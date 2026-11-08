<script lang="ts">
  import FlowSteps from "./FlowSteps.svelte";
  import { tick, untrack } from "svelte";
  import { enhance } from "$app/forms";
  import { m } from "#lib/paraglide/messages.js";
  import { editDraft, type BallotDraft, type Candidate, type Election } from "../election.ts";
  import CandidateTicket from "./CandidateTicket.svelte";

  import { ballotErrorMessages, type BallotError } from "./ballot-error.ts";

  type EditType = "add" | "remove" | "up" | "down";

  let {
    election,
    initialDraft,
    open,
    error,
    unsaved = false,
  }: {
    election: Election;
    initialDraft: BallotDraft;
    open: boolean;
    error?: BallotError;
    unsaved?: boolean;
  } = $props();

  // The route keys this component to the server draft; subsequent edits stay local.
  let draft = $state<BallotDraft>(untrack(() => structuredClone(initialDraft)));
  let saving = $state(false);
  let hasUnsavedChanges = $state(untrack(() => unsaved));
  let controlRefs: Record<string, HTMLButtonElement> = {};
  let candidatesById = $derived(
    new Map<number, Candidate>(election.candidates.map((candidate) => [candidate.id, candidate])),
  );
  let rankedCandidates = $derived(
    draft.ranked.flatMap((id) => {
      const candidate = candidatesById.get(id);
      return candidate ? [candidate] : [];
    }),
  );
  let unrankedCandidates = $derived(
    draft.order.flatMap((id) => {
      const candidate = candidatesById.get(id);
      return candidate && !draft.ranked.includes(id) ? [candidate] : [];
    }),
  );

  function controlKey(id: number, action: EditType): string {
    return `${id}:${action}`;
  }

  function registerControl(key: string) {
    return (node: HTMLButtonElement) => {
      controlRefs[key] = node;
      return () => {
        if (controlRefs[key] === node) delete controlRefs[key];
      };
    };
  }

  async function editLocally(event: MouseEvent, candidateId: number, type: EditType) {
    event.preventDefault();
    draft = editDraft(draft, { type, candidateId });
    hasUnsavedChanges = true;
    await tick();

    const rankedIndex = draft.ranked.indexOf(candidateId);
    const atStart = rankedIndex === 0;
    const atEnd = rankedIndex === draft.ranked.length - 1;
    const focusAfter: Record<EditType, EditType> = {
      add: "remove",
      remove: "add",
      up: atStart ? "down" : "up",
      down: atEnd ? "up" : "down",
    };
    controlRefs[controlKey(candidateId, focusAfter[type])]?.focus();
  }
</script>

<div class="ballot-page">
  <FlowSteps current={3} />
  <header class="page-heading">
    <p class="eyebrow">{m[election.titleKey]()}</p>
    <h1>{m.ballot_title()}</h1>
  </header>

  <div class="ballot-notices">
    <section class="notice-card notice-card--privacy" aria-labelledby="ballot-privacy-heading">
      <h2 id="ballot-privacy-heading">{m.privacy_heading()}</h2>
      <p>{m.privacy_summary()}</p>
      <details class="privacy-details">
        <summary>{m.privacy_details_summary()}</summary>
        <p>{m.privacy_warning()}</p>
        <p>{m.privacy_obfuscation()}</p>
      </details>
    </section>
    <ul class="rule-note">
      <li>{m.omitted_rule()}</li>
      <li>{m.empty_rule()}</li>
      <li>{m.ballot_changes_notice()}</li>
    </ul>
  </div>

  {#if !open}
    <section class="readonly-notice" aria-labelledby="readonly-heading">
      <h2 id="readonly-heading">{m.ballot_readonly_heading()}</h2>
      <p>{m.ballot_readonly_body()}</p>
      <p role="status">{m.election_closed()}</p>
    </section>
  {/if}

  {#if error}
    <p class="form-error" role="alert">{ballotErrorMessages[error]()}</p>
  {/if}

  <form
    class="ballot-form"
    method="POST"
    action="?/save"
    aria-busy={saving}
    use:enhance={() => {
      saving = true;
      return async ({ update }) => {
        try {
          await update({ reset: false });
        } finally {
          saving = false;
        }
      };
    }}
  >
    <input type="hidden" name="electionId" value={election.id} />
    {#each draft.ranked as candidateId (candidateId)}
      <input type="hidden" name="candidateId" value={candidateId} />
    {/each}
    {#each draft.order as candidateId (candidateId)}
      <input type="hidden" name="candidateOrderId" value={candidateId} />
    {/each}

    {#if saving || hasUnsavedChanges}
      <p class="draft-status" role="status" aria-live="polite" aria-atomic="true">
        {saving ? m.ballot_saving_status() : m.ballot_unsaved_status()}
      </p>
    {/if}

    <div class="ballot-columns">
      <section class="ballot-panel" aria-labelledby="ranked-heading">
        <div class="panel-heading">
          <h2 id="ranked-heading">{m.ranked_title()}</h2>
          <span>{rankedCandidates.length}</span>
        </div>
        {#if rankedCandidates.length === 0}
          <p class="empty-state">{m.ranked_empty()}</p>
        {/if}
        <ol aria-label={m.ranked_title()}>
          {#each rankedCandidates as candidate, index (candidate.id)}
            <li>
              <span class="rank-position">{m.rank_label({ position: index + 1 })}</span>
              <CandidateTicket {candidate} />
              <div class="ballot-controls">
                <button
                  type="submit"
                  formaction="?/edit"
                  name="operation"
                  value={`up:${candidate.id}`}
                  aria-label={m.move_up_candidate({ name: candidate.name })}
                  disabled={!open || saving || index === 0}
                  {@attach registerControl(controlKey(candidate.id, "up"))}
                  onclick={(event) => editLocally(event, candidate.id, "up")}>↑</button
                >
                <button
                  type="submit"
                  formaction="?/edit"
                  name="operation"
                  value={`down:${candidate.id}`}
                  aria-label={m.move_down_candidate({ name: candidate.name })}
                  disabled={!open || saving || index === rankedCandidates.length - 1}
                  {@attach registerControl(controlKey(candidate.id, "down"))}
                  onclick={(event) => editLocally(event, candidate.id, "down")}>↓</button
                >
                <button
                  type="submit"
                  formaction="?/edit"
                  name="operation"
                  value={`remove:${candidate.id}`}
                  aria-label={m.remove_candidate({ name: candidate.name })}
                  disabled={!open || saving}
                  {@attach registerControl(controlKey(candidate.id, "remove"))}
                  onclick={(event) => editLocally(event, candidate.id, "remove")}>−</button
                >
              </div>
            </li>
          {/each}
        </ol>
      </section>

      <section class="ballot-panel" aria-labelledby="unranked-heading">
        <div class="panel-heading">
          <h2 id="unranked-heading">{m.unranked_title()}</h2>
          <span>{unrankedCandidates.length}</span>
        </div>
        {#if unrankedCandidates.length === 0}
          <p class="empty-state">{m.unranked_empty()}</p>
        {/if}
        <ul aria-label={m.unranked_title()}>
          {#each unrankedCandidates as candidate (candidate.id)}
            <li>
              <CandidateTicket {candidate} />
              <button
                type="submit"
                formaction="?/edit"
                name="operation"
                value={`add:${candidate.id}`}
                aria-label={m.add_candidate({ name: candidate.name })}
                disabled={!open || saving}
                {@attach registerControl(controlKey(candidate.id, "add"))}
                onclick={(event) => editLocally(event, candidate.id, "add")}>+</button
              >
            </li>
          {/each}
        </ul>
      </section>
    </div>

    <div class="ballot-submit">
      <p>{m.save_rule()}</p>
      <button class="button button--primary" type="submit" disabled={!open || saving}>
        {saving ? m.saving_vote() : m.cast_vote()}
      </button>
    </div>
  </form>
</div>
