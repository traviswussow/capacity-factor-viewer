/**
 * GEM Wiki Page Downloader
 *
 * Downloads GEM wiki pages locally for offline parsing.
 * Run this once to fetch all pages, then use parse-pages.ts to extract data.
 *
 * Usage: npx ts-node --project tsconfig.scripts.json scripts/gem-scraper/download-pages.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const BASE_URL = 'https://www.gem.wiki';
const DELAY_MS = 2000; // 2 seconds between requests - be respectful
const OUTPUT_DIR = path.join(__dirname, 'downloaded-pages');

// Major US coal plants to download
const MAJOR_PLANTS = [
  // Alabama Power / Georgia Power (Southern Company)
  'Gaston_Steam_Plant',
  'Barry_Steam_Plant',
  'Miller_Steam_Plant',
  'Plant_Bowen',
  'Scherer_Steam_Generating_Station',
  'Plant_Wansley',
  'Plant_Hammond',
  'Plant_Yates',
  // TVA Plants
  'Cumberland_Fossil_Plant',
  'Paradise_Fossil_Plant',
  'Bull_Run_Fossil_Plant',
  'Kingston_Fossil_Plant',
  'Gallatin_Fossil_Plant',
  // AEP Plants
  'Rockport_Generating_Station',
  'John_E._Amos_Power_Plant',
  'Mountaineer_Power_Plant',
  'Mitchell_Power_Station',
  // Duke Energy
  'Gibson_Generating_Station',
  'Cayuga_Generating_Station',
  'Gallagher_Generating_Station',
  // Entergy
  'White_Bluff_Steam_Electric_Station',
  'Independence_Steam_Electric_Station',
  // Xcel Energy
  'Sherburne_County_Generating_Station',
  'Comanche_Generating_Station',
  // Basin Electric
  'Coal_Creek_Station',
  'Leland_Olds_Station',
  'Antelope_Valley_Station',
  // Minnkota Power
  'Milton_R._Young_Station',
  // Western Plants
  'Colstrip_Power_Plant',
  'Four_Corners_Generating_Station',
  'San_Juan_Generating_Station',
  'Jim_Bridger_Power_Plant',
  'Intermountain_Power_Plant',
  'Navajo_Generating_Station',
  'Cholla_Power_Plant',
  // Texas Plants
  'Martin_Lake_Steam_Electric_Station',
  'Limestone_Generating_Station',
  'W._A._Parish_Generating_Station',
  'Monticello_Steam_Electric_Station',
  'Oak_Grove_Steam_Electric_Station',
  'J._K._Spruce_Power_Plant',
  'Fayette_Power_Project',
  'Big_Brown_Steam_Electric_Station',
  'Pirkey_Power_Plant',
  'Welsh_Power_Plant',
  // Michigan
  'Monroe_Power_Plant',
  'Belle_River_Power_Plant',
  'J._H._Campbell_Generating_Complex',
  // Missouri
  'Labadie_Energy_Center',
  'Rush_Island_Power_Station',
  'Sioux_Energy_Center',
  'Meramec_Energy_Center',
  // Indiana
  'Petersburg_Generating_Station',
  'A._B._Brown_Generating_Station',
  'Clifty_Creek_Plant',
  // Kentucky
  'Ghent_Generating_Station',
  'Mill_Creek_Generating_Station',
  'Trimble_County_Generating_Station',
  'Big_Sandy_Power_Plant',
  'Paradise_Fossil_Plant',
  // West Virginia
  'Harrison_Power_Station',
  'Fort_Martin_Power_Station',
  'Pleasants_Power_Station',
  // Pennsylvania
  'Bruce_Mansfield_Power_Plant',
  'Homer_City_Generating_Station',
  'Keystone_Generating_Station',
  'Conemaugh_Generating_Station',
  'Montour_Steam_Electric_Station',
  // Ohio
  'W._H._Sammis_Power_Plant',
  'Cardinal_Power_Plant',
  'Conesville_Power_Plant',
  'Kyger_Creek_Power_Plant',
  // Illinois
  'Prairie_State_Generating_Company',
  'Newton_Power_Station',
  'Joppa_Steam_Plant',
  'Baldwin_Energy_Complex',
  // North Carolina
  'Belews_Creek_Steam_Station',
  'Marshall_Steam_Station',
  'Roxboro_Steam_Electric_Plant',
  'Mayo_Steam_Electric_Generating_Plant',
  // Wyoming
  'Dave_Johnston_Power_Plant',
  'Naughton_Power_Plant',
  'Wyodak_Power_Plant',
  // North Dakota
  'Coal_Creek_Station',
  // Kansas
  'Jeffrey_Energy_Center',
  'La_Cygne_Generating_Station',
  // Nebraska
  'Gerald_Gentleman_Station',
  // Iowa
  'Ottumwa_Generating_Station',
  'Council_Bluffs_Energy_Center',
  // Arizona
  'Springerville_Generating_Station',
  'Coronado_Generating_Station',
  // Florida
  'Crystal_River_Energy_Complex',
  // Wisconsin
  'Pleasant_Prairie_Power_Plant',
  'Columbia_Energy_Center',
  'Elm_Road_Generating_Station',
  'Edgewater_Generating_Station',
  // Additional plants from PDF analysis (Jan 2026)
  // North Carolina - Duke Energy
  'Roxboro_Steam_Electric_Plant',
  'Mayo_Steam_Electric_Generating_Plant',
  'Cliffside_Steam_Station',
  // Indiana
  'Merom_Generating_Station',
  // Kansas
  'Lawrence_Energy_Center',
  // Utah - PacifiCorp/Rocky Mountain Power
  'Hunter_Power_Plant',
  'Huntington_Power_Plant',
  'Bonanza_Power_Plant',
  // Virginia
  'Clover_Power_Station',
  // South Carolina - Dominion
  'Wateree_Station',
  'Williams_Station',
  // Nebraska
  'North_Omaha_Station',
  // Delaware
  'Indian_River_Generating_Station',
  // Florida
  'Stanton_Energy_Center',
  // Colorado
  'Ray_D._Nixon_Power_Plant',
  // Wyoming - PacifiCorp
  'Jim_Bridger_Power_Plant',
];

async function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function downloadPage(plantSlug: string): Promise<boolean> {
  const url = `${BASE_URL}/${plantSlug}`;
  const outputPath = path.join(OUTPUT_DIR, `${plantSlug}.html`);

  // Skip if already downloaded
  if (fs.existsSync(outputPath)) {
    console.log(`  [SKIP] ${plantSlug} - already downloaded`);
    return true;
  }

  console.log(`  [DOWNLOAD] ${plantSlug}`);

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml',
      },
    });

    if (!response.ok) {
      console.log(`    [ERROR] HTTP ${response.status}`);
      return false;
    }

    const html = await response.text();
    fs.writeFileSync(outputPath, html);
    console.log(`    [OK] Saved ${(html.length / 1024).toFixed(1)} KB`);
    return true;
  } catch (error) {
    console.log(`    [ERROR] ${error}`);
    return false;
  }
}

async function main() {
  console.log('=== GEM Wiki Page Downloader ===\n');

  // Create output directory
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  console.log(`Output directory: ${OUTPUT_DIR}`);
  console.log(`Plants to download: ${MAJOR_PLANTS.length}`);
  console.log(`Delay between requests: ${DELAY_MS}ms\n`);

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < MAJOR_PLANTS.length; i++) {
    const plantSlug = MAJOR_PLANTS[i];
    console.log(`[${i + 1}/${MAJOR_PLANTS.length}] ${plantSlug}`);

    const outputPath = path.join(OUTPUT_DIR, `${plantSlug}.html`);
    if (fs.existsSync(outputPath)) {
      skipped++;
      console.log(`  [SKIP] Already downloaded`);
      continue;
    }

    const success = await downloadPage(plantSlug);
    if (success) {
      downloaded++;
    } else {
      failed++;
    }

    // Rate limiting - only delay if we actually made a request
    if (i < MAJOR_PLANTS.length - 1) {
      await delay(DELAY_MS);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Downloaded: ${downloaded}`);
  console.log(`Skipped (already had): ${skipped}`);
  console.log(`Failed: ${failed}`);
  console.log(`\nPages saved to: ${OUTPUT_DIR}`);

  // Save manifest
  const manifest = {
    downloaded_at: new Date().toISOString(),
    base_url: BASE_URL,
    plants: MAJOR_PLANTS,
    total: MAJOR_PLANTS.length,
    downloaded_count: downloaded + skipped,
    failed_count: failed,
  };
  fs.writeFileSync(
    path.join(OUTPUT_DIR, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
}

main().catch(console.error);
