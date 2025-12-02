/**
 * Centralized normalization functions for taxonomy values.
 * All taxonomy data (from JSON, CSV, or user input) should go through these functions.
 */

/**
 * Normalizes a taxonomy value by trimming whitespace and handling common null-like strings.
 * Returns undefined for empty or null-like values ("NA", "n/a", "null", "undefined", etc.)
 */
export function normalizeTaxonValue(value: string | undefined | null): string | undefined {
  if (value == null) return undefined

  const trimmed = value.trim()
  if (!trimmed) return undefined

  const lower = trimmed.toLowerCase()
  if (lower === 'na' || lower === 'n/a' || lower === 'null' || lower === 'undefined' || lower === 'na na') {
    return undefined
  }

  return trimmed
}

/**
 * Safely extracts a string value, returning undefined for non-strings.
 * Use this when reading values from untyped JSON shapes.
 */
export function safeString(value: unknown): string | undefined {
  if (typeof value === 'string') return value
  return undefined
}

/**
 * Safely extracts a number value, returning undefined for non-numbers.
 */
export function safeNumber(value: unknown): number | undefined {
  if (typeof value === 'number') return value
  return undefined
}

/**
 * Normalizes and safely extracts a taxonomy string value.
 * Combines safeString + normalizeTaxonValue for convenience.
 */
export function safeTaxonString(value: unknown): string | undefined {
  const str = safeString(value)
  return normalizeTaxonValue(str)
}

