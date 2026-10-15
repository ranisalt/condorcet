<script lang="ts">
  import { tick, untrack } from "svelte";
  import { enhance } from "$app/forms";
  import { m } from "#lib/paraglide/messages.js";
  import { editDraft, type BallotDraft, type Candidate, type Election } from "../election.ts";
  import CandidateTicket from "./CandidateTicket.svelte";

  type BallotError = "invalid" | "closed" | "stale" | "save";
  type EditType = "add" | "remove" | "up" | "down";

  let {
    election,
    initialDraft,
    open,
    error,
  }: {
    election: Election;
    initialDraft: BallotDraft;
    open: boolean;
    error?: BallotError;
  } = $props();

  // The route keys this component to the server draft; subsequent edits stay local.
  let draft = $state<BallotDraft>(untrack(() => structuredClone(initialDraft)));
  let saving = $state(false);
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

  function controlKey(id: number, action: string): string {
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
    await tick();

    const rankedIndex = draft.ranked.indexOf(candidateId);
    const focusAction =
      type === "add"
        ? "remove"
        : type === "remove"
          ? "add"
          : type === "up"
            ? rankedIndex === 0
              ? "down"
              : "up"
            : rankedIndex === draft.ranked.length - 1
              ? "up"
              : "down";
    controlRefs[controlKey(candidateId, focusAction)]?.focus();
  }

  function messageForError(value: BallotError): string {
    if (value === "invalid") return m.invalid_ballot();
    if (value === "closed") return m.election_closed();
    if (value === "stale") return m.stale_election();
    return m.save_failed();
  }
</script>

<h1>{m.ballot_title()}</h1>
<p>{m.simulation_warning()}</p>
<p>{m.privacy_warning()}</p>
<p>{m.omitted_rule()}</p>
<p>{m.empty_rule()}</p>
<p>{m.save_rule()}</p>

{#if !open}
  <p role="status">{m.election_closed()}</p>
{/if}

{#if error}
  <p role="alert">{messageForError(error)}</p>
{/if}

<form
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

  <div class="ballot-columns">
    <section aria-labelledby="ranked-heading">
      <h2 id="ranked-heading">{m.ranked_title()}</h2>
      {#if rankedCandidates.length === 0}
        <p>{m.ranked_empty()}</p>
      {/if}
      <ol aria-label={m.ranked_title()}>
        {#each rankedCandidates as candidate, index (candidate.id)}
          <li>
            <span>{m.rank_label({ position: index + 1 })}</span>
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

    <section aria-labelledby="unranked-heading">
      <h2 id="unranked-heading">{m.unranked_title()}</h2>
      {#if unrankedCandidates.length === 0}
        <p>{m.unranked_empty()}</p>
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

  <button type="submit" disabled={!open || saving} aria-busy={saving}>
    {saving ? m.saving_vote() : m.cast_vote()}
  </button>
</form>
