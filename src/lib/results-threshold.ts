/**
 * Parses RESULTS_THRESHOLD, the number of valid ballots needed before results unlock. Unset or
 * empty means the threshold is not defined yet, so results stay locked.
 */
export function parseResultsThreshold(value: string | undefined): number | null {
  const trimmed = value?.trim() ?? "";
  if (trimmed === "") return null;
  if (!/^\d+$/.test(trimmed) || Number(trimmed) <= 0 || !Number.isSafeInteger(Number(trimmed))) {
    throw new Error("RESULTS_THRESHOLD must be a positive integer");
  }
  return Number(trimmed);
}
