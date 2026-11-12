<script lang="ts">
  // About (#/about): what Handshape is and does, what's coming and how to reach
  // its maker, how the camera works, what happens to your data, and what the
  // app can't do, in plain words.
  import { content } from '../lib/content';
  import { routes } from '../lib/routes';
  import { FEEDBACK_URL, UPCOMING } from '../lib/roadmap';
  import Icon from '../components/Icon.svelte';
  import Logo from '../components/Logo.svelte';

  const letters = content.items.filter((i) => i.kind === 'letter').length;
  const numbers = content.items.filter((i) => i.kind === 'number').length;
  const reviewed = content.units.every((u) => u.review.status === 'reviewed');
</script>

<article class="about">
  <header class="head">
    <Logo size={56} />
    <div>
      <h1>About Handshape</h1>
      <p class="lead">
        Handshape is a free web app for learning to fingerspell in American Sign Language (ASL). It shows you each
        handshape, watches your hand through your camera and tells you what to fix, and brings signs back for review
        just before you would forget them.
      </p>
    </div>
  </header>

  <section class="card">
    <h2>What you can do</h2>
    <ul class="list">
      <li><b>Learn the signs.</b> The {letters} letters and the numbers 0 to {numbers - 1}, each with a picture, how to make it, and the signs it gets mixed up with.</li>
      <li><b>Review a little each day.</b> A few new signs at a time. Each one comes back after a day, then a few days, then longer, so it sticks.</li>
      <li><b>Practice on camera.</b> Make a sign to your camera and get a plain hint, such as "Straighten your index finger" or "Turn your palm to face out".</li>
      <li><b>Read fingerspelling.</b> Watch letters, words and numbers spelled out and say what you saw, in short levels that get faster.</li>
      <li><b>Spell words.</b> Fingerspell a word to the camera, letter by letter.</li>
      <li><b>Play Sign Five.</b> Guess the day's five-letter word in six tries by fingerspelling each guess.</li>
      <li><b>Sign the answer.</b> A sum appears and you sign the number, from 0 to 10.</li>
      <li><b>See your progress</b> and make your own word lists on the Dashboard.</li>
    </ul>
    <p class="start"><a class="btn primary" href={routes.home}>Go to Today<Icon name="arrow-right" size={16} /></a></p>
  </section>

  <section class="card">
    <h2>What's coming</h2>
    <p>Handshape is still being built. This is what's planned. There are no dates, and the order may change.</p>
    <ul class="coming">
      {#each UPCOMING as item}
        <li>
          <span class="stage {item.stage.toLowerCase()}">{item.stage}</span>
          <span><b>{item.title}.</b> {item.text}</span>
        </li>
      {/each}
    </ul>
    {#if FEEDBACK_URL}
      <div class="reach">
        <p>
          <b>Found a sign the camera gets wrong, or have an idea?</b> Tell me. It takes about two minutes, and it
          shapes what gets built next.
        </p>
        <p>
          <a class="btn primary" href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">Send feedback<Icon name="arrow-right" size={16} /></a>
        </p>
        <p class="small muted">Opens a Google Form in a new tab. What you write there goes to Google and to me, not through this app.</p>
      </div>
    {/if}
  </section>

  <section class="card">
    <h2>How the camera check works</h2>
    <p>
      Your browser finds 21 points on your hand in each video frame: the wrist, the knuckles and the fingertips. The
      app measures them (how bent each finger is, where your thumb sits, which way your palm faces) and compares that
      with the sign you are making. When something is off, it names the one thing to change.
    </p>
    <p>All of this happens on your own device. The video is never recorded and never sent anywhere.</p>
  </section>

  <section class="card">
    <h2>Your privacy</h2>
    <ul class="list">
      <li>No account, no ads and no tracking.</li>
      <li>Your progress is saved only in this browser, on this device. To back it up or move it, use Export in <a href={routes.settings}>Settings</a>.</li>
      <li>The one thing the app asks the internet for is the day's Sign Five word. It sends the date and gets a word back.</li>
      <li>Once it has loaded, the app works offline, and you can add it to your phone's home screen.</li>
    </ul>
  </section>

  <section class="card">
    <h2>Good to know</h2>
    <ul class="list">
      <li>
        <b>This is a start, not the whole language.</b> ASL has its own grammar, and uses movement, facial expression
        and space. Handshape teaches the manual alphabet and numbers, which are one part of it.
      </li>
      {#if !reviewed}
        <li>
          <b>The sign descriptions and drawings have not yet been reviewed by a Deaf signer.</b> Check what you learn
          here with a Deaf teacher or a fluent signer when you can.
        </li>
      {/if}
      <li>
        <b>The camera is a guide, not a judge.</b> It can't always see a thumb tucked behind the fingers, it works
        best in good light, and it is sometimes wrong. You can always grade yourself.
      </li>
      <li><b>The best way to learn ASL is from Deaf people:</b> a class, a tutor or your local Deaf community.</li>
    </ul>
  </section>

  <section class="card">
    <h2>Credits</h2>
    <ul class="list">
      <li>Letter and number pictures are in the public domain, from wpclipart.com. Each picture's source is shown under it.</li>
      <li>Hand tracking uses Google's MediaPipe, running in your browser. Review timing uses the FSRS method.</li>
      <li>
        Sign Five is inspired by Wordle and uses the day's Wordle word when it can reach it. Wordle belongs to The New
        York Times, which has nothing to do with this app.
      </li>
      <li>Handshape is open source under the MIT license.</li>
    </ul>
  </section>
</article>

<style>
  .about { max-width: 760px; margin: 0 auto; }
  .head { display: flex; align-items: flex-start; gap: 18px; margin: 4px 0 20px; }
  .head h1 { margin: 0 0 6px; }
  .lead { margin: 0; font-size: 1.05rem; color: var(--ink-2); }
  h2 { margin: 0 0 10px; }
  .card p { margin: 0 0 10px; color: var(--ink-2); }
  .card p:last-child { margin-bottom: 0; }
  .list { margin: 0; padding-left: 20px; display: grid; gap: 8px; color: var(--ink-2); }
  .list b { color: var(--ink); }
  .start { margin-top: 16px !important; }
  .coming { list-style: none; margin: 0; padding: 0; display: grid; gap: 10px; color: var(--ink-2); }
  .coming li { display: grid; grid-template-columns: 72px minmax(0, 1fr); gap: 12px; align-items: baseline; }
  .coming b { color: var(--ink); }
  .stage {
    justify-self: start; padding: 2px 9px; border-radius: 999px;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
    background: var(--surface-2); color: var(--ink-2);
  }
  .stage.next { background: var(--accent-soft); color: var(--accent); }
  .reach { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--line); }
  .reach p { margin-bottom: 10px; }
  .reach b { color: var(--ink); }
  @media (max-width: 560px) {
    .coming li { grid-template-columns: 1fr; gap: 4px; }
    .head { gap: 12px; }
    .head :global(svg) { width: 44px; height: 44px; }
    .lead { font-size: 1rem; }
  }
</style>
