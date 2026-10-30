CREATE TABLE `ballot_rank` (
	`election_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`candidate_id` integer NOT NULL,
	`position` integer NOT NULL,
	PRIMARY KEY(`election_id`, `voter_id`, `candidate_id`),
	FOREIGN KEY (`election_id`,`voter_id`) REFERENCES `election_participant`(`election_id`,`voter_id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ballot_rank_candidate_byte" CHECK("ballot_rank"."candidate_id" between 0 and 255),
	CONSTRAINT "ballot_rank_position_nonnegative" CHECK("ballot_rank"."position" >= 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ballot_rank_position_unique` ON `ballot_rank` (`election_id`,`voter_id`,`position`);--> statement-breakpoint
CREATE TABLE `election_participant` (
	`election_id` text NOT NULL,
	`voter_id` text NOT NULL,
	`acknowledged_at` integer NOT NULL,
	`submitted_at` integer,
	PRIMARY KEY(`election_id`, `voter_id`)
);
