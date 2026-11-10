<script lang="ts">
  import type { ResolvedItem } from '../lib/types';
  import { POSES } from '../lib/illustrations';
  import HandSign from './HandSign.svelte';
  import Icon from './Icon.svelte';

  let {
    item,
    mirror = $bindable(false),
    controls = true,
  }: { item: ResolvedItem; mirror?: boolean; controls?: boolean } = $props();

  const file = $derived(item.files[0]);
  const embed = $derived(file ? undefined : item.embeds[0]);
  const pose = $derived(POSES[item.id]);
  let speed = $state(1);
  let video = $state<HTMLVideoElement>();

  $effect(() => {
    if (video) video.playbackRate = speed;
  });

  function embedUrl(e: NonNullable<typeof embed>): string {
    const id = e.embed.replace(/^youtube:/, '');
    const p = new URLSearchParams({ rel: '0', modestbranding: '1', playsinline: '1' });
    if (e.start) p.set('start', String(Math.floor(e.start)));
    if (e.end) p.set('end', String(Math.ceil(e.end)));
    return `https://www.youtube-nocookie.com/embed/${id}?${p}`;
  }
</script>

<figure class="media">
  {#if file}
    <div class="frame" class:still={file.type !== 'video'} class:mirror>
      {#if file.type === 'video'}
        <video bind:this={video} src={file.url} autoplay loop muted playsinline aria-label="Sign for {item.gloss}"></video>
      {:else}
        <img src={file.url} alt="Handshape for {item.gloss}" />
      {/if}
    </div>
    {#if controls}
      <div class="row tools">
        <button class="small" onclick={() => (mirror = !mirror)} aria-pressed={mirror}><Icon name="flip" size={16} />Mirror</button>
        {#if file.type === 'video'}
          <div class="segmented">
            {#each [0.25, 0.5, 1] as s}
              <button class="small" onclick={() => (speed = s)} aria-pressed={speed === s}>{s}x</button>
            {/each}
          </div>
        {/if}
      </div>
    {/if}
    <figcaption class="small muted">{file.credit} · {file.license}</figcaption>
  {:else if embed}
    <div class="frame embed">
      <iframe src={embedUrl(embed)} title="Sign for {item.gloss}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
    </div>
    <figcaption class="small muted">{embed.credit} · needs internet</figcaption>
  {:else if pose}
    <div class="frame drawn">
      <HandSign id={item.id} size="100%" {mirror} label="Drawing of the handshape for {item.gloss}" />
    </div>
    {#if pose.note}<p class="note">{pose.note}</p>{/if}
    {#if controls}
      <div class="row tools">
        <button class="small" onclick={() => (mirror = !mirror)} aria-pressed={mirror}>
          <Icon name="flip" size={16} />{mirror ? 'Left hand' : 'Right hand'}
        </button>
      </div>
    {/if}
    <figcaption class="small muted">Simplified drawing, palm toward you. Check details against a fluent signer.</figcaption>
  {:else}
    <div class="frame empty">
      <span>No picture yet for <strong>{item.gloss}</strong>.</span>
      <span class="small">Use the description, a reference chart, or a teacher.</span>
    </div>
  {/if}
</figure>

<style>
  .media { margin: 0; }
  .frame {
    background: var(--paper);
    border-radius: var(--radius);
    overflow: hidden;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    max-height: 340px;
    margin: 0 auto;
  }
  video { width: 100%; height: 100%; object-fit: contain; display: block; }
  /* Still pictures: a fixed, bordered box; the drawing shrinks to fit inside it. */
  .still {
    aspect-ratio: auto;
    width: 100%;
    height: 300px;
    padding: 24px;
    border: 1px solid var(--line);
  }
  .still img {
    display: block;
    width: 100%;
    height: 100%;
    min-height: 0;
    object-fit: contain;
  }
  /* Phones: a shorter picture, the mirror button tucked into its corner, and the credit on one line. */
  @media (max-width: 640px) {
    .media { position: relative; }
    .still { height: 200px; padding: 14px; }
    .drawn { max-width: 240px; }
    .tools { position: absolute; top: 8px; right: 8px; margin: 0; }
    .tools button { background: color-mix(in srgb, var(--surface) 90%, transparent); }
    figcaption { margin-top: 6px; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  }
  .embed { aspect-ratio: 16 / 9; }
  iframe { width: 100%; height: 100%; border: 0; }
  .drawn {
    aspect-ratio: 1;
    max-height: none;
    padding: 6% 12% 0;
    align-items: end;
    background: var(--paper);
    border: 1px solid var(--line);
  }
  .drawn :global(svg) { width: 100%; }
  .note { text-align: center; font-weight: 600; font-size: 0.875rem; color: var(--ink-2); margin: 10px 0 0; }
  .empty {
    border: 2px dashed var(--line);
    background: transparent;
    padding: 16px;
    text-align: center;
    color: var(--ink-3);
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 4px;
    aspect-ratio: auto;
    min-height: 140px;
  }
  .tools { margin-top: 10px; justify-content: center; }
  figcaption { margin-top: 8px; text-align: center; }
  button[aria-pressed='true'] { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
  .segmented button[aria-pressed='true'] { background: var(--surface); color: var(--ink); border-color: transparent; }
</style>
