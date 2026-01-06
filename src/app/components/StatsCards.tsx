'use client';

import { Stats } from '@/types';

interface StatsCardsProps {
  stats: Stats | null;
  loading: boolean;
}

export function StatsCards({ stats, loading }: StatsCardsProps) {
  const cards = [
    {
      label: 'Generators',
      value: stats?.generatorCount ?? 0,
      format: (v: number) => v.toLocaleString(),
    },
    {
      label: 'Total Capacity',
      value: stats?.totalCapacityGW ?? 0,
      format: (v: number) => `${v.toFixed(1)} GW`,
    },
    {
      label: 'Avg CF',
      value: stats?.avgCapacityFactor ?? 0,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      label: 'Weighted Avg CF',
      value: stats?.weightedAvgCapacityFactor ?? 0,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      label: 'Median CF',
      value: stats?.medianCapacityFactor ?? 0,
      format: (v: number) => `${(v * 100).toFixed(1)}%`,
    },
    {
      label: 'Total Generation',
      value: stats?.totalGenerationTWh ?? 0,
      format: (v: number) => `${v.toFixed(1)} TWh`,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="bg-white rounded-lg shadow p-4 text-center"
        >
          <div className="text-sm text-gray-500 mb-1">{card.label}</div>
          {loading ? (
            <div className="h-8 bg-gray-200 rounded animate-pulse" />
          ) : (
            <div className="text-2xl font-bold text-gray-800">
              {card.format(card.value)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
