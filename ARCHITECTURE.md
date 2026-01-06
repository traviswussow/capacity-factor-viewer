# Capacity Factor Viewer - Architecture

## Overview
A Next.js web application for visualizing PUDL (Public Utility Data Liberation) capacity factor data. Users can explore capacity factors by region, fuel type, technology, and year with summary charts and detailed plant-level tables.

## Core Architectural Principles
- **Server-side aggregation**: With 6.2M rows in the database, all summary/chart data is computed server-side via API routes
- **Client-side detail views**: Plant-level tables use client-side pagination with reasonable page sizes
- **URL-synced state**: All filter state lives in URL params (via nuqs) for shareable links
- **Minimal client JavaScript**: Prefer server components where possible

## Tech Stack

**Frontend:**
- Next.js 15 (App Router) + TypeScript
- Tailwind CSS for styling
- Recharts for charts (React-native, declarative API)
- nuqs for URL-synced filter state

**Backend:**
- Supabase PostgreSQL (project: `pudl-data`, ID: `sachacwlppjduhzyfggs`)
- Next.js API routes for server-side aggregation

**Infrastructure:**
- Vercel deployment
- GitHub for version control

## System Boundaries & Constraints

**What this system IS:**
- Read-only visualization of PUDL capacity factor data
- Filter/explore interface for energy analysts

**What this system IS NOT:**
- Data entry or modification tool
- Real-time data feed (PUDL updates periodically)

**Hard Constraints:**
- 6.2M rows in source table - cannot load full dataset client-side
- Must use server-side aggregation for chart data
- Supabase anon key has read-only access

## Major Components

**1. Filter Panel (FilterPanel.tsx)**
- Region, fuel type, year, technology, season filters
- Uses nuqs for URL-synced state
- Validates inputs before queries

**2. Summary Charts (SummaryCharts.tsx)**
- Bar chart: CF by technology (simple vs combined cycle)
- Line chart: CF trend over years
- Fetches aggregated data from API routes

**3. Stats Cards (StatsCards.tsx)**
- Generator count, total capacity, weighted avg CF
- Derived from aggregation API response

**4. Detail Table (CapacityFactorTable.tsx)**
- Plant-level data with pagination
- Sortable columns
- Client-side fetch with filters

**5. API Routes (/api/aggregations)**
- Server-side SQL aggregation
- Returns pre-computed summaries for charts

## Design Patterns & Conventions

**Established Patterns:**
- Supabase client singleton in `lib/supabase.ts`
- TypeScript interfaces in `types/index.ts`
- Input validation before database queries
- Error boundaries around charts

**File Organization:**
```
src/
  app/
    page.tsx              # Main page with filters + charts
    layout.tsx            # Root layout with nuqs provider
    components/           # UI components
    api/aggregations/     # Server-side aggregation routes
  lib/
    supabase.ts          # Supabase client
    validation.ts        # URL param validation
    queries.ts           # Query builders
  types/
    index.ts             # All TypeScript types
```

## Data Architecture

**Source Table:** `out_eia__monthly_generators`
- 6.2M rows (monthly data from 2001-2024)
- Key columns: capacity_factor, capacity_mw, net_generation_mwh, prime_mover_code, balancing_authority_code_eia, fuel_type_code_pudl

**Data Flow:**
1. User adjusts filters → URL updates via nuqs
2. Components detect URL change → fetch from API
3. API routes run SQL aggregation on Supabase
4. Aggregated results returned → charts render

**Aggregation Queries:**
- GROUP BY fuel_type, year, technology
- COMPUTE avg(), weighted avg (SUM(cf*cap)/SUM(cap)), percentile_cont()
- FILTER by region, fuel, year range, season months

## Integration Points

**Supabase:**
- Direct client-side connection for paginated tables
- Server-side connection in API routes for aggregation
- Environment: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY

## Architectural Decisions Log

**2026-01-06 - Server-side aggregation required**
- Context: Discovered 6.2M rows in source table during pre-implementation
- Decision: Use API routes for all chart/summary data
- Rationale: Client-side aggregation of 6M+ rows would be extremely slow
- Alternatives: Client-side with TanStack Query (rejected - too many rows)

**2026-01-06 - nuqs for URL state**
- Context: Need shareable filter configurations
- Decision: Use nuqs library for URL-synced state
- Rationale: Type-safe, small footprint (3KB), replaces useState
- Alternatives: Custom useSearchParams wrapper (rejected - reinventing wheel)

**2026-01-06 - Recharts for visualization**
- Context: Need bar and line charts for CF visualization
- Decision: Use Recharts
- Rationale: React-native, declarative API, good TypeScript support, 180KB
- Alternatives: Chart.js (imperative), Tremor (too opinionated), Nivo (larger)
