import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateFilters, getSeasonMonths, getPrimeMoverCodes } from '@/lib/validation';
import * as fs from 'fs';
import * as path from 'path';

// Define the current year threshold - years at or below this use static data
const CURRENT_YEAR = new Date().getFullYear();
const HISTORICAL_CUTOFF_YEAR = CURRENT_YEAR - 1; // e.g., 2025 for current year 2026

// Types for the static JSON data (EIA format)
interface EIASeasonData {
  avgCapacityFactor: number;
  totalGenerationTWh: number;
  dataPoints: number;
}

interface EIAData {
  generated: string;
  source: string;
  description: string;
  years: string;
  regions: {
    [region: string]: {
      [fuelType: string]: {
        [year: string]: {
          [season: string]: EIASeasonData;
        };
      };
    };
  };
}

// Cache for static data (loaded once per server restart)
let eiaDataCache: EIAData | null = null;

function loadEIAData(): EIAData | null {
  if (eiaDataCache) return eiaDataCache;

  try {
    const filePath = path.join(process.cwd(), 'public', 'data', 'capacity-factors.json');
    if (fs.existsSync(filePath)) {
      const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
      eiaDataCache = data;
      return data;
    }
  } catch (error) {
    console.error('Error loading EIA data:', error);
  }
  return null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  // Validate all parameters
  const filters = validateFilters({
    region: searchParams.get('region'),
    fuelType: searchParams.get('fuelType'),
    year: searchParams.get('year') ? parseInt(searchParams.get('year')!) : null,
    season: searchParams.get('season'),
    technology: searchParams.get('technology'),
  });

  // Try to load from EIA static data first (covers 2019-2024)
  const eiaData = loadEIAData();
  if (eiaData) {
    const result = getFromEIAData(eiaData, filters);
    if (result) {
      return NextResponse.json(result);
    }
  }

  // Fall back to live query (using yearly table to avoid timeout)
  const seasonMonths = getSeasonMonths(filters.season);
  const primeMoverCodes = getPrimeMoverCodes(filters.technology);

  try {
    // Try RPC first
    const { data, error } = await supabase.rpc('get_capacity_factor_summary', {
      p_region: filters.region,
      p_fuel_type: filters.fuelType,
      p_year: filters.year,
      p_months: seasonMonths,
      p_prime_movers: primeMoverCodes,
    });

    if (error) {
      if (error.code === 'PGRST202') {
        return await fallbackQuery(filters, primeMoverCodes);
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Aggregation query error:', error);
    return await fallbackQuery(filters, primeMoverCodes);
  }
}

function getFromEIAData(
  data: EIAData,
  filters: ReturnType<typeof validateFilters>
): { stats: { generatorCount: number; totalCapacityGW: number; avgCapacityFactor: number; weightedAvgCapacityFactor: number; medianCapacityFactor: number; totalGenerationTWh: number }; byTechnology: { technology: string; avgCapacityFactor: number; weightedAvgCapacityFactor: number; totalCapacityMW: number; count: number }[]; filters: typeof filters; source: string } | null {
  try {
    const regionData = data.regions[filters.region];
    if (!regionData) return null;

    const fuelData = regionData[filters.fuelType];
    if (!fuelData) return null;

    const yearData = fuelData[filters.year.toString()];
    if (!yearData) return null;

    const seasonData = yearData[filters.season];
    if (!seasonData) return null;

    // EIA data is aggregated - no technology breakdown available
    // Calculate approximate capacity from CF and generation: Cap = Gen / (CF * hours)
    const hoursInYear = 8760;
    const hoursInSeason = filters.season === 'annual' ? hoursInYear : hoursInYear / 4;
    const capacityGW = seasonData.avgCapacityFactor > 0
      ? (seasonData.totalGenerationTWh * 1000) / (seasonData.avgCapacityFactor * hoursInSeason)
      : 0;

    return {
      stats: {
        generatorCount: seasonData.dataPoints, // Number of months with data
        totalCapacityGW: capacityGW,
        avgCapacityFactor: seasonData.avgCapacityFactor,
        weightedAvgCapacityFactor: seasonData.avgCapacityFactor, // Same for aggregated data
        medianCapacityFactor: seasonData.avgCapacityFactor, // Approximation
        totalGenerationTWh: seasonData.totalGenerationTWh,
      },
      byTechnology: [], // Not available from EIA aggregated data
      filters,
      source: 'eia-static',
    };
  } catch (error) {
    console.error('Error reading EIA data:', error);
    return null;
  }
}

async function fallbackQuery(
  filters: ReturnType<typeof validateFilters>,
  primeMoverCodes: string[]
) {
  // Use yearly table (monthly table times out due to size)
  // Note: Yearly data doesn't support seasonal breakdown
  const { data: summaryData, error: summaryError } = await supabase
    .from('out_eia__yearly_generators')
    .select('capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code, associated_combined_heat_power, report_date')
    .eq('balancing_authority_code_eia', filters.region)
    .eq('fuel_type_code_pudl', filters.fuelType)
    .eq('report_date', `${filters.year}-01-01`)
    .in('prime_mover_code', primeMoverCodes)
    .not('capacity_factor', 'is', null)
    .limit(10000);

  if (summaryError) {
    console.error('Summary query error:', summaryError);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  const filteredData = summaryData ?? [];

  // Calculate statistics
  const totalRecords = filteredData.length;

  if (totalRecords === 0) {
    return NextResponse.json({
      stats: {
        generatorCount: 0,
        totalCapacityGW: 0,
        avgCapacityFactor: 0,
        weightedAvgCapacityFactor: 0,
        medianCapacityFactor: 0,
        totalGenerationTWh: 0,
      },
      byTechnology: [],
      filters,
      source: 'yearly-fallback',
    });
  }

  // Simple average
  const avgCF = filteredData.reduce((sum, r) => sum + (r.capacity_factor ?? 0), 0) / totalRecords;

  // Weighted average
  const totalCapacity = filteredData.reduce((sum, r) => sum + (r.capacity_mw ?? 0), 0);
  const weightedSum = filteredData.reduce((sum, r) => sum + (r.capacity_factor ?? 0) * (r.capacity_mw ?? 0), 0);
  const weightedAvgCF = totalCapacity > 0 ? weightedSum / totalCapacity : 0;

  // Median
  const sortedCFs = filteredData.map(r => r.capacity_factor ?? 0).sort((a, b) => a - b);
  const medianCF = sortedCFs.length > 0
    ? sortedCFs[Math.floor(sortedCFs.length / 2)]
    : 0;

  // Total generation
  const totalGeneration = filteredData.reduce((sum, r) => sum + (r.net_generation_mwh ?? 0), 0);

  // Unique generators (approximate by unique capacity values per prime mover)
  const uniqueGenerators = new Set(filteredData.map(r => `${r.prime_mover_code}-${r.capacity_mw}`)).size;

  // Group by technology
  const simpleCycleData = filteredData.filter(r => r.prime_mover_code === 'GT');
  const combinedCycleData = filteredData.filter(r => ['CT', 'CA', 'CC', 'CS'].includes(r.prime_mover_code));

  const calcTechStats = (data: typeof filteredData, name: string) => {
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

  const byTechnology = [
    calcTechStats(simpleCycleData, 'Simple Cycle (GT)'),
    calcTechStats(combinedCycleData, 'Combined Cycle'),
  ].filter(Boolean);

  return NextResponse.json({
    stats: {
      generatorCount: uniqueGenerators,
      totalCapacityGW: totalCapacity / 1000,
      avgCapacityFactor: avgCF,
      weightedAvgCapacityFactor: weightedAvgCF,
      medianCapacityFactor: medianCF,
      totalGenerationTWh: totalGeneration / 1000000,
    },
    byTechnology,
    filters,
    source: 'yearly-fallback',
  });
}
