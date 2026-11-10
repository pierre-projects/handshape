<script lang="ts">
  import { routes } from '../lib/routes';
  import { content } from '../lib/content';
  import SignDetail from '../components/SignDetail.svelte';
  import SignPicture from '../components/SignPicture.svelte';
  import Icon from '../components/Icon.svelte';
  import { SPECS } from '../lib/engine/handshapes';
  import { hasIllustration } from '../lib/illustrations';
  import { onMount } from 'svelte';
  import { loadSettings, mirrored, prefs } from '../lib/settings.svelte';

  let { itemId }: { itemId?: string } = $props();
  const selected = $derived(itemId ? content.byId.get(itemId) : undefined);
  let mirror = $state(false);
  onMount(async () => {
    mirror = mirrored(await loadSettings());
  });

  // Same rule as the Camera page's drill: any sign with a handshape check.
  const cameraReady = $derived(!!selected && SPECS.has(selected.id));

  // Previous / next within the same unit.
  const siblings = $derived(selected ? content.items.filter((i) => i.unitId === selected.unitId) : []);
  const index = $derived(selected ? siblings.findIndex((i) => i.id === selected.id) : -1);
  const prev = $derived(index > 0 ? siblings[index - 1] : undefined);
  const next = $derived(index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : undefined);

  function onKey(e: KeyboardEvent) {
    if (!selected || e.target instanceof HTMLInputElement) return;
    if (e.key === 'ArrowLeft' && prev) location.hash = routes.sign(prev.id);
    if (e.key === 'ArrowRight' && next) location.hash = routes.sign(next.id);
  }
</script>

<svelte:window onkeydown={onKey} />

{#if selected}
  <div class="spread crumbs">
    <a class="btn ghost small" href={routes.signs}><Icon name="arrow-left" size={16} /> All signs</a>
    <div class="row">
      {#if prev}
        <a class="btn small" href={routes.sign(prev.id)} aria-label="Previous: {prev.gloss}"><Icon name="arrow-left" size={16} />{prev.gloss}</a>
      {/if}
      {#if next}
        <a class="btn small" href={routes.sign(next.id)} aria-label="Next: {next.gloss}">{next.gloss}<Icon name="arrow-right" size={16} /></a>
      {/if}
    </div>
  </div>
  <section class="card">
    <SignDetail item={selected} bind:mirror />
  </section>
  {#if cameraReady}
    <a class="btn primary lg practice" href={routes.cameraSign(selected.id)}>
      <Icon name="camera" size={18} />Practice {selected.gloss} on camera
    </a>
  {:else}
    <p class="small muted practice">The camera can't check {selected.gloss} yet. Copy the picture and description.</p>
  {/if}
{:else}
  {#if itemId}<p class="notice">No sign called “{itemId}”.</p>{/if}
  <div class="intro">
    <div>
      <h1>Signs</h1>
      <p class="muted">Tap any sign to see how it's made, then try it on camera.</p>
    </div>
    <a class="btn primary" href={routes.camera}><Icon name="camera" size={18} />Practice on camera</a>
  </div>
  {#each content.units as unit}
    <section class="card stack">
      <div class="spread">
        <div>
          <h2>{unit.title}</h2>
          <p class="muted small desc">{unit.description}</p>
        </div>
        <div class="unit-actions">
          {#if unit.review.status === 'draft'}<span class="badge draft" title="Not yet reviewed by a Deaf signer">Draft</span>{/if}
          {#if unit.items[0]}
            <a class="btn ghost small" href={routes.cameraSign(unit.items[0].id)}><Icon name="camera" size={16} />On camera</a>
          {/if}
        </div>
      </div>
      <ul class="grid">
        {#each unit.items as it}
          <li>
            <a href={routes.sign(it.id)} class="tile">
              {#if hasIllustration(it.id)}
                <SignPicture id={it.id} size={76} mirror={mirrored(prefs.value)} />
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
  .practice { display: flex; width: fit-content; margin: 0 auto; }
  p.practice { text-align: center; }
  .intro { margin: 4px 0 16px; display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
  .unit-actions { display: flex; align-items: center; gap: 8px; }
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
    color: var(--ink);
    background: var(--paper);
    transition: transform 0.12s, box-shadow 0.12s, border-color 0.12s;
  }
  .tile :global(svg) { width: 100%; max-width: 72px; }
  .tile:hover { border-color: var(--line-strong); box-shadow: var(--shadow-lift); }
  .gloss { font-weight: 600; font-size: 1rem; line-height: 1; color: var(--ink-2); }
  @media (max-width: 480px) {
    .grid { grid-template-columns: repeat(auto-fill, minmax(76px, 1fr)); gap: 8px; }
  }
</style>
