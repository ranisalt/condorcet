import type { PairwiseCount } from "./condorcet.ts";
import examples from "./explainers.json" with { type: "json" };

export const letters = ["A", "B", "C"] as const;
export type Letter = (typeof letters)[number];
export type BallotGroup = { count: number; order: readonly Letter[] };
export type Duel = { winner: Letter; loser: Letter; winnerVotes: number; loserVotes: number };

/** IDs used when feeding the examples to the real algorithms: A=0, B=1, C=2. */
export const candidateIds = [0, 1, 2] as const;

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
export const strength = groups(examples.strength);

export function total(ballots: readonly BallotGroup[]): number {
  return ballots.reduce((sum, { count }) => sum + count, 0);
}

function prefers(ballots: readonly BallotGroup[], x: Letter, y: Letter): number {
  return total(ballots.filter(({ order }) => order.indexOf(x) < order.indexOf(y)));
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

export function firstChoices(ballots: readonly BallotGroup[]): Record<Letter, number> {
  const totals: Record<Letter, number> = { A: 0, B: 0, C: 0 };
  for (const { count, order } of ballots) totals[order[0]] += count;
  return totals;
}

export function copelandScores(ballots: readonly BallotGroup[]): Record<Letter, number> {
  const scores: Record<Letter, number> = { A: 0, B: 0, C: 0 };
  for (const { winner, loser } of duels(ballots)) {
    scores[winner] += 1;
    scores[loser] -= 1;
  }
  return scores;
}

/** Tideman: duels by margin then winning votes, each locked unless it closes a cycle. */
export function lockSequence(ballots: readonly BallotGroup[]): { duel: Duel; locked: boolean }[] {
  const margin = (d: Duel) => d.winnerVotes - d.loserVotes;
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

/** Schulze strongest path for exactly three candidates: the direct win or a two-step chain. */
export function strongestPath(
  ballots: readonly BallotGroup[],
  from: Letter,
  to: Letter,
): { path: Letter[]; strength: number } {
  const win = (x: Letter, y: Letter) => {
    const d = duel(ballots, x, y);
    return d.winner === x ? d.winnerVotes : 0;
  };
  const middle = letters.find((l) => l !== from && l !== to) ?? from;
  const direct = win(from, to);
  const indirect = Math.min(win(from, middle), win(middle, to));
  return direct >= indirect
    ? { path: [from, to], strength: direct }
    : { path: [from, middle, to], strength: indirect };
}
