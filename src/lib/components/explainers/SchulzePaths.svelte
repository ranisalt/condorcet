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
  <ul class="explainer-list explainer-list--stack" aria-hidden="true">
    {#each routes as route (route.path.join(""))}
      <li class="chip-row">
        <CandidateChip letter={route.path[0]} />
        {#each route.links as link (link.loser)}
          <span class="path-link"
            >→ <span class:weakest={link.winnerVotes === route.strength}>{link.winnerVotes}</span> →</span
          >
          <CandidateChip letter={link.loser} />
        {/each}
        <strong>{m.explainer_path_strength({ strength: route.strength })}</strong>
      </li>
    {/each}
  </ul>
  <figcaption>{caption}</figcaption>
</figure>
