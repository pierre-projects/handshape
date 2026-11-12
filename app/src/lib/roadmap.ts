// What's coming, and how to reach the person who makes Handshape. Shown on the
// About page. Edit this file to change either: nothing else needs touching.

/**
 * The feedback form's address (a Google Form). While it is empty the app shows
 * no feedback link at all, so it can ship before the form exists.
 */
export const FEEDBACK_URL = 'https://forms.gle/RNSn9EP7f6YZJMJr6';

/** Next: being worked on now or first in line. Later: planned, not started. Ongoing: never finished. */
export type Stage = 'Next' | 'Later' | 'Ongoing';

export interface Upcoming {
  title: string;
  text: string;
  stage: Stage;
}

/**
 * Plans, not promises: no dates, and only things that are really intended.
 * Take an item out when it ships (and add it to "What you can do" on the About
 * page). The detail behind the number items is in docs/numbers-plan.md.
 */
export const UPCOMING: Upcoming[] = [
  {
    title: 'Numbers 11 to 20',
    text: 'How to sign them, with pictures and reading practice first. Camera checking comes after, since these numbers are made with small movements.',
    stage: 'Next',
  },
  {
    title: 'A review by a Deaf signer',
    text: 'Every sign description and picture checked by someone who signs every day.',
    stage: 'Next',
  },
  {
    title: 'A camera that reads natural handshapes',
    text: 'The camera is tuned sign by sign so a relaxed, everyday handshape counts, not only a textbook one.',
    stage: 'Ongoing',
  },
  {
    title: 'Numbers up to 100',
    text: 'The twenties, the tens and two-digit numbers, then bigger sums in Sign the answer.',
    stage: 'Later',
  },
  {
    title: 'Scores for Sign the answer',
    text: 'Your best round and your history, kept on your device with the rest of your progress.',
    stage: 'Later',
  },
];
