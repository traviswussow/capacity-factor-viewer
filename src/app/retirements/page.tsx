'use client';

import { useEffect, useState, Suspense } from 'react';
import { useQueryState, parseAsString, parseAsInteger } from 'nuqs';
import Link from 'next/link';
import { RetirementFilters, RetirementTable, ErrorBoundary } from '../components';
import { RetirementRecord } from '@/types';

interface RetirementResponse {
  data: RetirementRecord[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

function RetirementsDashboard() {
  const [state] = useQueryState('state', parseAsString.withDefault(''));
  const [fuelType] = useQueryState('fuelType', parseAsString.withDefault(''));
  const [page, setPage] = useQueryState('page', parseAsInteger.withDefault(1));

  const [data, setData] = useState<RetirementRecord[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams({
          state,
          fuelType,
          page: page.toString(),
        });

        const response = await fetch(`/api/retirements?${params}`);

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result: RetirementResponse = await response.json();
        setData(result.data);
        setTotalPages(result.pagination.totalPages);
      } catch (err) {
        console.error('Failed to fetch retirements:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [state, fuelType, page]);

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <main className="min-h-screen p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center gap-4 mb-2">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 text-sm font-medium"
            >
              &larr; Capacity Factors
            </Link>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Planned Power Plant Retirements
          </h1>
          <p className="text-gray-600">
            Generators with announced retirement dates that have not yet retired
          </p>
        </header>

        <RetirementFilters />

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
            <h3 className="font-semibold mb-1">Error loading data</h3>
            <p className="text-sm">{error}</p>
          </div>
        )}

        <ErrorBoundary>
          <RetirementTable
            data={data}
            loading={loading}
            page={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
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
            Tables: core_eia860__scd_generators, core_eia__entity_plants
          </p>
        </footer>
      </div>
    </main>
  );
}

export default function RetirementsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-gray-500">Loading...</div>
        </div>
      }
    >
      <RetirementsDashboard />
    </Suspense>
  );
}
