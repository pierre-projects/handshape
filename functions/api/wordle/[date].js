// Cloudflare Pages Function: GET /api/wordle/2026-11-10.json
// Relays the day's official Wordle answer, because the NYT endpoint doesn't
// allow other sites to read it from the browser. Only the answer is passed on.
// On hosts without functions (GitHub Pages, plain static), the app falls back
// to its own daily word.

/** @param {{ params: { date: string } }} context */
export async function onRequestGet({ params }) {
  const date = String(params.date).replace(/\.json$/, '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return new Response('Date must look like 2026-11-10', { status: 400 });
  }
  const upstream = await fetch(`https://www.nytimes.com/svc/wordle/v2/${date}.json`, {
    cf: { cacheTtl: 3600, cacheEverything: true },
  });
  if (!upstream.ok) return new Response('No word for that day', { status: 502 });
  const data = await upstream.json();
  const solution = typeof data?.solution === 'string' ? data.solution.toLowerCase() : '';
  if (!/^[a-z]{5}$/.test(solution)) return new Response('Unexpected answer', { status: 502 });
  return new Response(JSON.stringify({ date, solution }), {
    headers: { 'content-type': 'application/json', 'cache-control': 'public, max-age=3600' },
  });
}
