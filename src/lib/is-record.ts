/** A plain object (not null, not an array), as parsed JSON exposes it. */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
