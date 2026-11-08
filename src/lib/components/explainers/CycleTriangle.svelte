<script lang="ts">
  import type { Duel, Letter } from "#lib/explainers.ts";
  import Explainer from "./Explainer.svelte";

  let { duels, caption, skipped }: { duels: readonly Duel[]; caption: string; skipped?: Duel } =
    $props();

  const markerId = $props.id();
  const radius = 24;
  const nodes: { letter: Letter; x: number; y: number }[] = [
    { letter: "A", x: 150, y: 40 },
    { letter: "B", x: 255, y: 220 },
    { letter: "C", x: 45, y: 220 },
  ];
  const at = (letter: Letter) => {
    const node = nodes.find((candidate) => candidate.letter === letter);
    if (!node) throw new Error(`No node for ${letter}`);
    return node;
  };

  function segment({ winner, loser }: Duel) {
    const from = at(winner);
    const to = at(loser);
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const ux = (to.x - from.x) / length;
    const uy = (to.y - from.y) / length;
    return {
      x1: from.x + ux * radius,
      y1: from.y + uy * radius,
      x2: to.x - ux * (radius + 6),
      y2: to.y - uy * (radius + 6),
      labelX: (from.x + to.x) / 2 - uy * 28,
      labelY: (from.y + to.y) / 2 + ux * 28,
    };
  }

  const isSkipped = (duel: Duel) => skipped?.winner === duel.winner && skipped.loser === duel.loser;
</script>

<Explainer {caption}>
  <svg class="cycle-svg" viewBox="0 0 300 260" aria-hidden="true">
    <defs>
      <marker
        id={markerId}
        viewBox="0 0 10 10"
        refX="8"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto"
      >
        <path d="M0 0L10 5L0 10z" fill="var(--ink)" />
      </marker>
    </defs>
    {#each duels as duel (duel.winner + duel.loser)}
      {@const s = segment(duel)}
      <line
        x1={s.x1}
        y1={s.y1}
        x2={s.x2}
        y2={s.y2}
        stroke={isSkipped(duel) ? "var(--muted)" : "var(--ink)"}
        stroke-width="2"
        stroke-dasharray={isSkipped(duel) ? "6 5" : undefined}
        marker-end="url(#{markerId})"
      />
      <text
        x={s.labelX}
        y={s.labelY}
        text-anchor="middle"
        dominant-baseline="middle"
        font-size="13"
        fill={isSkipped(duel) ? "var(--muted)" : "var(--ink)"}
        stroke="var(--surface)"
        stroke-width="4"
        paint-order="stroke"
      >
        {isSkipped(duel) ? "✕ " : ""}{duel.winnerVotes}–{duel.loserVotes}
      </text>
    {/each}
    {#each nodes as node (node.letter)}
      <circle cx={node.x} cy={node.y} r={radius} fill="var(--cand-{node.letter.toLowerCase()})" />
      <text
        x={node.x}
        y={node.y}
        text-anchor="middle"
        dominant-baseline="central"
        font-size="18"
        font-weight="700"
        fill="var(--surface)">{node.letter}</text
      >
    {/each}
  </svg>
</Explainer>
