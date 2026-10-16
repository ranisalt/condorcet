<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import type { Election } from "#lib/election.ts";
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

  const number = new Intl.NumberFormat("pt-BR");
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
</script>

<div class="result-statistics">
  <span>{m.valid_participation({ count: number.format(view.validCount) })}</span>
  <span>{m.blank_stat({ count: number.format(view.blankCount) })}</span>
</div>

<section class="condorcet-panel" aria-labelledby="condorcet-heading">
  <p class="result-eyebrow">{m.results_strict_label()}</p>
  {#if winner}
    <h2 id="condorcet-heading">{winner.name}</h2>
    <p>{m.results_strict_winner_description()}</p>
    <small>{winner.number} · {winner.party}</small>
    <small>{m.vice_label({ name: winner.vice.name, party: winner.vice.party })}</small>
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
    <p class="result-eyebrow">{m.results_method_result()}</p>
    {#if outcome.unresolved}
      <h3>{m.results_unresolved_title()}</h3>
      <p>{m.results_unresolved_description()}</p>
    {:else if methodWinners.length > 1}
      <h3>{m.results_tied_title()}</h3>
      <ul class="method-winners">
        {#each methodWinners as candidate (candidate.id)}
          <li>
            <strong>{candidate.name}</strong><small>{candidate.number} · {candidate.party}</small>
            <small>{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small
            >
          </li>
        {/each}
      </ul>
    {:else if methodWinners[0]}
      <h3>{methodWinners[0].name}</h3>
      <small>{methodWinners[0].number} · {methodWinners[0].party}</small>
      <small
        >{m.vice_label({
          name: methodWinners[0].vice.name,
          party: methodWinners[0].vice.party,
        })}</small
      >
    {/if}
    <p>{methods[method].description()}</p>
  </section>
  <a class="method-help" href={resolve("/how-it-works#comparison-methods")}
    >{m.results_method_help()}</a
  >
</section>

<section class="pairwise-section">
  <h2 id="pairwise-heading">{m.pairwise_caption()}</h2>
  <p>{m.results_margin_description()}</p>
  <!-- Keyboard users need to focus and scroll the wide comparison table. -->
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <div class="margin-scroll" role="region" aria-label={m.pairwise_caption()} tabindex="0">
    <table>
      <caption>{m.pairwise_caption()}</caption>
      <thead>
        <tr>
          <th scope="col">{m.pairwise_row_label()}</th>
          {#each view.election.candidates as candidate (candidate.id)}
            <th scope="col">
              <span>{candidate.name}</span><small>{candidate.number} · {candidate.party}</small>
              <small
                >{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small
              >
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each view.election.candidates as candidate (candidate.id)}
          <tr>
            <th scope="row">
              {candidate.name}
              <small
                >{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small
              >
            </th>
            {#each view.election.candidates as opponent (opponent.id)}
              {@const margin =
                (view.matrix[candidate.id]?.[opponent.id] ?? 0) -
                (view.matrix[opponent.id]?.[candidate.id] ?? 0)}
              <td
                data-outcome={candidate.id === opponent.id
                  ? "none"
                  : margin > 0
                    ? "win"
                    : margin < 0
                      ? "loss"
                      : "tie"}
              >
                {#if candidate.id === opponent.id}—{:else if margin > 0}+{number.format(
                    margin,
                  )}{:else if margin < 0}−{number.format(Math.abs(margin))}{:else}0{/if}
              </td>
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
    color: var(--muted, #52615a);
    font-size: 0.875rem;
  }
  .condorcet-panel {
    padding: clamp(1.5rem, 4vw, 2.5rem);
    border: 1px solid var(--border, #d9ded6);
    border-radius: 0.75rem;
    background: #edf3ed;
    margin-block: 1.5rem 3rem;
  }
  .result-eyebrow {
    font-size: 0.75rem;
    font-weight: 650;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    margin-block: 0 0.75rem;
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
    background: #e9ece5;
    border: 1px solid var(--border, #d9ded6);
    border-radius: 0.5rem;
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
    background: #fffefa;
    box-shadow: 0 1px 3px #142a1814;
  }
  .method-outcome {
    border: 1px solid var(--border, #d9ded6);
    border-radius: 0.5rem;
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
    color: var(--muted, #52615a);
    font-size: 0.8rem;
    font-weight: 400;
  }
  .method-help {
    font-size: 0.875rem;
  }
  .margin-scroll {
    max-width: 100%;
    overflow-x: auto;
    border: 1px solid var(--border, #d9ded6);
    border-radius: 0.5rem;
    margin-block-start: 1.5rem;
  }
  table {
    width: 100%;
    border-collapse: separate;
    border-spacing: 0;
    font-size: 0.875rem;
  }
  caption {
    text-align: left;
    padding: 1rem;
    font-weight: 600;
  }
  th,
  td {
    padding: 1rem;
    border-top: 1px solid var(--border, #d9ded6);
    text-align: center;
    min-width: 7rem;
  }
  th {
    font-weight: 600;
    background: #f2f3ee;
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
    background: #edf3ed;
    color: #215437;
    font-weight: 600;
  }
  td[data-outcome="loss"] {
    color: #784b43;
  }
  td[data-outcome="none"] {
    background: #f2f3ee;
    color: #66736a;
  }
  .matrix-legend {
    color: var(--muted, #52615a);
    font-size: 0.875rem;
  }
</style>
