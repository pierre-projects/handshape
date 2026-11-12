// Sums for "Sign the answer": small additions and subtractions whose answers
// are the numbers the app teaches, 0 to 10. The learner signs the answer, so
// they have to recall the number's handshape instead of copying a picture.

export type Op = 'plus' | 'minus';

export interface Sum {
  a: number;
  b: number;
  op: Op;
  answer: number;
}

export const MIN_ANSWER = 0;
export const MAX_ANSWER = 10;
/** How many sums make a round. */
export const ROUND_LENGTH = 10;

/** Every answer a sum can have, as the ids the content and the camera checks use. */
export const ANSWERS = Array.from({ length: MAX_ANSWER - MIN_ANSWER + 1 }, (_, i) => String(MIN_ANSWER + i));

const SYMBOL: Record<Op, string> = { plus: '+', minus: '−' };

/** "3 + 4" for the screen. */
export function sumText(s: Sum): string {
  return `${s.a} ${SYMBOL[s.op]} ${s.b}`;
}

/** "3 plus 4" for a screen reader. */
export function sumSpoken(s: Sum): string {
  return `${s.a} ${s.op} ${s.b}`;
}

/** A whole number from lo to hi, both included. */
const between = (lo: number, hi: number, rnd: () => number) => lo + Math.floor(rnd() * (hi - lo + 1));

/**
 * A sum with this answer. Neither number in it is 0 ("7 + 0" is no sum at
 * all), so 0 and 1 are always subtractions and 10 is always an addition.
 */
export function makeSum(answer: number, rnd: () => number = Math.random): Sum {
  const canAdd = answer >= 2;
  const canSubtract = answer <= MAX_ANSWER - 1;
  const add = canAdd && (!canSubtract || rnd() < 0.5);
  if (add) {
    const a = between(1, answer - 1, rnd);
    return { a, b: answer - a, op: 'plus', answer };
  }
  const a = between(answer + 1, MAX_ANSWER, rnd);
  return { a, b: a - answer, op: 'minus', answer };
}

/**
 * A round of sums. Every answer is different, so each number comes up at most
 * once and the same number is never asked twice running (the camera can't
 * tell a second 7 from a 7 that is still being held).
 */
export function makeRound(count: number = ROUND_LENGTH, rnd: () => number = Math.random): Sum[] {
  const answers = ANSWERS.map(Number);
  for (let i = answers.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [answers[i], answers[j]] = [answers[j], answers[i]];
  }
  return answers.slice(0, Math.min(count, answers.length)).map((n) => makeSum(n, rnd));
}

export interface SumResult {
  sum: Sum;
  /** Wrong answers given before the right one. */
  misses: number;
  /** The handshape was shown, or the sum was skipped. */
  helped: boolean;
  /** The right answer was signed to the camera, not tapped. */
  signed: boolean;
}

/** Right the first time, with no help. */
export const firstTry = (r: SumResult) => r.misses === 0 && !r.helped;

/** A line for the end of a round. */
export function roundMessage(results: SumResult[]): string {
  const clean = results.filter(firstTry).length;
  if (clean === results.length) return 'Every one, first try!';
  if (clean >= results.length * 0.7) return 'Nicely done.';
  if (clean >= results.length * 0.4) return 'Getting there.';
  return 'Good start. The handshapes get easier with each round.';
}
