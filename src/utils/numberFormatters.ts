/**
 * Utilities for formatting money inputs with Vietnamese thousand separator dots (.)
 * Example: '50000000' -> '50.000.000'
 */

// Formats a raw digit string or number to thousand-separated dots (e.g. '50000000' -> '50.000.000')
export function formatCurrencyInput(val: string | number): string {
  if (val === undefined || val === null) return '';
  const str = String(val).trim();
  if (!str) return '';
  // Strip everything except digits
  const digits = str.replace(/\D/g, '');
  if (!digits) return '';
  // Remove leading zeros unless it's just '0'
  const cleanDigits = digits.replace(/^0+(?=\d)/, '');
  // Insert dots as thousand separators
  return cleanDigits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Parses a dot-formatted string back to a pure numeric value (e.g. '50.000.000' -> 50000000)
export function parseCurrencyInput(val: string | number): number {
  if (val === undefined || val === null) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  const digits = String(val).replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}
