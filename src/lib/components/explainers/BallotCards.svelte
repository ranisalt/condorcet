<script lang="ts">
  import type { BallotGroup } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import CandidateChip from "./CandidateChip.svelte";

  let { ballots, caption }: { ballots: readonly BallotGroup[]; caption: string } = $props();
</script>

<figure class="explainer">
  <ul class="explainer-list">
    {#each ballots as group, index (index)}
      <li class="ballot-card">
        <strong>
          {group.count === 1
            ? m.explainer_people_one()
            : m.explainer_people({ count: group.count })}
        </strong>
        <ol class="chip-row" aria-label={group.order.join(" > ")}>
          {#each group.order as letter, rank (letter)}
            <li>
              {#if rank > 0}<span aria-hidden="true">›</span>{/if}
              <CandidateChip {letter} />
            </li>
          {/each}
        </ol>
      </li>
    {/each}
  </ul>
  <figcaption>{caption}</figcaption>
</figure>
