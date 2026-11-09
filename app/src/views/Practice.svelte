<script lang="ts">
  // Camera drill: sign each prompt; it moves on as soon as the camera matches.
  // Signs you skip or take longest on come back sooner.
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { content } from '../lib/content';
  import { SPECS } from '../lib/engine/handshapes';
  import type { ResolvedItem, Settings } from '../lib/types';
  import HandCheck from '../components/HandCheck.svelte';
  import SignDetail from '../components/SignDetail.svelte';

  type Set = 'letter' | 'number';

  let settings = $state<Settings>();
  let set = $state<Set>('letter');
  let queue = $state<ResolvedItem[]>([]);
  let shownAt = 0;
  let showHelp = $state(false);
  let justMatched = $state(false);
  let times = $state<{ id: string; seconds: number }[]>([]);
  let skipped = $state<string[]>([]);
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  const current = $derived(queue[0]);
  const pool = (s: Set) => content.items.filter((i) => i.kind === s && SPECS.has(i.id) && !SPECS.get(i.id)!.movement);

  const average = $derived(times.length ? times.reduce((a, t) => a + t.seconds, 0) / times.length : undefined);
  const slowest = $derived.by(() => {
    const best = new Map<string, number>();
    for (const t of times) best.set(t.id, Math.max(best.get(t.id) ?? 0, t.seconds));
    return [...best.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  });

  onMount(async () => {
    settings = await (await getStore()).settings();
    begin('letter');
  });

  function shuffle<T>(xs: T[]): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function begin(s: Set) {
    clearTimeout(advanceTimer);
    set = s;
    queue = shuffle(pool(s));
    times = [];
    skipped = [];
    next(false);
  }

  /** Moves to the next prompt. A repeat goes back in a few places later. */
  function next(repeat: boolean) {
    const [head, ...rest] = queue;
    if (repeat && head) rest.splice(Math.min(rest.length, 3), 0, head);
    queue = rest.length ? rest : shuffle(pool(set));
    showHelp = false;
    justMatched = false;
    shownAt = performance.now();
  }

  function onMatch() {
    if (!current || justMatched) return;
    const seconds = Math.round((performance.now() - shownAt) / 100) / 10;
    times = [...times, { id: current.id, seconds }];
    justMatched = true;
    // Slow signs come back for another go.
    advanceTimer = setTimeout(() => next(seconds > 6), 900);
  }

  function skip() {
    if (!current) return;
    skipped = [...skipped, current.id];
    next(true);
  }

  const gloss = (id: string) => content.byId.get(id)?.gloss ?? id;
</script>

<div class="row tabs" role="tablist">
  <button role="tab" aria-selected={set === 'letter'} onclick={() => begin('letter')}>Letters</button>
  <button role="tab" aria-selected={set === 'number'} onclick={() => begin('number')}>Numbers</button>
</div>

{#if current}
  <section class="card stack">
    <div class="spread">
      <div>
        <p class="muted small">Sign this to your camera</p>
        <div class="big-gloss" class:matched={justMatched}>{current.gloss}</div>
      </div>
      <div class="row">
        <button class="small" onclick={() => (showHelp = !showHelp)} aria-expanded={showHelp}>Show me</button>
        <button class="small" onclick={skip}>Skip</button>
      </div>
    </div>
    {#if showHelp}
      <SignDetail item={current} showGloss={false} />
    {/if}
    <HandCheck target={current.id} autostart={settings?.showCameraByDefault ?? false} dominantHand={settings?.dominantHand} {onMatch} />
  </section>
{/if}

<section class="card stack">
  <h2>This session</h2>
  <div class="stat-grid">
    <div class="stat"><div class="value">{times.length}</div><div class="label">signed</div></div>
    <div class="stat"><div class="value">{average ? `${average.toFixed(1)}s` : '–'}</div><div class="label">average time to match</div></div>
    <div class="stat"><div class="value">{skipped.length}</div><div class="label">skipped</div></div>
  </div>
  {#if slowest.length}
    <p class="small">
      Slowest:
      {#each slowest as [id, s], i}<a href="#/learn/{id}">{gloss(id)}</a> ({s}s){i < slowest.length - 1 ? ', ' : ''}{/each}.
      Signs that take over 6 seconds come back for another go.
    </p>
  {/if}
  <p class="small muted">
    J, Z and 10 are left out because their movement isn't checked yet. The camera checks are new and may be strict or
    lenient on some letters. Use Show me and your own judgement too.
  </p>
</section>

<style>
  .tabs { margin-bottom: 12px; }
  .tabs button[aria-selected='true'] { background: var(--accent); color: var(--accent-ink); border-color: var(--accent); font-weight: 600; }
  .big-gloss { transition: color 150ms; }
  .big-gloss.matched { color: var(--good); }
</style>
