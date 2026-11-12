<script lang="ts">
  // How to make a letter's handshape, in a small card that floats by the key or
  // tile it belongs to. The words come from the alphabet content, so they match
  // the Learn pages.
  import { letters } from '../lib/fingerspell';
  import SignPicture from './SignPicture.svelte';

  let {
    letter,
    anchor,
    mirror = false,
    id = 'letter-tip',
  }: { letter: string; anchor: DOMRect; mirror?: boolean; id?: string } = $props();

  const item = $derived(letters.get(letter.toUpperCase()));
  /** The first two tips at most: one line is usually enough, P needs its second. */
  const tips = $derived((item?.tips ?? []).slice(0, 2));

  let card = $state<HTMLElement>();
  let pos = $state({ left: 0, top: 0, below: false });

  const GAP = 8;
  const EDGE = 8;

  /** Above the anchor, centered on it and kept on screen; below it if there's no room above. */
  $effect(() => {
    if (!card) return;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const left = Math.min(Math.max(anchor.left + anchor.width / 2 - w / 2, EDGE), window.innerWidth - w - EDGE);
    const below = anchor.top - h - GAP < EDGE;
    pos = { left, top: below ? anchor.bottom + GAP : anchor.top - h - GAP, below };
  });
</script>

{#if item}
  <div class="tip" class:below={pos.below} role="tooltip" {id} bind:this={card} style:left="{pos.left}px" style:top="{pos.top}px">
    <div class="head">
      <span class="pic"><SignPicture id={item.id} size="100%" {mirror} /></span>
      <div>
        <p class="eyebrow">How to sign</p>
        <p class="letter">{letter.toUpperCase()}</p>
      </div>
    </div>
    <p class="shape">{item.handshape}</p>
    {#if item.movement}<p class="move">{item.movement}</p>{/if}
    {#each tips as t}<p class="hint"><b>Tip:</b> {t}</p>{/each}
  </div>
{/if}

<style>
  .tip {
    position: fixed;
    z-index: 50;
    width: min(280px, calc(100vw - 16px));
    padding: 12px 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius);
    background: var(--surface);
    box-shadow: var(--shadow-lift);
    color: var(--ink);
    pointer-events: none;
    animation: rise 0.12s ease-out;
  }
  .tip.below { animation-name: drop; }
  @keyframes rise { from { opacity: 0; transform: translateY(4px); } }
  @keyframes drop { from { opacity: 0; transform: translateY(-4px); } }
  .head { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .pic {
    flex: none;
    width: 52px;
    height: 52px;
    display: grid;
    place-items: center;
    overflow: hidden;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
    mix-blend-mode: multiply;
  }
  .pic :global(img), .pic :global(svg) { width: 100% !important; height: 100% !important; object-fit: contain; }
  .eyebrow { margin: 0; font-size: 0.72rem; font-weight: 600; letter-spacing: 0.04em; text-transform: uppercase; color: var(--ink-3); }
  .letter { margin: 0; font-size: 1.5rem; font-weight: 750; line-height: 1.1; }
  p { margin: 0; }
  .shape { font-size: 0.9rem; line-height: 1.4; }
  .move, .hint { margin-top: 6px; font-size: 0.82rem; line-height: 1.4; color: var(--ink-2); }
  .hint b { color: var(--ink); font-weight: 600; }
  @media (prefers-reduced-motion: reduce) { .tip { animation: none; } }
</style>
