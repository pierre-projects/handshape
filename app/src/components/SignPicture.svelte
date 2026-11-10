<script lang="ts">
  // A small still picture of a sign: its image file when the content has one,
  // otherwise the drawn illustration. Videos fall back to the drawing too.
  import { content } from '../lib/content';
  import HandSign from './HandSign.svelte';

  let {
    id,
    size = 64,
    mirror = false,
    label = '',
  }: { id: string; size?: number | string; mirror?: boolean; label?: string } = $props();

  const image = $derived(content.byId.get(id)?.files.find((f) => f.type === 'image'));
  const css = $derived(typeof size === 'number' ? `${size}px` : size);
</script>

{#if image}
  <img src={image.url} alt={label} class:mirror style="width: {css}; height: {css}" loading="lazy" draggable="false" />
{:else}
  <HandSign {id} {size} {mirror} {label} animate={false} />
{/if}

<style>
  img { display: block; object-fit: contain; max-width: 100%; }
</style>
