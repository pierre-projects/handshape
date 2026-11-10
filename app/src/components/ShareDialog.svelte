<script lang="ts">
  // Share pop-up for a finished Sign Five game: a picture of the result to
  // download or share, and the same result as text to copy.
  import { drawShareCard, shareCardFile, type ShareCard } from '../lib/shareImage';
  import Icon from './Icon.svelte';

  let {
    open = $bindable(false),
    card,
    text,
    fileName,
  }: {
    open?: boolean;
    card: ShareCard;
    text: string;
    /** e.g. sign-five-2026-11-10.png */
    fileName: string;
  } = $props();

  let dialog = $state<HTMLDialogElement>();
  let imageUrl = $state('');
  let file: File | undefined;
  let note = $state('');
  let showText = $state(false);
  let noteTimer: ReturnType<typeof setTimeout> | undefined;

  const canShare = typeof navigator !== 'undefined' && !!navigator.share;

  // Draw the picture each time the pop-up opens, then show it as a modal.
  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      imageUrl = '';
      file = undefined;
      note = '';
      showText = false;
      dialog.showModal();
      drawShareCard(card).then((canvas) => {
        imageUrl = canvas.toDataURL('image/png');
        shareCardFile(canvas, fileName).then((f) => (file = f)).catch(() => {});
      });
    } else if (!open && dialog.open) {
      dialog.close();
    }
  });

  function say(text: string) {
    note = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => (note = ''), 3000);
  }

  async function copyText() {
    try {
      await navigator.clipboard.writeText(text);
      say('Copied. Paste it anywhere.');
    } catch {
      showText = true;
      say("Couldn't copy automatically. Select the text below and copy it.");
    }
  }

  async function shareNow() {
    try {
      if (file && navigator.canShare?.({ files: [file] })) await navigator.share({ files: [file], text });
      else await navigator.share({ text });
    } catch (e) {
      if (!(e instanceof DOMException && e.name === 'AbortError')) say("Couldn't open sharing. Download or copy instead.");
    }
  }

  function onBackdrop(e: MouseEvent) {
    // A click on the dimmed area outside the panel closes it.
    if (e.target === dialog) open = false;
  }
</script>

<dialog bind:this={dialog} class="share" aria-labelledby="share-title" onclose={() => (open = false)} onclick={onBackdrop}>
  <div class="panel">
    <header>
      <h2 id="share-title">Share your result</h2>
      <button class="ghost small close" onclick={() => (open = false)} aria-label="Close"><Icon name="x" size={18} /></button>
    </header>

    {#if imageUrl}
      <img class="preview" src={imageUrl} alt="Your Sign Five result: {text.split('\n')[0]}" />
    {:else}
      <div class="preview drawing" aria-hidden="true">Drawing your card…</div>
    {/if}

    <div class="actions">
      <a class="btn primary" class:disabled={!imageUrl} href={imageUrl || undefined} download={fileName}>
        <Icon name="arrow-left" size={16} />Download
      </a>
      <button onclick={copyText}><Icon name="edit" size={16} />Copy text</button>
      {#if canShare}
        <button onclick={shareNow}><Icon name="arrow-right" size={16} />Share…</button>
      {/if}
    </div>
    <p class="note small" aria-live="polite">{note}</p>

    <button class="ghost small toggle" onclick={() => (showText = !showText)} aria-expanded={showText}>
      {showText ? 'Hide text' : 'Show text'}
    </button>
    {#if showText}
      <textarea readonly rows="9" value={text} onfocus={(e) => e.currentTarget.select()} aria-label="Result as text"></textarea>
    {/if}
  </div>
</dialog>

<style>
  .share {
    width: min(440px, calc(100vw - 32px));
    max-height: calc(100dvh - 32px);
    padding: 0;
    border: 0;
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 24px 48px -12px rgb(16 24 40 / 0.3);
  }
  .share::backdrop { background: rgb(16 24 40 / 0.45); backdrop-filter: blur(2px); }
  .share[open] { animation: rise 0.18s ease-out; }
  @keyframes rise { from { transform: translateY(12px); opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .share[open] { animation: none; } }
  .panel { display: grid; gap: 12px; padding: 16px 18px 18px; }
  header { display: flex; align-items: center; justify-content: space-between; }
  header h2 { margin: 0; font-size: 1.1rem; }
  .close { min-width: 36px; padding: 6px; }
  .preview {
    width: 100%;
    aspect-ratio: 1;
    border-radius: var(--radius-sm);
    border: 1px solid var(--line);
    background: var(--spell-soft);
  }
  .drawing { display: grid; place-items: center; color: var(--ink-3); font-size: 0.9rem; }
  .actions { display: grid; grid-template-columns: repeat(auto-fit, minmax(100px, 1fr)); gap: 8px; }
  .actions > * { white-space: nowrap; }
  .disabled { pointer-events: none; opacity: 0.6; }
  .actions > * { justify-content: center; }
  .share :global(.btn.primary) { background: var(--spell); border-color: var(--spell); }
  .note { min-height: 1.2em; margin: -4px 0 0; text-align: center; color: var(--good); font-weight: 600; }
  .toggle { justify-self: center; color: var(--ink-3); }
  textarea {
    width: 100%;
    font: inherit;
    font-size: 0.95rem;
    line-height: 1.3;
    padding: 8px 10px;
    border: 1px solid var(--line-strong);
    border-radius: var(--radius-sm);
    resize: none;
  }
  /* Download points down, not left. */
  .actions .btn.primary :global(svg) { transform: rotate(-90deg); }
</style>
