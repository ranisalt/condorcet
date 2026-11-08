<script lang="ts">
  import type { BallotGroup } from "#lib/explainers.ts";
  import BallotCard from "./BallotCard.svelte";
  import Explainer from "./Explainer.svelte";

  let { ballots, caption }: { ballots: readonly BallotGroup[]; caption: string } = $props();
</script>

<Explainer {caption}>
  <ul class="explainer-list">
    {#each ballots as group, index (index)}
      <BallotCard {group} />
    {/each}
  </ul>
</Explainer>
