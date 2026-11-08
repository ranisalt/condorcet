import { getLocale } from "#lib/paraglide/runtime.js";

/** Formats a count in the active Paraglide locale. */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat(getLocale()).format(value);
}
