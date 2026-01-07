/**
 * Refresh Current Year Capacity Factor Data
 *
 * This script fetches current-year seasonal capacity factor data using chunked
 * queries to the monthly table to avoid statement timeouts. Run this quarterly
 * to keep current-year data fresh.
 *
 * Usage: npx ts-node scripts/refresh-current-year.ts
 * Or: npm run refresh-current-year
 *
 * The output is stored in public/data/capacity-factors-current.json
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Configuration
const CURRENT_YEAR = new Date().getFullYear();
const REGIONS = ['ERCO', 'MISO', 'PJM', 'CISO', 'SWPP', 'NYIS', 'ISNE'];
const FUEL_TYPES = ['gas', 'coal', 'nuclear', 'wind', 'solar', 'hydro'];
const TECHNOLOGIES = ['all', 'simple_cycle', 'combined_cycle'];

// Season definitions with their months
const SEASONS = {
  winter: { months: [12, 1, 2], label: 'Winter (Dec-Feb)' },
  spring: { months: [3, 4, 5], label: 'Spring (Mar-May)' },
  summer: { months: [6, 7, 8], label: 'Summer (Jun-Aug)' },
  fall: { months: [9, 10, 11], label: 'Fall (Sep-Nov)' },
  annual: { months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], label: 'Annual' },
} as const;

const SIMPLE_CYCLE_CODES = ['GT'];
const COMBINED_CYCLE_CODES = ['CT', 'CA', 'CC', 'CS'];

// Types
interface SeasonalStats {
  avgCapacityFactor: number;
  weightedAvgCapacityFactor: number;
  medianCapacityFactor: number;
  totalCapacityGW: number;
  totalGenerationTWh: number;
  generatorCount: number;
}

interface TechnologyBreakdown {
  technology: string;
  avgCapacityFactor: number;
  weightedAvgCapacityFactor: number;
  totalCapacityMW: number;
  count: number;
}

interface SeasonData {
  stats: SeasonalStats;
  byTechnology: TechnologyBreakdown[];
}

interface TechnologyData {
  [season: string]: SeasonData;
}

interface FuelTypeData {
  [technology: string]: TechnologyData;
}

interface RegionData {
  [fuelType: string]: FuelTypeData;
}

interface CurrentYearData {
  generated: string;
  year: number;
  dataVersion: string;
  lastRefresh: string;
  regions: {
    [region: string]: RegionData;
  };
}

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  console.error('Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function getPrimeMoverCodes(technology: string): string[] {
  switch (technology) {
    case 'simple_cycle':
      return [...SIMPLE_CYCLE_CODES];
    case 'combined_cycle':
      return [...COMBINED_CYCLE_CODES];
    case 'all':
    default:
      return [...SIMPLE_CYCLE_CODES, ...COMBINED_CYCLE_CODES];
  }
}

function calculateStats(records: Array<{
  capacity_factor: number | null;
  capacity_mw: number | null;
  net_generation_mwh: number | null;
  prime_mover_code: string;
}>): SeasonalStats {
  if (records.length === 0) {
    return {
      avgCapacityFactor: 0,
      weightedAvgCapacityFactor: 0,
      medianCapacityFactor: 0,
      totalCapacityGW: 0,
      totalGenerationTWh: 0,
      generatorCount: 0,
    };
  }

  const avgCF = records.reduce((sum, r) => sum + (r.capacity_factor ?? 0), 0) / records.length;

  const totalCapacity = records.reduce((sum, r) => sum + (r.capacity_mw ?? 0), 0);
  const weightedSum = records.reduce((sum, r) => sum + (r.capacity_factor ?? 0) * (r.capacity_mw ?? 0), 0);
  const weightedAvgCF = totalCapacity > 0 ? weightedSum / totalCapacity : 0;

  const sortedCFs = records.map(r => r.capacity_factor ?? 0).sort((a, b) => a - b);
  const medianCF = sortedCFs[Math.floor(sortedCFs.length / 2)];

  const totalGeneration = records.reduce((sum, r) => sum + (r.net_generation_mwh ?? 0), 0);

  const uniqueGenerators = new Set(records.map(r => `${r.prime_mover_code}-${r.capacity_mw}`)).size;

  return {
    avgCapacityFactor: avgCF,
    weightedAvgCapacityFactor: weightedAvgCF,
    medianCapacityFactor: medianCF,
    totalCapacityGW: totalCapacity / 1000,
    totalGenerationTWh: totalGeneration / 1000000,
    generatorCount: uniqueGenerators,
  };
}

function calculateTechnologyBreakdown(records: Array<{
  capacity_factor: number | null;
  capacity_mw: number | null;
  prime_mover_code: string;
}>): TechnologyBreakdown[] {
  const simpleCycleData = records.filter(r => SIMPLE_CYCLE_CODES.includes(r.prime_mover_code));
  const combinedCycleData = records.filter(r => COMBINED_CYCLE_CODES.includes(r.prime_mover_code));

  const calcTechStats = (data: typeof records, name: string): TechnologyBreakdown | null => {
    if (data.length === 0) return null;
    const cap = data.reduce((sum, r) => sum + (r.capacity_mw ?? 0), 0);
    const wSum = data.reduce((sum, r) => sum + (r.capacity_factor ?? 0) * (r.capacity_mw ?? 0), 0);
    return {
      technology: name,
      avgCapacityFactor: data.reduce((sum, r) => sum + (r.capacity_factor ?? 0), 0) / data.length,
      weightedAvgCapacityFactor: cap > 0 ? wSum / cap : 0,
      totalCapacityMW: cap,
      count: data.length,
    };
  };

  return [
    calcTechStats(simpleCycleData, 'Simple Cycle (GT)'),
    calcTechStats(combinedCycleData, 'Combined Cycle'),
  ].filter((t): t is TechnologyBreakdown => t !== null);
}

/**
 * Fetch monthly data for a specific region, fuel type, and month range
 * Uses smaller chunks to avoid timeout
 */
async function fetchMonthlyDataChunked(
  region: string,
  fuelType: string,
  year: number,
  months: readonly number[],
  primeMoverCodes: string[]
): Promise<Array<{
  capacity_factor: number | null;
  capacity_mw: number | null;
  net_generation_mwh: number | null;
  prime_mover_code: string;
}>> {
  const allRecords: Array<{
    capacity_factor: number | null;
    capacity_mw: number | null;
    net_generation_mwh: number | null;
    prime_mover_code: string;
  }> = [];

  // Query each month separately to avoid timeout
  for (const month of months) {
    // For winter season, December is from previous year
    const queryYear = (month === 12 && months.includes(1)) ? year - 1 : year;
    const dateStr = `${queryYear}-${month.toString().padStart(2, '0')}-01`;

    try {
      const { data, error } = await supabase
        .from('out_eia__monthly_generators')
        .select('capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code')
        .eq('balancing_authority_code_eia', region)
        .eq('fuel_type_code_pudl', fuelType)
        .eq('report_date', dateStr)
        .in('prime_mover_code', primeMoverCodes)
        .not('capacity_factor', 'is', null)
        .limit(5000);

      if (error) {
        // If monthly table times out, fall back to yearly
        if (error.code === '57014') {
          console.warn(`\n  Warning: Monthly query timed out for ${region}/${fuelType}/${dateStr}, using yearly fallback`);
          return await fetchYearlyFallback(region, fuelType, year, primeMoverCodes);
        }
        console.error(`Error fetching ${region}/${fuelType}/${dateStr}:`, error.message);
        continue;
      }

      if (data) {
        allRecords.push(...data);
      }
    } catch (err) {
      console.error(`Exception fetching ${region}/${fuelType}/${dateStr}:`, err);
    }

    // Small delay between queries
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return allRecords;
}

/**
 * Fallback to yearly table if monthly queries fail
 */
async function fetchYearlyFallback(
  region: string,
  fuelType: string,
  year: number,
  primeMoverCodes: string[]
): Promise<Array<{
  capacity_factor: number | null;
  capacity_mw: number | null;
  net_generation_mwh: number | null;
  prime_mover_code: string;
}>> {
  const { data, error } = await supabase
    .from('out_eia__yearly_generators')
    .select('capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code')
    .eq('balancing_authority_code_eia', region)
    .eq('fuel_type_code_pudl', fuelType)
    .eq('report_date', `${year}-01-01`)
    .in('prime_mover_code', primeMoverCodes)
    .not('capacity_factor', 'is', null)
    .limit(10000);

  if (error) {
    console.error(`Error in yearly fallback for ${region}/${fuelType}/${year}:`, error.message);
    return [];
  }

  return data ?? [];
}

async function main() {
  console.log(`Starting current year (${CURRENT_YEAR}) data refresh...\n`);

  const outputData: CurrentYearData = {
    generated: new Date().toISOString(),
    year: CURRENT_YEAR,
    dataVersion: '1.0.0',
    lastRefresh: new Date().toISOString(),
    regions: {},
  };

  let totalCombinations = 0;
  let completedCombinations = 0;

  // Count total combinations
  for (const region of REGIONS) {
    for (const fuelType of FUEL_TYPES) {
      for (const technology of TECHNOLOGIES) {
        for (const seasonKey of Object.keys(SEASONS)) {
          totalCombinations++;
        }
      }
    }
  }

  for (const region of REGIONS) {
    console.log(`Processing region: ${region}`);
    outputData.regions[region] = {};

    for (const fuelType of FUEL_TYPES) {
      outputData.regions[region][fuelType] = {};

      for (const technology of TECHNOLOGIES) {
        const primeMoverCodes = getPrimeMoverCodes(technology);
        outputData.regions[region][fuelType][technology] = {};

        for (const [seasonKey, seasonConfig] of Object.entries(SEASONS)) {
          completedCombinations++;
          process.stdout.write(`\r  Progress: ${completedCombinations}/${totalCombinations} (${Math.round(completedCombinations/totalCombinations*100)}%)`);

          const records = await fetchMonthlyDataChunked(
            region,
            fuelType,
            CURRENT_YEAR,
            seasonConfig.months,
            primeMoverCodes
          );

          outputData.regions[region][fuelType][technology][seasonKey] = {
            stats: calculateStats(records),
            byTechnology: calculateTechnologyBreakdown(records),
          };
        }
      }
    }
    console.log(''); // New line after progress
  }

  // Write output file
  const outputPath = path.join(__dirname, '..', 'public', 'data', 'capacity-factors-current.json');
  fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2));

  console.log(`\nCurrent year data refreshed successfully!`);
  console.log(`Year: ${CURRENT_YEAR}`);
  console.log(`Output: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
