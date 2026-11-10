<script lang="ts">
  import { content } from '../lib/content';
  import type { ResolvedItem } from '../lib/types';
  import SignMedia from './SignMedia.svelte';
  import SignPicture from './SignPicture.svelte';

  let { item, mirror = $bindable(false), showGloss = true }: { item: ResolvedItem; mirror?: boolean; showGloss?: boolean } =
    $props();

  const unit = $derived(content.units.find((u) => u.id === item.unitId));
  const contrasts = $derived((item.confusable_with ?? []).map((id) => content.byId.get(id)).filter((x) => x !== undefined));
</script>

<div class="detail">
  <div class="visual">
    <SignMedia {item} bind:mirror />
  </div>

  <div class="info">
    {#if showGloss}
      <div class="spread head">
        <div>
          <p class="eyebrow">{item.kind === 'letter' ? 'Letter' : item.kind === 'number' ? 'Number' : 'Sign'}</p>
          <div class="big-gloss">{item.gloss}</div>
        </div>
        {#if unit?.review.status === 'draft'}
          <span class="badge draft" title="Not yet reviewed by a Deaf signer">Draft</span>
        {/if}
      </div>
    {/if}

    <dl>
      <div class="fact">
        <dt>Handshape</dt>
        <dd>{item.handshape}</dd>
      </div>
      {#if item.palm}
        <div class="fact">
          <dt>Palm faces</dt>
          <dd>{item.palm}</dd>
        </div>
      {/if}
      {#if item.movement}
        <div class="fact">
          <dt>Movement</dt>
          <dd>{item.movement}</dd>
        </div>
      {/if}
    </dl>

    {#if item.tips?.length}
      <div class="tips">
        <p class="eyebrow">Tip</p>
        <ul>
          {#each item.tips as tip}<li>{tip}</li>{/each}
        </ul>
      </div>
    {/if}

    {#if contrasts.length}
      <div>
        <p class="eyebrow">Don't confuse with</p>
        <div class="contrasts">
          {#each contrasts as c}
            <a href="#/learn/{c.id}" class="contrast">
              <SignPicture id={c.id} size={44} {mirror} />
              <span>{c.gloss}</span>
            </a>
          {/each}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  .detail { display: grid; grid-template-columns: minmax(0, 5fr) minmax(0, 6fr); gap: 28px; align-items: start; }
  .info > * + * { margin-top: 18px; }
  .head { align-items: flex-start; }
  dl { display: grid; gap: 10px; margin: 0; }
  .fact { border-bottom: 1px solid var(--line); padding: 0 0 10px; }
  dt { font-weight: 700; color: var(--ink-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
  dd { margin: 2px 0 0; }
  .tips { background: var(--surface-2); border: 1px solid var(--line); border-radius: var(--radius-sm); padding: 12px 14px; }
  .tips ul { margin: 0; padding-left: 18px; color: var(--ink-2); }
  .contrasts { display: flex; gap: 8px; flex-wrap: wrap; }
  .contrast {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px 6px 6px;
    border: 1px solid var(--line);
    border-radius: var(--radius-sm);
    text-decoration: none;
    color: var(--ink);
    font-weight: 600;
    background: var(--paper);
  }
  .contrast:hover { border-color: var(--accent); }
  @media (max-width: 640px) {
    .detail { grid-template-columns: 1fr; gap: 18px; }
    .visual { max-width: 320px; margin: 0 auto; width: 100%; }
  }
</style>
