<script lang="ts">
  // Draws a hand illustration for a letter or number from its pose.
  // Fingers are thick round-capped strokes: an outline pass under a fill pass,
  // so extended fingers merge with the palm into one silhouette.
  import { POSES, type FingerState, type HandPose, type ThumbState } from '../lib/illustrations';

  let {
    id,
    size = 160,
    mirror = false,
    label,
    animate = true,
  }: { id: string; size?: number | string; mirror?: boolean; label?: string; animate?: boolean } = $props();

  const pose = $derived<HandPose | undefined>(POSES[id]);

  const BASE = 118;
  const FINGERS = [
    { x: 71, w: 19, len: 66 },
    { x: 92, w: 20, len: 74 },
    { x: 113, w: 19, len: 68 },
    { x: 133, w: 16, len: 52 },
  ];
  const THUMB_W = 21;
  const OUT = 5;

  interface Stroke {
    d: string;
    w: number;
    angle: number;
    x: number;
    state: FingerState;
    i: number;
  }

  const EXTENDED: FingerState[] = ['up', 'hook'];

  function fingerPath(state: FingerState, i: number): string {
    const { x, len } = FINGERS[i];
    switch (state) {
      case 'up':
        return `M ${x} ${BASE + 12} L ${x} ${BASE - len}`;
      case 'hook':
        return `M ${x} ${BASE + 12} L ${x} ${BASE - len * 0.5} Q ${x} ${BASE - len * 0.74} ${x - 13} ${BASE - len * 0.56}`;
      case 'curl':
        return `M ${x} ${BASE - 4} L ${x} ${BASE + 26}`;
      case 'bent':
        return `M ${x} ${BASE - 10} L ${x} ${BASE + 14}`;
      case 'pinch':
        return i === 0
          ? `M ${x} ${BASE + 12} L ${x} ${BASE - 26} Q ${x} ${BASE - 52} ${x - 18} ${BASE - 40} Q ${x - 27} ${BASE - 32} ${x - 26} ${BASE - 18}`
          : `M ${x} ${BASE - 4} L ${x} ${BASE + 24}`;
    }
  }

  function thumbPath(t: ThumbState, p: HandPose): string {
    switch (t) {
      case 'side':
        return 'M 66 186 Q 50 162 51 114';
      case 'across':
        return 'M 64 184 Q 86 156 118 150';
      case 'acrossHigh':
        return 'M 62 186 Q 64 150 114 140';
      case 'acrossLow':
        return 'M 64 188 Q 88 170 122 166';
      case 'out':
        return 'M 68 182 Q 46 160 22 140';
      case 'up':
        return 'M 64 182 Q 52 140 56 84';
      case 'between':
        return 'M 64 186 Q 70 150 82 108';
      case 'along':
        return 'M 64 186 Q 46 150 48 100';
      case 'tuckT':
        return 'M 62 188 Q 66 160 82 148';
      case 'tuckN':
        return 'M 62 188 Q 72 162 102 148';
      case 'tuckM':
        return 'M 62 188 Q 80 166 123 148';
      case 'pinch': {
        const i = p.fingers.indexOf('pinch');
        const { x } = FINGERS[Math.max(0, i)];
        return i <= 0 ? `M 66 184 Q 34 152 45 ${BASE - 16}` : `M 64 186 Q 86 176 ${x - 2} ${BASE + 26}`;
      }
    }
  }

  const tuckX: Partial<Record<ThumbState, number>> = { tuckT: 81.5, tuckN: 102.5, tuckM: 123 };

  const parts = $derived.by(() => {
    if (!pose) return undefined;
    const extended: Stroke[] = [];
    const folded: Stroke[] = [];
    pose.fingers.forEach((s, i) => {
      const stroke = { d: fingerPath(s, i), w: FINGERS[i].w, angle: pose.spread?.[i] ?? 0, x: FINGERS[i].x, state: s, i };
      if (EXTENDED.includes(s) || (s === 'pinch' && i === 0)) extended.push(stroke);
      else folded.push(stroke);
    });
    // Crossed fingers (R): draw the index last so it sits over the middle.
    if (pose.spread && pose.spread[0] > 0) extended.reverse();
    return { extended, folded, thumb: thumbPath(pose.thumb, pose), tuck: tuckX[pose.thumb] };
  });

  /** Short curved creases across a finger: joints on straight fingers, a fold line on folded ones. */
  function creases(state: FingerState, i: number): string {
    const { x, w, len } = FINGERS[i];
    const a = w * 0.3;
    const mark = (y: number) => `M ${x - a} ${y} Q ${x} ${y + 2.5} ${x + a} ${y}`;
    if (state === 'up') return [mark(BASE - len * 0.34), mark(BASE - len * 0.66)].join(' ');
    if (state === 'curl' || (state === 'pinch' && i > 0)) return mark(BASE + 10);
    if (state === 'hook') return mark(BASE - len * 0.28);
    return '';
  }

  /** A thumbnail just behind the end of a stroke, aligned with its direction. */
  function nailAt(d: string): { cx: number; cy: number; angle: number } | undefined {
    const nums = d.match(/-?\d+(\.\d+)?/g)?.map(Number);
    if (!nums || nums.length < 4) return undefined;
    const [x, y] = nums.slice(-2);
    const [px, py] = nums.slice(-4, -2);
    const len = Math.hypot(x - px, y - py) || 1;
    const dx = (x - px) / len;
    const dy = (y - py) / len;
    return { cx: x - dx * 4, cy: y - dy * 4, angle: (Math.atan2(dy, dx) * 180) / Math.PI };
  }

  // Side views for C and O, drawn as one outlined silhouette each: the wrist rises
  // from the bottom left, fingers reach right over the top, the thumb runs below.
  // `outline` is open at the bottom so the wrist runs off the edge.
  interface Side {
    outline: string;
    details: string;
    nails: { cx: number; cy: number; angle: number }[];
  }
  const SIDE: Record<'c' | 'o', Side> = {
    c: {
      outline:
        'M 40 232 L 56 168 C 46 130 50 86 72 70 C 96 56 140 56 162 63 C 182 70 182 100 166 101 ' +
        'C 154 102 136 92 114 94 C 96 96 88 108 90 122 C 92 136 112 140 140 136 ' +
        'C 156 134 162 148 150 154 C 132 162 112 166 100 176 L 92 232',
      details:
        'M 162 74 C 148 71 128 71 112 76 M 162 84 C 148 82 130 82 114 86 ' +
        'M 94 112 Q 99 117 104 113 M 60 176 Q 78 181 96 178',
      nails: [
        { cx: 171, cy: 93, angle: 110 },
        { cx: 153, cy: 145, angle: 80 },
      ],
    },
    o: {
      outline:
        'M 46 232 L 60 168 C 48 128 54 84 80 68 C 104 54 146 60 158 86 C 168 108 160 130 146 138 ' +
        'C 140 141 134 140 132 134 C 140 118 136 96 116 92 C 98 90 88 104 90 120 ' +
        'C 92 134 110 142 128 142 C 140 142 146 150 138 158 C 124 166 110 170 102 178 L 96 232',
      details:
        'M 150 84 C 156 98 154 114 146 124 M 140 76 C 148 90 148 108 142 118 ' +
        'M 94 114 Q 99 119 104 115 M 64 178 Q 82 183 100 180',
      nails: [
        { cx: 142, cy: 132, angle: 140 },
        { cx: 137, cy: 150, angle: 60 },
      ],
    },
  };

  const motionPath: Record<string, string> = {
    j: 'M 166 58 L 166 150 Q 166 192 136 192 Q 118 192 112 176',
    z: 'M 116 26 L 176 26 L 116 74 L 176 74',
    shake: 'M 26 74 Q 56 52 86 74',
  };
</script>

{#if pose}
  <svg
    class="hand"
    class:animate
    viewBox="0 0 200 230"
    width={size}
    role="img"
    aria-label={label ?? `Drawing of the handshape for ${id.toUpperCase()}`}
  >
    <defs>
      <marker id="arrow-{id}" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" class="arrowhead" />
      </marker>
    </defs>
    <g transform={mirror ? 'translate(200 0) scale(-1 1)' : undefined}>
      <g transform={pose.rotate ? `translate(100 137) scale(0.86) rotate(${pose.rotate}) translate(-100 -137)` : undefined}>
        {#if pose.shape === 'c' || pose.shape === 'o'}
          {@const s = SIDE[pose.shape]}
          <path d="{s.outline} Z" class="skin-fill" />
          <path d={s.outline} class="silhouette" />
          <path d={s.details} class="crease" />
          {#each s.nails as n}
            <ellipse cx={n.cx} cy={n.cy} rx="6" ry="4.5" transform="rotate({n.angle} {n.cx} {n.cy})" class="nail" />
          {/each}
        {:else if parts}
          <!-- outline pass -->
          <rect x="56" y="106" width="88" height="96" rx="26" class="line" stroke-width={OUT} />
          <rect x="70" y="186" width="60" height="44" class="line" stroke-width={OUT} />
          {#each parts.extended as f}
            <path d={f.d} transform="rotate({f.angle} {f.x} {BASE + 10})" class="line" stroke-width={f.w + OUT} />
          {/each}
          <!-- fill pass -->
          <rect x="56" y="106" width="88" height="96" rx="26" class="skin-fill" />
          <rect x="70" y="186" width="60" height="44" class="skin-fill" />
          {#each parts.extended as f}
            <path d={f.d} transform="rotate({f.angle} {f.x} {BASE + 10})" class="skin" stroke-width={f.w} />
            <path d={creases(f.state, f.i)} transform="rotate({f.angle} {f.x} {BASE + 10})" class="crease" />
          {/each}
          <path d="M 84 186 Q 104 176 128 160 M 66 150 Q 90 140 118 146" class="crease faint" />
          <!-- folded fingers sit over the palm -->
          {#each parts.folded as f}
            <path d={f.d} class="line" stroke-width={f.w + OUT} />
            <path d={f.d} class="shade" stroke-width={f.w} />
            <path d={creases(f.state, f.i)} class="crease" />
          {/each}
          {#if pose.fingers.includes('bent')}
            {#each FINGERS as f}
              <ellipse cx={f.x} cy={BASE + 15} rx={f.w * 0.28} ry="3.5" class="nail" />
            {/each}
          {/if}
          <!-- thumb -->
          <path d={parts.thumb} class="line" stroke-width={THUMB_W + OUT} />
          <path d={parts.thumb} class="skin" stroke-width={THUMB_W} />
          {#if !parts.tuck}
            {@const n = nailAt(parts.thumb)}
            {#if n}<ellipse cx={n.cx} cy={n.cy} rx="6" ry="5" transform="rotate({n.angle} {n.cx} {n.cy})" class="nail" />{/if}
          {/if}
          {#if parts.tuck}
            <path d="M {parts.tuck} 140 L {parts.tuck} 126" class="line" stroke-width={12 + OUT} />
            <path d="M {parts.tuck} 140 L {parts.tuck} 126" class="skin" stroke-width={12} />
          {/if}
        {/if}
        {#if pose.motion}
          <path
            d={motionPath[pose.motion]}
            class="motion"
            marker-end="url(#arrow-{id})"
            marker-start={pose.motion === 'shake' ? `url(#arrow-${id})` : undefined}
          />
        {/if}
      </g>
    </g>
  </svg>
{/if}

<style>
  .hand { display: block; height: auto; max-width: 100%; overflow: visible; }
  path { fill: none; stroke-linecap: round; stroke-linejoin: round; }
  .line { stroke: var(--skin-line); fill: var(--skin-line); }
  path.line { fill: none; }
  .skin { stroke: var(--skin); }
  .skin-fill { fill: var(--skin); }
  .silhouette { stroke: var(--skin-line); stroke-width: 4.5; }
  .shade { stroke: var(--skin-shade); }
  .nail { fill: var(--nail); stroke: var(--skin-line); stroke-width: 2; }
  .crease { stroke: var(--skin-line); stroke-width: 2.2; opacity: 0.75; }
  .crease.faint { opacity: 0.4; }
  .motion { stroke: var(--accent); stroke-width: 5; stroke-dasharray: 9 8; }
  .arrowhead { fill: var(--accent); }
  .animate .motion { animation: march 1.2s linear infinite; }
  @keyframes march { to { stroke-dashoffset: -34; } }
  @media (prefers-reduced-motion: reduce) {
    .animate .motion { animation: none; }
  }
</style>
