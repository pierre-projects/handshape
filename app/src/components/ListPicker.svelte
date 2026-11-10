<script lang="ts">
  // Compact list chooser for drills and games: built-in words or your own.
  // Lists are edited on the dashboard; this only picks one and plays a word.
  import Icon from './Icon.svelte';

  let {
    words,
    useCustom,
    builtInCount,
    activeWord,
    onUse,
    onPlay,
    editHref = '#/progress/lists',
  }: {
    words: string[];
    useCustom: boolean;
    builtInCount: number;
    activeWord?: string;
    onUse: (custom: boolean) => void;
    /** When given, your words show as chips you can tap to play. */
    onPlay?: (word: string) => void;
    editHref?: string;
  } = $props();
</script>

<section class="card picker" aria-label="Word list">
  <div class="bar">
    <span class="label">Words</span>
    <div class="segmented" role="group" aria-label="Which words to use">
      <button aria-pressed={!useCustom} onclick={() => onUse(false)}>
        Built-in <span class="count">{builtInCount}</span>
      </button>
      <button aria-pressed={useCustom} disabled={!words.length} onclick={() => onUse(true)} title={words.length ? '' : 'Add words on your dashboard first'}>
        My words <span class="count">{words.length}</span>
      </button>
    </div>
    <a class="btn ghost small edit" href={editHref}>
      <Icon name={words.length ? 'edit' : 'plus'} size={16} />{words.length ? 'Edit my list' : 'Make my list'}
    </a>
  </div>
  {#if useCustom && words.length && onPlay}
    <ul class="chips" aria-label="My words. Tap one to practise it.">
      {#each words as w (w)}
        <li>
          <button class="chip" class:active={w === activeWord} onclick={() => onPlay?.(w)} title="Practise {w}">
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
  .edit { margin-left: auto; color: var(--m, var(--accent)); }
  .count {
    display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 6px; margin-left: 4px;
    border-radius: 999px; background: var(--surface-3); color: var(--ink-2);
    font-size: 0.72rem; font-weight: 650; font-variant-numeric: tabular-nums;
  }
  .segmented button[aria-pressed='true'] .count { background: var(--m-soft, var(--accent-soft)); color: var(--m, var(--accent)); }
  .segmented button:disabled { opacity: 0.55; cursor: not-allowed; }
  .chips { list-style: none; margin: 10px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    gap: 6px; min-height: 34px; padding: 3px 12px 3px 6px; border-radius: 999px;
    border: 1px solid var(--line-strong); background: var(--surface); font-weight: 650; letter-spacing: 0.05em;
  }
  .chip:hover { border-color: var(--m, var(--accent)); }
  .tri {
    display: grid; place-items: center; width: 20px; height: 20px; border-radius: 50%;
    background: var(--surface-2); color: var(--ink-3);
  }
  .chip.active { background: var(--m-soft, var(--accent-soft)); border-color: var(--m, var(--accent)); color: var(--m, var(--accent)); }
  .chip.active .tri { background: var(--m, var(--accent)); color: #fff; }
  @media (max-width: 560px) {
    .label { display: none; }
    .segmented { flex: 1; }
    .segmented button { flex: 1; white-space: nowrap; }
  }
</style>
