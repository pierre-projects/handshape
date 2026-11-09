<script lang="ts">
  import { onMount } from 'svelte';
  import Home from './views/Home.svelte';
  import Review from './views/Review.svelte';
  import Learn from './views/Learn.svelte';
  import Fingerspell from './views/Fingerspell.svelte';
  import Progress from './views/Progress.svelte';
  import Practice from './views/Practice.svelte';

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
    { name: 'home', label: 'Today', href: '#/' },
    { name: 'review', label: 'Review', href: '#/review' },
    { name: 'learn', label: 'Signs', href: '#/learn' },
    { name: 'fingerspell', label: 'Spell', href: '#/fingerspell' },
    { name: 'practice', label: 'Camera', href: '#/practice' },
    { name: 'progress', label: 'Progress', href: '#/progress' },
  ];
</script>

<header>
  <nav class="wrap" aria-label="Main">
    <a class="brand" href="#/">ASL</a>
    <ul>
      {#each links as link}
        <li><a href={link.href} aria-current={route.name === link.name ? 'page' : undefined}>{link.label}</a></li>
      {/each}
    </ul>
  </nav>
</header>

<main class="wrap">
  {#key route.name + (route.param ?? '')}
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
  {/key}
</main>

<footer class="wrap small muted">
  Camera video and your progress stay on this device. Nothing is uploaded.
</footer>

<style>
  header {
    background: var(--surface);
    border-bottom: 1px solid var(--line);
    margin-bottom: 20px;
    position: sticky;
    top: 0;
    z-index: 10;
  }
  nav { display: flex; align-items: center; gap: 12px; min-height: 56px; }
  .brand { font-weight: 800; font-size: 1.1rem; text-decoration: none; color: var(--accent); }
  ul { display: flex; list-style: none; margin: 0; padding: 0; gap: 2px; overflow-x: auto; }
  li a {
    display: block;
    padding: 8px 10px;
    border-radius: 8px;
    text-decoration: none;
    color: var(--ink-2);
    white-space: nowrap;
    font-size: 0.95rem;
  }
  li a:hover { background: var(--surface-2); }
  li a[aria-current='page'] { color: var(--accent); background: var(--accent-soft); font-weight: 600; }
  footer { padding: 24px 16px 40px; text-align: center; }
  @media (max-width: 480px) {
    .brand { display: none; }
    ul { gap: 0; }
    li a { padding: 8px 5px; font-size: 0.8125rem; }
  }
</style>
