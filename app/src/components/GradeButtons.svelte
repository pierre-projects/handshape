<script lang="ts">
  import { GRADES, type Grade } from '../lib/srs';

  let {
    intervals,
    suggested,
    onGrade,
  }: { intervals: Record<number, string>; suggested?: Grade; onGrade: (g: Grade) => void } = $props();

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement) return;
    const g = GRADES.find((x) => x.key === e.key);
    if (g) {
      e.preventDefault();
      onGrade(g.rating);
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="grades" role="group" aria-label="How well did you know it?">
  {#each GRADES as g}
    <button class:suggested={suggested === g.rating} class="g{g.rating}" onclick={() => onGrade(g.rating)}>
      <span class="label">{g.label}</span>
      <span class="when">{intervals[g.rating] ?? ''}</span>
      <kbd>{g.key}</kbd>
    </button>
  {/each}
</div>

<style>
  .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  button {
    --c: var(--ink-2);
    --soft: var(--surface-2);
    flex-direction: column;
    gap: 0;
    padding: 10px 4px;
    min-height: 60px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
  }
  button:hover { background: var(--soft); border-color: var(--c); }
  .label { font-weight: 600; font-size: 0.95rem; color: var(--c); }
  .when { font-size: 0.8rem; color: var(--ink-3); }
  kbd { margin-top: 2px; }
  .g1 { --c: var(--bad); --soft: var(--bad-soft); }
  .g2 { --c: var(--ok); --soft: var(--ok-soft); }
  .g3 { --c: var(--good); --soft: var(--good-soft); }
  .g4 { --c: var(--accent); --soft: var(--accent-soft); }
  .suggested { background: var(--soft); border-color: var(--c); }
</style>
