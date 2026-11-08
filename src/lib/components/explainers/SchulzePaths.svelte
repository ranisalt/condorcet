<script lang="ts">
  import { strongestPath, type BallotGroup, type Letter } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import CandidateChip from "./CandidateChip.svelte";

  let {
    ballots,
    pairs,
    caption,
  }: { ballots: readonly BallotGroup[]; pairs: [Letter, Letter][]; caption: string } = $props();
  const routes = $derived(
    pairs.flatMap(([x, y]) => [strongestPath(ballots, x, y), strongestPath(ballots, y, x)]),
  );
</script>

<figure class="explainer">
  <ul class="explainer-list explainer-list--stack">
    {#each routes as route (route.path.join(""))}
      <li class="chip-row">
        <span class="chip-row" aria-label={route.path.join(" → ")}>
          {#each route.path as letter, step (step)}
            {#if step > 0}<span aria-hidden="true">→</span>{/if}
            <CandidateChip {letter} />
          {/each}
        </span>
        <span>{m.explainer_path_strength({ strength: route.strength })}</span>
      </li>
    {/each}
  </ul>
  <figcaption>{caption}</figcaption>
</figure>
