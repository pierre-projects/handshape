<script lang="ts">
  // Camera drill: sign each prompt and the camera tells you when it matches.
  // It waits for you to press Next unless you turn on auto-advance, so the
  // sign never changes without you seeing it. Slow or skipped signs come back.
  import { onDestroy, onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { content } from '../lib/content';
  import { SPECS } from '../lib/engine/handshapes';
  import type { ResolvedItem, Settings } from '../lib/types';
  import HandCheck from '../components/HandCheck.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';

  type Set = 'letter' | 'number';

  /** Opened from a sign's page (#/practice/<id>): that sign comes first. */
  let { startId }: { startId?: string } = $props();

  const AUTO_MS = 2000;
  const AUTO_KEY = 'asl.practice.autoAdvance';
  const PIC_KEY = 'asl.practice.showPicture';

  let settings = $state<Settings>();
  let set = $state<Set>('letter');
  let queue = $state<ResolvedItem[]>([]);
  let shownAt = 0;
  let matched = $state(false);
  let lastSeconds = $state(0);
  let times = $state<{ id: string; seconds: number }[]>([]);
  let skipped = $state<string[]>([]);
  let autoAdvance = $state(read(AUTO_KEY, false));
  let showPicture = $state(read(PIC_KEY, true));
  let counting = $state(false);
  let advanceTimer: ReturnType<typeof setTimeout> | undefined;

  const current = $derived(queue[0]);
  const movement = $derived(current ? SPECS.get(current.id)?.movement : undefined);
  const upNext = $derived(queue[1]);
  // Signs with movement (J, Z, 10) are in too: the camera checks their starting handshape.
  const pool = (s: Set) => content.items.filter((i) => i.kind === s && SPECS.has(i.id));
  const average = $derived(times.length ? times.reduce((a, t) => a + t.seconds, 0) / times.length : undefined);

  function read(key: string, fallback: boolean): boolean {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : v === '1';
    } catch {
      return fallback;
    }
  }
  function write(key: string, v: boolean) {
    try {
      localStorage.setItem(key, v ? '1' : '0');
    } catch {
      /* storage unavailable: keep the in-memory value */
    }
  }

  onMount(async () => {
    settings = await (await getStore()).settings();
    const start = startId ? content.byId.get(startId) : undefined;
    begin(start?.kind === 'number' ? 'number' : 'letter', start?.id);
  });
  onDestroy(() => clearTimeout(advanceTimer));

  function shuffle<T>(xs: T[]): T[] {
    const a = [...xs];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function begin(s: Set, firstId?: string) {
    cancelAuto();
    set = s;
    const items = shuffle(pool(s));
    const i = firstId ? items.findIndex((x) => x.id === firstId) : -1;
    if (i > 0) items.unshift(...items.splice(i, 1));
    queue = items;
    times = [];
    skipped = [];
    reset();
  }

  function reset() {
    matched = false;
    shownAt = performance.now();
  }

  /** Moves to the next prompt. A repeat goes back in a few places later. */
  function next(repeat = matched && lastSeconds > 6) {
    cancelAuto();
    const [head, ...rest] = queue;
    if (repeat && head) rest.splice(Math.min(rest.length, 3), 0, head);
    queue = rest.length ? rest : shuffle(pool(set));
    reset();
  }

  function onMatch() {
    if (!current || matched) return;
    lastSeconds = Math.round((performance.now() - shownAt) / 100) / 10;
    times = [...times, { id: current.id, seconds: lastSeconds }];
    matched = true;
    if (autoAdvance) {
      counting = true;
      advanceTimer = setTimeout(() => next(), AUTO_MS);
    }
  }

  function cancelAuto() {
    clearTimeout(advanceTimer);
    counting = false;
  }

  /** Every sign in the set, in order, for the picker list. */
  const all = $derived(content.items.filter((i) => i.kind === set));
  const checkable = $derived(new Set(pool(set).map((i) => i.id)));
  const done = $derived(new Set(times.map((t) => t.id)));
  let rail = $state<HTMLElement>();

  /** Jumps straight to a sign picked from the list. */
  function choose(id: string) {
    if (id === current?.id) return;
    const item = pool(set).find((i) => i.id === id);
    if (!item) return;
    cancelAuto();
    queue = [item, ...queue.filter((i) => i.id !== id)];
    reset();
  }

  // Keep the highlighted sign visible in the list.
  $effect(() => {
    const id = current?.id;
    rail?.querySelector(`[data-id="${id}"]`)?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  });

  function skip() {
    if (!current) return;
    skipped = [...skipped, current.id];
    next(true);
  }

  function toggleAuto() {
    autoAdvance = !autoAdvance;
    write(AUTO_KEY, autoAdvance);
    if (!autoAdvance) cancelAuto();
  }

  function togglePicture() {
    showPicture = !showPicture;
    write(PIC_KEY, showPicture);
  }

  function onKey(e: KeyboardEvent) {
    if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey) return;
    if ((e.key === 'Enter' || e.key === ' ') && matched) {
      e.preventDefault();
      next();
    } else if (e.key === 's' || e.key === 'S') {
      skip();
    } else if (e.key === 'h' || e.key === 'H') {
      togglePicture();
    }
  }

  const mirror = $derived(settings?.dominantHand === 'Left');
</script>

<svelte:window onkeydown={onKey} />

<div class="practice">
  <div class="toolbar">
    <div class="segmented" role="tablist" aria-label="What to practise">
      <button role="tab" aria-selected={set === 'letter'} onclick={() => begin('letter')}>Letters</button>
      <button role="tab" aria-selected={set === 'number'} onclick={() => begin('number')}>Numbers</button>
    </div>
    <p class="session small" aria-label="This session">
      <span><b>{times.length}</b> signed</span>
      <span><b>{average ? `${average.toFixed(1)}s` : '–'}</b> avg</span>
      <span><b>{skipped.length}</b> skipped</span>
    </p>
    <label class="switch small">
      <input type="checkbox" checked={autoAdvance} onchange={toggleAuto} />
      <span class="track" aria-hidden="true"></span>
      Auto-advance
    </label>
  </div>

  {#if current}
    <div class="stage">
      <nav class="rail" bind:this={rail} aria-label="Choose a sign">
        {#each all as it (it.id)}
          {@const ok = checkable.has(it.id)}
          <button
            data-id={it.id}
            class:current={it.id === current.id}
            class:done={done.has(it.id)}
            class:skipped={skipped.includes(it.id) && !done.has(it.id)}
            disabled={!ok}
            aria-current={it.id === current.id ? 'true' : undefined}
            title={ok ? `Practise ${it.gloss}` : `${it.gloss} has a movement the camera can't check yet`}
            onclick={() => choose(it.id)}
          >{it.gloss}</button>
        {/each}
      </nav>

      <section class="prompt" class:matched aria-live="polite">
        <div class="prompt-main">
          <div class="target">
            <p class="eyebrow">{matched ? 'Matched' : 'Sign this'}</p>
            <div class="gloss">
              {#if matched}<span class="tick"><Icon name="check" size={28} /></span>{/if}{current.gloss}
            </div>
            {#if matched}<p class="time">{lastSeconds}s{lastSeconds > 6 ? ' · comes back for another go' : ''}</p>{/if}
          </div>
          {#if showPicture}
            <a class="ref" href="#/learn/{current.id}" title="Open {current.gloss} in Signs">
              <SignPicture id={current.id} size="100%" {mirror} label="How to sign {current.gloss}" />
            </a>
          {/if}
        </div>

        <div class="tip">
          <p class="how">{current.handshape}</p>
          {#if movement}
            <p class="move"><b>Then move:</b> {movement} The camera checks the starting handshape only.</p>
          {/if}
          {#if current.tips?.length}<p class="extra"><b>Tip:</b> {current.tips[0]}</p>{/if}
        </div>

        <div class="actions">
          {#if matched}
            <button class="primary lg next" class:counting onclick={() => next()} style="--ms: {AUTO_MS}ms">
              <span class="fill" aria-hidden="true"></span>
              <span class="label">Next sign <kbd>Enter</kbd></span>
            </button>
            {#if counting}<button class="ghost small" onclick={cancelAuto}>Stay here</button>{/if}
          {:else}
            <button onclick={skip}>Skip <kbd>S</kbd></button>
          {/if}
          <button class="ghost small" onclick={togglePicture} aria-pressed={showPicture}>
            {showPicture ? 'Hide' : 'Show'} picture <kbd>H</kbd>
          </button>
        </div>

        {#if upNext}
          <p class="upnext small muted">Up next: <b>{upNext.gloss}</b></p>
        {/if}
      </section>

      <div class="camera">
        <HandCheck
          fill
          target={current.id}
          autostart={settings?.showCameraByDefault ?? false}
          dominantHand={settings?.dominantHand}
          {onMatch}
        />
      </div>
    </div>
  {/if}

</div>

<style>
  /* Fill exactly one screen: viewport minus the header (and the tab bar on phones). */
  .practice {
    --chrome: 64px + 24px + 8px;
    height: calc(100dvh - (var(--chrome)));
    min-height: 520px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .toolbar { display: flex; align-items: center; gap: 12px 20px; flex-wrap: wrap; }
  .session { display: flex; gap: 14px; margin: 0; color: var(--ink-3); }
  .session b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .switch { margin-left: auto; display: inline-flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 600; color: var(--ink-2); }
  .switch input { position: absolute; opacity: 0; width: 1px; height: 1px; }
  .track { width: 38px; height: 22px; border-radius: 999px; background: var(--surface-3); position: relative; transition: background 0.15s; }
  .track::after {
    content: ''; position: absolute; top: 3px; left: 3px; width: 16px; height: 16px; border-radius: 50%;
    background: #fff; box-shadow: 0 1px 2px rgb(0 0 0 / 0.2); transition: transform 0.15s;
  }
  .switch input:checked + .track { background: var(--accent); }
  .switch input:checked + .track::after { transform: translateX(16px); }
  .switch input:focus-visible + .track { outline: 3px solid var(--accent); outline-offset: 2px; }

  .stage { flex: 1; min-height: 0; display: grid; grid-template-columns: auto minmax(230px, 290px) 1fr; gap: 16px; }

  /* Sign picker: every sign in the set, current one highlighted. */
  .rail {
    display: grid;
    grid-template-columns: repeat(2, 40px);
    grid-auto-rows: 36px;
    align-content: start;
    gap: 6px;
    min-height: 0;
    overflow-y: auto;
    padding: 2px;
  }
  .rail button {
    min-height: 0;
    padding: 0;
    font-weight: 650;
    font-size: 0.95rem;
    color: var(--ink-2);
    box-shadow: none;
    position: relative;
  }
  .rail button:hover:not(:disabled) { border-color: var(--accent); color: var(--accent); background: var(--surface); }
  .rail button.done { background: var(--good-soft); border-color: color-mix(in srgb, var(--good) 35%, transparent); color: var(--good); }
  .rail button.skipped::after {
    content: ''; position: absolute; top: 4px; right: 4px; width: 6px; height: 6px; border-radius: 50%; background: var(--warm);
  }
  .rail button.current, .rail button.current:hover {
    background: var(--accent); border-color: var(--accent); color: var(--accent-ink);
    box-shadow: 0 0 0 3px var(--accent-soft);
  }
  .rail button:disabled { opacity: 0.35; border-style: dashed; }
  .tip { border-left: 2px solid var(--line-strong); padding: 2px 0 2px 12px; font-size: 0.875rem; color: var(--ink-2); }
  .tip p { margin: 0; }
  .tip .extra, .tip .move { margin-top: 6px; }
  .tip .move { color: var(--accent); }
  .tip .move b { color: var(--accent); }
  .tip b { color: var(--ink); }
  .camera { min-height: 0; }

  .prompt {
    background: var(--surface);
    border: 1px solid var(--line);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    min-height: 0;
    transition: border-color 0.2s, background 0.2s;
  }
  .prompt.matched { border-color: var(--good); background: color-mix(in srgb, var(--good-soft) 60%, var(--surface)); }
  .prompt-main { flex: 1; min-height: 0; display: flex; flex-direction: column; gap: 10px; }
  .target .eyebrow { margin: 0; }
  .prompt.matched .eyebrow { color: var(--good); }
  .gloss { font-size: clamp(3.5rem, 9vh, 5.5rem); font-weight: 700; line-height: 1; letter-spacing: -0.02em; color: var(--ink); display: flex; align-items: center; gap: 8px; }
  .prompt.matched .gloss { color: var(--good); }
  .tick { display: grid; place-items: center; width: 40px; height: 40px; border-radius: 50%; background: var(--good); color: #fff; }
  .time { margin: 4px 0 0; font-weight: 700; color: var(--good); }
  .ref {
    flex: 1;
    min-height: 0;
    display: flex;
    justify-content: center;
    align-items: flex-end;
    background: var(--paper);
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    padding: 10px 10px 0;
    overflow: hidden;
  }
  .ref :global(svg) { height: 100%; width: auto; max-width: 100%; max-height: 240px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
  .next { position: relative; overflow: hidden; flex: 1; background: var(--good); border-color: var(--good); }
  .next .label { position: relative; display: inline-flex; gap: 8px; align-items: center; }
  .next .fill { position: absolute; inset: 0; transform-origin: left; transform: scaleX(0); background: rgb(255 255 255 / 0.25); }
  .next.counting .fill { animation: count var(--ms) linear forwards; }
  @keyframes count { to { transform: scaleX(1); } }
  .upnext { margin: 0; }

  @media (max-width: 820px) {
    .practice {
      --chrome: 56px + 16px + var(--nav-h) + 12px + env(safe-area-inset-bottom);
      min-height: 460px;
      gap: 8px;
    }
    .toolbar { gap: 8px 12px; flex-wrap: wrap; }
    .toolbar .segmented button { padding: 6px 12px; min-height: 34px; }
    .session { order: 3; width: 100%; justify-content: space-between; }
    .stage { grid-template-columns: 1fr; grid-template-rows: auto auto 1fr; gap: 10px; }
    .rail {
      grid-template-columns: none;
      grid-auto-flow: column;
      grid-auto-columns: 38px;
      grid-auto-rows: 34px;
      overflow-x: auto;
      overflow-y: hidden;
      scrollbar-width: none;
    }
    .prompt { padding: 12px 14px; gap: 8px; flex-direction: row; flex-wrap: wrap; align-items: center; }
    .prompt-main { flex-direction: row; align-items: center; flex: 1 1 auto; }
    .gloss { font-size: 3rem; }
    .tick { width: 30px; height: 30px; }
    .ref { flex: none; width: 70px; height: 80px; padding: 4px 4px 0; }
    .ref :global(svg) { max-height: 76px; }
    .actions { flex: 0 0 auto; }
    .upnext { display: none; }
    .tip { order: 5; width: 100%; font-size: 0.85rem; padding-left: 10px; }
    .tip .extra { display: none; }
    .next { flex: none; }
  }
</style>
