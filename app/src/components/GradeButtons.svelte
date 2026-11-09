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
  .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  button { flex-direction: column; gap: 0; padding: 8px 4px; }
  .label { font-weight: 600; }
  .when { font-size: 0.8rem; color: var(--ink-3); }
  kbd { margin-top: 2px; }
  .g1 .label { color: var(--bad); }
  .g3 .label { color: var(--good); }
  .suggested { outline: 2px solid var(--accent); outline-offset: 1px; background: var(--accent-soft); }
</style>
