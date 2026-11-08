<script lang="ts">
  import type { BallotGroup } from "#lib/explainers.ts";
  import BallotCard from "./BallotCard.svelte";

  let { ballots, caption }: { ballots: readonly BallotGroup[]; caption: string } = $props();
</script>

<figure class="explainer">
  <ul class="explainer-list">
    {#each ballots as group, index (index)}
      <BallotCard {group} />
    {/each}
  </ul>
  <figcaption>{caption}</figcaption>
</figure>
