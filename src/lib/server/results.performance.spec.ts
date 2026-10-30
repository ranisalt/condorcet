import { expect, it } from "vitest";
import { currentElection } from "./election.ts";
import { openTestD1 } from "../../test/d1.ts";
import { readElectionCounts } from "./ballots.ts";
import { buildPairwiseCountsQuery, readPairwiseCounts, readResults } from "./results.ts";
import { getDb } from "./db/index.ts";

const validBallots = 10_000;
const blankBallots = 100;
const batchSize = 80;
const maxParametersPerStatement = 80;
const performanceTest = process.env.RUN_PERF === "1" ? it : it.skip;

type BoundValue = string | number | null;
type BoundRow = readonly BoundValue[];

async function insertRows(
  d1: D1Database,
  table: string,
  columns: readonly string[],
  rows: Iterable<BoundRow>,
): Promise<number> {
  const maxRowsPerStatement = Math.floor(maxParametersPerStatement / columns.length);
  let pending: D1PreparedStatement[] = [];
  let rowBuffer: BoundRow[] = [];
  let maxParameters = 0;

  const prepareInsert = (batchRows: readonly BoundRow[]) => {
    const placeholders = batchRows.map(() => `(${columns.map(() => "?").join(",")})`).join(",");
    const statement = `INSERT INTO ${table} (${columns.join(",")}) VALUES ${placeholders}`;
    const parameters = batchRows.flatMap((row) => [...row]);
    maxParameters = Math.max(maxParameters, parameters.length);
    if (parameters.length > maxParametersPerStatement) {
      throw new Error(`Fixture statement exceeded ${maxParametersPerStatement} bound parameters`);
    }
    return d1.prepare(statement).bind(...parameters);
  };

  for (const row of rows) {
    if (row.length !== columns.length) throw new Error("Fixture row does not match its columns");
    rowBuffer.push(row);
    if (rowBuffer.length === maxRowsPerStatement) {
      pending.push(prepareInsert(rowBuffer));
      rowBuffer = [];
    }
    if (pending.length === batchSize) {
      await d1.batch(pending);
      pending = [];
    }
  }

  if (rowBuffer.length > 0) pending.push(prepareInsert(rowBuffer));
  if (pending.length > 0) await d1.batch(pending);
  return maxParameters;
}

function* participantRows(electionId: string, count: number, now: number): Generator<BoundRow> {
  for (let index = 0; index < count; index += 1) {
    yield [electionId, `perf-voter-${index}`, now, now];
  }
}

function* rankRows(electionId: string, candidateIds: readonly number[]): Generator<BoundRow> {
  for (let userIndex = 0; userIndex < validBallots; userIndex += 1) {
    for (const [position, candidateId] of candidateIds.entries()) {
      yield [electionId, `perf-voter-${userIndex}`, candidateId, position];
    }
  }
}

performanceTest(
  "aggregates 10,000 full-ranked ballots with bounded D1 statements",
  async () => {
    if (currentElection === null) throw new Error("Performance test requires a selected election");
    const { d1, dispose } = await openTestD1();
    try {
      const now = new Date("2026-10-15T12:00:00.000Z").getTime();
      const candidateIds = currentElection.candidates.map((candidate) => candidate.id);
      const participantParamCount = await insertRows(
        d1,
        "election_participant",
        ["election_id", "voter_id", "acknowledged_at", "submitted_at"],
        participantRows(currentElection.id, validBallots + blankBallots, now),
      );
      const rankParamCount = await insertRows(
        d1,
        "ballot_rank",
        ["election_id", "voter_id", "candidate_id", "position"],
        rankRows(currentElection.id, candidateIds),
      );
      expect(Math.max(participantParamCount, rankParamCount)).toBeLessThanOrEqual(
        maxParametersPerStatement,
      );

      const startedAt = performance.now();
      const results = await readResults(d1, currentElection, "perf-voter-0", validBallots);
      const durationMs = performance.now() - startedAt;
      const counts = await readElectionCounts(d1, currentElection.id);
      const pairs = await readPairwiseCounts(d1, currentElection);
      expect(counts).toEqual({ validCount: validBallots, blankCount: blankBallots });
      expect(results.state).toBe("available");
      if (results.state !== "available")
        throw new Error("Threshold-sized fixture should unlock results");
      expect(results.validCount).toBe(validBallots);
      expect(results.blankCount).toBe(blankBallots);
      expect(pairs.length).toBeLessThanOrEqual(candidateIds.length * (candidateIds.length - 1));
      expect(JSON.stringify(results)).not.toContain("perf-voter-");
      expect(JSON.stringify(results).length).toBeLessThan(32 * 1024);

      const query = buildPairwiseCountsQuery(getDb(d1), currentElection).toSQL();
      const plan = await d1
        .prepare(`EXPLAIN QUERY PLAN ${query.sql}`)
        .bind(...query.params)
        .all<{ detail: string }>();
      expect(
        plan.results.some(
          (row) =>
            row.detail.includes("SEARCH opponent") &&
            (row.detail.includes("INDEX") || row.detail.includes("PRIMARY KEY")),
        ),
      ).toBe(true);
      console.info(
        `10k-ballot D1 scale: ${validBallots} valid, ${blankBallots} blank, ${candidateIds.length} candidates, ${durationMs.toFixed(1)} ms readResults`,
      );
    } finally {
      await dispose();
    }
  },
  120_000,
);
