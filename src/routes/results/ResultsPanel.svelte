<script lang="ts">
  import { resolve } from "$app/paths";
  import { formatNumber } from "#lib/format.ts";
  import { m } from "#lib/paraglide/messages.js";
  import type { Candidate, Election } from "#lib/election.ts";
  import type { ResultsView } from "#lib/server/results.ts";
  import { methodIds, type MethodId } from "#lib/voting-methods.ts";

  let {
    view,
    method,
  }: {
    view: Extract<ResultsView, { state: "available" }> & {
      election: Pick<Election, "titleKey" | "candidates">;
    };
    method: MethodId;
  } = $props();

  const methods = {
    copeland: { label: m.results_copeland, description: m.results_copeland_description },
    schulze: { label: m.results_schulze, description: m.results_schulze_description },
    rankedPairs: { label: m.results_ranked_pairs, description: m.results_ranked_pairs_description },
  } satisfies Record<MethodId, unknown>;
  const winner = $derived(
    view.election.candidates.find((candidate) => candidate.id === view.winnerId),
  );
  const outcome = $derived(view.methods[method]);
  const methodWinners = $derived(
    view.election.candidates.filter((candidate) => outcome.winnerIds.includes(candidate.id)),
  );

  function marginCell(rowId: number, columnId: number) {
    if (rowId === columnId) return { outcome: "none", text: "—" };
    const margin = view.matrix[rowId][columnId] - view.matrix[columnId][rowId];
    if (margin > 0) return { outcome: "win", text: `+${formatNumber(margin)}` };
    if (margin < 0) return { outcome: "loss", text: `−${formatNumber(-margin)}` };
    return { outcome: "tie", text: "0" };
  }
</script>

{#snippet ticketDetails(candidate: Candidate)}
  <small>{candidate.number} · {candidate.party}</small>
  <small>{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small>
{/snippet}

<div class="result-statistics">
  <span>{m.valid_participation({ count: formatNumber(view.validCount) })}</span>
  <span>{m.blank_stat({ count: formatNumber(view.blankCount) })}</span>
</div>

<section class="condorcet-panel" aria-labelledby="condorcet-heading">
  <p class="eyebrow">{m.results_strict_label()}</p>
  {#if winner}
    <h2 id="condorcet-heading">{winner.name}</h2>
    <p>{m.results_strict_winner_description()}</p>
    {@render ticketDetails(winner)}
  {:else}
    <h2 id="condorcet-heading">{m.results_no_strict_winner()}</h2>
    <p>{m.no_condorcet_winner()}</p>
  {/if}
</section>

<section class="method-comparison" aria-labelledby="comparison-heading">
  <h2 id="comparison-heading">{m.results_comparison_title()}</h2>
  <p>{m.results_comparison_description()}</p>
  <nav class="method-navigation" aria-label={m.results_method_navigation()}>
    {#each methodIds as id (id)}
      <a href={resolve(`/results?method=${id}`)} aria-current={method === id ? "page" : undefined}>
        {methods[id].label()}
      </a>
    {/each}
  </nav>
  <section
    class="method-outcome"
    aria-label={m.results_method_outcome({ method: methods[method].label() })}
  >
    <p class="eyebrow">{m.results_method_result()}</p>
    {#if outcome.unresolved}
      <h3>{m.results_unresolved_title()}</h3>
      <p>{m.results_unresolved_description()}</p>
    {:else if methodWinners.length > 1}
      <h3>{m.results_tied_title()}</h3>
      <ul class="method-winners">
        {#each methodWinners as candidate (candidate.id)}
          <li>
            <strong>{candidate.name}</strong>
            {@render ticketDetails(candidate)}
          </li>
        {/each}
      </ul>
    {:else if methodWinners[0]}
      <h3>{methodWinners[0].name}</h3>
      {@render ticketDetails(methodWinners[0])}
    {/if}
    <p>{methods[method].description()}</p>
  </section>
  <a class="method-help" href={resolve("/how-it-works#comparison-methods")}
    >{m.results_method_help()}</a
  >
</section>

<section class="pairwise-section" aria-labelledby="pairwise-heading">
  <h2 id="pairwise-heading">{m.pairwise_caption()}</h2>
  <p>{m.results_margin_description()}</p>
  <!-- Keyboard users need to focus and scroll the wide comparison table. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="margin-scroll" data-matrix-scroll tabindex="0">
    <table aria-labelledby="pairwise-heading">
      <thead>
        <tr>
          <th scope="col">{m.pairwise_row_label()}</th>
          {#each view.election.candidates as candidate (candidate.id)}
            <th scope="col">
              <span>{candidate.name}</span>
              {@render ticketDetails(candidate)}
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each view.election.candidates as candidate (candidate.id)}
          <tr>
            <th scope="row">
              <span>{candidate.name}</span>
              {@render ticketDetails(candidate)}
            </th>
            {#each view.election.candidates as opponent (opponent.id)}
              {@const cell = marginCell(candidate.id, opponent.id)}
              <td data-outcome={cell.outcome}>{cell.text}</td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
  <p class="matrix-legend">{m.results_margin_legend()}</p>
</section>

<style>
  .result-statistics {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1.5rem;
    margin-block: 1.5rem;
    color: var(--muted);
    font-size: 0.875rem;
  }
  .condorcet-panel {
    padding: clamp(1.5rem, 4vw, 2.5rem);
    border: 1px solid var(--line);
    border-radius: 0.3rem;
    background: var(--green-soft);
    margin-block: 1.5rem 3rem;
  }
  .condorcet-panel h2 {
    font-size: clamp(1.75rem, 4vw, 2.5rem);
    margin-block: 0 0.75rem;
  }
  .method-comparison {
    margin-block: 3rem;
  }
  .method-comparison h2,
  .pairwise-section h2 {
    font-size: clamp(1.4rem, 3vw, 1.9rem);
  }
  .method-navigation {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem;
    padding: 0.375rem;
    margin-block: 1.5rem 0;
    background: var(--green-soft);
    border: 1px solid var(--line);
    border-radius: 0.3rem;
  }
  .method-navigation a {
    min-height: 2.75rem;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: 1 1 10rem;
    padding: 0.625rem 1rem;
    border-radius: 0.3rem;
    text-decoration: none;
    color: inherit;
    font-size: 0.875rem;
    font-weight: 600;
  }
  .method-navigation a[aria-current="page"] {
    background: var(--surface);
    box-shadow: 0 1px 3px color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .method-outcome {
    border: 1px solid var(--line);
    background: var(--surface);
    border-radius: 0.3rem;
    padding: 1.5rem;
    margin-block: 1rem;
  }
  .method-outcome h3 {
    font-size: 1.5rem;
    margin-block: 0.5rem;
  }

  .method-winners {
    list-style: none;
    padding: 0;
    display: grid;
    gap: 0.75rem;
  }
  .method-winners li {
    display: grid;
    gap: 0.25rem;
  }
  small {
    display: block;
    color: var(--muted);
    font-size: 0.8rem;
    font-weight: 400;
  }
  .method-help {
    font-size: 0.875rem;
  }
  .margin-scroll {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid var(--line);
    border-radius: 0.3rem;
    margin-block-start: 1.5rem;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.875rem;
  }
  th,
  td {
    padding: 1rem;
    border-top: 1px solid var(--line);
    text-align: center;
    min-width: 7rem;
  }
  th {
    font-weight: 600;
    background: var(--paper);
  }
  th:first-child {
    position: sticky;
    left: 0;
    z-index: 1;
    text-align: left;
    min-width: 8rem;
    max-width: 12rem;
  }
  th span {
    display: block;
  }
  td {
    font-variant-numeric: tabular-nums;
  }
  td[data-outcome="win"] {
    background: var(--green-soft);
    color: var(--green);
    font-weight: 600;
  }
  td[data-outcome="loss"] {
    color: var(--loss);
  }
  td[data-outcome="none"] {
    background: var(--paper);
    color: var(--muted);
  }
  .matrix-legend {
    color: var(--muted);
    font-size: 0.875rem;
  }
</style>
