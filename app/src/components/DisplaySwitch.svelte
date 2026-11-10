<script lang="ts">
  // Chooses how spelled words are shown in the reading drills: the letter
  // pictures, or the moving drawn hand. Remembered in settings.
  import { prefs, updateSettings } from '../lib/settings.svelte';

  const display = $derived(prefs.value?.readDisplay ?? 'pictures');
</script>

<div class="segmented" role="group" aria-label="How letters are shown">
  <button aria-pressed={display === 'pictures'} onclick={() => updateSettings({ readDisplay: 'pictures' })}>Pictures</button>
  <button
    aria-pressed={display === 'hand'}
    onclick={() => updateSettings({ readDisplay: 'hand' })}
    title="A drawn hand that moves from letter to letter. Experimental: its handshapes are approximate."
  >Moving hand <span class="beta">beta</span></button>
</div>

<style>
  .beta {
    margin-left: 4px; padding: 1px 5px; border-radius: 999px; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.04em; text-transform: uppercase; background: var(--warn-soft); color: var(--warn-ink);
  }
</style>
