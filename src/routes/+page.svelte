<script lang="ts">
  import { resolve } from "$app/paths";
  import { formatNumber } from "#lib/format.ts";
  import { m } from "#lib/paraglide/messages.js";
  import type { PageProps } from "./$types";

  let { data, form }: PageProps = $props();
  const threshold = $derived(data.election?.resultsThreshold ?? null);
</script>

<svelte:head>
  <title>{m.app_title()}</title>
</svelte:head>

<div class="home-page">
  <section class="home-hero" aria-labelledby="home-title">
    <div class="home-copy">
      <p class="eyebrow">{m.home_eyebrow()}</p>
      <h1 id="home-title">{m.app_title()}</h1>
      {#if data.election}
        <h2 class="election-title">{m[data.election.titleKey]()}</h2>
      {/if}
      <p class="home-intro">{m.home_intro()}</p>

      {#if !data.election}
        <p class="notice-card" role="status">{m.no_election()}</p>
      {:else if !data.open}
        <p class="notice-card" role="status">{m.election_closed()}</p>
      {/if}

      <div class="home-actions">
        {#if data.election && data.signedIn}
          {#if data.open}
            <a class="button button--primary" href={resolve("acknowledgment")}>{m.start_ballot()}</a
            >
          {:else}
            <a class="button button--primary" href={resolve("ballot")}>{m.view_ballot()}</a>
          {/if}
          <form method="POST" action="?/logout">
            <button type="submit" class="button">{m.sign_out()}</button>
          </form>
        {:else if data.election}
          <form method="POST" action="?/login">
            {#if data.loginError || form?.loginFailed}
              <p role="alert">{m.login_failed()}</p>
            {/if}
            <button type="submit" class="button button--primary">{m.sign_in()}</button>
          </form>
          <a class="button" href={resolve("results")}>{m.nav_results()}</a>
        {/if}
      </div>

      <p class="privacy-link">
        <a href="{resolve('how-it-works')}#privacidade">{m.home_privacy_link()}</a>
      </p>
    </div>

    <figure class="preference-figure" aria-label={m.preference_illustration_label()}>
      <p class="figure-kicker">{m.preference_caption()}</p>
      <ol class="preference-list">
        <li>
          <span class="preference-number" aria-hidden="true">1</span>
          <span class="preference-copy">
            <strong>{m.preference_first()}</strong>
            <small>{m.preference_first_hint()}</small>
          </span>
          <span class="preference-check" aria-hidden="true">✓</span>
        </li>
        <li>
          <span class="preference-number" aria-hidden="true">2</span>
          <span class="preference-copy">
            <strong>{m.preference_second()}</strong>
            <small>{m.preference_second_hint()}</small>
          </span>
          <span class="preference-check" aria-hidden="true">✓</span>
        </li>
        <li>
          <span class="preference-number" aria-hidden="true">3</span>
          <span class="preference-copy">
            <strong>{m.preference_third()}</strong>
            <small>{m.preference_third_hint()}</small>
          </span>
          <span class="preference-check" aria-hidden="true">✓</span>
        </li>
      </ol>
    </figure>
  </section>

  {#if data.election}
    <section class="progress-panel" aria-labelledby="progress-heading">
      <div class="progress-count">
        <div class="progress-heading-row">
          <h2 id="progress-heading">{m.progress_title()}</h2>
          <span class="progress-state">
            <span class="status-dot" aria-hidden="true"></span>
            {!data.open
              ? m.progress_closed()
              : threshold !== null && data.validCount >= threshold
                ? m.progress_met()
                : m.progress_open()}
          </span>
        </div>
        <p class="progress-number">
          <strong>{formatNumber(data.validCount)}</strong>
          <span>
            {threshold === null
              ? m.progress_count_pending({ count: formatNumber(data.validCount) })
              : m.progress_count({
                  count: formatNumber(data.validCount),
                  threshold: formatNumber(threshold),
                })}
          </span>
        </p>
        {#if threshold === null}
          <p class="progress-note">{m.progress_threshold_pending()}</p>
        {:else}
          <progress
            value={Math.min(data.validCount, threshold)}
            max={threshold}
            aria-label={m.progress_label({ threshold: formatNumber(threshold) })}
          ></progress>
          {#if data.validCount >= threshold}
            <p class="progress-note">{m.progress_met_notice()}</p>
          {:else}
            <p class="progress-note">
              {m.progress_remaining({
                count: formatNumber(threshold - data.validCount),
              })}
            </p>
          {/if}
        {/if}
      </div>
      <aside class="progress-explanation">
        <h3>{m.progress_locked_title()}</h3>
        <p>
          {threshold === null
            ? m.results_threshold_pending()
            : m.results_threshold({ threshold: formatNumber(threshold) })}
        </p>
      </aside>
    </section>
  {/if}

  <section class="home-steps" aria-labelledby="steps-heading">
    <div class="section-heading">
      <h2 id="steps-heading">{m.home_steps_title()}</h2>
      <a href={resolve("how-it-works")}>{m.nav_method()}</a>
    </div>
    <ol class="step-grid">
      <li>
        <span class="step-number">01</span>
        <h3>{m.home_step_one_title()}</h3>
        <p>{m.home_step_one_body()}</p>
      </li>
      <li>
        <span class="step-number">02</span>
        <h3>{m.home_step_two_title()}</h3>
        <p>{m.home_step_two_body()}</p>
      </li>
      <li>
        <span class="step-number">03</span>
        <h3>{m.home_step_three_title()}</h3>
        <p>{m.home_step_three_body()}</p>
      </li>
    </ol>
  </section>
</div>
