<script lang="ts">
  // Spells a run of letters or digits on screen, one at a time, then calls
  // onDone. It plays once, as soon as it appears; to play again, show it again
  // (a {#key} block does that). Shows letter pictures, or the moving drawn hand.
  import { onMount } from 'svelte';
  import { content } from '../lib/content';
  import { buildSequence, sequenceDuration, type Frame } from '../lib/spelling';
  import type { Handedness } from '../lib/engine/hand';
  import HandSign from './HandSign.svelte';
  import SpellingHand from './SpellingHand.svelte';

  let {
    ids,
    speed,
    display = 'pictures',
    mirror = false,
    onDone,
  }: {
    /** Content item ids to show, in order: "c", "a", "t". */
    ids: string[];
    /** Letters per second. */
    speed: number;
    display?: 'pictures' | 'hand';
    /** Show a left-handed signer. */
    mirror?: boolean;
    onDone?: () => void;
  } = $props();

  /** A beat before the first letter, so the eye is ready. */
  const LEAD = 400;
  /** Longest to wait for pictures to load before starting anyway. */
  const PRELOAD_LIMIT = 1500;

  let frame = $state<Frame>();
  let startAt = $state<number>();
  // The run is fixed for the life of the player; a new word means a new player.
  // svelte-ignore state_referenced_locally
  const frames = buildSequence(ids, speed);
  // svelte-ignore state_referenced_locally
  const hand: Handedness = mirror ? 'Left' : 'Right';

  const image = (id: string) => content.byId.get(id)?.files.find((f) => f.type === 'image');

  /** Loads every picture first, so the first showing of a letter isn't a blank flash. */
  function preload(): Promise<unknown> {
    if (display === 'hand') return Promise.resolve();
    const urls = [...new Set(ids.map((id) => image(id)?.url).filter((u): u is string => !!u))];
    const loaded = Promise.all(
      urls.map((url) => {
        const img = new Image();
        img.src = url;
        return img.decode().catch(() => {});
      }),
    );
    return Promise.race([loaded, new Promise((r) => setTimeout(r, PRELOAD_LIMIT))]);
  }

  onMount(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    let gone = false;
    preload().then(() => {
      if (gone) return;
      startAt = performance.now() + LEAD;
      for (const f of frames) {
        timers.push(setTimeout(() => (frame = f), LEAD + f.startMs));
        timers.push(setTimeout(() => { if (frame === f) frame = undefined; }, LEAD + f.startMs + f.durationMs));
      }
      timers.push(setTimeout(() => onDone?.(), LEAD + sequenceDuration(frames) + 150));
    });
    return () => {
      gone = true;
      timers.forEach(clearTimeout);
    };
  });
</script>

<div class="player">
  {#if display === 'hand'}
    <div class="stage tall"><SpellingHand {ids} {speed} {startAt} {hand} /></div>
  {:else if frame}
    {@const img = image(frame.letter)}
    <div class="stage" class:shift={frame.repeat}>
      {#if img}
        <img src={img.url} alt="" class:mirror draggable="false" />
      {:else}
        <HandSign id={frame.letter} size={200} label="" animate={false} {mirror} />
      {/if}
    </div>
  {:else}
    <div class="stage wait muted small">{startAt === undefined ? 'Loading…' : 'Watch…'}</div>
  {/if}
  <div class="ticks" aria-hidden="true">
    {#each frames as f}<span class:seen={frame ? f.index <= frame.index : false}></span>{/each}
  </div>
</div>

<style>
  .player { position: relative; width: 100%; }
  .stage { width: 100%; height: 260px; display: grid; place-items: center; }
  /* The drawn hand is small inside its frame (it needs room to move), so it gets a taller one. */
  .stage.tall { height: 330px; }
  .stage img { max-width: 100%; max-height: 260px; object-fit: contain; }
  .stage.shift { transform: translateX(14%); }
  .ticks { position: absolute; bottom: -18px; left: 0; right: 0; display: flex; justify-content: center; gap: 6px; flex-wrap: wrap; }
  .ticks span { width: 22px; height: 4px; border-radius: 2px; background: var(--surface-3); transition: background 0.1s; }
  .ticks span.seen { background: var(--m, var(--accent)); }
</style>
