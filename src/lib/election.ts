export type Candidate = {
  id: number;
  name: string;
  number: string;
  party: string;
  vice: { name: string; party: string };
};

/** The only election title the catalog has; the config may name no other. */
export const electionTitleKey = "election_br_2026_title";

export type Election = {
  id: string;
  titleKey: typeof electionTitleKey;
  closesAt: string | null;
  sources: string[];
  candidates: Candidate[];
};

export type ElectionConfig = { currentElectionId: string | null; elections: Election[] };
export type BallotDraft = { ranked: number[]; order: number[] };
export type DraftEdit = { type: "add" | "remove" | "up" | "down"; candidateId: number };

export class InvalidBallotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidBallotError";
  }
}

export function isElectionOpen(election: Election, now: Date): boolean {
  return election.closesAt === null || now.getTime() < Date.parse(election.closesAt);
}

function candidateIdsByString(candidates: Candidate[]): Map<string, number> {
  const ids = new Map<string, number>();
  for (const candidate of candidates) {
    ids.set(String(candidate.id), candidate.id);
  }
  return ids;
}

export function parseRankedIds(values: FormDataEntryValue[], candidates: Candidate[]): number[] {
  const idByString = candidateIdsByString(candidates);
  const seen = new Set<number>();
  const ranked: number[] = [];

  for (const value of values) {
    if (typeof value !== "string")
      throw new InvalidBallotError("Candidate IDs must be text values");
    const candidateId = idByString.get(value);
    if (candidateId === undefined || seen.has(candidateId)) {
      throw new InvalidBallotError("Candidate ID is unknown or duplicated");
    }
    seen.add(candidateId);
    ranked.push(candidateId);
  }

  return ranked;
}

/** A request names its election once, as text, and it must be the current one. */
export function checkElectionId(
  electionIds: readonly FormDataEntryValue[],
  election: Election,
): "invalid" | "stale" | null {
  if (electionIds.length !== 1 || typeof electionIds[0] !== "string") return "invalid";
  return electionIds[0] === election.id ? null : "stale";
}

/** Reads a draft's candidate order and ranking. The caller checks the election id. */
export function parseDraft(form: FormData, election: Election): BallotDraft {
  const order = parseRankedIds(form.getAll("candidateOrderId"), election.candidates);
  if (order.length !== election.candidates.length) {
    throw new InvalidBallotError("Candidate order must include every candidate exactly once");
  }

  const ranked = parseRankedIds(form.getAll("candidateId"), election.candidates);
  return { ranked, order };
}

export function parseDraftEdit(
  value: FormDataEntryValue | null,
  candidates: Candidate[],
): DraftEdit {
  if (typeof value !== "string")
    throw new InvalidBallotError("Edit operation must be a text value");

  const match = /^(add|remove|up|down):(\d+)$/.exec(value);
  const type = match?.[1];
  const candidateIdText = match?.[2];
  if (
    (type !== "add" && type !== "remove" && type !== "up" && type !== "down") ||
    candidateIdText === undefined
  ) {
    throw new InvalidBallotError("Edit operation is malformed");
  }

  const candidateId = candidateIdsByString(candidates).get(candidateIdText);
  if (candidateId === undefined)
    throw new InvalidBallotError("Edit operation references an unknown candidate");
  return { type, candidateId };
}

export function editDraft(draft: BallotDraft, edit: DraftEdit): BallotDraft {
  const ranked = [...draft.ranked];
  const order = [...draft.order];
  if (!order.includes(edit.candidateId)) return { ranked, order };

  if (edit.type === "add") {
    if (!ranked.includes(edit.candidateId)) ranked.push(edit.candidateId);
    return { ranked, order };
  }

  const index = ranked.indexOf(edit.candidateId);
  if (edit.type === "remove") {
    if (index !== -1) ranked.splice(index, 1);
    return { ranked, order };
  }

  if (index === -1) return { ranked, order };
  const target = edit.type === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= ranked.length) return { ranked, order };
  const moving = ranked[index];
  const adjacent = ranked[target];
  if (moving === undefined || adjacent === undefined) return { ranked, order };
  ranked[index] = adjacent;
  ranked[target] = moving;
  return { ranked, order };
}

export function shuffle<T>(values: readonly T[], random: () => number = Math.random): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const sample = random();
    if (!Number.isFinite(sample) || sample < 0 || sample >= 1) {
      throw new RangeError("Random source must return a finite value in [0, 1)");
    }
    const swapIndex = Math.floor(sample * (index + 1));
    const current = shuffled[index];
    const selected = shuffled[swapIndex];
    shuffled[index] = selected;
    shuffled[swapIndex] = current;
  }
  return shuffled;
}
