<script lang="ts">
  import type { Letter } from "#lib/explainers.ts";

  let { letter }: { letter: Letter } = $props();
</script>

<span class="chip cand-{letter}">{letter}</span>
