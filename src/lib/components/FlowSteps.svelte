<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";

  let { current }: { current: 1 | 2 | 3 } = $props();
  const steps = [m.flow_step_sign_in, m.flow_step_notices, m.flow_step_ballot];
</script>

<ol class="flow-steps" aria-label={m.flow_steps_label()}>
  {#each steps as label, index (index)}
    {@const position = index + 1}
    <li
      class:done={position < current}
      class:current={position === current}
      aria-current={position === current ? "step" : undefined}
    >
      <span class="flow-step-marker" aria-hidden="true">
        {#if position < current}
          <svg viewBox="0 0 16 16" width="12" height="12"
            ><path
              d="M3.5 8.5l3 3 6-7"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              stroke-linecap="round"
              stroke-linejoin="round"
            /></svg
          >
        {:else}
          {String(position).padStart(2, "0")}
        {/if}
      </span>
      <span class="flow-step-label">{label()}</span>
      {#if position < current}<span class="sr-only">{` (${m.flow_step_done()})`}</span>{/if}
    </li>
  {/each}
</ol>
