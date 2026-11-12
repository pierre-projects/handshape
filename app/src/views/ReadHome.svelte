<script lang="ts">
  // Read (#/practice/read): the levels, track by track, with
  // what's passed and what's next; free practice; and the learner's own mix-ups.
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { routes } from '../lib/routes';
  import { canRead, plural } from '../lib/fingerspell';
  import {
    confusions, LEVELS, levelState, lockedReason, MIXUPS_LEVEL, mixUpLetterCount, nextLevel, PASS, passedCount,
    SESSION_SIZE, topMixUps, TRACKS, type Level,
  } from '../lib/receptive';
  import { spellingSummary } from '../lib/spelling';
  import { loadSettings, mirrored, prefs } from '../lib/settings.svelte';
  import type { SpellingAttempt } from '../lib/types';
  import Icon from '../components/Icon.svelte';
  import SignPicture from '../components/SignPicture.svelte';

  let attempts = $state<SpellingAttempt[]>([]);
  let ready = $state(false);

  const progress = $derived(prefs.value?.readLevels ?? {});
  const mixed = $derived(confusions(attempts));
  const mixUpLetters = $derived(mixUpLetterCount(mixed));
  const mixUps = $derived(topMixUps(mixed, 5));
  const summary = $derived(spellingSummary(attempts));
  const next = $derived(nextLevel(progress, mixUpLetters));
  const passed = $derived(passedCount(progress));
  const stateOf = (l: Level) => levelState(l, progress, mixUpLetters);

  onMount(async () => {
    const store = await getStore();
    await loadSettings();
    attempts = await store.attempts();
    ready = true;
  });

  /** "2 letters a second", "flashes for 0.7 s", or nothing for a picture that stays up. */
  function pace(l: Level): string {
    if (l.speed) return `${l.speed} ${l.kind === 'number' ? 'digits' : 'letters'} a second`;
    return l.flashMs ? `Flashes for ${l.flashMs / 1000} s` : 'No time limit';
  }
</script>

<div class="read">
  <header class="head">
    <a class="back-link small" href={routes.practice}><Icon name="arrow-left" size={16} />Practice</a>
    <div class="title-row">
      <span class="icon"><Icon name="eye" size={22} /></span>
      <div class="titles">
        <h1>Read</h1>
        <p class="small muted">
          {passed} of {LEVELS.length} levels passed{#if summary.read.wpm}{' · '}{summary.read.wpm} wpm reading{/if}
        </p>
      </div>
    </div>
  </header>

  {#if !canRead}
    <section class="card">
      <h2>Not available yet</h2>
      <p>Reading practice needs a picture for each letter, and there aren't enough yet.</p>
    </section>
  {:else}
    {#if ready && next}
      <a class="next card" href={routes.readLevel(next.id)}>
        <span class="next-text">
          <span class="eyebrow">{progress[next.id]?.plays ? 'Keep going' : passed ? 'Next level' : 'Start here'}</span>
          <b>{TRACKS.find((t) => t.id === next.track)?.title}: {next.title}</b>
          <span class="small muted">{next.blurb}</span>
        </span>
        <span class="btn primary">{progress[next.id]?.plays ? 'Try again' : 'Start'}<Icon name="arrow-right" size={16} /></span>
      </a>
    {/if}

    <p class="how small muted">
      Each level is {SESSION_SIZE} quick reads. Get {PASS} right to pass it and open the next one.
    </p>

    {#each TRACKS as track}
      <section class="track" aria-labelledby="track-{track.id}">
        <div class="track-head">
          <h2 id="track-{track.id}">{track.title}</h2>
          <p class="small muted">{track.blurb}</p>
        </div>
        <ol class="levels">
          {#each LEVELS.filter((l) => l.track === track.id) as level, i}
            {@const s = stateOf(level)}
            {@const p = progress[level.id]}
            <li>
              {#if s === 'locked'}
                <div class="level locked" aria-disabled="true">
                  <span class="num">{i + 1}</span>
                  <span class="body">
                    <b>{level.title}</b>
                    <span class="small">{lockedReason(level)}</span>
                  </span>
                  <span class="badge">Locked</span>
                </div>
              {:else}
                <a class="level" class:passed={s === 'passed'} href={routes.readLevel(level.id)}>
                  <span class="num">{#if s === 'passed'}<Icon name="check" size={16} />{:else}{i + 1}{/if}</span>
                  <span class="body">
                    <b>{level.title}</b>
                    <span class="small muted">{level.blurb}</span>
                    <span class="small pace">{pace(level)}{#if p?.plays}{' · '}best {p.best} of {SESSION_SIZE}{/if}</span>
                  </span>
                  <span class="badge" class:done={s === 'passed'}>{s === 'passed' ? 'Passed' : p?.plays ? 'Try again' : 'Play'}</span>
                </a>
              {/if}
            </li>
          {/each}
        </ol>
      </section>
    {/each}

    <section class="track" aria-labelledby="free-title">
      <div class="track-head">
        <h2 id="free-title">Free reading</h2>
        <p class="small muted">No levels: word after word from the built-in words or your own lists, at a speed that follows you.</p>
      </div>
      <a class="level" href={routes.readFree}>
        <span class="num"><Icon name="play" size={14} /></span>
        <span class="body">
          <b>Read words</b>
          <span class="small muted">
            {plural(summary.read.count, 'word')} read{#if summary.read.accuracy !== undefined}{' · '}{summary.read.accuracy}% right lately{/if}
          </span>
        </span>
        <span class="badge">Open</span>
      </a>
    </section>

    <section class="track" aria-labelledby="mix-title">
      <div class="track-head">
        <h2 id="mix-title">Your mix-ups</h2>
        <p class="small muted">The letters you most often read as another letter.</p>
      </div>
      {#if mixUps.length}
        <ul class="mixups">
          {#each mixUps as m}
            <li class="card">
              <span class="pair">
                <span class="pic"><SignPicture id={m.shown.toLowerCase()} size={52} mirror={mirrored(prefs.value)} /><b>{m.shown}</b></span>
                <span class="as small muted">read as</span>
                <span class="pic"><SignPicture id={m.answered.toLowerCase()} size={52} mirror={mirrored(prefs.value)} /><b>{m.answered}</b></span>
              </span>
              <span class="small muted">{plural(m.count, 'time')}</span>
            </li>
          {/each}
        </ul>
        {#if stateOf(LEVELS.find((l) => l.id === MIXUPS_LEVEL)!) !== 'locked'}
          <a class="btn" href={routes.readLevel(MIXUPS_LEVEL)}>Drill these<Icon name="arrow-right" size={16} /></a>
        {/if}
      {:else}
        <p class="card empty small muted">Nothing yet. As you play, the letters you mix up collect here so you can drill them.</p>
      {/if}
    </section>
  {/if}
</div>

<style>
  .read { --m: var(--accent); --m-soft: var(--accent-soft); }
  .head { margin: 0 0 16px; }
  .title-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; }
  .icon {
    flex: none; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 12px;
    background: var(--m-soft); color: var(--m);
  }
  .titles h1 { margin: 0; font-size: 1.6rem; }
  .titles p { margin: 2px 0 0; }

  .next {
    display: flex; align-items: center; justify-content: space-between; gap: 16px; flex-wrap: wrap;
    border-left: 4px solid var(--m); color: var(--ink); text-decoration: none;
    transition: box-shadow 0.15s, border-color 0.15s;
  }
  .next:hover { box-shadow: var(--shadow-lift); }
  .next-text { display: grid; gap: 2px; min-width: 0; flex: 1 1 260px; }
  .next-text b { font-size: 1.15rem; }
  .how { margin: 14px 0 0; }

  .track { margin-top: 26px; }
  .track-head { margin-bottom: 10px; }
  .track-head h2 { margin: 0; }
  .track-head p { margin: 2px 0 0; }
  .levels { list-style: none; margin: 0; padding: 0; display: grid; gap: 8px; }
  .level {
    display: flex; align-items: center; gap: 14px; padding: 12px 16px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    color: var(--ink); text-decoration: none; box-shadow: var(--shadow);
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  a.level:hover { border-color: var(--m); box-shadow: var(--shadow-lift); }
  .level.locked { background: var(--surface-2); color: var(--ink-3); box-shadow: none; }
  .num {
    flex: none; display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%;
    background: var(--m-soft); color: var(--m); font-weight: 700; font-variant-numeric: tabular-nums;
  }
  .locked .num { background: var(--surface-3); color: var(--ink-3); }
  .passed .num { background: var(--good-soft); color: var(--good); }
  .body { display: grid; gap: 1px; flex: 1; min-width: 0; }
  .pace { color: var(--ink-2); }
  .badge.done { background: var(--good-soft); color: var(--good); border-color: transparent; }

  .mixups { list-style: none; margin: 0 0 12px; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
  .mixups li { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 10px 14px; }
  .pair { display: flex; align-items: center; gap: 10px; }
  .pic { display: grid; justify-items: center; gap: 0; padding: 4px 6px 2px; background: var(--paper); border-radius: var(--radius-sm); border: 1px solid var(--line); }
  .pic b { color: #18181b; }
  .empty { margin: 0; }

  @media (max-width: 560px) {
    .level { padding: 12px; gap: 10px; }
    .level .badge { display: none; }
  }
</style>
