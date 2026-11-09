<script lang="ts">
  // Mirrored self-view with optional recording. Recordings live in memory only
  // and are discarded when you leave the page.
  import { onDestroy } from 'svelte';

  let { autostart = false }: { autostart?: boolean } = $props();

  let stream = $state<MediaStream>();
  let video = $state<HTMLVideoElement>();
  let error = $state('');
  let recorder: MediaRecorder | undefined;
  let chunks: Blob[] = [];
  let recording = $state(false);
  let playback = $state<string>();

  const supported = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  async function start() {
    error = '';
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
    } catch (e) {
      error = e instanceof DOMException && e.name === 'NotAllowedError'
        ? 'Camera permission was denied. You can allow it in your browser settings.'
        : 'Could not start the camera.';
    }
  }

  function stop() {
    if (recording) recorder?.stop();
    stream?.getTracks().forEach((t) => t.stop());
    stream = undefined;
  }

  function toggleRecord() {
    if (!stream) return;
    if (recording) {
      recorder?.stop();
      return;
    }
    if (playback) URL.revokeObjectURL(playback);
    playback = undefined;
    chunks = [];
    recorder = new MediaRecorder(stream);
    recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    recorder.onstop = () => {
      recording = false;
      playback = URL.createObjectURL(new Blob(chunks, { type: recorder?.mimeType || 'video/webm' }));
    };
    recorder.start();
    recording = true;
  }

  $effect(() => {
    if (video && stream) video.srcObject = stream;
  });

  $effect(() => {
    if (autostart && supported) start();
  });

  onDestroy(() => {
    stop();
    if (playback) URL.revokeObjectURL(playback);
  });
</script>

{#if !supported}
  <p class="small muted">Camera is not available here. It needs a secure (https) page and a browser that supports it.</p>
{:else if !stream}
  <div class="row">
    <button onclick={start}>Turn on camera</button>
    <span class="small muted">See yourself mirrored while you sign.</span>
  </div>
  {#if error}<p class="small" role="alert">{error}</p>{/if}
{:else}
  <div class="cams" class:two={!!playback}>
    <div>
      <!-- svelte-ignore a11y_media_has_caption -->
      <video bind:this={video} autoplay muted playsinline class="mirror"></video>
      {#if recording}<span class="rec">Recording</span>{/if}
    </div>
    {#if playback}
      <div>
        <!-- svelte-ignore a11y_media_has_caption -->
        <video src={playback} controls loop autoplay playsinline class="mirror"></video>
        <span class="small muted">Your take</span>
      </div>
    {/if}
  </div>
  <div class="row tools">
    {#if typeof MediaRecorder !== 'undefined'}
      <button class="small" onclick={toggleRecord}>{recording ? 'Stop' : playback ? 'Record again' : 'Record'}</button>
    {/if}
    <button class="small" onclick={stop}>Camera off</button>
  </div>
{/if}

<style>
  .cams { display: grid; gap: 8px; }
  .cams.two { grid-template-columns: 1fr 1fr; }
  .cams > div { position: relative; }
  video { width: 100%; border-radius: 10px; background: #000; display: block; max-height: 300px; object-fit: cover; }
  .rec {
    position: absolute; top: 8px; left: 8px;
    background: #b23a2e; color: #fff;
    font-size: 0.75rem; font-weight: 700;
    padding: 2px 8px; border-radius: 999px;
  }
  .tools { margin-top: 8px; }
  @media (max-width: 480px) { .cams.two { grid-template-columns: 1fr; } }
</style>
