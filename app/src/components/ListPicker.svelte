<script lang="ts">
  import { rememberReturn, routes } from '../lib/routes';
  // Choose which word list a drill or game uses: the built-in words or one of
  // your lists. Lists are made and edited on the dashboard.
  import type { WordListDef } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    lists,
    selectedId,
    builtInCount,
    usable = (words) => words,
    unit = 'words',
    activeWord,
    onSelect,
    onPlay,
  }: {
    lists: WordListDef[];
    /** Empty for the built-in words. */
    selectedId: string;
    builtInCount: number;
    /** The words of a list this feature can use (Sign Five: five-letter ones). */
    usable?: (words: string[]) => string[];
    /** How to describe the usable words, e.g. "five-letter words". */
    unit?: string;
    activeWord?: string;
    onSelect: (id: string) => void;
    /** When given, the chosen list's words show as chips you can tap to play. */
    onPlay?: (word: string) => void;
  } = $props();

  const selected = $derived(lists.find((l) => l.id === selectedId));
  const words = $derived(selected ? usable(selected.words) : []);
</script>

<section class="card picker" aria-label="Word list">
  <div class="bar">
    <label class="label" for="list-select">Word list</label>
    <div class="select-wrap">
      <select id="list-select" value={selectedId} onchange={(e) => onSelect((e.currentTarget as HTMLSelectElement).value)}>
        <option value="">Built-in words ({builtInCount})</option>
        {#each lists as l (l.id)}
          {@const n = usable(l.words).length}
          <option value={l.id} disabled={!n}>{l.name} ({n}{n ? '' : ` ${unit}`})</option>
        {/each}
      </select>
    </div>
    <a class="btn ghost small manage" href={selected ? routes.list(selected.id) : routes.lists} onclick={() => rememberReturn()}>
      <Icon name={lists.length ? 'edit' : 'plus'} size={16} />{selected ? 'Edit list' : lists.length ? 'Manage lists' : 'Make a list'}
    </a>
  </div>
  {#if selected && onPlay && words.length}
    <ul class="chips" aria-label="{selected.name}. Tap a word to practice it.">
      {#each words as w (w)}
        <li>
          <button class="pill chip" class:active={w === activeWord} onclick={() => onPlay?.(w)} title="Practice {w}">
            <span class="tri"><Icon name="play" size={11} /></span>{w}
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>

<style>
  .picker { padding: 10px 14px; }
  .bar { display: flex; align-items: center; gap: 10px 12px; flex-wrap: wrap; }
  .label { font-weight: 600; color: var(--ink-2); font-size: 0.875rem; }
  .select-wrap { flex: 1; min-width: 180px; max-width: 360px; }
  select { width: 100%; font-weight: 600; }
  .manage { margin-left: auto; color: var(--m, var(--accent)); }
  .chips { margin-top: 10px; }
  .chip { min-height: 34px; padding: 3px 12px 3px 6px; }
  .chip:hover { border-color: var(--m, var(--accent)); }
  .tri {
    display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
    background: var(--surface-2); color: var(--ink-3);
  }
  .chip.active { background: var(--m-soft, var(--accent-soft)); border-color: var(--m, var(--accent)); color: var(--m, var(--accent)); }
  .chip.active .tri { background: var(--m, var(--accent)); color: #fff; }
  @media (max-width: 560px) {
    .label { width: 100%; }
    .select-wrap { max-width: none; }
  }
</style>
