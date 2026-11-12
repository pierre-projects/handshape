<script lang="ts">
  // A drill's start screen: what to do on one side, and on the other a preview
  // of the drill playing itself, so the learner sees what they are about to do
  // instead of only reading about it. The page gives the steps and the Start
  // button as children, and the preview's moving part as `demo`.
  import type { Snippet } from 'svelte';

  let {
    label,
    caption,
    children,
    demo,
  }: {
    /** The preview's small heading, e.g. "How a sum goes". */
    label: string;
    /** One line under the preview that says what is happening in it right now. */
    caption: string;
    children: Snippet;
    demo: Snippet;
  } = $props();
</script>

<div class="intro">
  <div class="intro-text">
    {@render children()}
  </div>
  <!-- Decoration for the steps beside it, which say the same thing, so it is hidden from screen readers. -->
  <div class="demo" aria-hidden="true">
    <p class="eyebrow">{label}</p>
    {@render demo()}
    <p class="demo-cap small">{caption}</p>
  </div>
</div>

<style>
  .intro {
    display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 300px); align-items: center; gap: 32px;
    max-width: 800px; margin: 0 auto; padding: 20px 16px;
  }
  .intro-text { display: grid; gap: 16px; justify-items: start; }
  .intro-text > :global(*) { margin: 0; }
  .demo {
    display: grid; justify-items: center; align-content: center; gap: 12px; min-height: 262px; padding: 18px 16px;
    border: 1px solid var(--line); border-radius: var(--radius); background: var(--m-soft);
  }
  .demo .eyebrow { margin: 0; color: var(--m); }
  .demo-cap { margin: 0; min-height: 1.4em; font-weight: 600; color: var(--ink-2); text-align: center; }
  /* The square a handshape shows in: dashed while it waits, solid once there is something in it. */
  .demo :global(.demo-frame) {
    display: grid; place-items: center; width: 124px; height: 124px;
    border: 2px dashed color-mix(in srgb, var(--m) 40%, transparent); border-radius: var(--radius);
    color: color-mix(in srgb, var(--m) 55%, transparent);
    transition: background 0.2s, border-color 0.2s;
  }
  .demo :global(.demo-frame.filled) { border-style: solid; border-color: var(--line); background: var(--paper); }

  @media (max-width: 760px) {
    /* On a phone the preview comes first, since it says what the drill is faster than the steps do,
       and Start sits right under it so it is on screen without scrolling. The steps follow. */
    .intro { grid-template-columns: 1fr; justify-items: center; gap: 16px; padding: 12px 4px; }
    .intro-text { display: contents; }
    .intro-text > :global(*) { order: 3; text-align: center; }
    .intro-text > :global(.lead) { order: -1; }
    .demo { order: 0; width: min(100%, 300px); }
    .intro-text > :global(button) { order: 1; }
    .intro-text > :global(.steps) { order: 2; text-align: left; }
  }
</style>
