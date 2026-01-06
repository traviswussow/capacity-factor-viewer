// Generator data from out_eia__monthly_generators
export interface Generator {
  plant_id_eia: number;
  plant_name_eia: string;
  generator_id: string;
  report_date: string;
  balancing_authority_code_eia: string;
  fuel_type_code_pudl: string;
  prime_mover_code: string;
  technology_description: string;
  capacity_mw: number;
  capacity_factor: number;
  net_generation_mwh: number;
  associated_combined_heat_power: boolean;
}

// Aggregated capacity factor data for charts
export interface CapacityFactorSummary {
  fuel_type: string;
  technology_type: 'simple_cycle' | 'combined_cycle' | 'other';
  year: number;
  season: 'annual' | 'summer' | 'winter';
  avg_capacity_factor: number;
  weighted_avg_capacity_factor: number;
  median_capacity_factor: number;
  total_capacity_mw: number;
  total_generation_mwh: number;
  generator_count: number;
}

// Time series data for trend charts
export interface CapacityFactorTrend {
  year: number;
  avg_capacity_factor: number;
  weighted_avg_capacity_factor: number;
}

// Filter state
export interface FilterState {
  region: string;
  fuelType: string;
  year: number;
  technology: 'all' | 'simple_cycle' | 'combined_cycle';
  season: 'annual' | 'summer' | 'winter';
}

// Stats for the stats cards
export interface Stats {
  generatorCount: number;
  totalCapacityGW: number;
  avgCapacityFactor: number;
  weightedAvgCapacityFactor: number;
  medianCapacityFactor: number;
  totalGenerationTWh: number;
}

// Valid regions (major ISOs)
export const REGIONS = [
  { value: 'ERCO', label: 'ERCOT (Texas)' },
  { value: 'MISO', label: 'MISO (Midwest)' },
  { value: 'PJM', label: 'PJM (Mid-Atlantic)' },
  { value: 'CISO', label: 'CAISO (California)' },
  { value: 'SWPP', label: 'SPP (Southwest Power Pool)' },
  { value: 'NYIS', label: 'NYISO (New York)' },
  { value: 'ISNE', label: 'ISO-NE (New England)' },
] as const;

// Valid fuel types
export const FUEL_TYPES = [
  { value: 'gas', label: 'Natural Gas' },
  { value: 'coal', label: 'Coal' },
  { value: 'nuclear', label: 'Nuclear' },
  { value: 'wind', label: 'Wind' },
  { value: 'solar', label: 'Solar' },
  { value: 'hydro', label: 'Hydro' },
] as const;

// Prime mover mappings
export const SIMPLE_CYCLE_CODES = ['GT'] as const;
export const COMBINED_CYCLE_CODES = ['CT', 'CA', 'CC', 'CS'] as const;

// Season month mappings
export const SEASON_MONTHS = {
  annual: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  summer: [6, 7, 8],
  winter: [12, 1, 2],
} as const;

// Year range
export const MIN_YEAR = 2001;
export const MAX_YEAR = 2024;
export const DEFAULT_YEAR = 2024;
