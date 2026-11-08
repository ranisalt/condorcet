<script lang="ts">
  import { letters, type Letter } from "#lib/explainers.ts";
  import CandidateChip from "./CandidateChip.svelte";

  let { tallies, caption }: { tallies: Record<Letter, number>; caption: string } = $props();
  const max = $derived(Math.max(...letters.map((letter) => tallies[letter])));
  const rows = $derived([...letters].sort((a, b) => tallies[b] - tallies[a]));
</script>

<figure class="explainer">
  <ul class="explainer-list explainer-list--stack" aria-hidden="true">
    {#each rows as letter (letter)}
      <li class="tally-row">
        <CandidateChip {letter} />
        <span class="tally-track">
          <span class="tally-bar cand-{letter}" style:width="{(tallies[letter] / max) * 100}%"
            >{tallies[letter]}</span
          >
        </span>
      </li>
    {/each}
  </ul>
  <figcaption>{caption}</figcaption>
</figure>
