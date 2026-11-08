<script lang="ts">
  import { resolve } from "$app/paths";
  import { formatNumber } from "#lib/format.ts";
  import { m } from "#lib/paraglide/messages.js";
  import ResultsPanel from "./ResultsPanel.svelte";
  import type { PageProps } from "./$types";

  let { data }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.results_title()} · {m.app_title()}</title>
</svelte:head>

<header class="page-heading">
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
        : data.view.threshold === null
          ? m.results_threshold_pending()
          : m.results_below_threshold()}
    </p>
    <p>{m.valid_participation({ count: formatNumber(data.view.validCount) })}</p>
    {#if data.view.threshold !== null}
      <progress
        max={data.view.threshold}
        value={Math.min(data.view.validCount, data.view.threshold)}
        aria-label={m.progress_label({ threshold: formatNumber(data.view.threshold) })}
      ></progress>
      <p>{m.results_threshold({ threshold: formatNumber(data.view.threshold) })}</p>
    {/if}
    <a class="button button--primary" href={resolve("ballot")}>{m.nav_ballot()}</a>
  </section>
{:else}
  <ResultsPanel view={data.view} method={data.view.method} />
{/if}

<style>
  .locked-results {
    padding: 2rem;
    border: 1px solid var(--line);
    border-radius: 0.3rem;
    background: var(--surface);
  }
  .locked-results progress {
    display: block;
    width: 100%;
    height: 0.5rem;
    accent-color: var(--green);
  }
</style>
