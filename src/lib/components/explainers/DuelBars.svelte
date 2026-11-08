<script lang="ts">
  import type { Duel } from "#lib/explainers.ts";
  import { m } from "#lib/paraglide/messages.js";
  import CandidateChip from "./CandidateChip.svelte";
  import Explainer from "./Explainer.svelte";

  let { duels, caption }: { duels: readonly Duel[]; caption: string } = $props();
</script>

<Explainer {caption}>
  <ul class="explainer-list explainer-list--stack">
    {#each duels as duel (duel.winner + duel.loser)}
      {@const share = (duel.winnerVotes / (duel.winnerVotes + duel.loserVotes)) * 100}
      <li>
        <div class="duel" aria-hidden="true">
          <CandidateChip letter={duel.winner} />
          <div class="duel-bar">
            <span class="cand-{duel.winner}" style:width="{share}%">{duel.winnerVotes}</span>
            <span class="cand-{duel.loser}" style:width="{100 - share}%">{duel.loserVotes}</span>
          </div>
          <CandidateChip letter={duel.loser} />
        </div>
        <p>{m.explainer_beats(duel)}</p>
      </li>
    {/each}
  </ul>
</Explainer>
