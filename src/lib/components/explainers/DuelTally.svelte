<script lang="ts">
  import { supporters, total, type BallotGroup, type Letter } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import BallotCard from "./BallotCard.svelte";
  import Explainer from "./Explainer.svelte";

  let {
    ballots,
    x,
    y,
    caption,
  }: { ballots: readonly BallotGroup[]; x: Letter; y: Letter; caption: string } = $props();
  const sides = $derived(
    (
      [
        [x, y],
        [y, x],
      ] as const
    ).map(([above, below]) => {
      const groups = supporters(ballots, above, below);
      return { above, below, groups, sum: total(groups) };
    }),
  );
</script>

<Explainer {caption}>
  <div class="tally">
    {#each sides as side (side.above)}
      <div class="tally-side">
        <h3>{m.explainer_ranked_above({ winner: side.above, loser: side.below })}</h3>
        <ul class="explainer-list">
          {#each side.groups as group, index (index)}
            <BallotCard {group} />
          {/each}
        </ul>
        <p class="tally-sum">
          {side.groups.length > 1
            ? `${side.groups.map((g) => g.count).join(" + ")} = ${side.sum}`
            : side.sum}
        </p>
      </div>
    {/each}
  </div>
</Explainer>
