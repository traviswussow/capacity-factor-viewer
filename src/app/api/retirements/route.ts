import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

// Mapping of GEM plant names to EIA plant names for matching
// This handles cases where names differ between sources
const GEM_TO_EIA_NAME_MAP: Record<string, string> = {
  'Gaston Steam Plant': 'E C Gaston',
  'Barry Steam Plant': 'Barry',
  'Miller Steam Plant': 'James H Miller Jr',
  'Plant Bowen': 'Bowen',
  'Scherer Steam Generating Station': 'Scherer',
  'Wansley Plant': 'Wansley',
  'Hammond Steam Generating Station': 'Hammond',
  'Cumberland Fossil Plant': 'Cumberland',
  'Paradise Fossil Plant': 'Paradise',
  'Bull Run Fossil Plant': 'Bull Run',
  'Kingston Fossil Plant': 'Kingston',
  'Gallatin Fossil Plant': 'Gallatin',
  'Gibson Generating Station': 'Gibson',
  'Cayuga Generating Station': 'Cayuga',
  'Baldwin Energy Complex': 'Baldwin Energy Station',
  'Newton Power Station': 'Newton',
  'Belle River Power Plant': 'Belle River',
  'Monroe Power Plant': 'Monroe',
  'Columbia Energy Center': 'Columbia',
  'Comanche Generating Station': 'Comanche',
  'Dave Johnston Power Plant': 'Dave Johnston',
  'Marshall Steam Station': 'Marshall',
  'Belews Creek Steam Station': 'Belews Creek',
  'Jeffrey Energy Center': 'Jeffrey Energy Ctr',
  'Ghent Generating Station': 'Ghent',
  'Mill Creek Generating Station': 'Mill Creek',
  'Sherburne County Generating Station': 'Sherburne County',
  'Sioux Energy Center': 'Sioux',
  'Four Corners Steam Plant': 'Four Corners',
  'Pleasants Power Station': 'Pleasants',
  'Naughton Power Plant': 'Naughton',
  'Elm Road Generating Station': 'Elm Road',
  'Petersburg Generating Station': 'Petersburg',
};

// Normalize plant name for fuzzy matching
function normalizePlantName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+(steam|plant|station|generating|power|energy|center|complex|fossil)\s*/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Create reverse map: EIA name -> GEM name
const EIA_TO_GEM_NAME_MAP: Record<string, string> = {};
for (const [gemName, eiaName] of Object.entries(GEM_TO_EIA_NAME_MAP)) {
  EIA_TO_GEM_NAME_MAP[eiaName] = gemName;
}

// Manual delay data from PDF analysis (Jan 2026)
// This supplements EIA/GEM data with confirmed delay information
interface ManualDelayEntry {
  name: string;
  state: string;
  operator: string;
  original_retirement_year: number;
  revised_retirement_year: number | null;
  delay_years: number | null;
  indefinite?: boolean;
  doe_202c?: boolean;
  capacity_mw: number;
  source: string;
  source_url?: string;
}

const MANUAL_DELAY_DATA: ManualDelayEntry[] = [
  { name: "Gaston Station", state: "AL", operator: "Alabama Power", original_retirement_year: 2028, revised_retirement_year: 2035, delay_years: 7, capacity_mw: 952, source: "AP News", source_url: "https://apnews.com/article/alabama-power-coal-plants-delay-retirement-c8b0e5a7d9f4" },
  { name: "Comanche", state: "CO", operator: "Xcel Energy", original_retirement_year: 2025, revised_retirement_year: 2026, delay_years: 1, capacity_mw: 335, source: "Utility Dive", source_url: "https://www.utilitydive.com/news/xcel-energy-colorado-coal-retirement-delay/703847/" },
  { name: "Craig", state: "CO", operator: "Tri-State G&T", original_retirement_year: 2025, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 427, source: "DeSmog", source_url: "https://www.desmog.com/2024/01/craig-coal-plant-colorado/" },
  { name: "Bowen", state: "GA", operator: "Georgia Power", original_retirement_year: 2027, revised_retirement_year: 2038, delay_years: 11, capacity_mw: 1440, source: "GPB", source_url: "https://www.gpb.org/news/2024/georgia-power-coal-plant-delays" },
  { name: "Scherer", state: "GA", operator: "Georgia Power", original_retirement_year: 2027, revised_retirement_year: 2038, delay_years: 11, capacity_mw: 860, source: "GPB", source_url: "https://www.gpb.org/news/2024/georgia-power-coal-plant-delays" },
  { name: "Cayuga", state: "IN", operator: "Duke Energy", original_retirement_year: 2026, revised_retirement_year: 2029, delay_years: 3, capacity_mw: 1062, source: "Duke IRP", source_url: "https://www.duke-energy.com/our-company/about-us/irp" },
  { name: "Gibson", state: "IN", operator: "Duke Energy", original_retirement_year: 2035, revised_retirement_year: 2038, delay_years: 3, capacity_mw: 3236, source: "Utility Dive", source_url: "https://www.utilitydive.com/news/duke-energy-indiana-coal-retirement-delay/712456/" },
  { name: "Merom", state: "IN", operator: "Hallador Power", original_retirement_year: 2023, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 980, source: "Hoosier Energy", source_url: "https://www.hoosierpublicmedia.org/environment/2023-merom-coal-plant" },
  { name: "Baldwin", state: "IL", operator: "Vistra", original_retirement_year: 2025, revised_retirement_year: 2027, delay_years: 2, capacity_mw: 1185, source: "PR Newswire", source_url: "https://www.prnewswire.com/news-releases/vistra-baldwin-coal-plant-2027.html" },
  { name: "Jeffrey", state: "KS", operator: "Evergy", original_retirement_year: 2030, revised_retirement_year: 2032, delay_years: 1, capacity_mw: 1337, source: "Evergy IRP", source_url: "https://www.evergy.com/company/about-evergy/regulatory" },
  { name: "Lawrence", state: "KS", operator: "Evergy", original_retirement_year: 2023, revised_retirement_year: 2028, delay_years: 5, capacity_mw: 486, source: "Kansas Reflector", source_url: "https://kansasreflector.com/2024/evergy-lawrence-coal-plant-delay/" },
  { name: "Mill Creek", state: "KY", operator: "LGE", original_retirement_year: 2027, revised_retirement_year: 2031, delay_years: 4, capacity_mw: 300, source: "Utility Dive", source_url: "https://www.utilitydive.com/news/lge-ku-kentucky-coal-retirement/698234/" },
  { name: "Ghent", state: "KY", operator: "LGE/KU", original_retirement_year: 2028, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 1200, source: "Utility Dive", source_url: "https://www.utilitydive.com/news/lge-ku-kentucky-coal-retirement/698234/" },
  { name: "Brandon Shores", state: "MD", operator: "Talen", original_retirement_year: 2025, revised_retirement_year: 2029, delay_years: 4, capacity_mw: 1289, source: "Power Engineering", source_url: "https://www.power-eng.com/coal/talen-brandon-shores-maryland-delay/" },
  { name: "Campbell", state: "MI", operator: "Consumers Energy", original_retirement_year: 2025, revised_retirement_year: null, delay_years: null, doe_202c: true, capacity_mw: 1446, source: "DOE Order", source_url: "https://www.energy.gov/oe/section-202c-emergency-orders" },
  { name: "Sherburne", state: "MN", operator: "Xcel Energy", original_retirement_year: 2023, revised_retirement_year: 2030, delay_years: 7, capacity_mw: 1360, source: "Power Mag", source_url: "https://www.powermag.com/xcel-sherburne-coal-minnesota-2030/" },
  { name: "Sioux", state: "MO", operator: "Ameren", original_retirement_year: 2028, revised_retirement_year: 2033, delay_years: 5, capacity_mw: 1100, source: "GEM Wiki", source_url: "https://www.gem.wiki/Sioux_Energy_Center" },
  { name: "Roxboro", state: "NC", operator: "Duke Energy", original_retirement_year: 2027, revised_retirement_year: 2034, delay_years: 7, capacity_mw: 1813, source: "Power Mag", source_url: "https://www.powermag.com/duke-energy-north-carolina-coal-delays/" },
  { name: "Marshall", state: "NC", operator: "Duke Energy", original_retirement_year: 2031, revised_retirement_year: 2033, delay_years: 2, capacity_mw: 1300, source: "WUNC", source_url: "https://www.wunc.org/environment/2024-duke-energy-coal-retirement-delay" },
  { name: "Belews Creek", state: "NC", operator: "Duke Energy", original_retirement_year: 2035, revised_retirement_year: 2040, delay_years: 5, capacity_mw: 1270, source: "WUNC", source_url: "https://www.wunc.org/environment/2024-duke-energy-coal-retirement-delay" },
  { name: "Coal Creek", state: "ND", operator: "Rainbow Energy", original_retirement_year: 2021, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 1150, source: "ND Governor", source_url: "https://www.governor.nd.gov/news/coal-creek-station" },
  { name: "Four Corners", state: "NM", operator: "APS", original_retirement_year: 2022, revised_retirement_year: 2031, delay_years: 9, capacity_mw: 1540, source: "Navajo Times", source_url: "https://navajotimes.com/four-corners-power-plant-2031/" },
  { name: "Winyah", state: "SC", operator: "Santee Cooper", original_retirement_year: 2027, revised_retirement_year: 2035, delay_years: 8, capacity_mw: 1260, source: "GEM Wiki", source_url: "https://www.gem.wiki/Winyah_Generating_Station" },
  { name: "Cumberland", state: "TN", operator: "TVA", original_retirement_year: 2027, revised_retirement_year: 2028, delay_years: 1, capacity_mw: 2500, source: "WKMS", source_url: "https://www.wkms.org/energy-environment/2024-tva-cumberland-coal-delay" },
  { name: "Fayette", state: "TX", operator: "City of Austin", original_retirement_year: 2022, revised_retirement_year: 2029, delay_years: 7, capacity_mw: 570, source: "Austin Chronicle", source_url: "https://www.austinchronicle.com/news/fayette-power-project-delay/" },
  { name: "Bonanza", state: "UT", operator: "Deseret G&T", original_retirement_year: 2030, revised_retirement_year: 2041, delay_years: 11, capacity_mw: 458, source: "GEM Wiki", source_url: "https://www.gem.wiki/Bonanza_Power_Plant" },
  { name: "Hunter", state: "UT", operator: "Rocky Mountain Power", original_retirement_year: 2032, revised_retirement_year: 2036, delay_years: 4, capacity_mw: 1577, source: "Utah News", source_url: "https://www.sltrib.com/news/environment/rocky-mountain-power-coal-delay/" },
  { name: "Huntington", state: "UT", operator: "Rocky Mountain Power", original_retirement_year: 2032, revised_retirement_year: 2046, delay_years: 14, capacity_mw: 1037, source: "Utah News", source_url: "https://www.sltrib.com/news/environment/rocky-mountain-power-coal-delay/" },
  { name: "Intermountain", state: "UT", operator: "IPA", original_retirement_year: 2025, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 1900, source: "Utah News", source_url: "https://www.sltrib.com/news/environment/intermountain-power-coal/" },
  { name: "Clover", state: "VA", operator: "Dominion Energy", original_retirement_year: 2025, revised_retirement_year: 2045, delay_years: 20, capacity_mw: 848, source: "GEM Wiki", source_url: "https://www.gem.wiki/Clover_Power_Station" },
  { name: "Centralia", state: "WA", operator: "TransAlta", original_retirement_year: 2025, revised_retirement_year: null, delay_years: null, doe_202c: true, capacity_mw: 730, source: "DOE Order", source_url: "https://www.energy.gov/oe/section-202c-emergency-orders" },
  { name: "Columbia", state: "WI", operator: "Alliant Energy", original_retirement_year: 2026, revised_retirement_year: 2029, delay_years: 3, capacity_mw: 1100, source: "Alliant Energy", source_url: "https://www.alliantenergy.com/cleanenergy/columbiaplant" },
  { name: "Pleasants", state: "WV", operator: "First Energy", original_retirement_year: 2018, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 1288, source: "IEEFA", source_url: "https://ieefa.org/resources/pleasants-power-station-west-virginia" },
  { name: "Dave Johnston", state: "WY", operator: "Rocky Mountain Power", original_retirement_year: 2028, revised_retirement_year: 2030, delay_years: 2, capacity_mw: 922, source: "PacifiCorp IRP", source_url: "https://www.pacificorp.com/energy/integrated-resource-plan.html" },
  { name: "Jim Bridger", state: "WY", operator: "PacifiCorp", original_retirement_year: 2022, revised_retirement_year: 2037, delay_years: 15, capacity_mw: 2441, source: "GEM Wiki", source_url: "https://www.gem.wiki/Jim_Bridger_Power_Plant" },
  { name: "Wyodak", state: "WY", operator: "PacifiCorp", original_retirement_year: 2036, revised_retirement_year: null, delay_years: null, indefinite: true, capacity_mw: 362, source: "DeSmog", source_url: "https://www.desmog.com/wyodak-coal-plant/" },
];

// Create lookup map for manual delay data
const manualDelayByPlantState = new Map<string, ManualDelayEntry>();
for (const entry of MANUAL_DELAY_DATA) {
  // Normalize name for matching
  const normalizedName = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
  manualDelayByPlantState.set(`${normalizedName}-${entry.state}`, entry);
}

function findManualDelay(plantName: string, state: string): ManualDelayEntry | undefined {
  const normalizedName = plantName.toLowerCase().replace(/[^a-z0-9]/g, '');

  // Try direct match
  let match = manualDelayByPlantState.get(`${normalizedName}-${state}`);
  if (match) return match;

  // Try partial match (for names like "E C Gaston" matching "Gaston")
  for (const [key, entry] of manualDelayByPlantState) {
    const entryNormalizedName = entry.name.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (key.endsWith(`-${state}`) && (normalizedName.includes(entryNormalizedName) || entryNormalizedName.includes(normalizedName))) {
      return entry;
    }
  }

  return undefined;
}

interface RetirementRecord {
  plant_id_eia: number | null;
  plant_name_eia: string;
  generator_id: string;
  state: string;
  county: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity_mw: number | null;
  fuel_type_code_pudl: string | null;
  operational_status: string;
  planned_generator_retirement_date: string | null;
  generator_retirement_date: string | null;
  extended: boolean;
  original_retirement_date: string | null;
  // Data source tracking
  data_sources: ('eia' | 'gem' | 'manual')[];
  // Separate date fields for comparison
  eia_retirement_date: string | null;
  gem_retirement_date: string | null;
  // Delay tracking
  delay_months: number | null;
  delay_years: number | null;
  original_planned_year: number | null;
  revised_planned_year: number | null;
  indefinite_delay: boolean;
  doe_202c_order: boolean;
  delay_source: string | null;
  delay_source_url: string | null;
  operator: string | null;
}

// Calculate delay in months between two dates
function calculateDelayMonths(earlierDate: string | null, laterDate: string | null): number | null {
  if (!earlierDate || !laterDate) return null;
  const earlier = new Date(earlierDate);
  const later = new Date(laterDate);
  if (later <= earlier) return null;
  const months = (later.getFullYear() - earlier.getFullYear()) * 12 + (later.getMonth() - earlier.getMonth());
  return months > 0 ? months : null;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const state = searchParams.get('state') || '';
  const fuelType = searchParams.get('fuelType') || '';
  const page = parseInt(searchParams.get('page') || '1');
  const limit = 100;
  const offset = (page - 1) * limit;

  try {
    // ========================================
    // STEP 1: Get EIA data (existing logic)
    // ========================================
    const { data: dateData } = await supabase
      .from('core_eia860__scd_generators')
      .select('report_date')
      .order('report_date', { ascending: false })
      .limit(1);

    const latestReportDate = dateData?.[0]?.report_date;

    // ========================================
    // STEP 2: Get GEM retirement data
    // ========================================
    let gemQuery = supabase
      .from('gem_retirement_data')
      .select('*')
      .not('planned_retirement_year', 'is', null)
      .order('planned_retirement_year', { ascending: true });

    if (state) {
      gemQuery = gemQuery.eq('state', state);
    }

    if (fuelType) {
      gemQuery = gemQuery.ilike('fuel_type', `%${fuelType}%`);
    }

    const { data: gemData, error: gemError } = await gemQuery;

    if (gemError) {
      console.error('GEM query error:', gemError);
    }

    // Create a map of GEM data by plant name + state for matching
    const gemByPlant = new Map<string, typeof gemData>();
    // Also create a normalized name map for fuzzy matching
    const gemByNormalizedName = new Map<string, string[]>(); // normalized -> [original keys]
    for (const gem of gemData || []) {
      const key = `${gem.plant_name}-${gem.state}`;
      if (!gemByPlant.has(key)) {
        gemByPlant.set(key, []);
      }
      gemByPlant.get(key)!.push(gem);

      // Add to normalized name map
      const normalizedKey = `${normalizePlantName(gem.plant_name)}-${gem.state}`;
      if (!gemByNormalizedName.has(normalizedKey)) {
        gemByNormalizedName.set(normalizedKey, []);
      }
      if (!gemByNormalizedName.get(normalizedKey)!.includes(key)) {
        gemByNormalizedName.get(normalizedKey)!.push(key);
      }
    }

    // ========================================
    // STEP 3: Get EIA generators (modified to include those without retirement dates)
    // ========================================
    const records: RetirementRecord[] = [];
    const seenGemPlants = new Set<string>();

    if (latestReportDate) {
      // Get EIA generators - now includes both with and without retirement dates
      // to allow GEM data to supplement
      let eiaQuery = supabase
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
        .is('generator_retirement_date', null)
        .in('fuel_type_code_pudl', ['coal', 'gas']); // Focus on coal/gas for retirement tracking

      if (fuelType) {
        eiaQuery = eiaQuery.eq('fuel_type_code_pudl', fuelType);
      }

      const { data: eiaGenerators } = await eiaQuery;

      if (eiaGenerators && eiaGenerators.length > 0) {
        const plantIds = [...new Set(eiaGenerators.map(g => g.plant_id_eia))];

        // Fetch plant data
        let plantQuery = supabase
          .from('core_eia__entity_plants')
          .select('plant_id_eia, plant_name_eia, state, county, city, latitude, longitude')
          .in('plant_id_eia', plantIds);

        if (state) {
          plantQuery = plantQuery.eq('state', state);
        }

        const { data: plants } = await plantQuery;
        const plantMap = new Map(plants?.map(p => [p.plant_id_eia, p]) || []);

        // Process EIA generators
        for (const gen of eiaGenerators) {
          const plant = plantMap.get(gen.plant_id_eia);
          if (!plant) continue;

          // Try to find matching GEM data
          let gemRetirementYear: number | null = null;
          let gemMatch: NonNullable<typeof gemData>[0] | null = null;

          // Try direct name match first
          const gemKey = `${plant.plant_name_eia}-${plant.state}`;
          let gemPlants = gemByPlant.get(gemKey);
          let matchedGemKey = gemKey;

          // Strategy 1: Direct name match
          if (!gemPlants) {
            // Strategy 2: Try reverse lookup from GEM name map
            for (const [gemName, eiaName] of Object.entries(GEM_TO_EIA_NAME_MAP)) {
              if (eiaName === plant.plant_name_eia) {
                const altKey = `${gemName}-${plant.state}`;
                gemPlants = gemByPlant.get(altKey);
                if (gemPlants) {
                  matchedGemKey = altKey;
                  break;
                }
              }
            }
          }

          // Strategy 3: Fuzzy match using normalized names
          if (!gemPlants) {
            const normalizedEiaKey = `${normalizePlantName(plant.plant_name_eia)}-${plant.state}`;
            const matchingGemKeys = gemByNormalizedName.get(normalizedEiaKey);
            if (matchingGemKeys && matchingGemKeys.length > 0) {
              matchedGemKey = matchingGemKeys[0];
              gemPlants = gemByPlant.get(matchedGemKey) || null;
            }
          }

          // Strategy 4: Partial match - check if EIA name is contained in GEM name or vice versa
          if (!gemPlants) {
            const normalizedEia = normalizePlantName(plant.plant_name_eia);
            for (const [key, plants] of gemByPlant) {
              const [gemName, gemState] = key.split('-');
              if (gemState !== plant.state) continue;
              const normalizedGem = normalizePlantName(gemName);
              if (normalizedEia.includes(normalizedGem) || normalizedGem.includes(normalizedEia)) {
                gemPlants = plants;
                matchedGemKey = key;
                break;
              }
            }
          }

          // If we found GEM data, extract the match
          if (gemPlants) {
            gemMatch = gemPlants.find(g =>
              g.unit_name.includes(gen.generator_id) ||
              gen.generator_id.includes(g.unit_name.replace(/[^0-9]/g, ''))
            ) || gemPlants[0];
            if (gemMatch) {
              gemRetirementYear = gemMatch.planned_retirement_year;
              seenGemPlants.add(matchedGemKey);
            }
          }

          // Track both EIA and GEM dates separately
          const eiaDate = gen.planned_generator_retirement_date;
          const gemDate = gemRetirementYear ? `${gemRetirementYear}-12-31` : null;

          // Build data sources array
          const dataSources: ('eia' | 'gem' | 'manual')[] = [];
          if (eiaDate) dataSources.push('eia');
          if (gemDate) dataSources.push('gem');

          // Use the most recent/latest date as the primary planned date
          // (typically delays push dates later)
          let retirementDate = eiaDate || gemDate;
          if (eiaDate && gemDate) {
            retirementDate = new Date(eiaDate) > new Date(gemDate) ? eiaDate : gemDate;
          }

          // Calculate delay if both dates exist
          const delayMonths = calculateDelayMonths(
            eiaDate && gemDate ? (new Date(eiaDate) < new Date(gemDate) ? eiaDate : gemDate) : null,
            eiaDate && gemDate ? (new Date(eiaDate) > new Date(gemDate) ? eiaDate : gemDate) : null
          );

          // Look up manual delay data
          const manualDelay = findManualDelay(plant.plant_name_eia, plant.state);

          // Use manual delay data if available for retirement date
          if (manualDelay) {
            dataSources.push('manual');
            if (manualDelay.revised_retirement_year) {
              retirementDate = `${manualDelay.revised_retirement_year}-12-31`;
            } else if (manualDelay.indefinite || manualDelay.doe_202c) {
              // Keep existing date or use original
              retirementDate = retirementDate || `${manualDelay.original_retirement_year}-12-31`;
            }
          }

          // Only include if has a retirement date from any source
          if (retirementDate || manualDelay) {
            records.push({
              plant_id_eia: gen.plant_id_eia,
              plant_name_eia: plant.plant_name_eia,
              generator_id: gen.generator_id,
              state: plant.state,
              county: plant.county,
              city: plant.city,
              latitude: plant.latitude,
              longitude: plant.longitude,
              capacity_mw: gen.capacity_mw,
              fuel_type_code_pudl: gen.fuel_type_code_pudl,
              operational_status: gen.operational_status,
              planned_generator_retirement_date: retirementDate || (manualDelay ? `${manualDelay.revised_retirement_year || manualDelay.original_retirement_year}-12-31` : null),
              generator_retirement_date: gen.generator_retirement_date,
              extended: (manualDelay?.delay_years ?? 0) > 0 || (delayMonths !== null && delayMonths > 0),
              original_retirement_date: manualDelay ? `${manualDelay.original_retirement_year}-12-31` : (delayMonths && eiaDate && gemDate ? (new Date(eiaDate) < new Date(gemDate) ? eiaDate : gemDate) : null),
              data_sources: dataSources,
              eia_retirement_date: eiaDate,
              gem_retirement_date: gemDate,
              delay_months: manualDelay?.delay_years ? manualDelay.delay_years * 12 : delayMonths,
              delay_years: manualDelay?.delay_years ?? (delayMonths ? Math.round(delayMonths / 12) : null),
              original_planned_year: manualDelay?.original_retirement_year ?? null,
              revised_planned_year: manualDelay?.revised_retirement_year ?? null,
              indefinite_delay: manualDelay?.indefinite ?? false,
              doe_202c_order: manualDelay?.doe_202c ?? false,
              delay_source: manualDelay?.source ?? null,
              delay_source_url: manualDelay?.source_url ?? null,
              operator: manualDelay?.operator ?? null,
            });
          }
        }
      }
    }

    // ========================================
    // STEP 4: Add GEM-only plants (not matched to EIA)
    // ========================================
    for (const [gemKey, gemUnits] of gemByPlant) {
      if (seenGemPlants.has(gemKey)) continue;

      for (const gem of gemUnits || []) {
        if (!gem.planned_retirement_year) continue;
        if (gem.status?.toLowerCase() === 'retired') continue;

        // Apply state filter
        if (state && gem.state !== state) continue;

        const gemDate = `${gem.planned_retirement_year}-12-31`;

        // Look up manual delay data for GEM-only plants
        const manualDelay = findManualDelay(gem.plant_name, gem.state);
        const dataSources: ('eia' | 'gem' | 'manual')[] = ['gem'];
        if (manualDelay) dataSources.push('manual');

        // Use manual delay date if available
        let retirementDate = gemDate;
        if (manualDelay?.revised_retirement_year) {
          retirementDate = `${manualDelay.revised_retirement_year}-12-31`;
        }

        records.push({
          plant_id_eia: null,
          plant_name_eia: gem.plant_name,
          generator_id: gem.unit_name,
          state: gem.state,
          county: gem.county,
          city: null,
          latitude: null,
          longitude: null,
          capacity_mw: gem.capacity_mw,
          fuel_type_code_pudl: gem.fuel_type?.toLowerCase() || null,
          operational_status: gem.status || 'operating',
          planned_generator_retirement_date: retirementDate,
          generator_retirement_date: null,
          extended: (manualDelay?.delay_years ?? 0) > 0,
          original_retirement_date: manualDelay ? `${manualDelay.original_retirement_year}-12-31` : null,
          data_sources: dataSources,
          eia_retirement_date: null,
          gem_retirement_date: gemDate,
          delay_months: manualDelay?.delay_years ? manualDelay.delay_years * 12 : null,
          delay_years: manualDelay?.delay_years ?? null,
          original_planned_year: manualDelay?.original_retirement_year ?? null,
          revised_planned_year: manualDelay?.revised_retirement_year ?? null,
          indefinite_delay: manualDelay?.indefinite ?? false,
          doe_202c_order: manualDelay?.doe_202c ?? false,
          delay_source: manualDelay?.source ?? null,
          delay_source_url: manualDelay?.source_url ?? null,
          operator: manualDelay?.operator ?? gem.owner,
        });
      }
    }

    // ========================================
    // STEP 5: Deduplicate records
    // ========================================
    // Create a map to identify duplicates by normalized plant name + state + generator
    const seenRecords = new Map<string, RetirementRecord>();
    for (const record of records) {
      const normalizedName = normalizePlantName(record.plant_name_eia);
      // Extract unit number from generator_id for matching
      const unitNum = record.generator_id.replace(/[^0-9]/g, '');
      const key = `${normalizedName}-${record.state}-${unitNum}`;

      const existing = seenRecords.get(key);
      if (!existing) {
        seenRecords.set(key, record);
      } else {
        // Prefer record with more data sources
        if (record.data_sources.length > existing.data_sources.length) {
          seenRecords.set(key, record);
        } else if (record.data_sources.length === existing.data_sources.length) {
          // Prefer EIA record over GEM-only
          if (record.plant_id_eia !== null && existing.plant_id_eia === null) {
            seenRecords.set(key, record);
          }
        }
      }
    }

    const deduplicatedRecords = Array.from(seenRecords.values());

    // ========================================
    // STEP 6: Sort and paginate
    // ========================================
    deduplicatedRecords.sort((a, b) => {
      const dateA = a.planned_generator_retirement_date || '9999-12-31';
      const dateB = b.planned_generator_retirement_date || '9999-12-31';
      return dateA.localeCompare(dateB);
    });

    const totalCount = deduplicatedRecords.length;
    const paginatedRecords = deduplicatedRecords.slice(offset, offset + limit);

    return NextResponse.json({
      data: paginatedRecords,
      pagination: {
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit)
      }
    });

  } catch (error) {
    console.error('Retirements API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
