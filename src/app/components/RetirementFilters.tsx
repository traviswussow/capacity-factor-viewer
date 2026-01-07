'use client';

import { useQueryState, parseAsString } from 'nuqs';
import { US_STATES, OPERATIONAL_STATUS_OPTIONS, RETIREMENT_FUEL_TYPES } from '@/types';

export function RetirementFilters() {
  const [state, setState] = useQueryState('state', parseAsString.withDefault(''));
  const [status, setStatus] = useQueryState('status', parseAsString.withDefault('planned'));
  const [fuelType, setFuelType] = useQueryState('fuelType', parseAsString.withDefault(''));

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Filters</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* State */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-gray-700 mb-1">
            State
          </label>
          <select
            id="state"
            value={state}
            onChange={(e) => setState(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {US_STATES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div>
          <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
            Status
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {OPERATIONAL_STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Fuel Type */}
        <div>
          <label htmlFor="fuelType" className="block text-sm font-medium text-gray-700 mb-1">
            Fuel Type
          </label>
          <select
            id="fuelType"
            value={fuelType}
            onChange={(e) => setFuelType(e.target.value || null)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {RETIREMENT_FUEL_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
