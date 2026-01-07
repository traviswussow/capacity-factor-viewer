'use client';

import { useEffect, useState, Suspense } from 'react';
import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';
import Link from 'next/link';
import { FilterPanel, StatsCards, SummaryCharts, ErrorBoundary } from './components';
import { Stats, DEFAULT_YEAR } from '@/types';

interface TechnologyData {
  technology: string;
  avgCapacityFactor: number;
  weightedAvgCapacityFactor: number;
  totalCapacityMW: number;
  count: number;
}

interface AggregationResponse {
  stats: Stats;
  byTechnology: TechnologyData[];
}

function Dashboard() {
  const [region] = useQueryState('region', parseAsString.withDefault('ERCO'));
  const [fuelType] = useQueryState('fuelType', parseAsString.withDefault('gas'));
  const [year] = useQueryState('year', parseAsInteger.withDefault(DEFAULT_YEAR));
  const [season] = useQueryState('season', parseAsString.withDefault('annual'));
  const [technology] = useQueryState('technology', parseAsString.withDefault('all'));

  const [data, setData] = useState<AggregationResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          region,
          fuelType,
          year: year.toString(),
          season,
          technology,
        });

        const response = await fetch(`/api/aggregations?${params}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        setData(result);
      } catch (err) {
        console.error('Failed to fetch data:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [region, fuelType, year, season, technology]);

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-3xl font-bold text-gray-900">
              Capacity Factor Viewer
            </h1>
            <Link
              href="/retirements"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              Plant Retirements &rarr;
            </Link>
          </div>
          <p className="text-gray-600">
            Explore capacity factors for power generators across the United States
          </p>
        </header>

        <FilterPanel />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            <h3 className="font-semibold mb-1">Error loading data</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <ErrorBoundary>
          <StatsCards stats={data?.stats ?? null} loading={loading} />
        </ErrorBoundary>

        <ErrorBoundary>
          <SummaryCharts byTechnology={data?.byTechnology ?? []} loading={loading} />
        </ErrorBoundary>

        <footer className="mt-8 pt-4 border-t border-gray-200 text-sm text-gray-500">
          <p>
            Data source:{' '}
            <a
              href="https://catalyst.coop/pudl/"
              className="text-blue-600 hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              PUDL (Public Utility Data Liberation)
            </a>{' '}
            by Catalyst Cooperative
          </p>
          <p className="mt-1">
            Table: out_eia__monthly_generators | Years: 2001-2024
          </p>
        </footer>
      </div>
    </main>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    }>
      <Dashboard />
    </Suspense>
  );
}
