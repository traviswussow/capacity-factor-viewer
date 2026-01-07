/**
 * GEM Wiki Page Parser
 *
 * Parses locally downloaded GEM wiki pages to extract coal plant retirement data.
 * Run download-pages.ts first to fetch the pages.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/gem-scraper/parse-pages.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const INPUT_DIR = path.join(__dirname, 'downloaded-pages');
const OUTPUT_DIR = path.join(__dirname, '../../public/data');

interface GemUnit {
  plant_name: string;
  plant_slug: string;
  unit_name: string;
  status: string;
  fuel_type: string;
  capacity_mw: number | null;
  technology: string | null;
  start_year: number | null;
  planned_retirement_year: number | null;
  retired_year: number | null;
  state: string | null;
  county: string | null;
  owner: string | null;
  parent_company: string | null;
}

interface ParsedPlant {
  name: string;
  slug: string;
  state: string | null;
  county: string | null;
  total_capacity_mw: number;
  units: GemUnit[];
}

// US State name to abbreviation mapping
const STATE_ABBREV: Record<string, string> = {
  'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
  'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
  'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
  'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
  'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
  'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
  'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
  'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
  'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
  'Wisconsin': 'WI', 'Wyoming': 'WY',
};

function extractLocation(html: string): { state: string | null; county: string | null } {
  // Look for patterns like "in City, County, State" or "City, State, United States"
  // The page typically has format: "is an operating power station of at least X-megawatts (MW) in City, County, State"

  // Pattern 1: City, County, State, United States
  const pattern1 = /in\s+([\w\s]+),\s+([\w\s]+),\s+([\w\s]+),\s*(?:United States|USA)/i;
  let match = html.match(pattern1);
  if (match) {
    const stateAbbrev = STATE_ABBREV[match[3].trim()];
    if (stateAbbrev) {
      return { state: stateAbbrev, county: match[2].trim() };
    }
  }

  // Pattern 2: City, State (no county)
  const pattern2 = /in\s+([\w\s]+),\s+(Alabama|Alaska|Arizona|Arkansas|California|Colorado|Connecticut|Delaware|Florida|Georgia|Hawaii|Idaho|Illinois|Indiana|Iowa|Kansas|Kentucky|Louisiana|Maine|Maryland|Massachusetts|Michigan|Minnesota|Mississippi|Missouri|Montana|Nebraska|Nevada|New Hampshire|New Jersey|New Mexico|New York|North Carolina|North Dakota|Ohio|Oklahoma|Oregon|Pennsylvania|Rhode Island|South Carolina|South Dakota|Tennessee|Texas|Utah|Vermont|Virginia|Washington|West Virginia|Wisconsin|Wyoming)/i;
  match = html.match(pattern2);
  if (match) {
    return { state: STATE_ABBREV[match[2]] || null, county: null };
  }

  return { state: null, county: null };
}

function extractPlantName(html: string, filename: string): string {
  // Try to get from title tag
  const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
  if (titleMatch) {
    return titleMatch[1].replace(' - Global Energy Monitor', '').trim();
  }

  // Fall back to filename
  return filename.replace('.html', '').replace(/_/g, ' ');
}

function parseCapacity(text: string): number | null {
  // Handle formats like "272", "952.5", "1,300"
  const cleaned = text.replace(/,/g, '').trim();
  const match = cleaned.match(/([\d.]+)/);
  if (match) {
    const val = parseFloat(match[1]);
    return isNaN(val) ? null : val;
  }
  return null;
}

function parseYear(text: string): { year: number | null; isPlanned: boolean } {
  if (!text || text.trim() === '' || text === '—' || text === '-') {
    return { year: null, isPlanned: false };
  }

  const isPlanned = text.toLowerCase().includes('planned') ||
                    text.toLowerCase().includes('proposed') ||
                    text.toLowerCase().includes('expected');

  const yearMatch = text.match(/(\d{4})/);
  const year = yearMatch ? parseInt(yearMatch[1], 10) : null;

  return { year, isPlanned };
}

function parseUnitsTable(html: string, plantName: string, plantSlug: string, location: { state: string | null; county: string | null }): GemUnit[] {
  const units: GemUnit[] = [];

  // Find all wikitables
  const tableRegex = /<table[^>]*class="[^"]*wikitable[^"]*"[^>]*>([\s\S]*?)<\/table>/gi;
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableHtml = tableMatch[0];

    // Check if this is a unit details table (has capacity/MW column)
    const hasCapacity = /capacity|mw\b/i.test(tableHtml);
    const hasUnitColumn = /unit\s*(name)?/i.test(tableHtml);

    if (!hasCapacity || !hasUnitColumn) continue;

    // Parse rows
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    const rows: string[] = [];
    let rowMatch;

    while ((rowMatch = rowRegex.exec(tableHtml)) !== null) {
      rows.push(rowMatch[0]);
    }

    if (rows.length < 2) continue;

    // Parse header row
    const headerRow = rows[0];
    const headerCellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
    const headers: string[] = [];
    let headerCellMatch;

    while ((headerCellMatch = headerCellRegex.exec(headerRow)) !== null) {
      const text = headerCellMatch[1].replace(/<[^>]+>/g, '').trim().toLowerCase();
      headers.push(text);
    }

    // Find column indices
    const cols = {
      unit: headers.findIndex(h => h.includes('unit') && (h.includes('name') || h.length < 15)),
      status: headers.findIndex(h => h === 'status' || h.includes('status')),
      fuel: headers.findIndex(h => h.includes('fuel')),
      capacity: headers.findIndex(h => h.includes('capacity') || (h.includes('mw') && !h.includes('start'))),
      technology: headers.findIndex(h => h.includes('technology') || h.includes('type')),
      startYear: headers.findIndex(h => h.includes('start') || h.includes('commission') || h.includes('online')),
      retiredYear: headers.findIndex(h => h.includes('retired') || h.includes('retire') || h.includes('closure') || h.includes('close')),
    };

    // If no unit column found, try first column
    if (cols.unit === -1) cols.unit = 0;

    // Parse data rows
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const cellRegex = /<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi;
      const cells: string[] = [];
      let cellMatch;

      while ((cellMatch = cellRegex.exec(row)) !== null) {
        const text = cellMatch[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        cells.push(text);
      }

      if (cells.length === 0) continue;

      const unitName = cols.unit >= 0 && cols.unit < cells.length ? cells[cols.unit] : '';
      const status = cols.status >= 0 && cols.status < cells.length ? cells[cols.status] : '';
      const fuelType = cols.fuel >= 0 && cols.fuel < cells.length ? cells[cols.fuel] : '';
      const capacityStr = cols.capacity >= 0 && cols.capacity < cells.length ? cells[cols.capacity] : '';
      const technology = cols.technology >= 0 && cols.technology < cells.length ? cells[cols.technology] : null;
      const startYearStr = cols.startYear >= 0 && cols.startYear < cells.length ? cells[cols.startYear] : '';
      const retiredYearStr = cols.retiredYear >= 0 && cols.retiredYear < cells.length ? cells[cols.retiredYear] : '';

      // Skip header-like rows or empty rows
      if (!unitName || unitName.toLowerCase().includes('unit name') || unitName.toLowerCase() === 'total') {
        continue;
      }

      const capacity = parseCapacity(capacityStr);
      const startYearParsed = parseYear(startYearStr);
      const retiredYearParsed = parseYear(retiredYearStr);

      // Determine retirement status
      let plannedRetirementYear: number | null = null;
      let retiredYear: number | null = null;

      if (retiredYearParsed.year) {
        const currentYear = new Date().getFullYear();
        if (retiredYearParsed.isPlanned || retiredYearParsed.year > currentYear) {
          plannedRetirementYear = retiredYearParsed.year;
        } else if (status.toLowerCase().includes('retired') || retiredYearParsed.year <= currentYear) {
          retiredYear = retiredYearParsed.year;
        }
      }

      units.push({
        plant_name: plantName,
        plant_slug: plantSlug,
        unit_name: unitName,
        status: status || 'unknown',
        fuel_type: fuelType || 'unknown',
        capacity_mw: capacity,
        technology: technology,
        start_year: startYearParsed.year,
        planned_retirement_year: plannedRetirementYear,
        retired_year: retiredYear,
        state: location.state,
        county: location.county,
        owner: null,
        parent_company: null,
      });
    }
  }

  return units;
}

function parsePlantFile(filename: string): ParsedPlant | null {
  const filepath = path.join(INPUT_DIR, filename);
  const html = fs.readFileSync(filepath, 'utf-8');

  const slug = filename.replace('.html', '');
  const name = extractPlantName(html, filename);
  const location = extractLocation(html);
  const units = parseUnitsTable(html, name, slug, location);

  const totalCapacity = units.reduce((sum, u) => sum + (u.capacity_mw || 0), 0);

  return {
    name,
    slug,
    state: location.state,
    county: location.county,
    total_capacity_mw: totalCapacity,
    units,
  };
}

function main() {
  console.log('=== GEM Wiki Page Parser ===\n');

  if (!fs.existsSync(INPUT_DIR)) {
    console.error(`Error: Input directory not found: ${INPUT_DIR}`);
    console.error('Run download-pages.ts first to fetch the pages.');
    process.exit(1);
  }

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  // Get all HTML files
  const files = fs.readdirSync(INPUT_DIR).filter(f => f.endsWith('.html'));
  console.log(`Found ${files.length} downloaded pages\n`);

  const plants: ParsedPlant[] = [];
  const allUnits: GemUnit[] = [];

  for (const file of files) {
    console.log(`Parsing: ${file}`);
    const plant = parsePlantFile(file);

    if (plant) {
      plants.push(plant);
      allUnits.push(...plant.units);
      console.log(`  -> ${plant.name} (${plant.state}): ${plant.units.length} units, ${plant.total_capacity_mw.toFixed(0)} MW`);

      const withRetirement = plant.units.filter(u => u.planned_retirement_year);
      if (withRetirement.length > 0) {
        console.log(`     Planned retirements: ${withRetirement.map(u => `${u.unit_name} (${u.planned_retirement_year})`).join(', ')}`);
      }
    }
  }

  // Summary
  console.log('\n=== Summary ===');
  console.log(`Plants parsed: ${plants.length}`);
  console.log(`Total units: ${allUnits.length}`);

  const operatingUnits = allUnits.filter(u => u.status.toLowerCase().includes('operating'));
  const retiredUnits = allUnits.filter(u => u.status.toLowerCase().includes('retired'));
  const withPlannedRetirement = allUnits.filter(u => u.planned_retirement_year);

  console.log(`Operating units: ${operatingUnits.length}`);
  console.log(`Retired units: ${retiredUnits.length}`);
  console.log(`Units with planned retirement: ${withPlannedRetirement.length}`);

  // Show plants with planned retirements
  if (withPlannedRetirement.length > 0) {
    console.log('\n=== Units with Planned Retirements ===');
    const byPlant = new Map<string, GemUnit[]>();
    for (const unit of withPlannedRetirement) {
      if (!byPlant.has(unit.plant_name)) {
        byPlant.set(unit.plant_name, []);
      }
      byPlant.get(unit.plant_name)!.push(unit);
    }

    for (const [plantName, units] of byPlant) {
      console.log(`\n${plantName} (${units[0].state}):`);
      for (const unit of units) {
        console.log(`  - ${unit.unit_name}: ${unit.capacity_mw} MW, retire ${unit.planned_retirement_year}`);
      }
    }
  }

  // Save JSON output
  const jsonOutput = {
    parsed_at: new Date().toISOString(),
    plants_count: plants.length,
    units_count: allUnits.length,
    units_with_planned_retirement: withPlannedRetirement.length,
    plants,
    units: allUnits,
  };

  const jsonPath = path.join(OUTPUT_DIR, 'gem-retirement-data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(jsonOutput, null, 2));
  console.log(`\nJSON saved to: ${jsonPath}`);

  // Save CSV output
  const csvHeader = 'plant_name,plant_slug,unit_name,state,county,status,fuel_type,capacity_mw,technology,start_year,planned_retirement_year,retired_year\n';
  const csvRows = allUnits.map(u =>
    [
      `"${u.plant_name}"`,
      `"${u.plant_slug}"`,
      `"${u.unit_name}"`,
      u.state || '',
      u.county || '',
      `"${u.status}"`,
      `"${u.fuel_type}"`,
      u.capacity_mw || '',
      u.technology || '',
      u.start_year || '',
      u.planned_retirement_year || '',
      u.retired_year || '',
    ].join(',')
  ).join('\n');

  const csvPath = path.join(OUTPUT_DIR, 'gem-retirement-data.csv');
  fs.writeFileSync(csvPath, csvHeader + csvRows);
  console.log(`CSV saved to: ${csvPath}`);

  // Save SQL insert statements for Supabase
  const sqlStatements = allUnits
    .filter(u => u.planned_retirement_year) // Only units with retirement dates
    .map(u => `INSERT INTO gem_retirement_data (plant_name, plant_slug, unit_name, state, county, status, fuel_type, capacity_mw, start_year, planned_retirement_year) VALUES ('${u.plant_name.replace(/'/g, "''")}', '${u.plant_slug}', '${u.unit_name.replace(/'/g, "''")}', '${u.state}', ${u.county ? `'${u.county}'` : 'NULL'}, '${u.status}', '${u.fuel_type}', ${u.capacity_mw}, ${u.start_year}, ${u.planned_retirement_year});`);

  const sqlPath = path.join(OUTPUT_DIR, 'gem-retirement-inserts.sql');
  fs.writeFileSync(sqlPath, sqlStatements.join('\n'));
  console.log(`SQL inserts saved to: ${sqlPath}`);
}

main();
