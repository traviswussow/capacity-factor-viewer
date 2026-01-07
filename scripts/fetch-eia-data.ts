/**
 * Fetch Capacity Factor Data from EIA API
 *
 * Uses the EIA Open Data API to:
 * 1. Fetch daily generation by balancing authority and fuel type
 * 2. Aggregate to monthly/seasonal
 * 3. Calculate capacity factors
 * 4. Save to JSON for the app to use
 *
 * Usage: npm run fetch-eia-data
 */

import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const EIA_API_KEY = process.env.EIA_API_KEY;
const BASE_URL = 'https://api.eia.gov/v2';

if (!EIA_API_KEY) {
  console.error('Missing EIA_API_KEY in .env.local');
  process.exit(1);
}

// Regions we care about
const REGIONS = ['ERCO', 'MISO', 'PJM', 'CISO', 'SWPP', 'NYIS', 'ISNE'];

// EIA fuel type codes for generation data
const FUEL_TYPES: Record<string, string> = {
  'NG': 'gas',
  'COL': 'coal',
  'NUC': 'nuclear',
  'WND': 'wind',
  'SUN': 'solar',
  'WAT': 'hydro',
};

// Season definitions (meteorological)
const SEASONS = {
  winter: [12, 1, 2],
  spring: [3, 4, 5],
  summer: [6, 7, 8],
  fall: [9, 10, 11],
} as const;

// Years to fetch
const START_YEAR = 2019;
const END_YEAR = 2024;

interface DailyGeneration {
  period: string;  // YYYY-MM-DD
  respondent: string;
  fueltype: string;
  value: number;
}

interface SeasonalData {
  avgCapacityFactor: number;
  totalGenerationTWh: number;
  dataPoints: number;
}

async function fetchWithRetry(url: string, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  Retry ${i + 1}/${retries}...`);
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}

async function fetchDailyGeneration(
  region: string,
  fuelType: string,
  startDate: string,
  endDate: string
): Promise<DailyGeneration[]> {
  const allData: DailyGeneration[] = [];
  let offset = 0;
  const limit = 5000;

  while (true) {
    // Filter by Central timezone to avoid duplicate records (API returns one per timezone)
    const url = `${BASE_URL}/electricity/rto/daily-fuel-type-data/data/?api_key=${EIA_API_KEY}` +
      `&facets[respondent][]=${region}` +
      `&facets[fueltype][]=${fuelType}` +
      `&facets[timezone][]=Central` +
      `&start=${startDate}` +
      `&end=${endDate}` +
      `&frequency=daily` +
      `&data[]=value` +
      `&sort[0][column]=period&sort[0][direction]=asc` +
      `&offset=${offset}&length=${limit}`;

    const response = await fetchWithRetry(url);

    if (!response.response?.data || response.response.data.length === 0) {
      break;
    }

    for (const record of response.response.data) {
      if (record.value !== null && record.value !== undefined) {
        allData.push({
          period: record.period,
          respondent: record.respondent,
          fueltype: record.fueltype,
          value: parseFloat(record.value),
        });
      }
    }

    if (response.response.data.length < limit) {
      break;
    }

    offset += limit;
  }

  return allData;
}

async function fetchCapacityForRegionFuel(
  region: string,
  fuelCodes: string[],
  startDate: string,
  endDate: string
): Promise<Map<string, number>> {
  // Returns Map of YYYY-MM -> total capacity in MW
  const capacityByMonth: Map<string, number> = new Map();
  let offset = 0;
  const limit = 5000;

  // Build facet query for multiple fuel codes
  const fuelFacets = fuelCodes.map(c => `&facets[energy_source_code][]=${c}`).join('');

  while (true) {
    const url = `${BASE_URL}/electricity/operating-generator-capacity/data/?api_key=${EIA_API_KEY}` +
      `&facets[balancing_authority_code][]=${region}` +
      fuelFacets +
      `&start=${startDate}` +
      `&end=${endDate}` +
      `&frequency=monthly` +
      `&data[]=nameplate-capacity-mw` +
      `&sort[0][column]=period&sort[0][direction]=asc` +
      `&offset=${offset}&length=${limit}`;

    const response = await fetchWithRetry(url);

    if (!response.response?.data || response.response.data.length === 0) {
      break;
    }

    for (const record of response.response.data) {
      const period = record.period; // YYYY-MM
      const capacity = parseFloat(record['nameplate-capacity-mw'] || 0);
      if (capacity > 0) {
        capacityByMonth.set(period, (capacityByMonth.get(period) || 0) + capacity);
      }
    }

    if (response.response.data.length < limit) {
      break;
    }

    offset += limit;
  }

  return capacityByMonth;
}

// Map our fuel types to EIA capacity fuel codes (some need multiple codes aggregated)
const CAPACITY_FUEL_CODES: Record<string, string[]> = {
  'NG': ['NG'],
  'COL': ['BIT', 'SUB', 'LIG', 'WC', 'RC'],  // All coal types
  'NUC': ['NUC'],
  'WND': ['WND'],
  'SUN': ['SUN'],
  'WAT': ['WAT'],
};

function aggregateToSeasons(
  dailyGen: DailyGeneration[],
  capacityByMonth: Map<string, number>
): Record<number, Record<string, SeasonalData>> {
  const result: Record<number, Record<string, SeasonalData>> = {};

  // Group daily generation by month
  const genByMonth: Map<string, number> = new Map();
  for (const record of dailyGen) {
    const month = record.period.substring(0, 7); // YYYY-MM
    genByMonth.set(month, (genByMonth.get(month) || 0) + record.value);
  }

  for (let year = START_YEAR; year <= END_YEAR; year++) {
    result[year] = {};

    // Annual calculation
    let annualGen = 0;
    let annualHours = 0;
    let annualCapacitySum = 0;
    let annualMonths = 0;

    for (let month = 1; month <= 12; month++) {
      const monthKey = `${year}-${month.toString().padStart(2, '0')}`;
      const gen = genByMonth.get(monthKey) || 0;
      const cap = capacityByMonth.get(monthKey) || 0;
      const daysInMonth = new Date(year, month, 0).getDate();

      if (gen > 0) {
        annualGen += gen;
        annualHours += daysInMonth * 24;
        annualCapacitySum += cap;
        annualMonths++;
      }
    }

    const avgAnnualCapacity = annualMonths > 0 ? annualCapacitySum / annualMonths : 0;
    const annualCF = (avgAnnualCapacity > 0 && annualHours > 0)
      ? annualGen / (avgAnnualCapacity * annualHours)
      : 0;

    result[year]['annual'] = {
      avgCapacityFactor: Math.min(annualCF, 1), // Cap at 100%
      totalGenerationTWh: annualGen / 1000000,
      dataPoints: annualMonths,
    };

    // Seasonal calculations
    for (const [season, months] of Object.entries(SEASONS)) {
      let seasonGen = 0;
      let seasonHours = 0;
      let seasonCapacitySum = 0;
      let seasonMonthCount = 0;

      for (const month of months) {
        // For winter, Dec belongs to the previous year's winter
        const actualYear = (season === 'winter' && month === 12) ? year - 1 : year;
        const monthKey = `${actualYear}-${month.toString().padStart(2, '0')}`;
        const gen = genByMonth.get(monthKey) || 0;
        const cap = capacityByMonth.get(monthKey) || 0;
        const daysInMonth = new Date(actualYear, month, 0).getDate();

        if (gen > 0) {
          seasonGen += gen;
          seasonHours += daysInMonth * 24;
          seasonCapacitySum += cap;
          seasonMonthCount++;
        }
      }

      const avgSeasonCapacity = seasonMonthCount > 0 ? seasonCapacitySum / seasonMonthCount : 0;
      const seasonCF = (avgSeasonCapacity > 0 && seasonHours > 0)
        ? seasonGen / (avgSeasonCapacity * seasonHours)
        : 0;

      result[year][season] = {
        avgCapacityFactor: Math.min(seasonCF, 1),
        totalGenerationTWh: seasonGen / 1000000,
        dataPoints: seasonMonthCount,
      };
    }
  }

  return result;
}

async function main() {
  console.log('Fetching capacity factor data from EIA API...\n');
  console.log(`Date range: ${START_YEAR} to ${END_YEAR}`);
  console.log(`Regions: ${REGIONS.join(', ')}`);
  console.log(`Fuel types: ${Object.values(FUEL_TYPES).join(', ')}\n`);

  const outputData: Record<string, Record<string, Record<number, Record<string, SeasonalData>>>> = {};

  const startDate = `${START_YEAR}-01-01`;
  const endDate = `${END_YEAR}-12-31`;
  const capacityStartDate = `${START_YEAR}-01`;
  const capacityEndDate = `${END_YEAR}-12`;

  for (const region of REGIONS) {
    console.log(`\nRegion: ${region}`);
    outputData[region] = {};

    for (const [eiaFuel, ourFuel] of Object.entries(FUEL_TYPES)) {
      process.stdout.write(`  ${ourFuel}: `);

      // Fetch daily generation
      const dailyGen = await fetchDailyGeneration(region, eiaFuel, startDate, endDate);

      if (dailyGen.length === 0) {
        console.log('no generation data');
        outputData[region][ourFuel] = {};
        continue;
      }

      // Fetch capacity (using mapped fuel codes)
      const capacityCodes = CAPACITY_FUEL_CODES[eiaFuel] || [eiaFuel];
      const capacityByMonth = await fetchCapacityForRegionFuel(
        region,
        capacityCodes,
        capacityStartDate,
        capacityEndDate
      );

      // Calculate seasonal capacity factors
      const seasonalData = aggregateToSeasons(dailyGen, capacityByMonth);
      outputData[region][ourFuel] = seasonalData;

      // Show a sample capacity factor
      const sample2024 = seasonalData[2024]?.annual?.avgCapacityFactor;
      console.log(`${dailyGen.length} days, CF(2024)=${sample2024 ? (sample2024 * 100).toFixed(1) + '%' : 'N/A'}`);

      // Rate limiting
      await new Promise(r => setTimeout(r, 300));
    }
  }

  // Write output
  const output = {
    generated: new Date().toISOString(),
    source: 'EIA Open Data API',
    description: 'Seasonal capacity factors by region and fuel type',
    years: `${START_YEAR}-${END_YEAR}`,
    regions: outputData,
  };

  const outputPath = path.join(__dirname, '..', 'public', 'data', 'capacity-factors.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

  console.log(`\nDone! Output: ${outputPath}`);
  console.log(`File size: ${(fs.statSync(outputPath).size / 1024).toFixed(1)} KB`);
}

main().catch(console.error);
