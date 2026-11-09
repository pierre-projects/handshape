<script lang="ts">
  import type { ResolvedItem } from '../lib/types';

  let {
    item,
    mirror = $bindable(false),
    controls = true,
  }: { item: ResolvedItem; mirror?: boolean; controls?: boolean } = $props();

  const file = $derived(item.files[0]);
  const embed = $derived(file ? undefined : item.embeds[0]);
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
    <div class="frame" class:mirror>
      {#if file.type === 'video'}
        <video bind:this={video} src={file.url} autoplay loop muted playsinline aria-label="Sign for {item.gloss}"></video>
      {:else}
        <img src={file.url} alt="Handshape for {item.gloss}" />
      {/if}
    </div>
    {#if controls}
      <div class="row tools">
        <button class="small" onclick={() => (mirror = !mirror)} aria-pressed={mirror}>Mirror</button>
        {#if file.type === 'video'}
          {#each [0.25, 0.5, 1] as s}
            <button class="small" onclick={() => (speed = s)} aria-pressed={speed === s}>{s}x</button>
          {/each}
        {/if}
      </div>
    {/if}
    <figcaption class="small muted">{file.credit} · {file.license}</figcaption>
  {:else if embed}
    <div class="frame embed">
      <iframe src={embedUrl(embed)} title="Sign for {item.gloss}" allow="encrypted-media; picture-in-picture" allowfullscreen></iframe>
    </div>
    <figcaption class="small muted">{embed.credit} · needs internet</figcaption>
  {:else}
    <div class="frame empty">
      <span>No image or video yet for <strong>{item.gloss}</strong>.</span>
      <span class="small">Use the description, a reference chart, or a teacher.</span>
    </div>
  {/if}
</figure>

<style>
  .media { margin: 0; }
  .frame {
    background: var(--surface-2);
    border-radius: 10px;
    overflow: hidden;
    display: grid;
    place-items: center;
    aspect-ratio: 4 / 3;
    max-height: 340px;
    margin: 0 auto;
  }
  img, video { width: 100%; height: 100%; object-fit: contain; display: block; }
  .embed { aspect-ratio: 16 / 9; }
  iframe { width: 100%; height: 100%; border: 0; }
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
  .tools { margin-top: 8px; justify-content: center; }
  figcaption { margin-top: 6px; text-align: center; }
  button[aria-pressed='true'] { background: var(--accent-soft); color: var(--accent); border-color: var(--accent); }
</style>
