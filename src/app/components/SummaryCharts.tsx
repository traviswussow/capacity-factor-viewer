'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface TechnologyData {
  technology: string;
  avgCapacityFactor: number;
  weightedAvgCapacityFactor: number;
  totalCapacityMW: number;
  count: number;
}

interface SummaryChartsProps {
  byTechnology: TechnologyData[];
  loading: boolean;
}

export function SummaryCharts({ byTechnology, loading }: SummaryChartsProps) {
  // Transform data for the chart
  const chartData = byTechnology.map((t) => ({
    name: t.technology,
    'Simple Avg': Math.round(t.avgCapacityFactor * 100),
    'Weighted Avg': Math.round(t.weightedAvgCapacityFactor * 100),
    capacity: t.totalCapacityMW,
  }));

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Capacity Factor by Technology</h3>
        <div className="h-64 bg-gray-100 rounded animate-pulse flex items-center justify-center">
          <span className="text-gray-400">Loading chart...</span>
        </div>
      </div>
    );
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h3 className="text-lg font-semibold mb-4 text-gray-800">Capacity Factor by Technology</h3>
        <div className="h-64 flex items-center justify-center text-gray-500">
          No data available for the selected filters
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <h3 className="text-lg font-semibold mb-4 text-gray-800">Capacity Factor by Technology</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="name" />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value) => `${value}%`}
            label={{ value: 'Capacity Factor (%)', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value) => [`${value}%`, '']}
            labelFormatter={(label) => `Technology: ${label}`}
          />
          <Legend />
          <Bar dataKey="Simple Avg" fill="#3b82f6" name="Simple Average" />
          <Bar dataKey="Weighted Avg" fill="#10b981" name="Capacity-Weighted Average" />
        </BarChart>
      </ResponsiveContainer>

      {/* Data table for accessibility */}
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 px-4 text-gray-600">Technology</th>
              <th className="text-right py-2 px-4 text-gray-600">Simple Avg CF</th>
              <th className="text-right py-2 px-4 text-gray-600">Weighted Avg CF</th>
              <th className="text-right py-2 px-4 text-gray-600">Capacity (MW)</th>
              <th className="text-right py-2 px-4 text-gray-600">Records</th>
            </tr>
          </thead>
          <tbody>
            {byTechnology.map((t) => (
              <tr key={t.technology} className="border-b hover:bg-gray-50">
                <td className="py-2 px-4 text-gray-800">{t.technology}</td>
                <td className="text-right py-2 px-4 text-gray-800">
                  {(t.avgCapacityFactor * 100).toFixed(1)}%
                </td>
                <td className="text-right py-2 px-4 text-gray-800">
                  {(t.weightedAvgCapacityFactor * 100).toFixed(1)}%
                </td>
                <td className="text-right py-2 px-4 text-gray-800">
                  {t.totalCapacityMW.toLocaleString()}
                </td>
                <td className="text-right py-2 px-4 text-gray-800">
                  {t.count.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
