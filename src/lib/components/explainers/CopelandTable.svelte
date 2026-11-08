<script lang="ts">
  import { copelandScores, duels, letters, type BallotGroup } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import CandidateChip from "./CandidateChip.svelte";

  let { ballots, caption }: { ballots: readonly BallotGroup[]; caption: string } = $props();
  const results = $derived(duels(ballots));
  const scores = $derived(copelandScores(ballots));
</script>

<figure class="explainer">
  <table>
    <thead>
      <tr>
        <th scope="col">{m.explainer_candidate()}</th>
        <th scope="col">{m.explainer_wins()}</th>
        <th scope="col">{m.explainer_losses()}</th>
        <th scope="col">{m.explainer_score()}</th>
      </tr>
    </thead>
    <tbody>
      {#each letters as letter (letter)}
        <tr>
          <th scope="row"><CandidateChip {letter} /></th>
          <td>{results.filter((d) => d.winner === letter).length}</td>
          <td>{results.filter((d) => d.loser === letter).length}</td>
          <td>{scores[letter]}</td>
        </tr>
      {/each}
    </tbody>
  </table>
  <figcaption>{caption}</figcaption>
</figure>
