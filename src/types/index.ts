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

// ============================================
// Retirement Page Types
// ============================================

// Generator retirement record from joined tables
export interface RetirementRecord {
  plant_id_eia: number;
  plant_name_eia: string;
  generator_id: string;
  state: string;
  county: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  capacity_mw: number;
  fuel_type_code_pudl: string | null;
  operational_status: string;
  planned_generator_retirement_date: string | null;
  generator_retirement_date: string | null;
  extended: boolean;
  original_retirement_date: string | null;
}

// Retirement filter state
export interface RetirementFilters {
  state: string;
  status: 'all' | 'planned' | 'retired' | 'operating';
  fuelType: string;
}

// US States for dropdown
export const US_STATES = [
  { value: '', label: 'All States' },
  { value: 'AL', label: 'Alabama' },
  { value: 'AK', label: 'Alaska' },
  { value: 'AZ', label: 'Arizona' },
  { value: 'AR', label: 'Arkansas' },
  { value: 'CA', label: 'California' },
  { value: 'CO', label: 'Colorado' },
  { value: 'CT', label: 'Connecticut' },
  { value: 'DE', label: 'Delaware' },
  { value: 'FL', label: 'Florida' },
  { value: 'GA', label: 'Georgia' },
  { value: 'HI', label: 'Hawaii' },
  { value: 'ID', label: 'Idaho' },
  { value: 'IL', label: 'Illinois' },
  { value: 'IN', label: 'Indiana' },
  { value: 'IA', label: 'Iowa' },
  { value: 'KS', label: 'Kansas' },
  { value: 'KY', label: 'Kentucky' },
  { value: 'LA', label: 'Louisiana' },
  { value: 'ME', label: 'Maine' },
  { value: 'MD', label: 'Maryland' },
  { value: 'MA', label: 'Massachusetts' },
  { value: 'MI', label: 'Michigan' },
  { value: 'MN', label: 'Minnesota' },
  { value: 'MS', label: 'Mississippi' },
  { value: 'MO', label: 'Missouri' },
  { value: 'MT', label: 'Montana' },
  { value: 'NE', label: 'Nebraska' },
  { value: 'NV', label: 'Nevada' },
  { value: 'NH', label: 'New Hampshire' },
  { value: 'NJ', label: 'New Jersey' },
  { value: 'NM', label: 'New Mexico' },
  { value: 'NY', label: 'New York' },
  { value: 'NC', label: 'North Carolina' },
  { value: 'ND', label: 'North Dakota' },
  { value: 'OH', label: 'Ohio' },
  { value: 'OK', label: 'Oklahoma' },
  { value: 'OR', label: 'Oregon' },
  { value: 'PA', label: 'Pennsylvania' },
  { value: 'RI', label: 'Rhode Island' },
  { value: 'SC', label: 'South Carolina' },
  { value: 'SD', label: 'South Dakota' },
  { value: 'TN', label: 'Tennessee' },
  { value: 'TX', label: 'Texas' },
  { value: 'UT', label: 'Utah' },
  { value: 'VT', label: 'Vermont' },
  { value: 'VA', label: 'Virginia' },
  { value: 'WA', label: 'Washington' },
  { value: 'WV', label: 'West Virginia' },
  { value: 'WI', label: 'Wisconsin' },
  { value: 'WY', label: 'Wyoming' },
] as const;

// Operational status options
export const OPERATIONAL_STATUS_OPTIONS = [
  { value: 'all', label: 'All Generators' },
  { value: 'planned', label: 'Planned Retirement' },
  { value: 'retired', label: 'Already Retired' },
  { value: 'operating', label: 'Operating (No Retirement Date)' },
] as const;

// Fuel types for retirement filter (includes all)
export const RETIREMENT_FUEL_TYPES = [
  { value: '', label: 'All Fuel Types' },
  { value: 'gas', label: 'Natural Gas' },
  { value: 'coal', label: 'Coal' },
  { value: 'nuclear', label: 'Nuclear' },
  { value: 'wind', label: 'Wind' },
  { value: 'solar', label: 'Solar' },
  { value: 'hydro', label: 'Hydro' },
  { value: 'oil', label: 'Oil' },
  { value: 'waste', label: 'Waste' },
  { value: 'other', label: 'Other' },
] as const;
