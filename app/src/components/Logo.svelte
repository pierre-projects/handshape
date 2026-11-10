<script lang="ts">
  // The Handshape logo: the ASL "I love you" handshape on the app's blue.
  // The same drawing as app/public/icon.svg (the browser tab and home-screen
  // icon); change both together.
  let { size = 30 }: { size?: number } = $props();
</script>

<svg width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
  <rect width="512" height="512" rx="116" fill="var(--accent)" />
  <g fill="#fff" stroke="#fff" stroke-linecap="round" transform="translate(10 0)">
    <rect x="181" y="236" width="218" height="174" rx="64" stroke="none" />
    <path d="M204 266V122M376 270V142M262 262V226M320 262V230" stroke-width="46" />
    <path d="M214 350L116 282" stroke-width="48" />
  </g>
</svg>

<style>
  svg { display: block; flex: none; }
</style>
