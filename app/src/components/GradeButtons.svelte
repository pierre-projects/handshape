<script lang="ts">
  import { GRADES, type Grade } from '../lib/srs';

  let {
    intervals,
    suggested,
    onGrade,
  }: { intervals: Record<number, string>; suggested?: Grade; onGrade: (g: Grade) => void } = $props();

  const HINTS: Record<number, string> = { 1: 'Missed it', 2: 'Struggled', 3: 'Got it', 4: 'Too easy' };
  const UNITS: Record<string, [string, string]> = {
    m: ['min', 'min'], h: ['hour', 'hours'], d: ['day', 'days'], mo: ['month', 'months'], y: ['year', 'years'],
  };

  /** "10m" → "in 10 min", "1d" → "tomorrow". */
  function when(short: string | undefined): string {
    const m = short?.match(/^(\d+)(mo|m|h|d|y)$/);
    if (!m) return '';
    const n = Number(m[1]);
    if (m[2] === 'd' && n === 1) return 'tomorrow';
    const [one, many] = UNITS[m[2]];
    return `in ${n} ${n === 1 ? one : many}`;
  }

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

<p class="ask">How well did you know it?</p>
<div class="grades" role="group" aria-label="How well did you know it?">
  {#each GRADES as g}
    <button
      class:suggested={suggested === g.rating}
      class="g{g.rating}"
      onclick={() => onGrade(g.rating)}
      aria-label="{g.label}: {HINTS[g.rating]}, see it again {when(intervals[g.rating])}"
    >
      {#if suggested === g.rating}<span class="tag">Suggested</span>{/if}
      <span class="label">{g.label}</span>
      <span class="hint">{HINTS[g.rating]}</span>
      <span class="when">{when(intervals[g.rating])}</span>
      <kbd>{g.key}</kbd>
    </button>
  {/each}
</div>

<style>
  .ask { margin: 0 0 8px; text-align: center; font-size: 0.85rem; font-weight: 600; color: var(--ink-2); }
  .grades { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; }
  button {
    --c: var(--ink-2);
    --soft: var(--surface-2);
    position: relative;
    flex-direction: column;
    gap: 1px;
    padding: 10px 4px 8px;
    min-height: 64px;
    border: 1px solid var(--line-strong);
    border-top: 3px solid var(--c);
    border-radius: var(--radius-sm);
    background: var(--surface);
  }
  button:hover { background: var(--soft); border-color: var(--c); }
  .label { font-weight: 700; font-size: 1rem; color: var(--c); }
  .hint { font-size: 0.78rem; color: var(--ink-2); }
  .when { font-size: 0.74rem; color: var(--ink-3); font-variant-numeric: tabular-nums; }
  kbd { position: absolute; top: 6px; right: 6px; margin: 0; }
  .tag {
    position: absolute;
    top: -10px;
    left: 50%;
    transform: translateX(-50%);
    padding: 1px 8px;
    border-radius: 999px;
    background: var(--c);
    color: #fff;
    font-size: 0.66rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }
  .g1 { --c: var(--bad); --soft: var(--bad-soft); }
  .g2 { --c: var(--ok); --soft: var(--ok-soft); }
  .g3 { --c: var(--good); --soft: var(--good-soft); }
  .g4 { --c: var(--accent); --soft: var(--accent-soft); }
  .suggested { background: var(--soft); border-color: var(--c); box-shadow: 0 0 0 1px var(--c); }
  @media (max-width: 480px) {
    .grades { gap: 6px; }
    .hint { display: none; }
    button { min-height: 56px; }
  }
</style>
