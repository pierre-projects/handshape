<script lang="ts">
  // Editor for one of the learner's word lists, on the dashboard: add words,
  // remove them (with undo), clear all, and choose whether drills use it.
  import { onDestroy } from 'svelte';
  import { MAX_WORD_LETTERS, sortWords } from '../lib/spelling';
  import Icon from './Icon.svelte';

  let {
    id,
    title,
    description,
    icon = 'spell',
    words,
    useCustom,
    builtInCount,
    exact,
    examples,
    playHref,
    onSave,
  }: {
    id: string;
    title: string;
    description: string;
    icon?: 'spell' | 'review' | 'eye' | 'camera';
    words: string[];
    useCustom: boolean;
    builtInCount: number;
    /** Words must have exactly this many letters (Sign Five uses 5). */
    exact?: number;
    examples: string[];
    /** Where to go to practise this list. */
    playHref: string;
    onSave: (patch: { words?: string[]; useCustom?: boolean }) => void;
  } = $props();

  let draft = $state('');
  let input = $state<HTMLInputElement>();
  let removed = $state<{ word: string; index: number }>();
  let confirmClear = $state(false);
  let undoTimer: ReturnType<typeof setTimeout> | undefined;
  let clearTimer: ReturnType<typeof setTimeout> | undefined;

  const rule = $derived(exact ? `exactly ${exact} letters` : `up to ${MAX_WORD_LETTERS} letters`);
  const preview = $derived(sortWords(draft, words, exact));
  const skipped = $derived(
    [
      preview.duplicates.length && `already added: ${preview.duplicates.join(', ')}`,
      preview.invalid.length && `no letters: ${preview.invalid.join(', ')}`,
      preview.tooLong.length && `not ${rule}: ${preview.tooLong.join(', ')}`,
    ].filter(Boolean) as string[],
  );

  onDestroy(() => {
    clearTimeout(undoTimer);
    clearTimeout(clearTimer);
  });

  function add(e?: Event) {
    e?.preventDefault();
    if (!preview.added.length) return;
    onSave({ words: [...words, ...preview.added], useCustom: true });
    draft = '';
    input?.focus();
  }

  function addExamples() {
    const fresh = examples.filter((w) => !words.includes(w));
    if (fresh.length) onSave({ words: [...words, ...fresh], useCustom: true });
  }

  function remove(word: string) {
    const index = words.indexOf(word);
    const rest = words.filter((w) => w !== word);
    onSave({ words: rest, ...(rest.length ? {} : { useCustom: false }) });
    removed = { word, index };
    clearTimeout(undoTimer);
    undoTimer = setTimeout(() => (removed = undefined), 6000);
  }

  function undo() {
    if (!removed || words.includes(removed.word)) return;
    const next = [...words];
    next.splice(Math.min(removed.index, next.length), 0, removed.word);
    onSave({ words: next, useCustom: true });
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
    onSave({ words: [], useCustom: false });
  }
</script>

<section class="card list" aria-labelledby="{id}-title">
  <header class="head">
    <span class="ico"><Icon name={icon} size={20} /></span>
    <div class="titles">
      <h3 id="{id}-title">{title}</h3>
      <p class="small muted">{description}</p>
    </div>
    <a class="btn ghost small" href={playHref}>Practise<Icon name="arrow-right" size={16} /></a>
  </header>

  <div class="use">
    <span class="small muted">Practice uses</span>
    <div class="segmented" role="group" aria-label="Which words {title} uses">
      <button aria-pressed={!useCustom} onclick={() => onSave({ useCustom: false })}>
        Built-in <span class="count">{builtInCount}</span>
      </button>
      <button aria-pressed={useCustom} disabled={!words.length} onclick={() => onSave({ useCustom: true })}>
        My list <span class="count">{words.length}</span>
      </button>
    </div>
  </div>

  <form class="add" onsubmit={add}>
    <input
      bind:this={input}
      bind:value={draft}
      type="text"
      placeholder="Add words, e.g. {examples.slice(0, 3).join(', ')}"
      aria-label="Words to add to {title}, separated by commas or spaces"
      aria-describedby="{id}-help"
      autocomplete="off"
      autocapitalize="characters"
      spellcheck="false"
    />
    <button class="primary" type="submit" disabled={!preview.added.length}>
      <Icon name="plus" size={16} />Add{preview.added.length > 1 ? ` ${preview.added.length}` : ''}
    </button>
  </form>
  <div id="{id}-help" class="help small" aria-live="polite">
    {#if preview.added.length}
      <span class="will">Adds {preview.added.join(', ')}</span>
    {:else if !draft.trim()}
      <span class="muted">Separate words with commas or spaces. Letters only, {rule}.</span>
    {/if}
    {#if skipped.length}<span class="skip">Skipping {skipped.join('; ')}</span>{/if}
  </div>

  {#if words.length}
    <div class="list-head">
      <span class="small muted">{words.length} {words.length === 1 ? 'word' : 'words'}</span>
      <button class="ghost small" class:danger={confirmClear} onclick={clearAll}>
        {confirmClear ? 'Tap again to clear all' : 'Clear all'}
      </button>
    </div>
    <ul class="chips">
      {#each words as w (w)}
        <li class="chip">
          <span class="word">{w}</span>
          <button class="remove" onclick={() => remove(w)} aria-label="Remove {w}" title="Remove"><Icon name="x" size={14} /></button>
        </li>
      {/each}
    </ul>
  {:else}
    <div class="empty">
      <p>Your list is empty. It's saved on this device and included in exports.</p>
      <button class="small" onclick={addExamples}>Start with {examples.slice(0, 3).join(', ')}…</button>
    </div>
  {/if}

  {#if removed}
    <div class="toast small" role="status">
      Removed <b>{removed.word}</b>
      <button class="ghost small" onclick={undo}>Undo</button>
    </div>
  {/if}
</section>

<style>
  .list { display: grid; gap: 12px; }
  .head { display: flex; align-items: flex-start; gap: 12px; }
  .ico {
    flex: none; display: grid; place-items: center; width: 40px; height: 40px; border-radius: 10px;
    background: var(--m-soft, var(--accent-soft)); color: var(--m, var(--accent));
  }
  .titles { flex: 1; min-width: 0; }
  .titles h3 { margin: 0; font-size: 1.05rem; }
  .titles p { margin: 2px 0 0; }
  .use { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .count {
    display: inline-grid; place-items: center; min-width: 22px; height: 20px; padding: 0 6px; margin-left: 4px;
    border-radius: 999px; background: var(--surface-3); color: var(--ink-2);
    font-size: 0.72rem; font-weight: 650; font-variant-numeric: tabular-nums;
  }
  .segmented button[aria-pressed='true'] .count { background: var(--m-soft, var(--accent-soft)); color: var(--m, var(--accent)); }
  .segmented button:disabled { opacity: 0.55; cursor: not-allowed; }

  .add { display: flex; gap: 8px; }
  .add input { flex: 1; min-width: 0; text-transform: uppercase; letter-spacing: 0.04em; }
  .add input::placeholder { text-transform: none; letter-spacing: 0; }
  .list :global(button.primary) { background: var(--m, var(--accent)); border-color: var(--m, var(--accent)); }
  .help { min-height: 1.4em; margin-top: -6px; display: flex; flex-wrap: wrap; gap: 4px 12px; }
  .will { color: var(--good); font-weight: 600; }
  .skip { color: var(--warn-ink); }

  .list-head { display: flex; align-items: center; justify-content: space-between; }
  .danger { color: var(--bad); background: var(--bad-soft); }
  .chips { list-style: none; margin: -4px 0 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip {
    display: inline-flex; align-items: center; border: 1px solid var(--line-strong); border-radius: 999px;
    background: var(--surface); overflow: hidden;
  }
  .word { padding: 4px 4px 4px 12px; font-weight: 650; letter-spacing: 0.05em; }
  .remove { border: 0; border-radius: 0; box-shadow: none; background: transparent; min-height: 32px; padding: 4px 10px 4px 6px; color: var(--ink-3); }
  .remove:hover { color: var(--bad); background: var(--bad-soft); }

  .empty {
    padding: 14px; border: 1px dashed var(--line-strong); border-radius: var(--radius-sm);
    display: flex; align-items: center; justify-content: space-between; gap: 10px 16px; flex-wrap: wrap; color: var(--ink-2);
  }
  .empty p { margin: 0; font-size: 0.9rem; }

  .toast {
    justify-self: start; display: inline-flex; align-items: center; gap: 8px; padding: 4px 4px 4px 12px;
    border-radius: var(--radius-sm); background: var(--ink); color: #fff;
  }
  .toast button { color: #fff; min-height: 28px; }
  .toast button:hover { background: rgb(255 255 255 / 0.15); color: #fff; }
</style>
