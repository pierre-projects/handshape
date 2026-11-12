<script lang="ts">
  import { routes } from '../lib/routes';
  // Fingerspelling landing (#/fingerspelling). Sign Five, the daily word game,
  // leads the page with today's board; under it are the drills (reading,
  // spelling and the numbers game), then the word lists they use. Each is its
  // own page: SignFive (#/fingerspelling/sign-five), ReadHome and its levels
  // (#/fingerspelling/read), SpellDrill (#/fingerspelling/spell) and SignSums
  // (#/fingerspelling/sums).
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { spellingSummary } from '../lib/spelling';
  import { builtInWords, canRead, drillWords } from '../lib/fingerspell';
  import { loadSettings, prefs, updateSettings } from '../lib/settings.svelte';
  import type { SignFiveSave, SpellingAttempt } from '../lib/types';
  import { dailyStatus, dayKey, describeDaily, MAX_GUESSES, scoreGuess, WORD_LENGTH, type Mark } from '../lib/guess';
  import { confusions, LEVELS, mixUpLetterCount, nextLevel, passedCount } from '../lib/receptive';
  import ListPicker from '../components/ListPicker.svelte';
  import Icon from '../components/Icon.svelte';

  let attempts = $state<SpellingAttempt[]>([]);
  let five = $state<SignFiveSave>();
  let loaded = $state(false);
  const summary = $derived(spellingSummary(attempts));
  const chosen = $derived(drillWords(prefs.value).list);
  const levels = $derived(prefs.value?.readLevels ?? {});
  const nextRead = $derived(nextLevel(levels, mixUpLetterCount(confusions(attempts))));

  // Sign Five: how today's game stands, and its board so far.
  const today = $derived(dailyStatus(five));
  const stats = $derived(five?.stats);
  type Tile = { letter: string; mark?: Mark };
  const blank: Tile[] = Array.from({ length: WORD_LENGTH }, () => ({ letter: '' }));
  /** Today's guesses, colored, with empty rows after them. Before the first guess, the game's name stands in. */
  const board = $derived.by((): Tile[][] => {
    const daily = five?.daily?.key === dayKey() ? five.daily : undefined;
    const rows: Tile[][] = (daily?.guesses ?? []).map((g) => {
      const marks = daily?.answer ? scoreGuess(g, daily.answer) : [];
      return g.split('').map((letter, i) => ({ letter, mark: marks[i] }));
    });
    if (!rows.length) {
      const demo: Mark[] = ['hit', 'near', 'miss', 'hit', 'near'];
      rows.push('SIGN5'.split('').map((letter, i) => ({ letter, mark: demo[i] })));
    }
    while (rows.length < MAX_GUESSES) rows.push(blank);
    return rows;
  });
  const fiveCta = $derived(
    { unplayed: "Play today's word", playing: 'Keep playing', won: 'Play a practice word', lost: 'Play a practice word' }[today.state],
  );

  onMount(async () => {
    const store = await getStore();
    await loadSettings();
    attempts = await store.attempts();
    five = await store.signFive();
    loaded = true;
  });
</script>

<header class="hub-head">
  <h1>Fingerspelling</h1>
  <p class="muted">Play today's word, then practice the two skills behind it: reading and spelling.</p>
</header>

<a class="feature" href={routes.signFive}>
  <span class="feature-text">
    <span class="kicker light">Daily word game</span>
    <span class="feature-title">Sign Five</span>
    <span class="feature-desc">Guess the five-letter word in six tries, fingerspelling each guess to your camera.</span>
    <span class="feature-status">
      {#if loaded}
        <b>{describeDaily(today)}.</b>
        {#if stats?.played}
          <span class="chip">{stats.streak} day streak</span>
          <span class="chip">{stats.won} of {stats.played} won</span>
        {/if}
      {:else}
        &nbsp;
      {/if}
    </span>
    <span class="feature-go">{fiveCta}<Icon name="arrow-right" size={18} /></span>
  </span>
  <span class="board" class:fresh={today.state === 'unplayed'} aria-hidden="true">
    {#each board as row}
      {#each row as t}<i class={t.mark ?? ''} class:filled={!!t.letter}>{t.letter}</i>{/each}
    {/each}
  </span>
</a>

<h2 class="section-title">Practice</h2>
<div class="modes">
  <a class="mode-card read" href={routes.read} class:locked={!canRead} aria-disabled={!canRead}>
    <div class="art" aria-hidden="true">
      <span class="flash">C</span><span class="flash on">A</span><span class="flash">T</span>
      <span class="art-icon"><Icon name="eye" size={22} /></span>
    </div>
    <div class="mode-body">
      <span class="kicker"><Icon name="eye" size={15} />Receptive</span>
      <h2>Read</h2>
      <p>Levels for letters, words and numbers, a drill on the letters you mix up, and free practice at a speed that adapts to you.</p>
      <div class="mode-meta">
        <span><b>{passedCount(levels)}</b> of {LEVELS.length} levels</span>
        {#if summary.read.wpm}<span><b>{summary.read.wpm}</b> wpm reading</span>{/if}
        <span><b>{summary.read.count}</b> {summary.read.count === 1 ? 'word' : 'words'} read</span>
        {#if summary.read.accuracy !== undefined}<span><b>{summary.read.accuracy}%</b> right</span>{/if}
      </div>
    </div>
    <span class="go">{!canRead ? 'Needs letter images' : nextRead && passedCount(levels) ? `Next: ${nextRead.title}` : 'Start reading'}<Icon name="arrow-right" size={18} /></span>
  </a>

  <a class="mode-card spell" href={routes.spell}>
    <div class="art" aria-hidden="true">
      <span class="tile ok">C</span><span class="tile now">A</span><span class="tile">T</span>
      <span class="art-icon"><Icon name="camera" size={22} /></span>
    </div>
    <div class="mode-body">
      <span class="kicker"><Icon name="signs" size={15} />Expressive</span>
      <h2>Spell</h2>
      <p>See a word and fingerspell it to your camera. Each letter is checked as you go, and you get a score.</p>
      <div class="mode-meta">
        {#if summary.spell.lettersPerSecond}<span><b>{summary.spell.lettersPerSecond.toFixed(1)}</b> letters/s</span>{/if}
        <span><b>{summary.spell.count}</b> {summary.spell.count === 1 ? 'word' : 'words'} spelled</span>
        {#if summary.spell.clean !== undefined}<span><b>{summary.spell.clean}%</b> clean</span>{/if}
      </div>
    </div>
    <span class="go">Start spelling<Icon name="arrow-right" size={18} /></span>
  </a>

  <a class="mode-card spell" href={routes.sums}>
    <div class="art" aria-hidden="true">
      <span class="sum-art">3 + 4 =</span><span class="tile now">?</span>
      <span class="art-icon"><Icon name="camera" size={22} /></span>
    </div>
    <div class="mode-body">
      <span class="kicker"><Icon name="signs" size={15} />Numbers</span>
      <h2>Sign the answer</h2>
      <p>A sum appears and you sign the answer to your camera. Ten sums a round, with the numbers 0 to 10.</p>
    </div>
    <span class="go">Start counting<Icon name="arrow-right" size={18} /></span>
  </a>
</div>

<h2 class="section-title">Words to practice</h2>
<ListPicker
  lists={prefs.value?.lists ?? []}
  selectedId={chosen?.id ?? ''}
  builtInCount={builtInWords.length}
  onSelect={(id) => updateSettings({ spellListId: id })}
/>

{#if summary.weakLetters.length}
  <section class="card weak">
    <p class="small">
      <b>Letters you misread most:</b>
      {#each summary.weakLetters as [l, s], i}<a href={routes.sign(l.toLowerCase())}>{l}</a> ({Math.round(s.rate * 100)}%){i < summary.weakLetters.length - 1 ? ', ' : ''}{/each}.
      Reading practice shows these letters more often.
    </p>
  </section>
{/if}

<style>
  /* Each drill has its own color so the two never look alike. */
  .read { --m: var(--accent); --m-soft: var(--accent-soft); }
  .spell { --m: var(--spell); --m-soft: var(--spell-soft); }

  .hub-head { margin: 4px 0 16px; }
  .hub-head h1 { margin: 0 0 4px; }
  .hub-head p { margin: 0; }
  .modes { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
  .mode-card {
    display: grid; grid-template-rows: auto 1fr auto; overflow: hidden;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    color: var(--ink); text-decoration: none; box-shadow: var(--shadow);
    transition: border-color 0.15s, box-shadow 0.15s, transform 0.15s;
  }
  .mode-card:hover { border-color: var(--m); box-shadow: var(--shadow-lift); transform: translateY(-1px); }
  .mode-card.locked { opacity: 0.6; pointer-events: none; }
  .art {
    position: relative; display: flex; justify-content: center; align-items: center; gap: 10px; height: 132px;
    background: var(--m-soft); border-bottom: 1px solid var(--line);
  }
  .art-icon {
    position: absolute; top: 12px; left: 12px; display: grid; place-items: center; width: 38px; height: 38px;
    border-radius: 50%; background: var(--surface); color: var(--m);
  }
  .flash { font-size: 2.6rem; font-weight: 750; color: color-mix(in srgb, var(--m) 25%, transparent); }
  .flash.on { font-size: 3.6rem; color: var(--m); }
  .tile {
    display: grid; place-items: center; width: 50px; height: 58px; border-radius: var(--radius-sm);
    border: 1px solid var(--line-strong); background: var(--surface); font-size: 1.7rem; font-weight: 700; color: var(--ink-3);
  }
  .tile.ok { border-color: var(--good); background: var(--good-soft); color: var(--good); }
  .sum-art { font-size: 2rem; font-weight: 750; color: var(--m); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .tile.now { border: 2px solid var(--m); color: var(--m); box-shadow: 0 0 0 3px color-mix(in srgb, var(--m) 18%, transparent); }
  .mode-body { padding: 16px 18px 4px; }
  .mode-body h2 { margin: 4px 0 6px; font-size: 1.4rem; }
  .mode-body p { margin: 0; color: var(--ink-2); }
  .kicker {
    display: inline-flex; align-items: center; gap: 6px; font-size: 0.75rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; color: var(--m);
  }
  .mode-meta { display: flex; flex-wrap: wrap; gap: 6px 14px; margin-top: 12px; font-size: 0.85rem; color: var(--ink-3); }
  .mode-meta b { color: var(--ink); font-variant-numeric: tabular-nums; }
  .go {
    display: flex; align-items: center; justify-content: space-between; margin: 14px 18px 16px; padding: 10px 14px;
    border-radius: var(--radius-sm); background: var(--m); color: #fff; font-weight: 650;
  }
  /* Sign Five leads the page: a full-width banner in the game's own color, with today's board. */
  .feature {
    --tile: 34px;
    display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 28px;
    margin-bottom: 30px; padding: 26px 30px; border-radius: calc(var(--radius) + 4px);
    background: linear-gradient(135deg, var(--spell), color-mix(in srgb, var(--spell) 62%, #0b1020));
    color: #fff; text-decoration: none;
    box-shadow: 0 10px 24px -10px color-mix(in srgb, var(--spell) 70%, transparent);
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .feature:hover { transform: translateY(-2px); box-shadow: 0 16px 30px -12px color-mix(in srgb, var(--spell) 80%, transparent); }
  .feature:focus-visible { outline: 3px solid var(--spell-glow); outline-offset: 3px; }
  .feature-text { display: grid; gap: 6px; justify-items: start; min-width: 0; }
  .kicker.light { color: rgb(255 255 255 / 0.78); }
  .feature-title { font-size: 2.3rem; font-weight: 750; line-height: 1.05; letter-spacing: -0.03em; }
  .feature-desc { max-width: 44ch; color: rgb(255 255 255 / 0.88); }
  .feature-status { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 8px; margin-top: 4px; min-height: 1.6em; font-size: 0.9rem; }
  .chip { padding: 2px 9px; border-radius: 999px; background: rgb(255 255 255 / 0.16); font-variant-numeric: tabular-nums; }
  .feature-go {
    display: inline-flex; align-items: center; gap: 8px; margin-top: 10px; padding: 11px 18px;
    border-radius: var(--radius-sm); background: #fff; color: var(--spell); font-weight: 700;
  }
  .board { display: grid; grid-template-columns: repeat(5, var(--tile)); gap: 4px; flex: none; }
  .board i {
    display: grid; place-items: center; width: var(--tile); height: var(--tile); border-radius: 5px;
    font-style: normal; font-weight: 750; font-size: calc(var(--tile) * 0.5); color: #fff;
    background: rgb(255 255 255 / 0.1); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.22);
  }
  .board i.filled { background: rgb(255 255 255 / 0.24); box-shadow: none; }
  .board i.hit { background: var(--cam-match); }
  .board i.near { background: #e0a800; }
  .board i.miss { background: rgb(11 16 32 / 0.45); }
  /* Before the first guess the empty rows fade away, so the name row reads as the game's sign. */
  .board.fresh i:nth-child(n + 16) { opacity: 0.55; }

  .section-title { font-size: 1.05rem; margin: 0 0 10px; }
  .weak { margin-top: 16px; padding: 12px 16px; }
  .weak p { margin: 0; }
  /* Three cards need the full width; on a narrower screen the third sits under the first two. */
  @media (max-width: 940px) {
    .modes { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  }
  @media (max-width: 760px) {
    .modes { grid-template-columns: 1fr; }
    .art { height: 104px; }
    .feature { --tile: 26px; padding: 20px; gap: 16px; }
    .feature-title { font-size: 1.9rem; }
  }
  @media (max-width: 480px) {
    .feature { --tile: 19px; padding: 18px 16px; gap: 12px; align-items: start; }
    .board { gap: 3px; margin-top: 4px; }
    .feature-title { font-size: 1.7rem; }
    .feature-desc { font-size: 0.92rem; }
  }
</style>
