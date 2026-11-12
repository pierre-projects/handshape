// "How to make this sign", shown beside a key or tile (see LetterTip.svelte).
// Sign Five's letter keys and tiles and Sign the answer's number keys share
// it: hover with a mouse, focus from the keyboard, or press and hold on a
// touch screen.

export interface Peek {
  /** The sign's id in the content: a lower-case letter or a number. */
  sign: string;
  /** Where the key or tile is on screen, so the tip can sit beside it. */
  rect: DOMRect;
}

/** How long the mouse rests on a key before the tip shows. */
const HOVER_MS = 300;
/** How long a finger holds a key before the tip shows instead of the key being pressed. */
const HOLD_MS = 450;

/**
 * One tip for a page. `onShow` is told each time a sign's tip opens, for a
 * game where looking up the answer counts as help.
 */
export function createPeek(onShow?: (sign: string) => void) {
  let current = $state<Peek>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  /** Set when a press-and-hold opened the tip, so letting go doesn't also press the key. */
  let heldOpen = false;

  function show(sign: string, el: Element) {
    clearTimeout(timer);
    current = { sign, rect: el.getBoundingClientRect() };
    onShow?.(sign);
  }

  function hide() {
    clearTimeout(timer);
    current = undefined;
  }

  return {
    get current() {
      return current;
    },
    hide,
    /** Mouse hover: a short wait, unless a tip is already open (then moving along the keys is instant). */
    hover(e: PointerEvent, sign: string) {
      if (e.pointerType !== 'mouse' || !sign) return;
      const el = e.currentTarget as Element;
      clearTimeout(timer);
      if (current) show(sign, el);
      else timer = setTimeout(() => show(sign, el), HOVER_MS);
    },
    /** Touch: start of a press that may turn into a hold. */
    hold(e: PointerEvent, sign: string) {
      if (e.pointerType === 'mouse') return;
      heldOpen = false;
      const el = e.currentTarget as Element;
      clearTimeout(timer);
      timer = setTimeout(() => {
        heldOpen = true;
        show(sign, el);
      }, HOLD_MS);
    },
    /** Touch: the finger lifted. */
    release(e: PointerEvent) {
      if (e.pointerType !== 'mouse') hide();
    },
    /** Keyboard focus, not a click. */
    focus(e: FocusEvent, sign: string) {
      const el = e.currentTarget as Element;
      if (el.matches(':focus-visible')) show(sign, el);
    },
    /** True, once, when the press that just ended was a hold that showed the tip: the key shouldn't act on it. */
    wasHold(): boolean {
      const held = heldOpen;
      heldOpen = false;
      return held;
    },
  };
}
