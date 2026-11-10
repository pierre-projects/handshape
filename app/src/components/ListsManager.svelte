<script lang="ts">
  // Word lists on the dashboard.
  //   #/progress/lists        all lists, and "New list"
  //   #/progress/lists/<id>   one list: rename, add and remove words, choose where it's used, delete
  import { onDestroy, tick, untrack } from 'svelte';
  import { fiveLetterWords, findList, MAX_LISTS, newListId, uniqueName } from '../lib/lists';
  import { MAX_WORD_LETTERS, sortWords } from '../lib/spelling';
  import type { Settings, WordListDef } from '../lib/types';
  import Icon from './Icon.svelte';

  let {
    settings,
    listId,
    onSave,
  }: { settings: Settings; listId?: string; onSave: (patch: Partial<Settings>) => Promise<void> } = $props();

  const list = $derived(findList(settings.lists, listId));
  const fives = $derived(list ? fiveLetterWords(list.words) : []);
  const inSpell = $derived(!!list && settings.spellListId === list.id);
  const inFive = $derived(!!list && settings.fiveListId === list.id);

  let name = $state('');
  let nameInput = $state<HTMLInputElement>();
  let draft = $state('');
  let removed = $state<{ word: string; index: number }>();
  let confirmDelete = $state(false);
  let timers: ReturnType<typeof setTimeout>[] = [];
  let renameTimer: ReturnType<typeof setTimeout> | undefined;
  onDestroy(() => {
    timers.forEach(clearTimeout);
    clearTimeout(renameTimer);
  });

  // Show the saved name, except while it's being typed (saving trims it).
  $effect(() => {
    const saved = list?.name ?? '';
    if (untrack(() => document.activeElement !== nameInput)) name = saved;
  });

  const preview = $derived(sortWords(draft, list?.words ?? []));
  const skipped = $derived(
    [
      preview.duplicates.length && `already in the list: ${preview.duplicates.join(', ')}`,
      preview.invalid.length && `no letters: ${preview.invalid.join(', ')}`,
      preview.tooLong.length && `over ${MAX_WORD_LETTERS} letters: ${preview.tooLong.join(', ')}`,
    ].filter(Boolean) as string[],
  );

  function update(id: string, change: Partial<WordListDef>) {
    return onSave({ lists: settings.lists.map((l) => (l.id === id ? { ...l, ...change } : l)) });
  }

  async function create() {
    if (settings.lists.length >= MAX_LISTS) return;
    const l: WordListDef = { id: newListId(), name: uniqueName('New list', settings.lists), words: [] };
    await onSave({ lists: [...settings.lists, l] });
    location.hash = `#/progress/lists/${l.id}`;
    await tick();
  }

  // A brand-new list opens with its name ready to type over.
  $effect(() => {
    if (list && !list.words.length && /^New list( \d+)?$/.test(list.name) && nameInput) {
      nameInput.focus();
      nameInput.select();
    }
  });

  function rename() {
    if (!list) return;
    const n = name.trim();
    if (!n) name = list.name;
    else if (n !== list.name) update(list.id, { name: n.slice(0, 40) });
    if (document.activeElement !== nameInput) name = n || list.name;
  }

  function addWords(e: Event) {
    e.preventDefault();
    if (!list || !preview.added.length) return;
    update(list.id, { words: [...list.words, ...preview.added] });
    draft = '';
  }

  function remove(word: string) {
    if (!list) return;
    const index = list.words.indexOf(word);
    update(list.id, { words: list.words.filter((w) => w !== word) });
    removed = { word, index };
    timers.push(setTimeout(() => (removed = undefined), 6000));
  }

  function undo() {
    if (!list || !removed || list.words.includes(removed.word)) return;
    const next = [...list.words];
    next.splice(Math.min(removed.index, next.length), 0, removed.word);
    update(list.id, { words: next });
    removed = undefined;
  }

  function toggleUse(which: 'spellListId' | 'fiveListId') {
    if (!list) return;
    onSave({ [which]: settings[which] === list.id ? '' : list.id });
  }

  async function remove_list() {
    if (!list) return;
    if (!confirmDelete) {
      confirmDelete = true;
      timers.push(setTimeout(() => (confirmDelete = false), 4000));
      return;
    }
    const id = list.id;
    await onSave({
      lists: settings.lists.filter((l) => l.id !== id),
      spellListId: settings.spellListId === id ? '' : settings.spellListId,
      fiveListId: settings.fiveListId === id ? '' : settings.fiveListId,
    });
    location.hash = '#/progress/lists';
  }
</script>

{#if !listId}
  <div class="index-head">
    <div>
      <h2>Word lists</h2>
      <p class="muted small">
        Lists of words you want to practise: names, places, words from a class. Pick a list in any drill or game.
      </p>
    </div>
    {#if settings.lists.length}
      <button class="primary" onclick={create} disabled={settings.lists.length >= MAX_LISTS}>
        <Icon name="plus" size={16} />New list
      </button>
    {/if}
  </div>

  {#if settings.lists.length}
    <div class="grid">
      {#each settings.lists as l (l.id)}
        {@const f = fiveLetterWords(l.words).length}
        <a class="list-card" href="#/progress/lists/{l.id}">
          <span class="lc-top">
            <b class="lc-name">{l.name}</b>
            <Icon name="arrow-right" size={16} />
          </span>
          <span class="small muted">{l.words.length} {l.words.length === 1 ? 'word' : 'words'}{f ? ` · ${f} with five letters` : ''}</span>
          <span class="lc-words">
            {#if l.words.length}
              {l.words.slice(0, 8).join(' · ')}{l.words.length > 8 ? ' …' : ''}
            {:else}
              <span class="muted">No words yet</span>
            {/if}
          </span>
          {#if settings.spellListId === l.id || settings.fiveListId === l.id}
            <span class="uses">
              {#if settings.spellListId === l.id}<span class="use read">Fingerspelling</span>{/if}
              {#if settings.fiveListId === l.id}<span class="use five">Sign Five</span>{/if}
            </span>
          {/if}
        </a>
      {/each}
      <button class="list-card new" onclick={create} disabled={settings.lists.length >= MAX_LISTS}>
        <Icon name="plus" size={22} />New list
      </button>
    </div>
  {:else}
    <section class="card empty">
      <span class="empty-ico"><Icon name="spell" size={28} /></span>
      <h3>No lists yet</h3>
      <p class="muted">Make a list of words you want to practise, then choose it in Fingerspelling or Sign Five.</p>
      <button class="primary" onclick={create}><Icon name="plus" size={16} />Make your first list</button>
    </section>
  {/if}
{:else if !list}
  <section class="card empty">
    <h3>List not found</h3>
    <p class="muted">It may have been deleted.</p>
    <a class="btn" href="#/progress/lists">All lists</a>
  </section>
{:else}
  <a class="back small" href="#/progress/lists"><Icon name="arrow-left" size={16} />All lists</a>

  <section class="card detail">
    <div class="name-row">
      <label class="sr" for="list-name">List name</label>
      <input
        id="list-name"
        class="name"
        bind:this={nameInput}
        bind:value={name}
        onblur={rename}
        oninput={() => {
          clearTimeout(renameTimer);
          renameTimer = setTimeout(() => name.trim() && rename(), 700);
        }}
        onkeydown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        maxlength="40"
        autocomplete="off"
      />
      <span class="small muted count">{list.words.length} {list.words.length === 1 ? 'word' : 'words'}</span>
    </div>

    <div class="uses-block">
      <p class="label">Use this list in</p>
      <div class="use-toggles">
        <button class="use-toggle" aria-pressed={inSpell} onclick={() => toggleUse('spellListId')} disabled={!list.words.length}>
          <span class="tick">{#if inSpell}<Icon name="check" size={14} />{/if}</span>
          <span><b>Fingerspelling</b><small>Read and Spell drills</small></span>
        </button>
        <button class="use-toggle five" aria-pressed={inFive} onclick={() => toggleUse('fiveListId')} disabled={!fives.length}>
          <span class="tick">{#if inFive}<Icon name="check" size={14} />{/if}</span>
          <span><b>Sign Five</b><small>{fives.length ? `Practice games, ${fives.length} five-letter ${fives.length === 1 ? 'word' : 'words'}` : 'Needs five-letter words'}</small></span>
        </button>
      </div>
    </div>
  </section>

  <section class="card words">
    <h3>Words</h3>
    <form class="add" onsubmit={addWords}>
      <textarea
        bind:value={draft}
        rows="3"
        placeholder="Type or paste words, one per line or separated by commas"
        aria-label="Words to add to {list.name}"
        aria-describedby="add-help"
        autocapitalize="characters"
        spellcheck="false"
      ></textarea>
      <div class="add-foot">
        <div id="add-help" class="small help" aria-live="polite">
          {#if preview.added.length}<span class="will">Adds {preview.added.join(', ')}</span>{/if}
          {#if skipped.length}<span class="skip">Skipping {skipped.join('; ')}</span>{/if}
        </div>
        <button class="primary" type="submit" disabled={!preview.added.length}>
          <Icon name="plus" size={16} />Add {preview.added.length || ''} {preview.added.length === 1 ? 'word' : 'words'}
        </button>
      </div>
    </form>

    {#if list.words.length}
      <ul class="chips">
        {#each list.words as w (w)}
          <li class="chip" class:five={w.length === 5}>
            <span class="word">{w}</span>
            <button class="x" onclick={() => remove(w)} aria-label="Remove {w}" title="Remove"><Icon name="x" size={14} /></button>
          </li>
        {/each}
      </ul>
      <p class="small muted legend"><span class="dot"></span>Five-letter words can be used in Sign Five.</p>
    {:else}
      <p class="muted small">No words yet. Add some above.</p>
    {/if}
    {#if removed}
      <div class="toast small" role="status">
        Removed <b>{removed.word}</b>
        <button class="ghost small" onclick={undo}>Undo</button>
      </div>
    {/if}
  </section>

  <div class="danger-row">
    <button class="ghost small" class:danger={confirmDelete} onclick={remove_list}>
      <Icon name="x" size={14} />{confirmDelete ? `Tap again to delete “${list.name}”` : 'Delete list'}
    </button>
  </div>
{/if}

<style>
  .index-head { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 16px; }
  .index-head h2 { margin: 0 0 2px; }
  .index-head p { margin: 0; max-width: 60ch; }

  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 12px; }
  .list-card {
    display: grid; align-content: start; gap: 4px; min-height: 120px; padding: 14px 16px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--surface);
    color: var(--ink); text-decoration: none; box-shadow: var(--shadow); text-align: left;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .list-card:hover { border-color: var(--accent); box-shadow: var(--shadow-lift); }
  .lc-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--ink-3); }
  .lc-name { color: var(--ink); font-size: 1.05rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .lc-words { font-size: 0.85rem; font-weight: 600; letter-spacing: 0.03em; color: var(--ink-2); line-height: 1.5; }
  .uses { display: flex; gap: 6px; margin-top: 4px; flex-wrap: wrap; }
  .use { font-size: 0.72rem; font-weight: 700; padding: 2px 8px; border-radius: 999px; }
  .use.read { background: var(--accent-soft); color: var(--accent); }
  .use.five { background: #f4f0ff; color: #6d28d9; }
  .list-card.new {
    display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 6px;
    border-style: dashed; box-shadow: none; color: var(--accent); font-weight: 650; background: transparent;
  }

  .empty { display: grid; justify-items: center; gap: 8px; text-align: center; padding: 36px 20px; }
  .empty h3, .empty p { margin: 0; }
  .empty-ico { display: grid; place-items: center; width: 56px; height: 56px; border-radius: 14px; background: var(--accent-soft); color: var(--accent); }

  .back { display: inline-flex; align-items: center; gap: 4px; margin-bottom: 10px; color: var(--ink-3); text-decoration: none; font-weight: 600; }
  .back:hover { color: var(--ink); }
  .detail { display: grid; gap: 16px; }
  .name-row { display: flex; align-items: center; gap: 12px; }
  .name {
    flex: 1; min-width: 0; font-size: 1.5rem; font-weight: 700; border: 1px solid transparent;
    background: transparent; padding: 4px 8px; margin-left: -8px; border-radius: var(--radius-sm);
  }
  .name:hover { border-color: var(--line); }
  .name:focus { border-color: var(--accent); background: var(--surface); }
  .count { white-space: nowrap; }
  .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  .label { margin: 0 0 8px; font-size: 0.8rem; font-weight: 700; color: var(--ink-3); text-transform: uppercase; letter-spacing: 0.05em; }
  .use-toggles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .use-toggle {
    --c: var(--accent); --soft: var(--accent-soft);
    justify-content: flex-start; gap: 10px; padding: 10px 12px; text-align: left; font-weight: 400;
    border: 1px solid var(--line-strong); border-radius: var(--radius-sm); background: var(--surface);
  }
  .use-toggle.five { --c: #6d28d9; --soft: #f4f0ff; }
  .use-toggle span:last-child { display: grid; }
  .use-toggle small { color: var(--ink-3); font-size: 0.78rem; }
  .use-toggle[aria-pressed='true'] { border-color: var(--c); background: var(--soft); }
  .use-toggle:disabled { opacity: 0.55; }
  .tick {
    flex: none; display: grid; place-items: center; width: 20px; height: 20px; border-radius: 5px;
    border: 1.5px solid var(--line-strong); background: var(--surface); color: #fff;
  }
  .use-toggle[aria-pressed='true'] .tick { background: var(--c); border-color: var(--c); }

  .words { display: grid; gap: 12px; margin-top: 16px; }
  .words h3 { margin: 0; }
  .add { display: grid; gap: 8px; }
  .add textarea { width: 100%; resize: vertical; text-transform: uppercase; letter-spacing: 0.04em; font: inherit; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: var(--radius-sm); }
  .add textarea::placeholder { text-transform: none; letter-spacing: 0; }
  .add-foot { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .help { display: flex; flex-direction: column; gap: 2px; }
  .will { color: var(--good); font-weight: 600; }
  .skip { color: var(--warn-ink); }
  .chips { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 6px; }
  .chip { display: inline-flex; align-items: center; border: 1px solid var(--line-strong); border-radius: 999px; background: var(--surface); overflow: hidden; }
  .chip.five { border-color: #c4b5fd; background: #faf7ff; }
  .word { padding: 4px 4px 4px 12px; font-weight: 650; letter-spacing: 0.05em; }
  .x { border: 0; border-radius: 0; box-shadow: none; background: transparent; min-height: 32px; padding: 4px 10px 4px 6px; color: var(--ink-3); }
  .x:hover { color: var(--bad); background: var(--bad-soft); }
  .legend { display: flex; align-items: center; gap: 6px; margin: 0; }
  .dot { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #c4b5fd; background: #faf7ff; }
  .toast { justify-self: start; display: inline-flex; align-items: center; gap: 8px; padding: 4px 4px 4px 12px; border-radius: var(--radius-sm); background: var(--ink); color: #fff; }
  .toast button { color: #fff; min-height: 28px; }

  .danger-row { margin-top: 16px; }
  .danger-row button { color: var(--bad); }
  .danger { background: var(--bad-soft); }

  @media (max-width: 560px) {
    .use-toggles { grid-template-columns: 1fr; }
    .add-foot { flex-direction: column; align-items: stretch; }
    .name { font-size: 1.25rem; }
  }
</style>
