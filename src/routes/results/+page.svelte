<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import ResultsPanel from "./ResultsPanel.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
  const number = new Intl.NumberFormat("pt-BR");
</script>

<svelte:head>
  <title>{m.results_title()} · {m.app_title()}</title>
</svelte:head>

<header class="results-heading">
  <p class="eyebrow">{m[data.view.election.titleKey]()}</p>
  <h1>{m.results_title()}</h1>
  <p>{m.results_intro()}</p>
</header>

{#if data.view.state === "locked"}
  <section class="locked-results" aria-labelledby="locked-heading">
    <h2 id="locked-heading">{m.results_locked_title()}</h2>
    <p>
      {data.view.reason === "not-submitted"
        ? m.results_not_submitted()
        : m.results_below_threshold()}
    </p>
    <p>{m.valid_participation({ count: number.format(data.view.validCount) })}</p>
    <progress
      max={data.view.threshold}
      value={Math.min(data.view.validCount, data.view.threshold)}
      aria-label={m.progress_label({ threshold: number.format(data.view.threshold) })}
    ></progress>
    <p>{m.results_threshold({ threshold: number.format(data.view.threshold) })}</p>
    <a class="button button--primary" href={resolve("ballot")}>{m.nav_ballot()}</a>
  </section>
{:else}
  <ResultsPanel view={data.view} method={data.method ?? "copeland"} />
{/if}

<p class="results-disclaimer">{m.simulation_warning()}</p>

<style>
  .results-heading {
    margin-block: 1rem 2rem;
  }
  .eyebrow {
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .locked-results {
    padding: clamp(1.5rem, 4vw, 3rem);
    border: 1px solid var(--border, #d9ded6);
    border-radius: 0.75rem;
    max-width: 52rem;
  }
  .locked-results progress {
    display: block;
    width: 100%;
    height: 0.5rem;
    accent-color: #24523a;
  }
  .results-disclaimer {
    margin-block-start: 3rem;
    padding-block-start: 1.5rem;
    border-top: 1px solid var(--border, #d9ded6);
    color: var(--muted, #52615a);
    font-size: 0.875rem;
  }
</style>
