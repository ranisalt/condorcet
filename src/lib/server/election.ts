import electionConfigJson from "./elections.json";
import type { Candidate, Election, ElectionConfig } from "../election.ts";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const timestampPattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(Z|([+-])(\d{2}):(\d{2}))$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUnknownArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && uuidPattern.test(value);
}

function isNonemptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasValidTimezoneTimestamp(value: string): boolean {
  const match = timestampPattern.exec(value);
  if (match === null) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const offsetHour = match[9] === undefined ? 0 : Number(match[9]);
  const offsetMinute = match[10] === undefined ? 0 : Number(match[10]);
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [31, leapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const maxDay = daysInMonth[month - 1];

  return (
    maxDay !== undefined &&
    day >= 1 &&
    day <= maxDay &&
    hour <= 23 &&
    minute <= 59 &&
    second <= 59 &&
    offsetHour <= 23 &&
    offsetMinute <= 59 &&
    Number.isFinite(Date.parse(value))
  );
}

function parseCandidate(value: unknown, path: string): Candidate {
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);

  const id = value.id;
  const name = value.name;
  const number = value.number;
  const party = value.party;
  const vice = value.vice;
  if (typeof id !== "number" || !Number.isInteger(id) || id < 0 || id > 255) {
    throw new TypeError(`${path}.id must be an integer from 0 to 255`);
  }
  if (!isNonemptyString(name) || !isNonemptyString(number) || !isNonemptyString(party)) {
    throw new TypeError(`${path} must include a name, ballot number, and party`);
  }
  if (!isRecord(vice) || !isNonemptyString(vice.name) || !isNonemptyString(vice.party)) {
    throw new TypeError(`${path}.vice must include a name and party`);
  }

  return { id, name, number, party, vice: { name: vice.name, party: vice.party } };
}

function parseElection(value: unknown, index: number): Election {
  const path = `elections[${index}]`;
  if (!isRecord(value)) throw new TypeError(`${path} must be an object`);

  const id = value.id;
  const titleKey = value.titleKey;
  const closesAt = value.closesAt;
  const resultsThreshold = value.resultsThreshold;
  const rawSources = value.sources;
  const rawCandidates = value.candidates;
  if (!isUuid(id)) throw new TypeError(`${path}.id must be a UUID`);
  if (titleKey !== "election_br_2026_title") throw new TypeError(`${path}.titleKey is unsupported`);
  if (closesAt !== null && (typeof closesAt !== "string" || !hasValidTimezoneTimestamp(closesAt))) {
    throw new TypeError(`${path}.closesAt must be null or a valid timezone-qualified timestamp`);
  }
  if (
    typeof resultsThreshold !== "number" ||
    !Number.isInteger(resultsThreshold) ||
    resultsThreshold <= 0
  ) {
    throw new TypeError(`${path}.resultsThreshold must be a positive integer`);
  }
  if (
    !isUnknownArray(rawSources) ||
    rawSources.length === 0 ||
    !rawSources.every(isNonemptyString)
  ) {
    throw new TypeError(`${path}.sources must contain nonempty source strings`);
  }
  if (!isUnknownArray(rawCandidates) || rawCandidates.length < 2) {
    throw new TypeError(`${path}.candidates must contain at least two candidates`);
  }

  const candidates = rawCandidates.map((candidate, candidateIndex) =>
    parseCandidate(candidate, `${path}.candidates[${candidateIndex}]`),
  );
  const candidateIds = new Set<number>();
  const ballotNumbers = new Set<string>();
  for (const candidate of candidates) {
    if (candidateIds.has(candidate.id))
      throw new TypeError(`${path} contains duplicate candidate IDs`);
    if (ballotNumbers.has(candidate.number))
      throw new TypeError(`${path} contains duplicate ballot numbers`);
    candidateIds.add(candidate.id);
    ballotNumbers.add(candidate.number);
  }

  return {
    id,
    titleKey,
    closesAt,
    resultsThreshold,
    sources: [...rawSources],
    candidates,
  };
}

export function validateElectionConfig(value: unknown): ElectionConfig {
  if (!isRecord(value)) throw new TypeError("Election configuration must be an object");
  const currentElectionId = value.currentElectionId;
  const rawElections = value.elections;
  if (currentElectionId !== null && !isUuid(currentElectionId)) {
    throw new TypeError("currentElectionId must be null or a UUID");
  }
  if (!isUnknownArray(rawElections)) throw new TypeError("elections must be an array");

  const elections = rawElections.map((election, index) => parseElection(election, index));
  const electionIds = new Set<string>();
  for (const election of elections) {
    if (electionIds.has(election.id)) throw new TypeError("Election IDs must be unique");
    electionIds.add(election.id);
  }
  if (currentElectionId !== null && !electionIds.has(currentElectionId)) {
    throw new TypeError("currentElectionId does not select a configured election");
  }

  return { currentElectionId, elections };
}

export function selectElection(config: ElectionConfig): Election | null {
  if (config.currentElectionId === null) return null;
  return config.elections.find((election) => election.id === config.currentElectionId) ?? null;
}

function freezeTree<T>(value: T): T {
  if (isUnknownArray(value)) {
    for (const child of value) freezeTree(child);
    Object.freeze(value);
  } else if (isRecord(value)) {
    for (const key of Object.keys(value)) freezeTree(value[key]);
    Object.freeze(value);
  }
  return value;
}

const validatedConfig = validateElectionConfig(electionConfigJson);
export const currentElection = freezeTree(selectElection(validatedConfig));
