/**
 * Load GEM retirement data into Supabase
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/gem-scraper/load-to-supabase.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

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

async function main() {
  console.log('=== Loading GEM Data to Supabase ===\n');

  // Read the JSON file
  const jsonPath = path.join(__dirname, '../../public/data/gem-retirement-data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('Error: JSON file not found. Run parse-pages.ts first.');
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  const units: GemUnit[] = data.units;

  console.log(`Found ${units.length} units to load`);

  // Clear existing data
  console.log('\nClearing existing data...');
  const { error: deleteError } = await supabase
    .from('gem_retirement_data')
    .delete()
    .neq('id', 0); // Delete all rows

  if (deleteError) {
    console.error('Error clearing table:', deleteError);
  }

  // Insert in batches of 100
  const batchSize = 100;
  let inserted = 0;
  let errors = 0;

  for (let i = 0; i < units.length; i += batchSize) {
    const batch = units.slice(i, i + batchSize).map(unit => ({
      plant_name: unit.plant_name,
      plant_slug: unit.plant_slug,
      unit_name: unit.unit_name,
      state: unit.state,
      county: unit.county,
      status: unit.status,
      fuel_type: unit.fuel_type,
      capacity_mw: unit.capacity_mw,
      technology: unit.technology,
      start_year: unit.start_year,
      planned_retirement_year: unit.planned_retirement_year,
      retired_year: unit.retired_year,
      owner: unit.owner,
      parent_company: unit.parent_company,
      scraped_at: new Date().toISOString(),
    }));

    const { error } = await supabase
      .from('gem_retirement_data')
      .upsert(batch, { onConflict: 'plant_slug,unit_name' });

    if (error) {
      console.error(`Error inserting batch ${i / batchSize + 1}:`, error);
      errors += batch.length;
    } else {
      inserted += batch.length;
      console.log(`Inserted batch ${Math.floor(i / batchSize) + 1} (${inserted}/${units.length})`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total units: ${units.length}`);
  console.log(`Inserted: ${inserted}`);
  console.log(`Errors: ${errors}`);

  // Verify the data
  const { data: countData, error: countError } = await supabase
    .from('gem_retirement_data')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('Error counting rows:', countError);
  } else {
    console.log(`\nRows in table: ${countData}`);
  }

  // Check Gaston specifically
  const { data: gastonData, error: gastonError } = await supabase
    .from('gem_retirement_data')
    .select('*')
    .ilike('plant_name', '%gaston%');

  if (gastonError) {
    console.error('Error querying Gaston:', gastonError);
  } else {
    console.log('\n=== Gaston Steam Plant Data ===');
    for (const row of gastonData || []) {
      console.log(`  ${row.unit_name}: ${row.capacity_mw} MW, planned retirement ${row.planned_retirement_year}`);
    }
  }
}

main().catch(console.error);
