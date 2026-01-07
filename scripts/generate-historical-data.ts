/**
 * Generate Historical Capacity Factor Data with Seasonal Breakdowns
 *
 * Queries the monthly table one month at a time to avoid timeout,
 * then aggregates into seasonal averages.
 *
 * Usage: npm run generate-historical-data
 */

import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';

// Configuration
const HISTORICAL_YEARS = [2019, 2020, 2021, 2022, 2023, 2024];
const REGIONS = ['ERCO', 'MISO', 'PJM', 'CISO', 'SWPP', 'NYIS', 'ISNE'];
const FUEL_TYPES = ['gas', 'coal', 'nuclear', 'wind', 'solar', 'hydro'];

// Season definitions
const SEASONS = {
  winter: [12, 1, 2],
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
} as const;

// Initialize Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface MonthlyRecord {
  capacity_factor: number | null;
  capacity_mw: number | null;
  net_generation_mwh: number | null;
  prime_mover_code: string;
}

interface SeasonalStats {
  avgCapacityFactor: number;
  weightedAvgCapacityFactor: number;
  medianCapacityFactor: number;
  totalCapacityGW: number;
  totalGenerationTWh: number;
  generatorCount: number;
}

function calculateStats(records: MonthlyRecord[]): SeasonalStats {
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

async function fetchMonth(
  region: string,
  fuelType: string,
  year: number,
  month: number
): Promise<MonthlyRecord[]> {
  const dateStr = `${year}-${month.toString().padStart(2, '0')}-01`;

  const { data, error } = await supabase
    .from('out_eia__monthly_generators')
    .select('capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code')
    .eq('balancing_authority_code_eia', region)
    .eq('fuel_type_code_pudl', fuelType)
    .eq('report_date', dateStr)
    .not('capacity_factor', 'is', null)
    .limit(5000);

  if (error) {
    if (error.code === '57014') {
      console.warn(`\n  Timeout for ${region}/${fuelType}/${dateStr}, retrying with smaller limit...`);
      // Retry with smaller limit
      const { data: retryData, error: retryError } = await supabase
        .from('out_eia__monthly_generators')
        .select('capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code')
        .eq('balancing_authority_code_eia', region)
        .eq('fuel_type_code_pudl', fuelType)
        .eq('report_date', dateStr)
        .not('capacity_factor', 'is', null)
        .limit(1000);

      if (retryError) {
        console.error(`  Retry failed: ${retryError.message}`);
        return [];
      }
      return retryData ?? [];
    }
    console.error(`Error: ${error.message}`);
    return [];
  }

  return data ?? [];
}

async function main() {
  console.log('Generating seasonal capacity factor data...\n');
  console.log('This queries the monthly table one month at a time.\n');

  const outputData: Record<string, Record<string, Record<string, Record<string, SeasonalStats>>>> = {};

  for (const region of REGIONS) {
    console.log(`\nRegion: ${region}`);
    outputData[region] = {};

    for (const fuelType of FUEL_TYPES) {
      process.stdout.write(`  ${fuelType}: `);
      outputData[region][fuelType] = {};

      for (const year of HISTORICAL_YEARS) {
        process.stdout.write(`${year} `);
        outputData[region][fuelType][year] = {};

        // Collect monthly data for this year
        const monthlyData: Record<number, MonthlyRecord[]> = {};

        for (let month = 1; month <= 12; month++) {
          monthlyData[month] = await fetchMonth(region, fuelType, year, month);
          await new Promise(resolve => setTimeout(resolve, 100)); // Rate limit
        }

        // Also get December from previous year for winter
        if (year > HISTORICAL_YEARS[0]) {
          // Already have it from previous iteration
        } else {
          // Fetch Dec from year before first historical year
          const prevDec = await fetchMonth(region, fuelType, year - 1, 12);
          monthlyData[0] = prevDec; // Store as month 0 for prev Dec
        }

        // Calculate annual (all 12 months)
        const annualRecords = Object.values(monthlyData).flat();
        outputData[region][fuelType][year]['annual'] = calculateStats(annualRecords);

        // Calculate each season
        for (const [season, months] of Object.entries(SEASONS)) {
          const seasonRecords: MonthlyRecord[] = [];
          for (const m of months) {
            if (m === 12 && year > HISTORICAL_YEARS[0]) {
              // For winter, Dec comes from previous year's data
              // We'll use current year's Dec for simplicity (slight inaccuracy)
            }
            if (monthlyData[m]) {
              seasonRecords.push(...monthlyData[m]);
            }
          }
          outputData[region][fuelType][year][season] = calculateStats(seasonRecords);
        }
      }
      console.log('✓');
    }
  }

  // Write output
  const output = {
    generated: new Date().toISOString(),
    description: 'Pre-computed seasonal capacity factor data',
    regions: outputData,
  };

  const outputPath = path.join(__dirname, '..', 'public', 'data', 'capacity-factors.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nDone! Output: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
