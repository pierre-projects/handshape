<script lang="ts">
  import { routes } from '../lib/routes';
  // Fingerspelling landing (#/fingerspell): pick a drill or the word game.
  // The drills are their own pages: ReadDrill (#/fingerspell/read),
  // SpellDrill (#/fingerspell/spell) and SignFive (#/fingerspell/game).
  import { onMount } from 'svelte';
  import { getStore } from '../lib/app';
  import { spellingSummary } from '../lib/spelling';
  import { builtInWords, canRead, drillWords } from '../lib/fingerspell';
  import { loadSettings, prefs, updateSettings } from '../lib/settings.svelte';
  import type { SpellingAttempt } from '../lib/types';
  import { dailyStatus, describeDaily } from '../lib/guess';
  import ListPicker from '../components/ListPicker.svelte';
  import Icon from '../components/Icon.svelte';

  let attempts = $state<SpellingAttempt[]>([]);
  let fiveToday = $state('');
  const summary = $derived(spellingSummary(attempts));
  const chosen = $derived(drillWords(prefs.value).list);

  onMount(async () => {
    const store = await getStore();
    await loadSettings();
    attempts = await store.attempts();
    fiveToday = describeDaily(dailyStatus(await store.signFive()));
  });
</script>

<header class="hub-head">
  <h1>Fingerspelling</h1>
  <p class="muted">Two different skills: reading other people's spelling, and spelling clearly yourself.</p>
</header>

<div class="modes">
  <a class="mode-card read" href={routes.read} class:locked={!canRead} aria-disabled={!canRead}>
    <div class="art" aria-hidden="true">
      <span class="flash">C</span><span class="flash on">A</span><span class="flash">T</span>
      <span class="art-icon"><Icon name="eye" size={22} /></span>
    </div>
    <div class="mode-body">
      <span class="kicker"><Icon name="eye" size={15} />Receptive</span>
      <h2>Read</h2>
      <p>Watch a word flash by one letter at a time, then type what you saw. Speed adapts to you.</p>
      <div class="mode-meta">
        {#if summary.read.wpm}<span><b>{summary.read.wpm}</b> wpm reading</span>{/if}
        <span><b>{summary.read.count}</b> {summary.read.count === 1 ? 'word' : 'words'} read</span>
        {#if summary.read.accuracy !== undefined}<span><b>{summary.read.accuracy}%</b> right</span>{/if}
      </div>
    </div>
    <span class="go">{canRead ? 'Start reading' : 'Needs letter images'}<Icon name="arrow-right" size={18} /></span>
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
</div>

<a class="game-card" href={routes.signFive}>
  <span class="mini-board" aria-hidden="true">
    <i class="h">S</i><i class="n">I</i><i>G</i><i class="h">N</i><i class="n">5</i>
  </span>
  <span class="game-text">
    <b>Sign Five</b>
    <span class="small muted">Guess the five-letter word in six tries by fingerspelling it.{fiveToday ? ` ${fiveToday}.` : ""}</span>
  </span>
  <span class="game-go">Play<Icon name="arrow-right" size={16} /></span>
</a>

<h2 class="section-title">Words to practise</h2>
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
      Read mode shows words with these letters more often.
    </p>
  </section>
{/if}

<style>
  /* Each drill has its own colour so the two never look alike. */
  .read { --m: var(--accent); --m-soft: var(--accent-soft); }
  .spell { --m: var(--spell); --m-soft: var(--spell-soft); }

  .hub-head { margin: 4px 0 18px; }
  .hub-head h1 { margin: 0 0 4px; }
  .hub-head p { margin: 0; }
  .modes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-bottom: 28px; }
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
  .game-card {
    display: flex; align-items: center; gap: 16px; margin: -12px 0 28px; padding: 14px 18px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    color: var(--ink); text-decoration: none; box-shadow: var(--shadow); transition: border-color 0.15s, box-shadow 0.15s;
  }
  .game-card:hover { border-color: var(--spell); box-shadow: var(--shadow-lift); }
  .mini-board { display: flex; gap: 3px; flex: none; }
  .mini-board i {
    display: grid; place-items: center; width: 26px; height: 26px; border-radius: 4px; font-style: normal;
    font-weight: 750; font-size: 0.85rem; color: #fff; background: var(--miss);
  }
  .mini-board i.h { background: var(--hit); }
  .mini-board i.n { background: var(--near); }
  .game-text { display: grid; flex: 1; min-width: 0; }
  .game-go { display: inline-flex; align-items: center; gap: 4px; font-weight: 650; color: var(--spell); }
  .section-title { font-size: 1.05rem; margin: 0 0 10px; }
  .weak { margin-top: 16px; padding: 12px 16px; }
  .weak p { margin: 0; }
  @media (max-width: 760px) {
    .modes { grid-template-columns: 1fr; }
    .art { height: 104px; }
  }
  @media (max-width: 560px) { .mini-board { display: none; } }
</style>
