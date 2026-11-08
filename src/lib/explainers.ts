import { summarizeCondorcet, type PairwiseCount } from "./condorcet.ts";
import examples from "./explainers.json" with { type: "json" };
import { summarizeMethods } from "./voting-methods.ts";

export const letters = ["A", "B", "C"] as const;
export type Letter = (typeof letters)[number];
export type BallotGroup = { count: number; order: readonly Letter[] };
export type Duel = { winner: Letter; loser: Letter; winnerVotes: number; loserVotes: number };

/** IDs used when feeding the examples to the real algorithms: A=0, B=1, C=2. */
const candidateIds = letters.map((_, id) => id);

function perLetter<T>(value: (letter: Letter) => T): Record<Letter, T> {
  return Object.fromEntries(letters.map((letter) => [letter, value(letter)])) as Record<Letter, T>;
}

function isLetter(value: string): value is Letter {
  return (letters as readonly string[]).includes(value);
}

function groups(raw: readonly { count: number; order: readonly string[] }[]): BallotGroup[] {
  return raw.map(({ count, order }) => {
    const letterOrder = order.filter(isLetter);
    if (letterOrder.length !== letters.length || new Set(letterOrder).size !== letters.length) {
      throw new TypeError(`Invalid example ballot ${order.join(">")}`);
    }
    return { count, order: letterOrder };
  });
}

export const cycle = groups(examples.cycle);
export const squeeze = groups(examples.squeeze);
export const uneven = groups(examples.uneven);

export function total(ballots: readonly BallotGroup[]): number {
  return ballots.reduce((sum, { count }) => sum + count, 0);
}

/** The ballot groups that rank x above y. */
export function supporters(ballots: readonly BallotGroup[], x: Letter, y: Letter): BallotGroup[] {
  return ballots.filter(({ order }) => order.indexOf(x) < order.indexOf(y));
}

function prefers(ballots: readonly BallotGroup[], x: Letter, y: Letter): number {
  return total(supporters(ballots, x, y));
}

export function pairwise(ballots: readonly BallotGroup[]): PairwiseCount[] {
  return letters.flatMap((x) =>
    letters
      .filter((y) => y !== x)
      .map((y) => ({
        preferredId: letters.indexOf(x),
        otherId: letters.indexOf(y),
        votes: prefers(ballots, x, y),
      })),
  );
}

/** The head-to-head result between x and y, whichever wins. */
export function duel(ballots: readonly BallotGroup[], x: Letter, y: Letter): Duel {
  const xVotes = prefers(ballots, x, y);
  const yVotes = prefers(ballots, y, x);
  if (xVotes === yVotes) throw new Error(`Example has a tied duel ${x}×${y}`);
  return xVotes > yVotes
    ? { winner: x, loser: y, winnerVotes: xVotes, loserVotes: yVotes }
    : { winner: y, loser: x, winnerVotes: yVotes, loserVotes: xVotes };
}

/** All three duels, in the order A×B, B×C, C×A, so a cycle reads A→B→C→A. */
export function duels(ballots: readonly BallotGroup[]): Duel[] {
  return [duel(ballots, "A", "B"), duel(ballots, "B", "C"), duel(ballots, "C", "A")];
}

export function margin(d: Duel): number {
  return d.winnerVotes - d.loserVotes;
}

export function firstChoices(ballots: readonly BallotGroup[]): Record<Letter, number> {
  const totals = perLetter(() => 0);
  for (const { count, order } of ballots) totals[order[0]] += count;
  return totals;
}

export type CopelandRecord = { wins: number; losses: number; score: number };

export function copelandRecords(ballots: readonly BallotGroup[]): Record<Letter, CopelandRecord> {
  const results = duels(ballots);
  return perLetter((letter) => {
    const wins = results.filter((d) => d.winner === letter).length;
    const losses = results.filter((d) => d.loser === letter).length;
    return { wins, losses, score: wins - losses };
  });
}

/** The record every candidate shares when Copeland ties them all. */
export function sharedCopelandRecord(ballots: readonly BallotGroup[]): CopelandRecord {
  const records = copelandRecords(ballots);
  const [first, ...rest] = letters.map((letter) => records[letter]);
  const differs = (r: CopelandRecord) =>
    r.wins !== first.wins || r.losses !== first.losses || r.score !== first.score;
  if (rest.some(differs)) throw new Error("Copeland records differ");
  return first;
}

/** The first round: the two most-voted first choices go on, the third is eliminated. */
export function firstRound(ballots: readonly BallotGroup[]): {
  finalists: [Letter, Letter];
  eliminated: Letter;
} {
  const first = firstChoices(ballots);
  if (letters.some((letter) => first[letter] * 2 > total(ballots))) {
    throw new Error("Example has a first-round majority");
  }
  const [a, b, eliminated] = [...letters].sort((x, y) => first[y] - first[x]);
  return { finalists: [a, b], eliminated };
}

function winners(ballots: readonly BallotGroup[]) {
  const { matrix, winnerId } = summarizeCondorcet(candidateIds, pairwise(ballots));
  return { winnerId, ...summarizeMethods(candidateIds, matrix) };
}

const toLetters = (ids: readonly number[]) => ids.map((id) => letters[id]);

/** The strict Condorcet winner, or null when there is a cycle. */
export function condorcetWinner(ballots: readonly BallotGroup[]): Letter | null {
  const { winnerId } = winners(ballots);
  return winnerId === null ? null : letters[winnerId];
}

/** The winner Copeland, Schulze and Tideman each pick, from the production algorithms. */
export function methodWinners(
  ballots: readonly BallotGroup[],
): Record<"copeland" | "schulze" | "tideman", Letter[]> {
  const result = winners(ballots);
  return {
    copeland: toLetters(result.copeland.winnerIds),
    schulze: toLetters(result.schulze.winnerIds),
    tideman: toLetters(result.rankedPairs.winnerIds),
  };
}

/** The single winner Schulze and Tideman both pick, or an error if they disagree. */
export function sharedWinner(ballots: readonly BallotGroup[]): Letter {
  const { schulze, tideman } = methodWinners(ballots);
  if (schulze.length !== 1 || tideman.length !== 1 || schulze[0] !== tideman[0]) {
    throw new Error("Schulze and Tideman do not share one winner");
  }
  return schulze[0];
}

/** Tideman: duels by margin then winning votes, each locked unless it closes a cycle. */
export function lockSequence(ballots: readonly BallotGroup[]): { duel: Duel; locked: boolean }[] {
  const ordered = duels(ballots).sort(
    (a, b) => margin(b) - margin(a) || b.winnerVotes - a.winnerVotes,
  );
  const locked: Duel[] = [];
  const reaches = (from: Letter, to: Letter): boolean =>
    from === to || locked.some((edge) => edge.winner === from && reaches(edge.loser, to));
  return ordered.map((d) => {
    const lock = !reaches(d.loser, d.winner);
    if (lock) locked.push(d);
    return { duel: d, locked: lock };
  });
}

/** The duel Tideman ignores because it closes a cycle. */
export function skippedDuel(ballots: readonly BallotGroup[]): Duel {
  const skipped = lockSequence(ballots).find((step) => !step.locked);
  if (!skipped) throw new Error("Example has no skipped duel");
  return skipped.duel;
}

/** The ranking left by the locked duels, from the candidate nobody beats down. */
export function lockedOrder(ballots: readonly BallotGroup[]): Letter[] {
  const locked = lockSequence(ballots)
    .filter((step) => step.locked)
    .map((step) => step.duel);
  const beatenBy = (letter: Letter) => locked.filter((d) => d.loser === letter).length;
  return [...letters].sort((a, b) => beatenBy(a) - beatenBy(b));
}

/** Schulze strongest path for exactly three candidates: the direct win or a two-step chain. */
export function strongestPath(
  ballots: readonly BallotGroup[],
  from: Letter,
  to: Letter,
): { path: Letter[]; strength: number; links: Duel[] } {
  const win = (x: Letter, y: Letter) => {
    const d = duel(ballots, x, y);
    return d.winner === x ? d.winnerVotes : 0;
  };
  const middle = letters.find((l) => l !== from && l !== to);
  if (middle === undefined) throw new Error(`No middle candidate between ${from} and ${to}`);
  const direct = win(from, to);
  const indirect = Math.min(win(from, middle), win(middle, to));
  const path = direct >= indirect ? [from, to] : [from, middle, to];
  return {
    path,
    strength: Math.max(direct, indirect),
    links: path.slice(1).map((step, index) => duel(ballots, path[index], step)),
  };
}
