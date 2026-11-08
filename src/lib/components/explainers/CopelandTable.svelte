<script lang="ts">
  import { copelandRecords, letters, type BallotGroup } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import CandidateChip from "./CandidateChip.svelte";
  import Explainer from "./Explainer.svelte";

  let { ballots, caption }: { ballots: readonly BallotGroup[]; caption: string } = $props();
  const records = $derived(copelandRecords(ballots));
</script>

<Explainer {caption}>
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
          <td>{records[letter].wins}</td>
          <td>{records[letter].losses}</td>
          <td>{records[letter].score}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</Explainer>
