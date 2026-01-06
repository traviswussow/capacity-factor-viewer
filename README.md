# Capacity Factor Viewer

A Next.js web application for visualizing capacity factor data from PUDL (Public Utility Data Liberation).

## Features

- Filter by region (ERCOT, MISO, PJM, CAISO, SPP, NYISO, ISO-NE)
- Filter by fuel type (gas, coal, nuclear, wind, solar, hydro)
- Filter by year (2001-2024)
- Filter by season (annual, summer, winter)
- Technology breakdown for gas (simple cycle vs combined cycle)
- Summary statistics: generator count, capacity, avg/weighted CF, median
- Interactive bar charts showing capacity factors by technology
- Data table for accessibility
- URL-synced filters for shareable links

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- Recharts for visualization
- nuqs for URL-synced filter state
- Supabase for data storage

## Data Source

Data comes from the PUDL database by Catalyst Cooperative:
- Table: `out_eia__monthly_generators`
- 6.2M rows of monthly generator data
- Years: 2001-2024

## Development

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Environment Variables

Create a `.env.local` file:

```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for design decisions and system architecture.

## Deployment

Deploy to Vercel with one click or via CLI:

```bash
vercel
```
