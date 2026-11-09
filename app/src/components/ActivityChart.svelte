<script lang="ts">
  // Single-series bar chart: one accent hue, so the title names it and no legend is needed.
  let { data }: { data: { day: Date; count: number }[] } = $props();

  const max = $derived(Math.max(1, ...data.map((d) => d.count)));
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  let hover = $state<number>();
</script>

<div class="chart" role="img" aria-label="Reviews and drills per day for the last {data.length} days">
  <div class="plot">
    {#each data as d, i}
      <div
        class="col"
        role="presentation"
        onmouseenter={() => (hover = i)}
        onmouseleave={() => (hover = undefined)}
      >
        {#if hover === i}
          <div class="tip"><strong>{d.count}</strong> on {fmt(d.day)}</div>
        {/if}
        <div class="bar" class:zero={d.count === 0} style="height: {(d.count / max) * 100}%"></div>
      </div>
    {/each}
  </div>
  <div class="axis small muted">
    <span>{fmt(data[0].day)}</span>
    <span>Today</span>
  </div>
</div>

<table class="sr-only">
  <caption>Activity per day</caption>
  <thead><tr><th>Day</th><th>Count</th></tr></thead>
  <tbody>
    {#each data as d}<tr><td>{fmt(d.day)}</td><td>{d.count}</td></tr>{/each}
  </tbody>
</table>

<style>
  .plot {
    display: flex;
    align-items: flex-end;
    gap: 2px;
    height: 96px;
    border-bottom: 1px solid var(--line);
  }
  .col { flex: 1; height: 100%; display: flex; align-items: flex-end; position: relative; cursor: default; }
  .bar { width: 100%; background: var(--bar); border-radius: 4px 4px 0 0; min-height: 2px; }
  .bar.zero { background: var(--line); }
  .col:hover .bar { filter: brightness(1.15); }
  .tip {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--ink);
    color: var(--bg);
    font-size: 0.75rem;
    padding: 4px 8px;
    border-radius: 6px;
    white-space: nowrap;
    pointer-events: none;
    z-index: 2;
  }
  .col:first-child .tip { left: 0; transform: none; }
  .col:last-child .tip { left: auto; right: 0; transform: none; }
  .axis { display: flex; justify-content: space-between; margin-top: 4px; }
  .chart { padding-top: 24px; }
</style>
