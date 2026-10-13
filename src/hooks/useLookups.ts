import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

// ============================================================================
// TYPES
// ============================================================================

export interface LookupValue {
  id: number;
  code: string;
  label: string;
  description: string | null;
  icon: string | null;
  color: string | null;
  metadata: Record<string, any> | null;
  sort_order: number;
}

export interface LookupCategory {
  id: number;
  code: string;
  name: string;
  description: string | null;
  allow_custom: boolean;
  sort_order: number;
}

interface LookupsResponse {
  success: true;
  lookups: Record<string, LookupValue[]>;
}

interface CategoriesResponse {
  success: true;
  categories: LookupCategory[];
}

interface SingleCategoryResponse {
  success: true;
  category: string;
  values: LookupValue[];
}

// ============================================================================
// HOOKS
// ============================================================================

/**
 * Get lookup values for multiple categories
 * @param categories - Array of category codes (e.g., ['benefits', 'skin_types'])
 * @param options - React Query options
 */
export function useLookups(categories?: string[]) {
  return useQuery({
    queryKey: ['lookups', categories],
    queryFn: async () => {
      const params = categories ? `?categories=${categories.join(',')}` : '';
      const response = await api.get<LookupsResponse>(`/lookups${params}`);
      return response.lookups;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    // Renamed from `cacheTime` in TanStack Query v5. The old name is not just
    // ignored — it fails the overload, which degrades this hook's return type to
    // `{}` and takes about sixty errors in ProductFormPage with it.
    gcTime: 30 * 60 * 1000,
    retry: 2,
  });
}

/**
 * Get a single category's values
 * @param categoryCode - Category code (e.g., 'benefits')
 */
export function useLookupCategory(categoryCode: string) {
  return useQuery({
    queryKey: ['lookup', categoryCode],
    queryFn: async () => {
      const response = await api.get<SingleCategoryResponse>(`/lookups/${categoryCode}`);
      return response.values;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    enabled: !!categoryCode,
  });
}

/**
 * Get all lookup categories (metadata)
 */
export function useLookupCategories() {
  return useQuery({
    queryKey: ['lookupCategories'],
    queryFn: async () => {
      const response = await api.get<CategoriesResponse>('/lookups/categories');
      return response.categories;
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 60 * 60 * 1000,
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Convert lookup values to simple options for dropdowns
 */
export function lookupToOptions(values: LookupValue[] | undefined) {
  if (!values) return [];
  return values.map((v) => ({
    value: v.code,
    label: v.label,
  }));
}

/**
 * Find lookup value by code
 */
export function findLookupValue(
  values: LookupValue[] | undefined,
  code: string,
): LookupValue | undefined {
  return values?.find((v) => v.code === code);
}

/**
 * Convert CSV string to lookup values
 */
export function csvToLookupValues(
  csv: string,
  lookupValues: LookupValue[] | undefined,
): LookupValue[] {
  if (!csv || !lookupValues) return [];
  const codes = csv
    .split(',')
    .map((c) => c.trim())
    .filter(Boolean);
  return codes
    .map((code) => lookupValues.find((v) => v.code === code))
    .filter((v): v is LookupValue => v !== undefined);
}

/**
 * Convert lookup values to CSV string
 */
export function lookupValuesToCSV(
  values: readonly (LookupValue | string)[],
): string {
  // The `freeSolo` Autocompletes hand back a plain string for anything the
  // user typed that is not in the lookup list; store that text as its own code.
  return values
    .map((v) => (typeof v === 'string' ? v.trim() : v.code))
    .filter(Boolean)
    .join(', ');
}
