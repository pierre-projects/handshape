<script lang="ts">
  import { onMount } from 'svelte';
  import { clearReturn, parseRoute, routes, type Route } from './lib/routes';
  import Home from './views/Home.svelte';
  import Review from './views/Review.svelte';
  import Learn from './views/Learn.svelte';
  import Fingerspell from './views/Fingerspell.svelte';
  import ReadDrill from './views/ReadDrill.svelte';
  import SpellDrill from './views/SpellDrill.svelte';
  import SignFive from './views/SignFive.svelte';
  import Progress from './views/Progress.svelte';
  import Practice from './views/Practice.svelte';
  import Icon from './components/Icon.svelte';

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
      // A "Back to …" link only makes sense while you're still on the dashboard.
      if (route.name !== 'dashboard') clearReturn();
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  // The same five places on every screen size. Camera practice belongs with Signs.
  const links = [
    { label: 'Today', href: routes.home, icon: 'home', pages: [''] },
    { label: 'Review', href: routes.review, icon: 'review', pages: ['review'] },
    { label: 'Signs', href: routes.signs, icon: 'signs', pages: ['signs', 'camera'] },
    { label: 'Spelling', href: routes.fingerspelling, icon: 'spell', pages: ['fingerspelling'] },
    { label: 'Dashboard', href: routes.dashboard, icon: 'progress', pages: ['dashboard'] },
  ] as const;
  const current = (pages: readonly string[]) => ((pages as readonly string[]).includes(route.name) ? 'page' : undefined);
</script>

<a class="skip" href="#main">Skip to content</a>

<header>
  <div class="wrap bar">
    <a class="brand" href={routes.home} aria-label="ASL Practice, home">
      <span class="logo"><Icon name="signs" size={20} /></span>
      <span>ASL <b>Practice</b></span>
    </a>
    <nav class="top" aria-label="Main">
      {#each links as link}
        <a href={link.href} aria-current={current(link.pages)}>
          <Icon name={link.icon} size={18} />{link.label}
        </a>
      {/each}
    </nav>
  </div>
</header>

<main id="main" class="wrap">
  {#key route.name + (route.param ?? '') + (route.sub ?? '')}
    <div class="page">
      {#if route.name === 'review'}
        <Review more={route.param === 'more'} />
      {:else if route.name === 'signs'}
        <Learn itemId={route.param} />
      {:else if route.name === 'camera'}
        <Practice startId={route.param} />
      {:else if route.name === 'fingerspelling' && route.param === 'read'}
        <ReadDrill />
      {:else if route.name === 'fingerspelling' && route.param === 'spell'}
        <SpellDrill />
      {:else if route.name === 'fingerspelling' && route.param === 'sign-five'}
        <SignFive />
      {:else if route.name === 'fingerspelling'}
        <Fingerspell />
      {:else if route.name === 'dashboard'}
        <Progress section={route.param} listId={route.sub} />
      {:else}
        <Home />
      {/if}
    </div>
  {/key}
</main>

<footer class="wrap small muted">
  Camera video and your progress stay on this device. Nothing is uploaded.
</footer>

<nav class="tabbar" aria-label="Main">
  {#each links as link}
    <a href={link.href} aria-current={current(link.pages)}>
      <Icon name={link.icon} />
      <span>{link.label}</span>
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
  .logo {
    display: grid;
    place-items: center;
    width: 30px;
    height: 30px;
    border-radius: 7px;
    background: var(--accent);
    color: var(--accent-ink);
  }
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
  .top a[aria-current='page'] { color: var(--ink); background: var(--surface-2); }

  .page { animation: enter 0.15s ease-out; }
  @keyframes enter { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .page { animation: none; } }

  footer { padding: 24px 16px 40px; text-align: center; }

  .tabbar { display: none; }

  @media (max-width: 820px) {
    .top { display: none; }
    header { margin-bottom: 16px; }
    .bar { min-height: 56px; }
    footer { padding-bottom: calc(var(--nav-h) + 32px + env(safe-area-inset-bottom)); }
    .tabbar {
      display: grid;
      grid-template-columns: repeat(5, 1fr);
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
