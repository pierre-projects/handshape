// "Sign Five": guess a five-letter word in six tries, fingerspelling each guess.
export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

export type Mark = 'hit' | 'near' | 'miss';

const RAW = `
about above actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry apart apple apply arena argue arise array aside asset audio avoid award aware awful
bacon badge baker basic basin beach beard beast begin being belly below bench berry birth black blade blame blank blast blend bless blind block blond blood bloom board boast bonus boost booth bound brain brake brand brave bread break breed brick bride brief bring broad broke brown brush build bunch burst buyer
cabin cable camel canal candy carry catch cause chain chair chalk charm chart chase cheap check cheek cheer chess chest chick chief child chill choir chord civil claim class clean clear clerk click cliff climb clock close cloth cloud coach coast color couch cough count court cover craft crane crash cream crime crisp cross crowd crown crumb cubic curve cycle
daily dance death debut delay dense depth diary dirty disco ditch dodge doubt dough draft drain drama dream dress drift drill drink drive eager eagle early earth eight elbow elder empty enemy enjoy enter entry equal error essay event every exact exist extra
faint faith false fancy feast fence ferry fever fiber field fifth fifty fight final first flame flash fleet flesh float flock flood floor flour fluid flute focus force forge forth forty forum found frame frank fresh front frost fruit fully funny
giant given glass globe glory glove goose grace grade grain grand grant grape graph grass grave great greed green greet grief grill grind gross group grove guard guess guest guide guilt
habit happy harsh heart heavy hedge hello hence honey honor horse hotel house human humor hurry ideal image index inner input issue
knife knock label labor large laser later laugh layer learn lease least leave legal lemon level light limit linen liver lobby local logic loose lover lower loyal lucky lunch
magic major maker mango maple march match mayor medal media mercy merit metal meter might minor minus mixed model money month moral motor mount mouse mouth movie muddy music
nasty nerve never newly night ninth noble noise north noted novel nurse ocean offer often olive onion opera orbit order organ other ought outer owner
paint panel panic paper party pasta patch pause peace peach pearl pedal penny phase phone photo piano piece pilot pinch pitch pizza place plain plane plant plate point polar porch pound power press price pride prime print prior prize proof proud prove punch pupil purse
quack queen quick quiet quite quote radio raise rally ranch range rapid ratio reach react ready realm rebel refer relax reply rider ridge rifle right rigid rival river roast robin robot rocky round route royal rugby ruler rural
salad sauce scale scare scarf scene scent scope score scout screw seize sense serve seven shade shake shall shape share shark sharp sheep sheet shelf shell shift shine shirt shock shoot shore short shout sight silly since skill skirt sleep slice slide slope small smart smell smile smoke snack snake solar solid solve sorry sound south space spare spark speak speed spell spend spice spine spoon sport spray squad stack staff stage stair stake stamp stand start state steam steel steep stick still stock stone stool storm story stove strap straw strip study stuff style sugar suite sunny super sweet swift swing sword
table taste teach teeth tempo thank theme there thick thief thing think third thorn those three throw thumb tiger tight timer tired title toast today token tooth topic torch total touch tough tower toxic trace track trade trail train treat trend trial tribe trick truck truly trunk trust truth tulip tutor twice twist
uncle under union unite unity until upper upset urban usual valid value valve video virus visit vital vivid vocal voice voter wagon waste watch water wheat wheel where which while white whole widow width witch woman world worry worth would wound write wrong
yacht yield young youth zebra
`;

/** Every word the game knows, upper case, five letters, no repeats. */
export const WORDS: string[] = [
  ...new Set(
    RAW.split(/\s+/)
      .map((w) => w.trim().toUpperCase())
      .filter((w) => /^[A-Z]{5}$/.test(w)),
  ),
];

/** Answers avoid J and Z, which need movement the camera can't read, so every answer can be signed. */
export const ANSWERS: string[] = WORDS.filter((w) => !/[JZ]/.test(w));

/** Colours a guess like the classic game: hits first, then nears use up the remaining letters. */
export function scoreGuess(guess: string, answer: string): Mark[] {
  const g = guess.toUpperCase();
  const a = answer.toUpperCase();
  const marks: Mark[] = Array(g.length).fill('miss');
  const left = new Map<string, number>();
  for (let i = 0; i < a.length; i++) {
    if (g[i] === a[i]) marks[i] = 'hit';
    else left.set(a[i], (left.get(a[i]) ?? 0) + 1);
  }
  for (let i = 0; i < g.length; i++) {
    if (marks[i] === 'hit') continue;
    const n = left.get(g[i]) ?? 0;
    if (n > 0) {
      marks[i] = 'near';
      left.set(g[i], n - 1);
    }
  }
  return marks;
}

/** Best mark seen so far for each letter, for colouring the keyboard. */
export function letterMarks(guesses: string[], answer: string): Map<string, Mark> {
  const rank: Record<Mark, number> = { miss: 0, near: 1, hit: 2 };
  const out = new Map<string, Mark>();
  for (const g of guesses) {
    scoreGuess(g, answer).forEach((m, i) => {
      const prev = out.get(g[i]);
      if (!prev || rank[m] > rank[prev]) out.set(g[i], m);
    });
  }
  return out;
}

export function isKnownWord(word: string): boolean {
  return WORDS.includes(word.toUpperCase());
}

/** Local calendar date as YYYY-MM-DD, the key for the daily word. */
export function dayKey(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** The same word for everyone on a given day. */
export function dailyAnswer(key: string = dayKey()): string {
  let h = 2166136261;
  for (const c of key) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return ANSWERS[(h >>> 0) % ANSWERS.length];
}

export function randomAnswer(avoid?: string, random: () => number = Math.random): string {
  const pool = ANSWERS.filter((w) => w !== avoid);
  return pool[Math.floor(random() * pool.length)];
}
