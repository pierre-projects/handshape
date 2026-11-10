<script lang="ts">
  // The frame both fingerspelling drills share: back link, title with the
  // drill's own colour and icon, a link to the other drill, the word-list
  // picker, and the card the drill itself fills.
  import type { Snippet } from 'svelte';
  import { builtInWords, drillWords } from '../lib/fingerspell';
  import { prefs, updateSettings } from '../lib/settings.svelte';
  import ListPicker from './ListPicker.svelte';
  import Icon from './Icon.svelte';

  let {
    kind,
    title,
    subtitle,
    activeWord,
    onPlay,
    children,
  }: {
    kind: 'read' | 'spell';
    title: string;
    subtitle: string;
    /** The word on screen, highlighted in the list. */
    activeWord?: string;
    onPlay?: (word: string) => void;
    children: Snippet;
  } = $props();

  const other = $derived(kind === 'read' ? { href: '#/fingerspell/spell', label: 'Spell', icon: 'camera' as const } : { href: '#/fingerspell/read', label: 'Read', icon: 'eye' as const });
  const chosen = $derived(drillWords(prefs.value).list);
</script>

<div class="drill {kind}">
  <header class="drill-head">
    <a class="back-link small" href="#/fingerspell"><Icon name="arrow-left" size={16} />Fingerspelling</a>
    <div class="title-row">
      <span class="drill-icon"><Icon name={kind === 'read' ? 'eye' : 'camera'} size={22} /></span>
      <div class="titles">
        <h1>{title}</h1>
        <p class="small muted">{subtitle}</p>
      </div>
      <a class="btn ghost small switch" href={other.href}><Icon name={other.icon} size={16} />Switch to {other.label}</a>
    </div>
  </header>

  <ListPicker
    lists={prefs.value?.lists ?? []}
    selectedId={chosen?.id ?? ''}
    builtInCount={builtInWords.length}
    {activeWord}
    onSelect={(id) => updateSettings({ spellListId: id })}
    {onPlay}
  />

  <section class="card drill-card">
    {@render children()}
  </section>
</div>

<style>
  /* Each drill has its own colour so the two never look alike. */
  .read { --m: var(--accent); --m-soft: var(--accent-soft); }
  .spell { --m: var(--spell); --m-soft: var(--spell-soft); }
  .drill-head { margin: 0 0 16px; }
  .title-row { display: flex; align-items: center; gap: 14px; margin-top: 10px; flex-wrap: wrap; }
  .drill-icon {
    flex: none; display: grid; place-items: center; width: 48px; height: 48px; border-radius: 12px;
    background: var(--m-soft); color: var(--m);
  }
  .titles { flex: 1; min-width: 200px; }
  .titles h1 { margin: 0; font-size: 1.6rem; }
  .titles p { margin: 2px 0 0; }
  .drill-card { margin-top: 14px; border-top: 3px solid var(--m); display: grid; gap: 14px; }
  .drill :global(.btn.primary), .drill :global(button.primary) { background: var(--m); border-color: var(--m); }
  @media (max-width: 760px) {
    .switch { margin-left: 62px; }
  }
</style>
