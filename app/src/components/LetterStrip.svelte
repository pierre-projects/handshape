<script lang="ts">
  // What was spelled, laid out letter by letter: each picture with its label,
  // and a mark on the ones answered wrongly. The slow look after a fast flash.
  import SignPicture from './SignPicture.svelte';

  let {
    parts,
    mirror = false,
  }: {
    /** One entry per thing shown: its content id, its label, whether it was answered right, and an optional caption ("your pick"). */
    parts: { id: string; label: string; caption?: string; ok: boolean }[];
    mirror?: boolean;
  } = $props();
</script>

<ol class="strip" aria-label="What was spelled, letter by letter">
  {#each parts as p}
    <li class:miss={!p.ok}>
      <SignPicture id={p.id} size={64} {mirror} />
      <b>{p.label}</b>
      {#if p.caption}<span class="caption">{p.caption}</span>{:else}<span class="sr-only">{p.ok ? 'read correctly' : 'missed'}</span>{/if}
    </li>
  {/each}
</ol>

<style>
  .strip { list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
  li {
    display: grid; justify-items: center; gap: 2px; padding: 6px 6px 4px; min-width: 76px;
    background: var(--paper); border: 1px solid var(--line); border-radius: var(--radius-sm);
  }
  li b { font-size: 1.05rem; color: #18181b; }
  /* The frame stays white in both themes so the black drawing reads; the border and label carry the mark. */
  li.miss { border: 2px solid var(--bad); padding: 5px 5px 3px; }
  li.miss b { color: #b42318; }
  .caption { font-size: 0.72rem; color: #52525b; }
  @media (max-width: 560px) {
    li { min-width: 60px; }
    li :global(img), li :global(svg) { width: 48px !important; height: 48px !important; }
  }
</style>
