<script lang="ts">
  // Fingerspelling word list: pick built-in words or your own, add and remove
  // your own words, and tap one to practise it now.
  import { onDestroy, tick } from 'svelte';
  import { MAX_WORD_LETTERS, sortWords } from '../lib/spelling';
  import Icon from './Icon.svelte';

  let {
    words,
    useCustom,
    builtInCount,
    activeWord,
    onSave,
    onPlay,
    playable = true,
  }: {
    /** The learner's own words. */
    words: string[];
    /** True when drills draw from the learner's words. */
    useCustom: boolean;
    builtInCount: number;
    /** The word on screen right now, if any, to highlight. */
    activeWord?: string;
    onSave: (patch: { customWords?: string[]; wordList?: 'builtin' | 'custom' }) => void;
    onPlay: (word: string) => void;
    /** False where no drill is open, so chips are labels rather than play buttons. */
    playable?: boolean;
  } = $props();

  const EXAMPLES = ['MOM', 'DAD', 'HOME', 'PIZZA', 'COFFEE'];

  let open = $state(false);
  let draft = $state('');
  let input = $state<HTMLInputElement>();
  let removed = $state<{ word: string; index: number }>();
  let confirmClear = $state(false);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const preview = $derived(sortWords(draft, words));
  const skipped = $derived(
    [
      preview.duplicates.length && `duplicate: ${preview.duplicates.join(', ')}`,
      preview.invalid.length && `no letters: ${preview.invalid.join(', ')}`,
      preview.tooLong.length && `over ${MAX_WORD_LETTERS} letters: ${preview.tooLong.join(', ')}`,
    ].filter(Boolean) as string[],
  );

  onDestroy(() => {
    clearTimeout(undoTimer);
    clearTimeout(clearTimer);
  });

  async function toggle() {
    open = !open;
    confirmClear = false;
    if (open) {
      await tick();
      input?.focus();
    }
  }

  function add(e?: Event) {
    e?.preventDefault();
    if (!preview.added.length) return;
    onSave({ customWords: [...words, ...preview.added], wordList: 'custom' });
    draft = '';
    input?.focus();
  }

  function addExamples() {
    const fresh = EXAMPLES.filter((w) => !words.includes(w));
    if (fresh.length) onSave({ customWords: [...words, ...fresh], wordList: 'custom' });
  }

  function remove(word: string) {
    const index = words.indexOf(word);
    const rest = words.filter((w) => w !== word);
    onSave({ customWords: rest, ...(rest.length ? {} : { wordList: 'builtin' as const }) });
    removed = { word, index };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (removed = undefined), 6000);
  }

  function undo() {
    if (!removed || words.includes(removed.word)) return;
    const next = [...words];
    next.splice(Math.min(removed.index, next.length), 0, removed.word);
    onSave({ customWords: next, wordList: 'custom' });
    removed = undefined;
    clearTimeout(undoTimer);
  }

  function clearAll() {
    if (!confirmClear) {
      confirmClear = true;
      clearTimeout(clearTimer);
      clearTimer = setTimeout(() => (confirmClear = false), 4000);
      return;
    }
    confirmClear = false;
    removed = undefined;
    onSave({ customWords: [], wordList: 'builtin' });
  }

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape' && open) {
      e.preventDefault();
      open = false;
    }
  }
</script>

<svelte:window onkeydown={onKey} />

<section class="card wordlist" aria-label="Word list">
  <div class="bar">
    <div class="source">
      <span class="label">Practise</span>
      <div class="segmented" role="group" aria-label="Which words to practise">
        <button aria-pressed={!useCustom} onclick={() => onSave({ wordList: 'builtin' })}>
          Built-in<span class="long">&nbsp;words</span> <span class="count">{builtInCount}</span>
        </button>
        <button
          aria-pressed={useCustom}
          onclick={() => (words.length ? onSave({ wordList: 'custom' }) : !open && toggle())}
        >
          My words <span class="count">{words.length}</span>
        </button>
      </div>
    </div>
    <button class="ghost small edit" aria-expanded={open} onclick={toggle}>
      {#if open}<Icon name="check" size={16} />Done{:else}<Icon name={words.length ? 'edit' : 'plus'} size={16} />{words.length ? 'Edit my words' : 'Add my words'}{/if}
    </button>
  </div>

  {#if open}
    <div class="editor" role="group" aria-label="Edit my words">
      <form class="add" onsubmit={add}>
        <input
          bind:this={input}
          bind:value={draft}
          type="text"
          placeholder="Type words, e.g. Sam, pizza, Boston"
          aria-label="Words to add, separated by commas or spaces"
          aria-describedby="wordlist-help"
          autocomplete="off"
          autocapitalize="characters"
          spellcheck="false"
        />
        <button class="primary" type="submit" disabled={!preview.added.length}>
          <Icon name="plus" size={16} />Add{preview.added.length > 1 ? ` ${preview.added.length}` : ''}
        </button>
      </form>
      <div id="wordlist-help" class="help small" aria-live="polite">
        {#if preview.added.length}
          <span class="will">Adds {preview.added.join(', ')}</span>
        {:else if !draft.trim()}
          <span class="muted">Separate words with commas or spaces. Letters only, up to {MAX_WORD_LETTERS}.</span>
        {/if}
        {#if skipped.length}<span class="skip">Skipping {skipped.join('; ')}</span>{/if}
      </div>

      {#if words.length}
        <div class="list-head">
          <span class="small muted">{words.length} {words.length === 1 ? 'word' : 'words'}{playable ? ' · tap one to practise it' : ''}</span>
          <button class="ghost small" class:danger={confirmClear} onclick={clearAll}>
            {confirmClear ? 'Tap again to clear all' : 'Clear all'}
          </button>
        </div>
        <ul class="chips">
          {#each words as w (w)}
            <li class="chip" class:active={w === activeWord}>
              {#if playable}
              <button class="play" onclick={() => onPlay(w)} title="Practise {w}">
                <span class="tri"><Icon name="play" size={11} /></span>{w}
              </button>
              {:else}<span class="play static">{w}</span>{/if}
              <button class="remove" onclick={() => remove(w)} aria-label="Remove {w}" title="Remove"><Icon name="x" size={14} /></button>
            </li>
          {/each}
        </ul>
      {:else}
        <div class="empty">
          <p>Add names, places or words you need to spell. They're saved on this device.</p>
          <button class="small" onclick={addExamples}>Start with {EXAMPLES.slice(0, 3).join(', ')}…</button>
        </div>
      {/if}
    </div>
  {:else if useCustom && words.length}
    <ul class="chips compact" aria-label={playable ? "My words. Tap one to practise it." : "My words"}>
      {#each words as w (w)}
        <li class="chip" class:active={w === activeWord}>
          {#if playable}
          <button class="play" onclick={() => onPlay(w)} title="Practise {w}">
            <span class="tri"><Icon name="play" size={11} /></span>{w}
          </button>
          {:else}<span class="play static">{w}</span>{/if}
        </li>
      {/each}
    </ul>
  {/if}

  {#if removed}
    <div class="toast small" role="status">
      Removed <b>{removed.word}</b>
      <button class="ghost small" onclick={undo}>Undo</button>
    </div>
  {/if}
</section>

<style>
  .wordlist { padding: 12px 16px; }
  .bar { display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; }
  .source { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
  .label { font-weight: 600; color: var(--ink-2); font-size: 0.875rem; }
  .count {
    display: inline-grid;
    place-items: center;
    min-width: 22px;
    height: 20px;
    padding: 0 6px;
    margin-left: 4px;
    border-radius: 999px;
    background: var(--surface-3);
    color: var(--ink-2);
    font-size: 0.72rem;
    font-weight: 650;
    font-variant-numeric: tabular-nums;
  }
  .segmented button[aria-pressed='true'] .count { background: var(--accent-soft); color: var(--accent); }
  .edit { color: var(--accent); }

  .editor { margin-top: 12px; padding-top: 12px; border-top: 1px solid var(--line); }
  .add { display: flex; gap: 8px; }
  .add input { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 0.04em; }
  .add input::placeholder { text-transform: none; letter-spacing: 0; }
  .help { min-height: 1.4em; margin-top: 6px; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .will { color: var(--good); font-weight: 600; }
  .skip { color: var(--warn-ink); }

  .list-head { display: flex; align-items: center; justify-content: space-between; margin-top: 10px; }
  .danger { color: var(--bad); background: var(--bad-soft); }

  .chips { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 8px; }
  .chips.compact { margin-top: 10px; }
  .chip {
    display: inline-flex;
    align-items: stretch;
    border: 1px solid var(--line-strong);
    border-radius: 999px;
    background: var(--surface);
    overflow: hidden;
    transition: border-color 0.12s, background 0.12s;
  }
  .chip:hover { border-color: var(--accent); }
  .chip button { border: 0; border-radius: 0; box-shadow: none; background: transparent; min-height: 36px; }
  .play { gap: 6px; padding: 4px 14px 4px 10px; font-weight: 650; letter-spacing: 0.05em; }
  .chip:has(.remove) .play { padding-right: 6px; }
  .static { display: inline-flex; align-items: center; min-height: 36px; padding: 4px 14px; }
  .chip:has(.static):not(:has(.remove)):hover { border-color: var(--line-strong); }
  .tri {
    display: grid;
    place-items: center;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    background: var(--surface-2);
    color: var(--ink-3);
    transition: background 0.12s, color 0.12s;
  }
  .play:hover .tri { background: var(--accent); color: var(--accent-ink); }
  .remove { padding: 4px 12px 4px 6px; color: var(--ink-3); }
  .remove:hover { color: var(--bad); background: var(--bad-soft); }
  .chip.active { background: var(--accent-soft); border-color: var(--accent); }
  .chip.active .play { color: var(--accent); }
  .chip.active .tri { background: var(--accent); color: var(--accent-ink); }

  .empty {
    margin-top: 12px;
    padding: 14px;
    border: 1px dashed var(--line-strong);
    border-radius: var(--radius-sm);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px 16px;
    flex-wrap: wrap;
    color: var(--ink-2);
  }
  .empty p { margin: 0; font-size: 0.9rem; }

  .toast {
    margin-top: 10px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 12px;
    border-radius: var(--radius-sm);
    background: var(--ink);
    color: #fff;
  }
  .toast button { color: #fff; min-height: 28px; }
  .toast button:hover { background: rgb(255 255 255 / 0.15); color: #fff; }

  @media (max-width: 560px) {
    .source { width: 100%; }
    .source .segmented { flex: 1; }
    .source .segmented button { flex: 1; }
    .label, .long { display: none; }
    .source .segmented button { white-space: nowrap; }
    .edit { margin-left: auto; }
  }
</style>
