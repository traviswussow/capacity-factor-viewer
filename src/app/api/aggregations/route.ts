import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { validateFilters, getSeasonMonths, getPrimeMoverCodes } from '@/lib/validation';

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

  const seasonMonths = getSeasonMonths(filters.season);
  const primeMoverCodes = getPrimeMoverCodes(filters.technology);

  try {
    // Get aggregated capacity factors
    const { data, error } = await supabase.rpc('get_capacity_factor_summary', {
      p_region: filters.region,
      p_fuel_type: filters.fuelType,
      p_year: filters.year,
      p_months: seasonMonths,
      p_prime_movers: primeMoverCodes,
    });

    if (error) {
      // If RPC doesn't exist, fall back to raw SQL
      if (error.code === 'PGRST202') {
        return await fallbackQuery(filters, seasonMonths, primeMoverCodes);
      }
      throw error;
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error('Aggregation query error:', error);
    return await fallbackQuery(filters, seasonMonths, primeMoverCodes);
  }
}

async function fallbackQuery(
  filters: ReturnType<typeof validateFilters>,
  seasonMonths: number[],
  primeMoverCodes: string[]
) {
  // Build the aggregation query manually
  const monthsArray = `{${seasonMonths.join(',')}}`;
  const primeMoverArray = `{${primeMoverCodes.map(c => `"${c}"`).join(',')}}`;

  // Summary stats query
  const { data: summaryData, error: summaryError } = await supabase
    .from('out_eia__monthly_generators')
    .select('capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code, associated_combined_heat_power, report_date')
    .eq('balancing_authority_code_eia', filters.region)
    .eq('fuel_type_code_pudl', filters.fuelType)
    .gte('report_date', `${filters.year}-01-01`)
    .lte('report_date', `${filters.year}-12-31`)
    .in('prime_mover_code', primeMoverCodes)
    .not('capacity_factor', 'is', null)
    .limit(50000); // Limit to avoid timeout

  if (summaryError) {
    console.error('Summary query error:', summaryError);
    return NextResponse.json({ error: 'Failed to fetch data' }, { status: 500 });
  }

  // Filter by season months
  const filteredData = summaryData?.filter(row => {
    // Assume report_date is in format YYYY-MM-DD
    const dateStr = row.report_date as unknown as string;
    if (!dateStr) return false;
    const month = new Date(dateStr).getMonth() + 1;
    return seasonMonths.includes(month);
  }) ?? [];

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
      trend: [],
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
  });
}
