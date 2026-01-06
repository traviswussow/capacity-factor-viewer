'use client';

import { useQueryState, parseAsInteger, parseAsString } from 'nuqs';
import { REGIONS, FUEL_TYPES, MIN_YEAR, MAX_YEAR, DEFAULT_YEAR } from '@/types';

export function FilterPanel() {
  const [region, setRegion] = useQueryState('region', parseAsString.withDefault('ERCO'));
  const [fuelType, setFuelType] = useQueryState('fuelType', parseAsString.withDefault('gas'));
  const [year, setYear] = useQueryState('year', parseAsInteger.withDefault(DEFAULT_YEAR));
  const [season, setSeason] = useQueryState('season', parseAsString.withDefault('annual'));
  const [technology, setTechnology] = useQueryState('technology', parseAsString.withDefault('all'));

  const years = Array.from({ length: MAX_YEAR - MIN_YEAR + 1 }, (_, i) => MAX_YEAR - i);

  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <h2 className="text-lg font-semibold mb-4 text-gray-800">Filters</h2>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {/* Region */}
        <div>
          <label htmlFor="region" className="block text-sm font-medium text-gray-700 mb-1">
            Region
          </label>
          <select
            id="region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {REGIONS.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
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
            onChange={(e) => setFuelType(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {FUEL_TYPES.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </div>

        {/* Year */}
        <div>
          <label htmlFor="year" className="block text-sm font-medium text-gray-700 mb-1">
            Year
          </label>
          <select
            id="year"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value))}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Season */}
        <div>
          <label htmlFor="season" className="block text-sm font-medium text-gray-700 mb-1">
            Season
          </label>
          <select
            id="season"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
          >
            <option value="annual">Annual</option>
            <option value="summer">Summer (Jun-Aug)</option>
            <option value="winter">Winter (Dec-Feb)</option>
          </select>
        </div>

        {/* Technology (only for gas) */}
        {fuelType === 'gas' && (
          <div>
            <label htmlFor="technology" className="block text-sm font-medium text-gray-700 mb-1">
              Technology
            </label>
            <select
              id="technology"
              value={technology}
              onChange={(e) => setTechnology(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-gray-900"
            >
              <option value="all">All</option>
              <option value="simple_cycle">Simple Cycle (GT)</option>
              <option value="combined_cycle">Combined Cycle</option>
            </select>
          </div>
        )}
      </div>
    </div>
  );
}
