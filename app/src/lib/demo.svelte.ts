// The clock behind a drill's preview: the little version of the drill that
// plays itself on the start screen (see components/DrillIntro.svelte). A
// preview is a short list of steps, each shown for a while, that loops.
import { untrack } from 'svelte';

/**
 * `durations` gives how long each step shows, in ms. `rest` is the step to
 * show, and stay on, when the device asks for less motion; pick the one that
 * explains the drill best as a still picture.
 */
export function createDemoLoop(durations: () => number[], rest: () => number) {
  let step = $state(0);
  /** How many times the loop has gone round, so a preview can show a different example each time. */
  let round = $state(0);

  /** Starts the loop from its first step. Returns the way to stop it, so it can be an effect's cleanup. */
  function run(): () => void {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Nothing here should make the effect that called it run again.
    untrack(() => {
      if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) {
        step = rest();
        return;
      }
      step = 0;
      const tick = () => {
        const all = durations();
        timer = setTimeout(() => {
          if (step + 1 >= all.length) {
            step = 0;
            round++;
          } else {
            step++;
          }
          tick();
        }, all[Math.min(step, all.length - 1)]);
      };
      tick();
    });
    return () => clearTimeout(timer);
  }

  return {
    get step() {
      return step;
    },
    get round() {
      return round;
    },
    run,
  };
}
