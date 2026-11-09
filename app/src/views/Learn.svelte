<script lang="ts">
  import { content } from '../lib/content';
  import SignDetail from '../components/SignDetail.svelte';
  import CameraMirror from '../components/CameraMirror.svelte';

  let { itemId }: { itemId?: string } = $props();
  const selected = $derived(itemId ? content.byId.get(itemId) : undefined);
  let mirror = $state(false);
</script>

{#if selected}
  <p><a href="#/learn">← All signs</a></p>
  <section class="card">
    <SignDetail item={selected} bind:mirror />
  </section>
  <section class="card stack">
    <h2>Try it</h2>
    <CameraMirror />
  </section>
{:else}
  {#if itemId}<p class="notice">No sign called “{itemId}”.</p>{/if}
  {#each content.units as unit}
    <section class="card stack">
      <div class="spread">
        <h2>{unit.title}</h2>
        {#if unit.review.status === 'draft'}<span class="badge draft">Draft</span>{/if}
      </div>
      <p class="muted small">{unit.description}</p>
      <ul class="grid">
        {#each unit.items as it}
          {@const resolved = content.byId.get(it.id)}
          <li>
            <a href="#/learn/{it.id}" class="tile" class:has-media={(resolved?.files.length ?? 0) > 0}>
              {it.gloss}
            </a>
          </li>
        {/each}
      </ul>
    </section>
  {/each}
{/if}

<style>
  .grid {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(56px, 1fr));
    gap: 8px;
  }
  .tile {
    display: grid;
    place-items: center;
    aspect-ratio: 1;
    border: 1px solid var(--line);
    border-radius: 10px;
    text-decoration: none;
    color: var(--ink);
    font-weight: 700;
    font-size: 1.3rem;
    background: var(--surface);
  }
  .tile:hover { background: var(--surface-2); }
  .tile.has-media { border-color: var(--accent); }
</style>
