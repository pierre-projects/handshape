<script lang="ts">
  import { onMount } from 'svelte';
  import Home from './views/Home.svelte';
  import Review from './views/Review.svelte';
  import Learn from './views/Learn.svelte';
  import Fingerspell from './views/Fingerspell.svelte';
  import Progress from './views/Progress.svelte';
  import Practice from './views/Practice.svelte';
  import Icon from './components/Icon.svelte';

  type Route = { name: string; param?: string };

  function parse(hash: string): Route {
    const [name, param] = hash.replace(/^#\/?/, '').split('/');
    return { name: name || 'home', param: param ? decodeURIComponent(param) : undefined };
  }

  let route = $state<Route>(parse(location.hash));

  onMount(() => {
    const onHash = () => {
      route = parse(location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  const links = [
    { name: 'home', label: 'Today', href: '#/', icon: 'home' },
    { name: 'review', label: 'Review', href: '#/review', icon: 'review' },
    { name: 'learn', label: 'Signs', href: '#/learn', icon: 'signs' },
    { name: 'fingerspell', label: 'Spell', href: '#/fingerspell', icon: 'spell' },
    { name: 'practice', label: 'Camera', href: '#/practice', icon: 'camera' },
    { name: 'progress', label: 'Progress', href: '#/progress', icon: 'progress' },
  ] as const;
</script>

<a class="skip" href="#main">Skip to content</a>

<header>
  <div class="wrap bar">
    <a class="brand" href="#/" aria-label="ASL Practice, home">
      <span class="logo"><Icon name="signs" size={20} /></span>
      <span>ASL <b>Practice</b></span>
    </a>
    <nav class="top" aria-label="Main">
      {#each links as link}
        <a href={link.href} aria-current={route.name === link.name ? 'page' : undefined}>
          <Icon name={link.icon} size={18} />{link.label}
        </a>
      {/each}
    </nav>
    <a class="progress-link" href="#/progress" aria-label="Progress" aria-current={route.name === 'progress' ? 'page' : undefined}>
      <Icon name="progress" />
    </a>
  </div>
</header>

<main id="main" class="wrap">
  {#key route.name + (route.param ?? '')}
    <div class="page">
      {#if route.name === 'review'}
        <Review />
      {:else if route.name === 'learn'}
        <Learn itemId={route.param} />
      {:else if route.name === 'fingerspell'}
        <Fingerspell />
      {:else if route.name === 'practice'}
        <Practice />
      {:else if route.name === 'progress'}
        <Progress />
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
  {#each links.filter((l) => l.name !== 'progress') as link}
    <a href={link.href} aria-current={route.name === link.name ? 'page' : undefined}>
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
  .progress-link { display: none; }

  .page { animation: enter 0.15s ease-out; }
  @keyframes enter { from { opacity: 0; } }
  @media (prefers-reduced-motion: reduce) { .page { animation: none; } }

  footer { padding: 24px 16px 40px; text-align: center; }

  .tabbar { display: none; }

  @media (max-width: 820px) {
    .top { display: none; }
    .progress-link {
      display: grid;
      place-items: center;
      margin-left: auto;
      width: 44px;
      height: 44px;
      border-radius: 8px;
      color: var(--ink-2);
    }
    .progress-link[aria-current='page'] { color: var(--accent); background: var(--accent-soft); }
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
