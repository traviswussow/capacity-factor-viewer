import {
  REGIONS,
  FUEL_TYPES,
  MIN_YEAR,
  MAX_YEAR,
  SIMPLE_CYCLE_CODES,
  COMBINED_CYCLE_CODES,
  SEASON_MONTHS,
  type Season,
} from '@/types';

// Valid region codes
const VALID_REGIONS: Set<string> = new Set(REGIONS.map(r => r.value));

// Valid fuel types
const VALID_FUEL_TYPES: Set<string> = new Set(FUEL_TYPES.map(f => f.value));

// Valid seasons
const VALID_SEASONS: Set<string> = new Set(['annual', 'winter', 'spring', 'summer', 'fall']);

// Valid technology filters
const VALID_TECHNOLOGIES: Set<string> = new Set(['all', 'simple_cycle', 'combined_cycle']);

export function validateRegion(region: string | null): string {
  if (!region || !VALID_REGIONS.has(region)) {
    return 'ERCO'; // Default to ERCOT
  }
  return region;
}

export function validateFuelType(fuelType: string | null): string {
  if (!fuelType || !VALID_FUEL_TYPES.has(fuelType)) {
    return 'gas'; // Default to natural gas
  }
  return fuelType;
}

export function validateYear(year: number | null): number {
  if (year === null || isNaN(year) || year < MIN_YEAR || year > MAX_YEAR) {
    return MAX_YEAR; // Default to most recent year
  }
  return Math.floor(year);
}

export function validateSeason(season: string | null): Season {
  if (!season || !VALID_SEASONS.has(season)) {
    return 'annual';
  }
  return season as Season;
}

export function validateTechnology(tech: string | null): 'all' | 'simple_cycle' | 'combined_cycle' {
  if (!tech || !VALID_TECHNOLOGIES.has(tech)) {
    return 'all';
  }
  return tech as 'all' | 'simple_cycle' | 'combined_cycle';
}

// Build prime mover filter based on technology selection
export function getPrimeMoverCodes(technology: 'all' | 'simple_cycle' | 'combined_cycle'): string[] {
  switch (technology) {
    case 'simple_cycle':
      return [...SIMPLE_CYCLE_CODES];
    case 'combined_cycle':
      return [...COMBINED_CYCLE_CODES];
    case 'all':
    default:
      return [...SIMPLE_CYCLE_CODES, ...COMBINED_CYCLE_CODES];
  }
}

// Get month numbers for season filter
export function getSeasonMonths(season: Season): number[] {
  return [...SEASON_MONTHS[season]];
}

// Validate and sanitize all filter params
export interface ValidatedFilters {
  region: string;
  fuelType: string;
  year: number;
  season: Season;
  technology: 'all' | 'simple_cycle' | 'combined_cycle';
}

export function validateFilters(params: {
  region?: string | null;
  fuelType?: string | null;
  year?: number | null;
  season?: string | null;
  technology?: string | null;
}): ValidatedFilters {
  return {
    region: validateRegion(params.region ?? null),
    fuelType: validateFuelType(params.fuelType ?? null),
    year: validateYear(params.year ?? null),
    season: validateSeason(params.season ?? null),
    technology: validateTechnology(params.technology ?? null),
  };
}
