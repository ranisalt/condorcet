<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { Candidate } from "#lib/election.ts";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const formatNumber = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  const availableView = $derived(data.view.state === "available" ? data.view : null);

  function candidateLabel(candidate: Candidate) {
    return `${candidate.name} · ${candidate.number} · ${candidate.party}`;
  }

  function cellText(count: number, denominator: number) {
    const percentage = formatNumber.format((100 * count) / denominator);
    return m.pairwise_cell({ count: formatNumber.format(count), percentage });
  }
</script>

<svelte:head>
  <title>{m.results_title()} · {m.app_title()}</title>
</svelte:head>

<h1>{m.results_title()}</h1>
<h2>{m[data.view.election.titleKey]()}</h2>
<p>{m.simulation_warning()}</p>
{#if data.view.state === "locked"}
  <p>{m.valid_participation({ count: formatNumber.format(data.view.validCount) })}</p>
  <p>{m.results_threshold({ threshold: formatNumber.format(data.view.threshold) })}</p>
  <p>
    {data.view.reason === "not-submitted" ? m.results_not_submitted() : m.results_below_threshold()}
  </p>
{:else if availableView}
  <p>{m.valid_participation({ count: formatNumber.format(availableView.validCount) })}</p>
  <p>{m.blank_stat({ count: formatNumber.format(availableView.blankCount) })}</p>
  {#if availableView.winnerId === null}
    <p>{m.no_condorcet_winner()}</p>
  {:else}
    {@const winner = availableView.election.candidates.find(
      (candidate) => candidate.id === availableView.winnerId,
    )}
    {#if winner}
      <p>{m.condorcet_winner({ name: candidateLabel(winner) })}</p>
    {/if}
  {/if}
  <p>{m.pairwise_explanation()}</p>
  <div class="table-scroll" role="region" aria-label={m.pairwise_caption()}>
    <table>
      <caption>{m.pairwise_caption()}</caption>
      <thead>
        <tr>
          <th scope="col">{m.pairwise_row_label()}</th>
          {#each availableView.election.candidates as candidate (candidate.id)}
            <th scope="col">
              <span>{candidateLabel(candidate)}</span>
              <small
                >{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small
              >
            </th>
          {/each}
        </tr>
      </thead>
      <tbody>
        {#each availableView.election.candidates as candidate (candidate.id)}
          <tr>
            <th scope="row">
              <span>{candidateLabel(candidate)}</span>
              <small
                >{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small
              >
            </th>
            {#each availableView.election.candidates as opponent (opponent.id)}
              <td>
                {#if candidate.id === opponent.id}
                  —
                {:else}
                  {cellText(
                    availableView.matrix[candidate.id]?.[opponent.id] ?? 0,
                    availableView.validCount,
                  )}
                {/if}
              </td>
            {/each}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
{/if}
