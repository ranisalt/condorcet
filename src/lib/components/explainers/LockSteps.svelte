<script lang="ts">
  import { duels, lockedOrder, lockSequence, type BallotGroup } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import CandidateChip from "./CandidateChip.svelte";
  import CycleTriangle from "./CycleTriangle.svelte";

  let { ballots, caption }: { ballots: readonly BallotGroup[]; caption: string } = $props();
  const steps = $derived(lockSequence(ballots));
  const skipped = $derived(steps.find((step) => !step.locked)?.duel);
  const order = $derived(lockedOrder(ballots));
</script>

<ol class="lock-steps">
  {#each steps as { duel, locked } (duel.winner + duel.loser)}
    <li class:skipped={!locked}>
      {m.explainer_beats(duel)} ({m.explainer_margin({
        margin: duel.winnerVotes - duel.loserVotes,
      })}):
      <strong>{locked ? m.explainer_locked() : m.explainer_skipped()}</strong>
    </li>
  {/each}
</ol>
<p class="chip-row final-order">
  {m.explainer_final_order()}:
  {#each order as letter, rank (letter)}
    {#if rank > 0}<span aria-hidden="true">›</span>{/if}
    <CandidateChip {letter} />
  {/each}
</p>
<CycleTriangle duels={duels(ballots)} {skipped} {caption} />
