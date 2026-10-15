<script lang="ts">
  import { m } from "#lib/paraglide/messages.js";
  import type { Candidate } from "../election.ts";

  let { candidate }: { candidate: Candidate } = $props();
</script>

<article>
  <strong>{candidate.name}</strong>
  <span>{candidate.number} · {candidate.party}</span>
  <small>{m.vice_label({ name: candidate.vice.name, party: candidate.vice.party })}</small>
</article>
