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
import { user } from "./auth.schema.ts";

export const electionParticipant = sqliteTable(
  "election_participant",
  {
    electionId: text("election_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    acknowledgedAt: integer("acknowledged_at", { mode: "timestamp_ms" }).notNull(),
    submittedAt: integer("submitted_at", { mode: "timestamp_ms" }),
  },
  (table) => [primaryKey({ columns: [table.electionId, table.userId] })],
);

export const ballotRank = sqliteTable(
  "ballot_rank",
  {
    electionId: text("election_id").notNull(),
    userId: text("user_id").notNull(),
    candidateId: integer("candidate_id").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.electionId, table.userId, table.candidateId] }),
    uniqueIndex("ballot_rank_position_unique").on(table.electionId, table.userId, table.position),
    foreignKey({
      columns: [table.electionId, table.userId],
      foreignColumns: [electionParticipant.electionId, electionParticipant.userId],
    }).onDelete("cascade"),
    check("ballot_rank_candidate_byte", sql`${table.candidateId} between 0 and 255`),
    check("ballot_rank_position_nonnegative", sql`${table.position} >= 0`),
  ],
);
