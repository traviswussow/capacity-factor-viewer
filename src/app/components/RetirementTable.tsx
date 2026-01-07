'use client';

import { useState, useMemo } from 'react';
import { RetirementRecord } from '@/types';

type SortColumn = 'plant_name_eia' | 'state' | 'fuel_type_code_pudl' | 'capacity_mw' | 'eia_retirement_date' | 'gem_retirement_date' | 'delay_months' | 'data_sources';
type SortDirection = 'asc' | 'desc';

interface RetirementTableProps {
  data: RetirementRecord[];
  loading: boolean;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatCapacity(mw: number | null): string {
  if (mw === null || mw === undefined) return '—';
  if (mw >= 1000) {
    return `${(mw / 1000).toFixed(1)} GW`;
  }
  return `${mw.toFixed(1)} MW`;
}

function getFuelLabel(code: string | null): string {
  if (!code) return '—';
  const labels: Record<string, string> = {
    gas: 'Natural Gas',
    coal: 'Coal',
    nuclear: 'Nuclear',
    wind: 'Wind',
    solar: 'Solar',
    hydro: 'Hydro',
    oil: 'Oil',
    waste: 'Waste',
    other: 'Other',
  };
  return labels[code] || code;
}

function formatDelay(months: number | null): string {
  if (months === null || months <= 0) return '—';
  if (months >= 12) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    if (remainingMonths === 0) {
      return `${years}y`;
    }
    return `${years}y ${remainingMonths}mo`;
  }
  return `${months}mo`;
}

function getRetirementStatus(plannedDate: string | null): { text: string; color: string } {
  if (!plannedDate) {
    return { text: 'Unknown', color: 'bg-gray-100 text-gray-800' };
  }
  const date = new Date(plannedDate);
  const now = new Date();
  if (date < now) {
    return { text: 'Overdue', color: 'bg-red-100 text-red-800' };
  }
  // Check if within next 2 years
  const twoYearsOut = new Date();
  twoYearsOut.setFullYear(twoYearsOut.getFullYear() + 2);
  if (date <= twoYearsOut) {
    return { text: 'Soon', color: 'bg-orange-100 text-orange-800' };
  }
  return { text: 'Planned', color: 'bg-blue-100 text-blue-800' };
}

function SortIcon({ direction, active }: { direction: SortDirection; active: boolean }) {
  return (
    <span className={`ml-1 inline-block ${active ? 'text-blue-600' : 'text-gray-400'}`}>
      {direction === 'asc' ? '↑' : '↓'}
    </span>
  );
}

export function RetirementTable({ data, loading, page, totalPages, onPageChange }: RetirementTableProps) {
  const [sortColumn, setSortColumn] = useState<SortColumn>('gem_retirement_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  const sortedData = useMemo(() => {
    return [...data].sort((a, b) => {
      let aVal: string | number | boolean | null;
      let bVal: string | number | boolean | null;

      switch (sortColumn) {
        case 'plant_name_eia':
          aVal = a.plant_name_eia?.toLowerCase() ?? '';
          bVal = b.plant_name_eia?.toLowerCase() ?? '';
          break;
        case 'state':
          aVal = a.state?.toLowerCase() ?? '';
          bVal = b.state?.toLowerCase() ?? '';
          break;
        case 'fuel_type_code_pudl':
          aVal = a.fuel_type_code_pudl?.toLowerCase() ?? '';
          bVal = b.fuel_type_code_pudl?.toLowerCase() ?? '';
          break;
        case 'capacity_mw':
          aVal = a.capacity_mw ?? 0;
          bVal = b.capacity_mw ?? 0;
          break;
        case 'eia_retirement_date':
          aVal = a.eia_retirement_date ?? '9999-12-31';
          bVal = b.eia_retirement_date ?? '9999-12-31';
          break;
        case 'gem_retirement_date':
          aVal = a.gem_retirement_date ?? '9999-12-31';
          bVal = b.gem_retirement_date ?? '9999-12-31';
          break;
        case 'delay_months':
          aVal = a.delay_months ?? 0;
          bVal = b.delay_months ?? 0;
          break;
        case 'data_sources':
          aVal = a.data_sources?.join(',') ?? '';
          bVal = b.data_sources?.join(',') ?? '';
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortColumn, sortDirection]);

  const headerClass = "px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none";
  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[...Array(10)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Generator Retirements</h3>
        <div className="text-center py-12 text-gray-500">
          No generators found matching the selected filters
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Generator Retirements</h3>
        <p className="text-sm text-gray-500 mt-1">
          Showing {data.length} generators • Page {page} of {totalPages}
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                className={`${headerClass} text-left`}
                onClick={() => handleSort('plant_name_eia')}
              >
                Plant / Generator
                <SortIcon direction={sortDirection} active={sortColumn === 'plant_name_eia'} />
              </th>
              <th
                className={`${headerClass} text-left`}
                onClick={() => handleSort('state')}
              >
                Location
                <SortIcon direction={sortDirection} active={sortColumn === 'state'} />
              </th>
              <th
                className={`${headerClass} text-left`}
                onClick={() => handleSort('fuel_type_code_pudl')}
              >
                Fuel Type
                <SortIcon direction={sortDirection} active={sortColumn === 'fuel_type_code_pudl'} />
              </th>
              <th
                className={`${headerClass} text-right`}
                onClick={() => handleSort('capacity_mw')}
              >
                Capacity
                <SortIcon direction={sortDirection} active={sortColumn === 'capacity_mw'} />
              </th>
              <th
                className={`${headerClass} text-left`}
                onClick={() => handleSort('eia_retirement_date')}
                title="Official retirement date from EIA-860 filings"
              >
                EIA Date
                <SortIcon direction={sortDirection} active={sortColumn === 'eia_retirement_date'} />
              </th>
              <th
                className={`${headerClass} text-left`}
                onClick={() => handleSort('gem_retirement_date')}
                title="Retirement date from Global Energy Monitor research"
              >
                GEM Date
                <SortIcon direction={sortDirection} active={sortColumn === 'gem_retirement_date'} />
              </th>
              <th
                className={`${headerClass} text-center`}
                onClick={() => handleSort('delay_months')}
                title="Delay between EIA and GEM dates"
              >
                Delay
                <SortIcon direction={sortDirection} active={sortColumn === 'delay_months'} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timeline
              </th>
              <th
                className={`${headerClass} text-center`}
                onClick={() => handleSort('data_sources')}
              >
                Sources
                <SortIcon direction={sortDirection} active={sortColumn === 'data_sources'} />
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                PDF Date
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Delay Source
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedData.map((record, idx) => {
              const timeline = getRetirementStatus(record.planned_generator_retirement_date);
              return (
                <tr key={`${record.plant_id_eia}-${record.generator_id}-${idx}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="text-sm font-medium text-gray-900">
                      {record.plant_name_eia}
                    </div>
                    <div className="text-xs text-gray-500">
                      Generator: {record.generator_id}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">{record.state}</div>
                    {record.county && (
                      <div className="text-xs text-gray-500">{record.county}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {getFuelLabel(record.fuel_type_code_pudl)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900 text-right">
                    {formatCapacity(record.capacity_mw)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {record.eia_retirement_date ? formatDate(record.eia_retirement_date) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-900">
                    {record.gem_retirement_date ? formatDate(record.gem_retirement_date) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {record.indefinite_delay ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800" title={`Originally ${record.original_planned_year}`}>
                        Indefinite
                      </span>
                    ) : record.doe_202c_order ? (
                      <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-yellow-100 text-yellow-800" title="DOE Section 202(c) emergency order">
                        DOE 202(c)
                      </span>
                    ) : record.delay_years && record.delay_years > 0 ? (
                      <div>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          +{record.delay_years}y
                        </span>
                        {record.original_planned_year && record.revised_planned_year && (
                          <div className="text-xs text-gray-500 mt-1">
                            {record.original_planned_year}→{record.revised_planned_year}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${timeline.color}`}>
                      {timeline.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <div className="flex gap-1 justify-center flex-wrap">
                      {record.data_sources?.includes('eia') && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-gray-100 text-gray-600" title="Data from EIA-860">
                          EIA
                        </span>
                      )}
                      {record.data_sources?.includes('gem') && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800" title="Data from Global Energy Monitor">
                          GEM
                        </span>
                      )}
                      {record.data_sources?.includes('manual') && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800" title="Manual delay data from news/utility sources">
                          PDF
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center text-sm">
                    {record.original_planned_year && record.revised_planned_year ? (
                      <span className="text-gray-900">
                        {record.original_planned_year} → {record.revised_planned_year}
                      </span>
                    ) : record.original_planned_year && record.indefinite_delay ? (
                      <span className="text-gray-900">
                        {record.original_planned_year} → <span className="text-red-600">TBD</span>
                      </span>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {record.delay_source ? (
                      record.delay_source_url ? (
                        <a
                          href={record.delay_source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 hover:underline"
                        >
                          {record.delay_source} ↗
                        </a>
                      ) : (
                        <span className="text-gray-900">{record.delay_source}</span>
                      )
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between">
          <button
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Previous
          </button>
          <span className="text-sm text-gray-700">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
