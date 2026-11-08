import examples from "./explainers.json" with { type: "json" };
import { explainTally, tally, type PairwiseCount } from "./voting-methods.ts";

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

const toLetters = (ids: readonly number[]) => ids.map((id) => letters[id]);

/** The strict Condorcet winner, or null when there is a cycle. */
export function condorcetWinner(ballots: readonly BallotGroup[]): Letter | null {
  const { condorcetWinnerId } = tally(candidateIds, pairwise(ballots));
  return condorcetWinnerId === null ? null : letters[condorcetWinnerId];
}

/** The winner Copeland, Schulze and Tideman each pick, from the production algorithms. */
export function methodWinners(
  ballots: readonly BallotGroup[],
): Record<"copeland" | "schulze" | "tideman", Letter[]> {
  const result = tally(candidateIds, pairwise(ballots)).methods;
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

/** Tideman, as the production Ranked Pairs locks it: duels by margin then winning votes. */
export function lockSequence(ballots: readonly BallotGroup[]): { duel: Duel; locked: boolean }[] {
  return explainTally(candidateIds, pairwise(ballots)).rankedPairs.map((step) => {
    const winner = letters[step.winnerId];
    const loser = letters[step.loserId];
    if (step.locked === null) throw new Error(`Locking ${winner}×${loser} depends on a tie order`);
    return { duel: duel(ballots, winner, loser), locked: step.locked };
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

/** The production Schulze strongest path from one candidate to another, with each link's duel. */
export function strongestPath(
  ballots: readonly BallotGroup[],
  from: Letter,
  to: Letter,
): { path: Letter[]; strength: number; links: Duel[] } {
  const { path: ids, strength } = explainTally(candidateIds, pairwise(ballots)).schulze[
    letters.indexOf(from)
  ][letters.indexOf(to)];
  if (ids.length === 0) throw new Error(`No path from ${from} to ${to}`);
  const path = toLetters(ids);
  return {
    path,
    strength,
    links: path.slice(1).map((step, index) => duel(ballots, path[index], step)),
  };
}
