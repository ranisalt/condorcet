<script lang="ts">
  import { resolve } from "$app/paths";
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
</script>

<svelte:head>
  <title>{m.app_title()}</title>
</svelte:head>

<h1>{m.app_title()}</h1>
<p>{m.simulation_warning()}</p>
<p>{m.login_explanation()}</p>
{#if data.election}
  <h2>{m[data.election.titleKey]()}</h2>
  <p>{m.valid_participation({ count: data.validCount.toLocaleString("pt-BR") })}</p>
  <p>
    {m.results_threshold({ threshold: data.election.resultsThreshold.toLocaleString("pt-BR") })}
  </p>
  {#if !data.open}
    <p role="status">{m.election_closed()}</p>
  {/if}
  {#if data.signedIn}
    <a href={resolve("acknowledgment")}>{m.start_ballot()}</a>
    <form method="POST" action="?/logout">
      <button type="submit">{m.sign_out()}</button>
    </form>
  {:else}
    <form method="POST" action="?/login">
      {#if data.loginError || form?.loginFailed}
        <p role="alert">{m.login_failed()}</p>
      {/if}
      <button type="submit">{m.sign_in()}</button>
    </form>
  {/if}
{:else}
  <p>{m.no_election()}</p>
{/if}
