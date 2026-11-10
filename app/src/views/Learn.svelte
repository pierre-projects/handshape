<script lang="ts">
  import { content } from '../lib/content';
  import SignDetail from '../components/SignDetail.svelte';
  import CameraMirror from '../components/CameraMirror.svelte';
  import HandCheck from '../components/HandCheck.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';
  import { isCheckable } from '../lib/engine/handshapes';
  import { hasIllustration } from '../lib/illustrations';
  import { getStore } from '../lib/app';
  import { onMount } from 'svelte';
  import type { Settings } from '../lib/types';

  let { itemId }: { itemId?: string } = $props();
  const selected = $derived(itemId ? content.byId.get(itemId) : undefined);
  let mirror = $state(false);
  let settings = $state<Settings>();
  onMount(async () => {
    settings = await (await getStore()).settings();
    mirror = settings.dominantHand === 'Left';
  });

  // Previous / next within the same unit.
  const siblings = $derived(selected ? content.items.filter((i) => i.unitId === selected.unitId) : []);
  const index = $derived(selected ? siblings.findIndex((i) => i.id === selected.id) : -1);
  const prev = $derived(index > 0 ? siblings[index - 1] : undefined);
  const next = $derived(index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined);

  function onKey(e: KeyboardEvent) {
    if (!selected || e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowLeft' && prev) location.hash = `#/learn/${prev.id}`;
    if (e.key === 'ArrowRight' && next) location.hash = `#/learn/${next.id}`;
  }
</script>

<svelte:window onkeydown={onKey} />

{#if selected}
  <div class="spread crumbs">
    <a class="btn ghost small" href="#/learn"><Icon name="arrow-left" size={16} /> All signs</a>
    <div class="row">
      {#if prev}
        <a class="btn small" href="#/learn/{prev.id}" aria-label="Previous: {prev.gloss}"><Icon name="arrow-left" size={16} />{prev.gloss}</a>
      {/if}
      {#if next}
        <a class="btn small" href="#/learn/{next.id}" aria-label="Next: {next.gloss}">{next.gloss}<Icon name="arrow-right" size={16} /></a>
      {/if}
    </div>
  </div>
  <section class="card">
    <SignDetail item={selected} bind:mirror />
  </section>
  <section class="card stack">
    <div>
      <p class="eyebrow">Practise</p>
      <h2>Try it with your camera</h2>
    </div>
    {#if isCheckable(selected.id)}
      <HandCheck target={selected.id} dominantHand={settings?.dominantHand} />
    {:else}
      <CameraMirror />
    {/if}
  </section>
{:else}
  {#if itemId}<p class="notice">No sign called “{itemId}”.</p>{/if}
  <div class="intro">
    <h1>Signs</h1>
    <p class="muted">Tap any sign to see how it's made, then try it on camera.</p>
  </div>
  {#each content.units as unit}
    <section class="card stack">
      <div class="spread">
        <div>
          <h2>{unit.title}</h2>
          <p class="muted small desc">{unit.description}</p>
        </div>
        {#if unit.review.status === 'draft'}<span class="badge draft" title="Not yet reviewed by a Deaf signer">Draft</span>{/if}
      </div>
      <ul class="grid">
        {#each unit.items as it}
          <li>
            <a href="#/learn/{it.id}" class="tile">
              {#if hasIllustration(it.id)}
                <SignPicture id={it.id} size={76} mirror={settings?.dominantHand === 'Left'} />
              {/if}
              <span class="gloss">{it.gloss}</span>
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}

<style>
  .crumbs { margin-bottom: 12px; }
  .intro { margin: 4px 0 16px; }
  .desc { margin: 4px 0 0; max-width: 60ch; }
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(92px, 1fr));
    gap: 10px;
  }
  .tile {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 2px;
    padding: 10px 8px 8px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    text-decoration: none;
    color: #18181b;
    background: var(--paper);
    transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
  }
  .tile :global(svg) { width: 100%; max-width: 72px; }
  .tile:hover { border-color: var(--line-strong); box-shadow: var(--shadow-lift); }
  .gloss { font-weight: 600; font-size: 1rem; line-height: 1; color: #3f3f46; }
  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
  }
</style>
