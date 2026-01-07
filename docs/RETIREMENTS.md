# Generator Retirements Feature

This document describes the power plant retirement tracking feature, which combines data from two sources to provide comprehensive retirement date information.

## Data Sources

### EIA-860 (Official)
- **Source**: U.S. Energy Information Administration Form 860
- **Data**: `planned_generator_retirement_date` field in `core_eia860__scd_generators` table
- **Limitations**: Only captures formally filed retirement dates. Many utilities don't report planned retirements until close to the actual date.
- **Coverage**: ~1.3% of generators have retirement dates in EIA data

### Global Energy Monitor (Research)
- **Source**: GEM Wiki (gem.wiki) - scraped from individual plant pages
- **Data**: Retirement dates from IRPs, regulatory filings, company announcements, news reports
- **Advantages**: Tracks announced retirements that haven't been formally filed with EIA
- **Table**: `gem_retirement_data` in Supabase

## How Data is Combined

The `/api/retirements` endpoint merges both sources:

1. **EIA generators** are queried first with their planned retirement dates
2. **GEM data** is matched by plant name + state
3. **Name mapping** handles cases where GEM uses different plant names than EIA (e.g., "Gaston Steam Plant" vs "E C Gaston")
4. **GEM-only plants** not matched to EIA are added separately

### Priority Logic
- When both EIA and GEM have dates, the later date is used as the primary `planned_generator_retirement_date`
- Both dates are preserved separately in `eia_retirement_date` and `gem_retirement_date` fields
- Delay is calculated when both dates exist and differ

## Database Schema

### gem_retirement_data Table
```sql
CREATE TABLE gem_retirement_data (
  id SERIAL PRIMARY KEY,
  plant_name TEXT NOT NULL,
  plant_slug TEXT NOT NULL,
  unit_name TEXT NOT NULL,
  state CHAR(2),
  county TEXT,
  status TEXT,
  fuel_type TEXT,
  capacity_mw NUMERIC,
  technology TEXT,
  start_year INTEGER,
  planned_retirement_year INTEGER,
  retired_year INTEGER,
  owner TEXT,
  parent_company TEXT,
  scraped_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(plant_slug, unit_name)
);
```

## API Response

### Endpoint
`GET /api/retirements`

### Query Parameters
- `state` - Filter by US state code (e.g., "AL", "TX")
- `fuelType` - Filter by fuel type (e.g., "coal", "gas")
- `page` - Page number (default: 1)

### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `plant_id_eia` | number \| null | EIA plant ID (null for GEM-only) |
| `plant_name_eia` | string | Plant name |
| `generator_id` | string | Generator/unit identifier |
| `state` | string | State code |
| `capacity_mw` | number | Nameplate capacity in MW |
| `eia_retirement_date` | string \| null | Official EIA retirement date |
| `gem_retirement_date` | string \| null | GEM research retirement date |
| `delay_months` | number \| null | Months between earlier and later date |
| `data_sources` | string[] | Array of sources: `['eia']`, `['gem']`, or `['eia', 'gem']` |

## GEM Data Scraper

### Location
`/scripts/gem-scraper/`

### Scripts
1. **download-pages.ts** - Downloads GEM wiki HTML pages locally
   - 2-second delay between requests to avoid rate limiting
   - Saves to `downloaded-pages/` directory

2. **parse-pages.ts** - Parses downloaded HTML files
   - Extracts unit-level data from MediaWiki tables
   - Outputs to `/public/data/`:
     - `gem-retirement-data.json`
     - `gem-retirement-data.csv`
     - `gem-retirement-inserts.sql`

3. **load-to-supabase.ts** - Loads parsed data to Supabase
   - Uses upsert with `plant_slug,unit_name` conflict handling
   - Processes in batches of 100

### Running the Scraper
```bash
# Download pages (requires internet)
npx ts-node --project tsconfig.scripts.json scripts/gem-scraper/download-pages.ts

# Parse downloaded pages
npx ts-node --project tsconfig.scripts.json scripts/gem-scraper/parse-pages.ts

# Load to Supabase
npx ts-node --project tsconfig.scripts.json scripts/gem-scraper/load-to-supabase.ts
```

## Name Mapping

GEM and EIA use different plant names. The mapping is defined in `/src/app/api/retirements/route.ts`:

```typescript
const GEM_TO_EIA_NAME_MAP: Record<string, string> = {
  'Gaston Steam Plant': 'E C Gaston',
  'Barry Steam Plant': 'Barry',
  'Miller Steam Plant': 'James H Miller Jr',
  'Plant Bowen': 'Bowen',
  // ... more mappings
};
```

To add new mappings, update this object when you find mismatches.

## UI Components

### RetirementTable
Location: `/src/app/components/RetirementTable.tsx`

Columns:
- Plant / Generator
- Location (state, county)
- Fuel Type
- Capacity
- **EIA Date** - Official retirement date from EIA-860
- **GEM Date** - Research date from Global Energy Monitor
- **Delay** - Difference between dates (if both exist)
- Timeline - Status indicator (Overdue, Soon, Planned)
- **Sources** - Badges showing which sources have data (EIA gray, GEM purple)

## Future Improvements

1. **Better name matching** - Implement fuzzy matching between EIA and GEM plant names
2. **Historical tracking** - Store previous retirement dates to show delay history
3. **Automated updates** - Schedule periodic GEM scraping and data refresh
4. **More data sources** - Add S&P Global, BNEF, or other retirement trackers
