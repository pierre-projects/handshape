<script lang="ts">
  import { content } from '../lib/content';
  import type { ResolvedItem } from '../lib/types';
  import SignMedia from './SignMedia.svelte';

  let { item, mirror = $bindable(false), showGloss = true }: { item: ResolvedItem; mirror?: boolean; showGloss?: boolean } =
    $props();

  const unit = $derived(content.units.find((u) => u.id === item.unitId));
  const contrasts = $derived((item.confusable_with ?? []).map((id) => content.byId.get(id)).filter((x) => x !== undefined));
</script>

<div class="detail">
  {#if showGloss}
    <div class="spread">
      <div class="big-gloss">{item.gloss}</div>
      {#if unit?.review.status === 'draft'}
        <span class="badge draft" title="Not yet reviewed by a Deaf signer">Draft</span>
      {/if}
    </div>
  {/if}

  <SignMedia {item} bind:mirror />

  <dl>
    <dt>Handshape</dt>
    <dd>{item.handshape}</dd>
    {#if item.palm}
      <dt>Palm faces</dt>
      <dd>{item.palm}</dd>
    {/if}
    {#if item.movement}
      <dt>Movement</dt>
      <dd>{item.movement}</dd>
    {/if}
  </dl>

  {#if item.tips?.length}
    <ul class="tips">
      {#each item.tips as tip}<li>{tip}</li>{/each}
    </ul>
  {/if}

  {#if contrasts.length}
    <p class="small">
      Don't confuse with:
      {#each contrasts as c, i}<a href="#/learn/{c.id}">{c.gloss}</a>{i < contrasts.length - 1 ? ', ' : ''}{/each}
    </p>
  {/if}
</div>

<style>
  .detail > * + * { margin-top: 14px; }
  dl { display: grid; grid-template-columns: max-content 1fr; gap: 6px 14px; margin: 14px 0 0; }
  dt { font-weight: 600; color: var(--ink-2); font-size: 0.875rem; padding-top: 2px; }
  dd { margin: 0; }
  .tips { margin: 0; padding-left: 20px; color: var(--ink-2); }
  @media (max-width: 480px) {
    dl { grid-template-columns: 1fr; gap: 2px; }
    dd { margin-bottom: 8px; }
  }
</style>
