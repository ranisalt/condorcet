<script lang="ts">
  import type { Snippet } from "svelte";

  let { caption, children }: { caption: string; children: Snippet } = $props();
</script>

<figure class="explainer">
  {@render children()}
  <figcaption>{caption}</figcaption>
</figure>
