<script lang="ts">
  type Name = 'home' | 'review' | 'signs' | 'spell' | 'camera' | 'progress' | 'arrow-left' | 'arrow-right' | 'check' | 'x' | 'flip' | 'play';
  let { name, size = 22 }: { name: Name; size?: number } = $props();

  const paths: Record<Name, string> = {
    home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    review: 'M4 4h11a2 2 0 0 1 2 2v12M8 8h11a2 2 0 0 1 2 2v9a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1zM12 14l2 2 4-4',
    signs: 'M8 13V5.5a1.5 1.5 0 0 1 3 0V12m0-1V4a1.5 1.5 0 0 1 3 0v8m0-6.5a1.5 1.5 0 0 1 3 0V13m0-4a1.5 1.5 0 0 1 3 0v6a7 7 0 0 1-7 7h-1a7 7 0 0 1-5.6-2.8L4.1 15.4a1.6 1.6 0 0 1 2.5-2L8 15',
    spell: 'M4 19l5-14h2l5 14M6.5 13h7M17 5v14m0 0l3-3m-3 3l-3-3',
    camera: 'M4 7h3l2-3h6l2 3h3a1 1 0 0 1 1 1v11a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
    progress: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
    'arrow-left': 'M15 5l-7 7 7 7',
    'arrow-right': 'M9 5l7 7-7 7',
    check: 'M5 12l5 5 9-10',
    x: 'M6 6l12 12M18 6L6 18',
    flip: 'M12 3v18M8 7L3 12l5 5M16 7l5 5-5 5',
    play: 'M7 4l13 8-13 8z',
  };
</script>

<svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2"
  stroke-linecap="round" stroke-linejoin="round">
  <path d={paths[name]} />
</svg>
