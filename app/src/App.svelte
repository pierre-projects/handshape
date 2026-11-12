<script lang="ts">
  import { onMount } from 'svelte';
  import { clearReturn, parseRoute, routes, type Route } from './lib/routes';
  import { FEEDBACK_URL } from './lib/roadmap';
  import { tabFor, tabs } from './lib/nav';
  import About from './views/About.svelte';
  import Home from './views/Home.svelte';
  import Review from './views/Review.svelte';
  import Learn from './views/Learn.svelte';
  import PracticeHub from './views/PracticeHub.svelte';
  import ReadDrill from './views/ReadDrill.svelte';
  import ReadHome from './views/ReadHome.svelte';
  import ReadSession from './views/ReadSession.svelte';
  import SpellDrill from './views/SpellDrill.svelte';
  import SignFive from './views/SignFive.svelte';
  import SignSums from './views/SignSums.svelte';
  import Progress from './views/Progress.svelte';
  import Settings from './views/Settings.svelte';
  import WordLists from './views/WordLists.svelte';
  import CameraPractice from './views/CameraPractice.svelte';
  import Icon from './components/Icon.svelte';
  import Logo from './components/Logo.svelte';

  /** Reads the address; an address from an older version is swapped for its current name. */
  function read(): Route {
    const r = parseRoute(location.hash);
    if (r.redirect) history.replaceState(null, '', r.redirect);
    return { name: r.name, param: r.param, sub: r.sub };
  }

  let route = $state<Route>(read());

  onMount(() => {
    const onHash = () => {
      route = read();
      // A "Back to …" link only makes sense while you're still in Word lists.
      if (!(route.name === 'practice' && route.param === 'lists')) clearReturn();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  // The same four places on every screen size (lib/nav.ts), and the one this page sits under.
  const here = $derived(tabFor(route));
</script>

<a class="skip" href="#main">Skip to content</a>

<header>
  <div class="wrap bar">
    <a class="brand" href={routes.home} aria-label="Handshape, home">
      <Logo size={30} />
      <span>Hand<b>shape</b></span>
    </a>
    <nav class="top" aria-label="Main">
      {#each tabs as tab}
        <a href={tab.href} aria-current={here === tab.id ? 'page' : undefined}>
          <Icon name={tab.icon} size={18} />{tab.label}
        </a>
      {/each}
    </nav>
    <!-- Settings is about the app, not a place to learn, so it is a gear here and not a tab. -->
    <a class="gear" href={routes.settings} aria-label="Settings" title="Settings" aria-current={route.name === 'settings' ? 'page' : undefined}>
      <Icon name="settings" size={20} />
    </a>
  </div>
</header>

<main id="main" class="wrap">
  {#key route.name + (route.param ?? '') + (route.sub ?? '')}
    <div class="page">
      {#if route.name === 'review'}
        <Review more={route.param === 'more'} />
      {:else if route.name === 'learn'}
        <Learn itemId={route.param} />
      {:else if route.name === 'practice' && route.param === 'camera'}
        <CameraPractice startId={route.sub} />
      {:else if route.name === 'practice' && route.param === 'read' && route.sub === 'free'}
        <ReadDrill />
      {:else if route.name === 'practice' && route.param === 'read' && route.sub}
        <ReadSession levelId={route.sub} />
      {:else if route.name === 'practice' && route.param === 'read'}
        <ReadHome />
      {:else if route.name === 'practice' && route.param === 'spell'}
        <SpellDrill />
      {:else if route.name === 'practice' && route.param === 'sign-five'}
        <SignFive />
      {:else if route.name === 'practice' && route.param === 'sums'}
        <SignSums />
      {:else if route.name === 'practice' && route.param === 'lists'}
        <WordLists listId={route.sub} />
      {:else if route.name === 'practice'}
        <PracticeHub />
      {:else if route.name === 'progress'}
        <Progress />
      {:else if route.name === 'settings'}
        <Settings />
      {:else if route.name === 'about'}
        <About />
      {:else}
        <Home />
      {/if}
    </div>
  {/key}
</main>

<footer class="wrap small muted">
  <span>Camera video and your progress stay on this device. Nothing is uploaded.</span>
  <a href={routes.about} aria-current={route.name === 'about' ? 'page' : undefined}>About Handshape</a>
  {#if FEEDBACK_URL}<a href={FEEDBACK_URL} target="_blank" rel="noopener noreferrer">Send feedback</a>{/if}
</footer>

<nav class="tabbar" aria-label="Main">
  {#each tabs as tab}
    <a href={tab.href} aria-current={here === tab.id ? 'page' : undefined}>
      <Icon name={tab.icon} />
      <span>{tab.label}</span>
    </a>
  {/each}
</nav>

<style>
  .skip { position: absolute; left: -999px; top: 8px; }
  .skip:focus { left: 8px; z-index: 50; background: var(--surface); padding: 8px 12px; border-radius: 8px; }

  header {
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    margin-bottom: 28px;
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .bar { display: flex; align-items: center; gap: 16px; min-height: 60px; }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    text-decoration: none;
    color: var(--ink);
    font-size: 0.975rem;
    font-weight: 600;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .brand b { font-weight: 600; color: var(--ink-3); }
  .top { display: flex; gap: 2px; margin-left: auto; }
  .top a {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    border-radius: 6px;
    text-decoration: none;
    color: var(--ink-3);
    font-weight: 550;
    font-size: 0.875rem;
  }
  .top a:hover { background: var(--surface-2); color: var(--ink); }
  /* The tab you are on is blue on every screen size. */
  .top a[aria-current='page'] { color: var(--accent); background: var(--accent-soft); }
  .gear {
    flex: none; display: grid; place-items: center; width: 36px; height: 36px; border-radius: 8px;
    color: var(--ink-3);
  }
  .gear:hover { background: var(--surface-2); color: var(--ink); }
  .gear[aria-current='page'] { color: var(--accent); background: var(--accent-soft); }

  .page { animation: enter 0.15s ease-out; }
  @keyframes enter { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .page { animation: none; } }

  footer { padding: 24px 16px 40px; display: flex; flex-wrap: wrap; justify-content: center; gap: 4px 14px; text-align: center; }
  footer a { color: var(--ink-2); font-weight: 600; }
  footer a:hover, footer a[aria-current='page'] { color: var(--accent); }

  .tabbar { display: none; }

  @media (max-width: 820px) {
    .top { display: none; }
    /* With the tabs gone from the top bar, the gear moves to its right-hand end, at a size for a thumb. */
    .gear { margin-left: auto; width: 44px; height: 44px; margin-right: -8px; }
    /* On a phone the tab bar does the navigating, so the title bar scrolls away and leaves the room to the page. */
    header { margin-bottom: 12px; position: static; }
    .bar { min-height: 48px; }
    footer { padding-bottom: calc(var(--nav-h) + 32px + env(safe-area-inset-bottom)); }
    .tabbar {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      position: fixed;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 20;
      background: var(--surface);
      border-top: 1px solid var(--line);
      padding-bottom: env(safe-area-inset-bottom);
    }
    .tabbar a {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      height: var(--nav-h);
      text-decoration: none;
      color: var(--ink-3);
      font-size: 0.7rem;
      font-weight: 550;
      position: relative;
    }
    .tabbar a[aria-current='page'] { color: var(--accent); }
    .tabbar a[aria-current='page']::before {
      content: '';
      position: absolute;
      top: 0;
      width: 32px;
      height: 3px;
      border-radius: 0 0 3px 3px;
      background: var(--accent);
    }
  }
</style>
