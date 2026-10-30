import { sql } from "drizzle-orm";
import {
  check,
  foreignKey,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

// voter_id is the opaque OIDC `sub` issued by the identity provider. It is the only
// voter identifier stored locally: no email, name or other provider claims.
export const electionParticipant = sqliteTable(
  "election_participant",
  {
    electionId: text("election_id").notNull(),
    voterId: text("voter_id").notNull(),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  },
  (table) => [primaryKey({ columns: [table.electionId, table.voterId] })],
);

export const ballotRank = sqliteTable(
  "ballot_rank",
  {
    electionId: text("election_id").notNull(),
    voterId: text("voter_id").notNull(),
    candidateId: integer("candidate_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.electionId, table.voterId, table.candidateId] }),
    uniqueIndex("ballot_rank_position_unique").on(table.electionId, table.voterId, table.position),
    foreignKey({
      columns: [table.electionId, table.voterId],
      foreignColumns: [electionParticipant.electionId, electionParticipant.voterId],
    }).onDelete("cascade"),
    check("ballot_rank_candidate_byte", sql`${table.candidateId} between 0 and 255`),
    check("ballot_rank_position_nonnegative", sql`${table.position} >= 0`),
  ],
);
