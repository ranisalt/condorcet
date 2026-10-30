import { expect, it } from "vitest";
import { parseResultsThreshold } from "./results-threshold.ts";

it("treats an unset or empty threshold as not yet defined", () => {
  expect(parseResultsThreshold(undefined)).toBeNull();
  expect(parseResultsThreshold("")).toBeNull();
  expect(parseResultsThreshold("  ")).toBeNull();
});

it("parses a positive integer threshold", () => {
  expect(parseResultsThreshold("10000")).toBe(10_000);
  expect(parseResultsThreshold(" 1 ")).toBe(1);
});

it("rejects thresholds that are not positive integers", () => {
  for (const value of ["0", "-1", "1.5", "1e3", "abc", "10 000", "0x10"]) {
    expect(() => parseResultsThreshold(value)).toThrow("RESULTS_THRESHOLD");
  }
});
