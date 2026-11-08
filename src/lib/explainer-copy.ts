import { getLocale } from "#lib/paraglide/runtime.js";
import { m } from "#lib/paraglide/messages.js";
import type { BallotGroup, Letter } from "./explainers.ts";

/** "A, depois B, depois C": readable aloud, unlike "A > B > C". */
export function spokenOrder(order: readonly Letter[]): string {
  return order
    .slice(1)
    .reduce<string>((before, after) => m.explainer_then({ before, after }), order[0]);
}

/** One sentence per ballot group: how many people, and their order. */
export function describeBallots(ballots: readonly BallotGroup[]): string {
  return ballots
    .map(({ count, order }) =>
      count === 1
        ? m.explainer_prefers_one({ count, order: spokenOrder(order) })
        : m.explainer_prefers({ count, order: spokenOrder(order) }),
    )
    .join(" ");
}

/** The group sizes as a list: "35 e 33". */
export function groupCounts(ballots: readonly BallotGroup[]): string {
  return new Intl.ListFormat(getLocale(), { type: "conjunction" }).format(
    ballots.map((g) => String(g.count)),
  );
}
