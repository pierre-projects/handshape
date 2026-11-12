<script lang="ts">
  // Word lists (#/practice/lists, #/practice/lists/<id>): the lists of words you
  // make for Read, Spell and Sign Five. They live under Practice because that is
  // where they are chosen and used.
  import { onMount } from 'svelte';
  import { routes } from '../lib/routes';
  import type { Settings } from '../lib/types';
  import { prefs, reloadSettings, updateSettings } from '../lib/settings.svelte';
  import ListsManager from '../components/ListsManager.svelte';
  import Icon from '../components/Icon.svelte';

  let { listId }: { listId?: string } = $props();
  const settings = $derived(prefs.value);

  onMount(() => {
    reloadSettings();
  });

  const save = (patch: Partial<Settings>) => updateSettings(patch);
</script>

<!-- One list has its own way back, to all the lists. -->
{#if !listId}
  <a class="back-link small" href={routes.practice}><Icon name="arrow-left" size={16} />Practice</a>
{/if}

{#if settings}
  <ListsManager {settings} {listId} onSave={save} />
{:else}
  <p class="muted">Loading…</p>
{/if}

<style>
  .back-link { margin-bottom: 10px; }
</style>
