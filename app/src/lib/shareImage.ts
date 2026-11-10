// Draws a Sign Five result as a picture to download or share. The score is
// signed: the ASL handshape for the number of guesses (or X for a miss) sits
// next to it. The grid has colors only, no letters, so it never spoils the word.
import { content } from './content';
import { MAX_GUESSES, scoreGuess, WORD_LENGTH, type Mark } from './guess';

export interface ShareCard {
  title: string;
  guesses: string[];
  answer: string;
  /** Letters fingerspelled to the camera, if any. */
  signed?: number;
  stats?: { played: number; won: number; streak: number };
  /** Draw handshapes mirrored, for a left-handed signer. */
  mirror?: boolean;
}

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six'];

/** Reads a color token from app.css so the picture matches the app. */
function token(name: string, fallback: string): string {
  if (typeof document === 'undefined') return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

/** The sign's own picture (a public-domain image in content/), loaded for drawing. */
function signImage(id: string): Promise<HTMLImageElement | undefined> {
  const url = content.byId.get(id)?.files.find((f) => f.type === 'image')?.url;
  if (!url) return Promise.resolve(undefined);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(undefined);
    img.src = url;
  });
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws an image inside a box, keeping its shape, optionally mirrored. */
function drawContained(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number, mirror: boolean) {
  const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = x + (w - dw) / 2;
  const dy = y + (h - dh) / 2;
  ctx.save();
  if (mirror) {
    ctx.translate(dx + dw / 2, 0);
    ctx.scale(-1, 1);
    ctx.translate(-(dx + dw / 2), 0);
  }
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.restore();
}

/** What the card says under the name: which game it was. */
export function cardSubtitle(title: string): string {
  const rest = title.replace(/^Sign Five ?/, '');
  return /practice/i.test(rest) ? 'Practice word' : `Daily word · ${rest}`;
}

/** A 1080×1080 card, the usual size for sharing a picture. */
export async function drawShareCard(card: ShareCard, size = 1080): Promise<HTMLCanvasElement> {
  const won = card.guesses.includes(card.answer);
  const [scoreSign, logoSign] = await Promise.all([
    signImage(won ? String(card.guesses.length) : 'x'),
    signImage('5'),
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const s = size / 1080;
  const font = token('--font', 'system-ui, sans-serif');
  const spell = token('--spell', '#6d28d9');
  const accent = token('--accent', '#2456d3');
  const ink = token('--ink', '#101828');
  const muted = token('--ink-3', '#667085');
  const colors: Record<Mark | 'empty', string> = {
    hit: token('--hit', '#067647'),
    near: token('--near', '#b88a00'),
    miss: token('--miss', '#667085'),
    empty: token('--surface-3', '#e4e7ec'),
  };
  const mirror = !!card.mirror;

  // Background: the game's purple fading into the app's blue, with a few soft rings.
  const bg = ctx.createLinearGradient(0, 0, size, size);
  bg.addColorStop(0, spell);
  bg.addColorStop(1, accent);
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, size, size);
  ctx.strokeStyle = 'rgb(255 255 255 / 0.12)';
  ctx.lineWidth = 3 * s;
  for (const [cx, cy, r] of [[960, 120, 150], [960, 120, 230], [110, 990, 170], [110, 990, 250]]) {
    ctx.beginPath();
    ctx.arc(cx * s, cy * s, r * s, 0, Math.PI * 2);
    ctx.stroke();
  }

  // The white card
  const px = 70 * s;
  const pw = size - 2 * px;
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = 'rgb(16 24 40 / 0.25)';
  ctx.shadowBlur = 40 * s;
  ctx.shadowOffsetY = 12 * s;
  roundRect(ctx, px, px, pw, pw, 44 * s);
  ctx.fill();
  ctx.shadowColor = 'transparent';

  // Header: the "5" handshape as a logo, the name, which game
  const lx = 120 * s;
  const ly = 112 * s;
  const logo = 84 * s;
  ctx.fillStyle = token('--spell-soft', '#f4f0ff');
  roundRect(ctx, lx, ly, logo, logo, 20 * s);
  ctx.fill();
  if (logoSign) drawContained(ctx, logoSign, lx + 10 * s, ly + 8 * s, logo - 20 * s, logo - 16 * s, mirror);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = spell;
  ctx.font = `800 ${40 * s}px ${font}`;
  ctx.fillText('SIGN FIVE', lx + logo + 22 * s, ly + 40 * s);
  ctx.fillStyle = muted;
  ctx.font = `600 ${28 * s}px ${font}`;
  ctx.fillText(cardSubtitle(card.title), lx + logo + 22 * s, ly + 76 * s);

  // The signed score: the handshape in a tile, the number beside it
  const sx = 120 * s;
  const sy = 236 * s;
  const sw = 250 * s;
  ctx.fillStyle = won ? '#ecfdf3' : '#f2f4f7';
  roundRect(ctx, sx, sy, sw, sw, 32 * s);
  ctx.fill();
  ctx.strokeStyle = won ? colors.hit : colors.miss;
  ctx.lineWidth = 6 * s;
  roundRect(ctx, sx, sy, sw, sw, 32 * s);
  ctx.stroke();
  if (scoreSign) {
    // The images are black line art on white; multiply drops the white onto the tint.
    ctx.globalCompositeOperation = 'multiply';
    drawContained(ctx, scoreSign, sx + 24 * s, sy + 20 * s, sw - 48 * s, sw - 40 * s, mirror);
    ctx.globalCompositeOperation = 'source-over';
  }

  const tx = sx + sw + 44 * s;
  ctx.fillStyle = ink;
  ctx.font = `800 ${150 * s}px ${font}`;
  ctx.fillText(`${won ? card.guesses.length : 'X'}/${MAX_GUESSES}`, tx, sy + 150 * s);
  ctx.fillStyle = won ? colors.hit : muted;
  ctx.font = `700 ${38 * s}px ${font}`;
  ctx.fillText(won ? `Solved in ${NUMBER_WORDS[card.guesses.length]}` : 'Out of guesses', tx, sy + 202 * s);
  ctx.fillStyle = muted;
  ctx.font = `600 ${26 * s}px ${font}`;
  ctx.fillText(won ? `signed: ${NUMBER_WORDS[card.guesses.length]}` : 'signed: X', tx, sy + 242 * s);

  // The grid, every row, so the shape reads at a glance
  const tile = 58 * s;
  const gap = 9 * s;
  const gridW = WORD_LENGTH * tile + (WORD_LENGTH - 1) * gap;
  const gx = (size - gridW) / 2;
  const gy = 530 * s;
  for (let r = 0; r < MAX_GUESSES; r++) {
    const marks = card.guesses[r] ? scoreGuess(card.guesses[r], card.answer) : undefined;
    for (let c = 0; c < WORD_LENGTH; c++) {
      ctx.fillStyle = marks ? colors[marks[c]] : colors.empty;
      roundRect(ctx, gx + c * (tile + gap), gy + r * (tile + gap), tile, tile, 11 * s);
      ctx.fill();
    }
  }

  // Footer: one line with how much was fingerspelled and the running stats
  const bits: string[] = [];
  if (card.signed) bits.push(`🤟 ${card.signed} of ${card.guesses.length * WORD_LENGTH} letters fingerspelled`);
  if (card.stats?.played) {
    bits.push(`streak ${card.stats.streak} · ${Math.round((card.stats.won / card.stats.played) * 100)}% won`);
  }
  if (!bits.length) bits.push('Fingerspell it, don’t type it');
  ctx.textAlign = 'center';
  ctx.fillStyle = muted;
  ctx.font = `600 ${26 * s}px ${font}`;
  ctx.fillText(bits.join('   ·   '), size / 2, gy + MAX_GUESSES * (tile + gap) + 44 * s);

  // The app's name, top right
  ctx.textAlign = 'right';
  ctx.font = `600 ${22 * s}px ${font}`;
  ctx.fillText('ASL Practice', size - 120 * s, ly + 30 * s);
  return canvas;
}

/** The card as a PNG file, for downloading or sharing. */
export function shareCardFile(canvas: HTMLCanvasElement, name: string): Promise<File> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(new File([b], name, { type: 'image/png' })) : reject(new Error('No image'))), 'image/png'),
  );
}
