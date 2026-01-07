'use client';

import { useState, useMemo } from 'react';
import { RetirementRecord } from '@/types';

type SortColumn = 'plant_name_eia' | 'state' | 'fuel_type_code_pudl' | 'capacity_mw' | 'planned_generator_retirement_date' | 'extended';
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
  const [sortColumn, setSortColumn] = useState<SortColumn>('planned_generator_retirement_date');
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
        case 'planned_generator_retirement_date':
          aVal = a.planned_generator_retirement_date ?? '';
          bVal = b.planned_generator_retirement_date ?? '';
          break;
        case 'extended':
          aVal = a.extended ? 1 : 0;
          bVal = b.extended ? 1 : 0;
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
                onClick={() => handleSort('planned_generator_retirement_date')}
              >
                Planned Retirement
                <SortIcon direction={sortDirection} active={sortColumn === 'planned_generator_retirement_date'} />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Timeline
              </th>
              <th
                className={`${headerClass} text-center`}
                onClick={() => handleSort('extended')}
              >
                Extended?
                <SortIcon direction={sortDirection} active={sortColumn === 'extended'} />
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
                    {formatDate(record.planned_generator_retirement_date)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${timeline.color}`}>
                      {timeline.text}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {record.extended ? (
                      <div>
                        <span className="inline-flex items-center px-2 py-1 text-xs font-semibold rounded-full bg-orange-100 text-orange-800">
                          Delayed
                        </span>
                        {record.original_retirement_date && (
                          <div className="text-xs text-gray-500 mt-1">
                            Was: {formatDate(record.original_retirement_date)}
                          </div>
                        )}
                      </div>
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
