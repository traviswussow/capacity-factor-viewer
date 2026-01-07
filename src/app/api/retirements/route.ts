import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const state = searchParams.get('state') || '';
  const fuelType = searchParams.get('fuelType') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 50;
  const offset = (page - 1) * limit;

  try {
    // First, get the most recent report_date (SCD table has historical snapshots)
    const { data: dateData } = await supabase
      .from('core_eia860__scd_generators')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1);

    const latestReportDate = dateData?.[0]?.report_date;
    if (!latestReportDate) {
      return NextResponse.json({ data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
    }

    // Only get generators with planned retirement that haven't retired yet
    // Filter by latest report_date to get current state only
    let query = supabase
      .from('core_eia860__scd_generators')
      .select(`
        plant_id_eia,
        generator_id,
        capacity_mw,
        fuel_type_code_pudl,
        operational_status,
        planned_generator_retirement_date,
        generator_retirement_date
      `)
      .eq('report_date', latestReportDate)
      .not('planned_generator_retirement_date', 'is', null)
      .is('generator_retirement_date', null)
      .order('planned_generator_retirement_date', { ascending: true });

    // Apply fuel type filter
    if (fuelType) {
      query = query.eq('fuel_type_code_pudl', fuelType);
    }

    // Get total count for pagination
    let countQuery = supabase
      .from('core_eia860__scd_generators')
      .select('*', { count: 'exact', head: true })
      .eq('report_date', latestReportDate)
      .not('planned_generator_retirement_date', 'is', null)
      .is('generator_retirement_date', null);

    if (fuelType) {
      countQuery = countQuery.eq('fuel_type_code_pudl', fuelType);
    }

    const { count: totalCount } = await countQuery;

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: generators, error: genError } = await query;

    if (genError) {
      console.error('Generators query error:', genError);
      return NextResponse.json({ error: 'Failed to fetch generators' }, { status: 500 });
    }

    if (!generators || generators.length === 0) {
      return NextResponse.json({
        data: [],
        pagination: { page, limit, total: 0, totalPages: 0 }
      });
    }

    // Get unique plant IDs
    const plantIds = [...new Set(generators.map(g => g.plant_id_eia))];

    // Fetch plant data
    let plantQuery = supabase
      .from('core_eia__entity_plants')
      .select('plant_id_eia, plant_name_eia, state, county, city, latitude, longitude')
      .in('plant_id_eia', plantIds);

    // Apply state filter
    if (state) {
      plantQuery = plantQuery.eq('state', state);
    }

    const { data: plants, error: plantError } = await plantQuery;

    if (plantError) {
      console.error('Plants query error:', plantError);
      return NextResponse.json({ error: 'Failed to fetch plants' }, { status: 500 });
    }

    // Create a map of plant data
    const plantMap = new Map(plants?.map(p => [p.plant_id_eia, p]) || []);

    // Join the data
    const records = generators
      .filter(g => plantMap.has(g.plant_id_eia))
      .map(g => {
        const plant = plantMap.get(g.plant_id_eia)!;
        return {
          plant_id_eia: g.plant_id_eia,
          plant_name_eia: plant.plant_name_eia,
          generator_id: g.generator_id,
          state: plant.state,
          county: plant.county,
          city: plant.city,
          latitude: plant.latitude,
          longitude: plant.longitude,
          capacity_mw: g.capacity_mw,
          fuel_type_code_pudl: g.fuel_type_code_pudl,
          operational_status: g.operational_status,
          planned_generator_retirement_date: g.planned_generator_retirement_date,
          generator_retirement_date: g.generator_retirement_date,
          extended: false, // Will be populated in v2 with changelog comparison
          original_retirement_date: null,
        };
      });

    // Filter by state if provided (in case plant wasn't in the filtered state)
    const filteredRecords = state
      ? records.filter(r => r.state === state)
      : records;

    return NextResponse.json({
      data: filteredRecords,
      pagination: {
        page,
        limit,
        total: totalCount || 0,
        totalPages: Math.ceil((totalCount || 0) / limit)
      }
    });

  } catch (error) {
    console.error('Retirements API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
