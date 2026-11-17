import { canvasFont, theme } from '../carnival';
import { palette } from './palette';
import {
  toScreen,
  type BoothSlot,
  type MidwayMap,
  type Prop,
  type Rect,
  type Walker,
} from './world';

/**
 * Flat, isometric vector drawing for the midway, in world pixels. The caller
 * sets up the canvas transform for the camera and zoom.
 */

type Ctx = CanvasRenderingContext2D;
type Pt = readonly [number, number];

/** A tile position, `z` pixels above the ground, in world pixels. */
function at(x: number, y: number, z = 0): Pt {
  const s = toScreen(x, y);
  return [s.x, s.y - z];
}

function poly(ctx: Ctx, points: readonly Pt[], color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function oval(ctx: Ctx, x: number, y: number, rx: number, ry: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function stroke(ctx: Ctx, points: readonly Pt[], color: string, width: number) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1]);
  ctx.stroke();
}

const lerp = (a: number, b: number, s: number) => a + (b - a) * s;

/** A tile-aligned box, `z` pixels off the ground and `h` pixels tall. */
function box(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  d: number,
  z: number,
  h: number,
  top: string,
  left: string,
  right: string,
) {
  if (h > 0) {
    poly(
      ctx,
      [at(x, y + d, z), at(x + w, y + d, z), at(x + w, y + d, z + h), at(x, y + d, z + h)],
      left,
    );
    poly(
      ctx,
      [at(x + w, y + d, z), at(x + w, y, z), at(x + w, y, z + h), at(x + w, y + d, z + h)],
      right,
    );
  }
  poly(
    ctx,
    [at(x, y, z + h), at(x + w, y, z + h), at(x + w, y + d, z + h), at(x, y + d, z + h)],
    top,
  );
}

// ── Ground ────────────────────────────────────────────────────────────────

/** The world-pixel height of the horizon; the field runs off to it. */
export const HORIZON = -24;

function hash(x: number, y: number, salt = 0): number {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function rectPoints(r: Rect, lift = 0): Pt[] {
  return [
    at(r.x, r.y, lift),
    at(r.x + r.w, r.y, lift),
    at(r.x + r.w, r.y + r.h, lift),
    at(r.x, r.y + r.h, lift),
  ];
}

/** The world-pixel box the pre-drawn ground layer covers. */
export function groundBounds(map: MidwayMap): Box {
  return {
    left: -map.height * 16 - 64,
    right: map.width * 16 + 64,
    top: -64,
    bottom: (map.width + map.height) * 8 + 4,
  };
}

/** The open field round the midway, filling the view from the horizon down. */
export function drawField(ctx: Ctx, view: Box) {
  ctx.fillStyle = palette.haze;
  ctx.fillRect(view.left, HORIZON, view.right - view.left, 6);
  ctx.fillStyle = palette.grass;
  ctx.fillRect(view.left, HORIZON + 6, view.right - view.left, Math.max(0, view.bottom - HORIZON));
}

/**
 * The most pixels the ground layer may use. Safari refuses canvases over
 * 16,777,216 pixels, and a long midway on a sharp screen would pass that.
 */
const MAX_GROUND_PIXELS = 16_000_000;

export interface GroundLayer {
  canvas: HTMLCanvasElement;
  /** Device pixels per world pixel the layer was drawn at. */
  scale: number;
}

/**
 * Draws the parts of the ground that never change (the snow, paths, trees
 * and the hedge's back two sides) once, onto an off-screen canvas covering
 * groundBounds(map). It uses `scale` device pixels per world pixel, or less
 * when that would make the canvas too big, so its size stays bounded however
 * long the midway grows.
 */
export function drawGroundLayer(map: MidwayMap, wanted: number): GroundLayer {
  const bounds = groundBounds(map);
  const area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  const scale = Math.min(wanted, Math.sqrt(MAX_GROUND_PIXELS / area));
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((bounds.right - bounds.left) * scale);
  canvas.height = Math.ceil((bounds.bottom - bounds.top) * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(scale, 0, 0, scale, -bounds.left * scale, -bounds.top * scale);

  // Fresh snow banks sit slightly above the packed paths.
  poly(ctx, rectPoints({ x: 0, y: 0, w: map.width, h: map.height }), palette.grassLight);
  for (const path of map.paths) poly(ctx, rectPoints(path, 3), palette.grassEdge);
  for (const path of map.paths) poly(ctx, rectPoints(path), palette.path);

  // Small tracks pressed into the snow.
  ctx.strokeStyle = palette.grassDark;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let y = 1; y < map.height - 1; y++) {
    for (let x = 1; x < map.width - 1; x++) {
      if (map.ground[y * map.width + x] !== 'grass' || hash(x, y) > 0.5) continue;
      const [px, py] = at(x + hash(x, y, 1), y + hash(x, y, 2));
      ctx.moveTo(px - 2, py - 2);
      ctx.lineTo(px, py);
      ctx.lineTo(px + 2, py - 3);
    }
  }
  ctx.stroke();

  // Trees out in the field behind the midway.
  for (let i = 0; i < map.width; i += 2) tree(ctx, i + 0.5 + hash(i, 1) * 0.6, -1.4 - hash(i, 2));
  for (let i = 2; i < map.height; i += 2) tree(ctx, -1.4 - hash(1, i), i + 0.5 + hash(2, i) * 0.6);

  hedge(ctx, { x: 0, y: 0, w: map.width, h: 1 });
  hedge(ctx, { x: 0, y: 0, w: 1, h: map.height });
  return { canvas, scale };
}

function tree(ctx: Ctx, x: number, y: number) {
  const [px, py] = at(x, y);
  oval(ctx, px + 4, py + 1, 12, 5, palette.shadow);
  poly(
    ctx,
    [
      [px - 1.5, py],
      [px + 1.5, py],
      [px + 1.5, py - 12],
      [px - 1.5, py - 12],
    ],
    palette.woodDark,
  );
  for (let tier = 0; tier < 3; tier++) {
    const z = 10 + tier * 10;
    const r = 14 - tier * 3;
    poly(
      ctx,
      [
        [px - r, py - z],
        [px, py - z - 23],
        [px + r, py - z],
      ],
      palette.hedgeDark,
    );
    poly(
      ctx,
      [
        [px - r * 0.68, py - z - 7],
        [px, py - z - 23],
        [px + r * 0.68, py - z - 7],
      ],
      palette.white,
    );
  }
}

function hedge(ctx: Ctx, area: Rect) {
  box(
    ctx,
    area.x + 0.15,
    area.y + 0.15,
    area.w - 0.3,
    area.h - 0.3,
    0,
    9,
    palette.white,
    palette.hedge,
    palette.hedgeDark,
  );
}

/** The hedge's front two sides, which can stand in front of anything. */
export function drawFrontHedge(ctx: Ctx, map: MidwayMap) {
  const h = map.height - 1;
  hedge(ctx, { x: map.width - 1, y: 1, w: 1, h: map.height - 1 });
  hedge(ctx, { x: 1, y: h, w: map.avenueX - 1, h: 1 });
  hedge(ctx, { x: map.avenueX + 2, y: h, w: map.width - map.avenueX - 3, h: 1 });
}

// Snow-capped timber workshops share the existing collision footprints.
export interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export const BOOTH_SIGN_HEIGHT = 56;

function sign(ctx: Ctx, text: string, x: number, y: number, width = 88, glow = false) {
  ctx.fillStyle = palette.ink;
  ctx.strokeStyle = glow ? palette.white : palette.gold;
  ctx.lineWidth = glow ? 2 : 1;
  ctx.beginPath();
  ctx.roundRect(x - width / 2, y - 8, width, 16, 3);
  ctx.fill();
  ctx.stroke();
  ctx.font = `bold 8px ${theme.font.family}`;
  ctx.fillStyle = palette.cream;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y, width - 8);
}
function lights(ctx: Ctx, a: Pt, b: Pt, t: number, count = 9) {
  const points: Pt[] = [];
  for (let i = 0; i <= count; i++) {
    const u = i / count;
    points.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * Math.PI) * 5]);
  }
  stroke(ctx, points, palette.hedgeDark, 1);
  points.forEach(([x, y], i) => {
    oval(ctx, x, y + 2, 3, 3, 'rgba(255,209,125,0.16)');
    oval(ctx, x, y + 2, 1.4, 1.8, Math.sin(t + i) * 0.5 + 0.5 > 0.2 ? palette.gold : palette.cream);
  });
}
function gift(ctx: Ctx, x: number, y: number, size = 8, color: string = palette.red) {
  ctx.fillStyle = color;
  ctx.fillRect(x - size / 2, y - size, size, size);
  ctx.fillStyle = palette.gold;
  ctx.fillRect(x - 1, y - size, 2, size);
  ctx.fillRect(x - size / 2, y - size * 0.65, size, 2);
  stroke(
    ctx,
    [
      [x, y - size],
      [x - 4, y - size - 3],
      [x - 4, y - size],
      [x + 4, y - size - 3],
      [x + 4, y - size],
      [x, y - size],
    ],
    palette.gold,
    1,
  );
}
function cabin(ctx: Ctx, r: Rect, name: string, t: number, glow = false) {
  const h = 32;
  const { x, y, w, h: d } = r;
  box(ctx, x, y, w, d, 0, h, palette.wood, palette.wood, palette.woodDark);
  for (let z = 5; z < h; z += 7)
    stroke(ctx, [at(x, y + d, z), at(x + w, y + d, z), at(x + w, y, z)], palette.woodLight, 0.6);
  const ridgeA = at(x + w / 2, y, h + 22),
    ridgeB = at(x + w / 2, y + d, h + 22);
  poly(ctx, [at(x, y, h), ridgeA, ridgeB, at(x, y + d, h)], palette.white);
  poly(ctx, [ridgeA, at(x + w, y, h), at(x + w, y + d, h), ridgeB], palette.cloud);
  poly(ctx, [at(x, y + d, h), ridgeB, at(x + w, y + d, h)], palette.redShade);
  stroke(ctx, [at(x, y + d, h), ridgeB, at(x + w, y + d, h)], palette.white, 3);
  const [cx, cy] = at(x + w / 2, y + d, 14);
  ctx.save();
  ctx.shadowColor = palette.gold;
  ctx.shadowBlur = 9;
  ctx.fillStyle = palette.gold;
  ctx.fillRect(cx - 10, cy - 9, 20, 15);
  ctx.restore();
  stroke(
    ctx,
    [
      [cx, cy - 9],
      [cx, cy + 6],
    ],
    palette.woodDark,
    2,
  );
  stroke(
    ctx,
    [
      [cx - 10, cy - 2],
      [cx + 10, cy - 2],
    ],
    palette.woodDark,
    2,
  );
  lights(ctx, at(x, y + d, h), at(x + w, y + d, h), t, 7);
  const [sx, sy] = at(x + w / 2, y + d, h + 5);
  sign(ctx, name, sx, sy, Math.max(66, w * 24), glow);
  const [gx, gy] = at(x + w - 0.2, y + d + 0.1);
  gift(ctx, gx, gy, 9);
  gift(ctx, gx - 11, gy - 4, 7, palette.hedge);
}
function christmasTree(ctx: Ctx, prop: Prop, t: number) {
  const [x, y] = at(prop.x + prop.w / 2, prop.y + prop.h / 2);
  const scale = prop.w > 1 ? 2 : 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  ctx.fillStyle = palette.wood;
  ctx.fillRect(-3, -14, 6, 14);
  for (let i = 0; i < 4; i++) {
    const z = 10 + i * 12,
      r = 24 - i * 5;
    poly(
      ctx,
      [
        [-r, -z],
        [0, -z - 28],
        [r, -z],
      ],
      i % 2 ? palette.hedge : palette.hedgeDark,
    );
    poly(
      ctx,
      [
        [-r * 0.55, -z - 12],
        [0, -z - 28],
        [r * 0.55, -z - 12],
      ],
      palette.white,
    );
    for (let j = 0; j < 3; j++)
      oval(ctx, -r * 0.55 + j * r * 0.55, -z - 4, 1.7, 1.7, j % 2 ? palette.red : palette.gold);
  }
  const star: Pt[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5,
      r = i % 2 ? 3 : 7;
    star.push([Math.cos(a) * r, -76 + Math.sin(a) * r]);
  }
  poly(ctx, star, palette.gold);
  gift(ctx, -12, 0, 12);
  gift(ctx, 10, 4, 10, palette.blue);
  ctx.restore();
  if (prop.w > 1) sign(ctx, 'CHRISTMAS WISHES', x, y + 12, 96);
  void t;
}
function sleigh(ctx: Ctx, prop: Prop) {
  const [x, y] = at(prop.x + prop.w / 2, prop.y + prop.h / 2);
  stroke(
    ctx,
    [
      [x - 25, y + 3],
      [x + 23, y + 3],
      [x + 29, y - 3],
    ],
    palette.gold,
    3,
  );
  poly(
    ctx,
    [
      [x - 23, y - 8],
      [x - 27, y - 28],
      [x - 16, y - 28],
      [x - 12, y - 17],
      [x + 20, y - 17],
      [x + 26, y - 26],
      [x + 28, y - 9],
    ],
    palette.red,
  );
  stroke(
    ctx,
    [
      [x - 24, y - 27],
      [x - 14, y - 16],
      [x + 20, y - 16],
      [x + 26, y - 26],
    ],
    palette.gold,
    2,
  );
  gift(ctx, x, y - 18, 14, palette.hedge);
  gift(ctx, x + 11, y - 18, 10);
}
function reindeer(ctx: Ctx, x: number, y: number) {
  oval(ctx, x, y - 10, 11, 6, palette.wood);
  oval(ctx, x + 10, y - 19, 5, 7, palette.woodLight);
  for (const dx of [-7, 6])
    stroke(
      ctx,
      [
        [x + dx, y - 8],
        [x + dx + 2, y],
      ],
      palette.woodDark,
      2,
    );
  stroke(
    ctx,
    [
      [x + 9, y - 24],
      [x + 6, y - 34],
      [x + 2, y - 37],
    ],
    palette.woodDark,
    1.5,
  );
  stroke(
    ctx,
    [
      [x + 12, y - 24],
      [x + 15, y - 34],
      [x + 19, y - 37],
    ],
    palette.woodDark,
    1.5,
  );
  stroke(
    ctx,
    [
      [x + 6, y - 33],
      [x + 3, y - 32],
    ],
    palette.woodDark,
    1,
  );
  oval(ctx, x + 14, y - 20, 2, 2, palette.red);
  oval(ctx, x + 11, y - 22, 1, 1, palette.ink);
  stroke(
    ctx,
    [
      [x + 5, y - 15],
      [x + 13, y - 13],
    ],
    palette.red,
    3,
  );
}
export function propBounds(prop: Prop): Box {
  const c = toScreen(prop.x + prop.w / 2, prop.y + prop.h / 2);
  const half = Math.max(30, (prop.w + prop.h) * 8);
  return {
    left: c.x - half - 10,
    right: c.x + half + 10,
    top: c.y - (prop.kind === 'ferris-wheel' ? 160 : 90),
    bottom: c.y + half / 2 + 20,
  };
}
export function boothBounds(slot: BoothSlot): Box {
  const c = toScreen(slot.x + 1, slot.y + 1);
  return { left: c.x - 40, right: c.x + 40, top: c.y - BOOTH_SIGN_HEIGHT - 30, bottom: c.y + 18 };
}
export function drawProp(ctx: Ctx, prop: Prop, t: number) {
  const [x, y] = at(prop.x + prop.w / 2, prop.y + prop.h / 2);
  switch (prop.kind) {
    case 'big-top':
      return cabin(ctx, prop, 'SANTA’S WORKSHOP', t);
    case 'round-tent':
      return cabin(ctx, prop, ['TOY MAKING', 'ELF LODGE', 'COCOA KITCHEN'][prop.variant % 3], t);
    case 'peaked-tent':
      return cabin(ctx, prop, prop.variant ? 'REINDEER STABLE' : 'SLEIGH MECHANIC', t);
    case 'ferris-wheel':
    case 'planter':
      return christmasTree(ctx, prop, t);
    case 'carousel':
      reindeer(ctx, x - 19, y - 5);
      reindeer(ctx, x + 18, y + 12);
      sign(ctx, 'REINDEER PADDOCK', x, y - 52, 100);
      return;
    case 'wagon':
      return sleigh(ctx, prop);
    case 'cart':
      return cabin(
        ctx,
        prop,
        ['GINGERBREAD', 'HOT COCOA', 'CANDY CANES', 'MULLED APPLE'][prop.variant % 4],
        t,
      );
    case 'ticket-booth':
      return cabin(ctx, prop, 'LETTERS', t);
    case 'balloons':
      gift(ctx, x, y, 14);
      gift(ctx, x + 11, y + 5, 10, palette.hedge);
      return;
    case 'bench':
      stroke(
        ctx,
        [
          [x - 10, y],
          [x - 10, y - 9],
          [x + 10, y - 9],
          [x + 10, y],
        ],
        palette.wood,
        3,
      );
      return;
    case 'bunting-pole':
      stroke(
        ctx,
        [
          [x, y],
          [x, y - 44],
        ],
        palette.white,
        3,
      );
      for (let z = 4; z < 44; z += 8)
        stroke(
          ctx,
          [
            [x - 1, y - z],
            [x + 1, y - z - 3],
          ],
          palette.red,
          2,
        );
      oval(ctx, x, y - 46, 3, 3, palette.gold);
      return;
    case 'billboard':
      stroke(
        ctx,
        [
          [x - 25, y],
          [x - 25, y - 54],
          [x + 25, y - 54],
          [x + 25, y],
        ],
        palette.wood,
        3,
      );
      sign(ctx, 'NORTH POLE • 90° N', x, y - 61, 112);
      sign(ctx, 'CHRISTMAS EVE CREW', x, y - 43, 112);
      return;
  }
}
export function drawBooth(ctx: Ctx, slot: BoothSlot, name: string, t: number, glow: boolean) {
  cabin(ctx, slot, name.toUpperCase(), t, glow);
}
export function drawBunting(ctx: Ctx, map: MidwayMap, t: number, view: Box) {
  for (const [a, b] of map.bunting)
    lights(ctx, at(a.x + 0.5, a.y + 0.5, 42), at(b.x + 0.5, b.y + 0.5, 42), t);
  void view;
}
export interface Look {
  skin: string;
  hair: string;
  shirt: string;
  pants: string;
  cap: string;
}
export function visitorLook(n: number): Look {
  return {
    skin: palette.skins[n % palette.skins.length],
    hair: palette.hairs[n % palette.hairs.length],
    shirt: n % 2 ? palette.hedge : palette.redShade,
    pants: palette.hedgeDark,
    cap: palette.hedge,
  };
}
export const PLAYER_LOOK: Look = {
  skin: palette.skins[0],
  hair: palette.white,
  shirt: palette.red,
  pants: palette.redShade,
  cap: palette.red,
};
export function drawWalker(ctx: Ctx, walker: Walker, look: Look, player = false, t = 0) {
  const p = toScreen(walker.x, walker.y),
    swing = walker.walking ? Math.sin(walker.stride * 7) * 2 : 0;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.scale(walker.flipped ? -1 : 1, 1);
  oval(ctx, 0, 1, player ? 9 : 6, 3, palette.shadow);
  if (player) {
    ctx.strokeStyle = palette.gold;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(0, 1, 11, 5, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  stroke(
    ctx,
    [
      [-3, -8],
      [-3 + swing, -2],
    ],
    look.pants,
    4,
  );
  stroke(
    ctx,
    [
      [3, -8],
      [3 - swing, -2],
    ],
    look.pants,
    4,
  );
  oval(ctx, -4 + swing, -1, 4, 2, palette.ink);
  oval(ctx, 4 - swing, -1, 4, 2, palette.ink);
  ctx.fillStyle = look.shirt;
  ctx.beginPath();
  ctx.roundRect(player ? -8 : -6, -22, player ? 16 : 12, 15, 4);
  ctx.fill();
  stroke(
    ctx,
    [
      [-7, -19],
      [-9, -11 + swing],
    ],
    look.shirt,
    4,
  );
  stroke(
    ctx,
    [
      [7, -19],
      [9, -11 - swing],
    ],
    look.shirt,
    4,
  );
  stroke(
    ctx,
    [
      [-7, -10],
      [7, -10],
    ],
    player ? palette.white : palette.gold,
    2,
  );
  stroke(
    ctx,
    [
      [-7, -14],
      [7, -14],
    ],
    palette.ink,
    3,
  );
  ctx.fillStyle = palette.gold;
  ctx.fillRect(-2, -16, 4, 4);
  oval(ctx, 0, -27, 6, 6, look.skin);
  if (walker.facing === 'front') {
    oval(ctx, -2, -28, 0.7, 1, palette.ink);
    oval(ctx, 2, -28, 0.7, 1, palette.ink);
    if (player)
      poly(
        ctx,
        [
          [-6, -26],
          [-5, -20],
          [0, -17],
          [5, -20],
          [6, -26],
          [0, -24],
        ],
        palette.white,
      );
    else {
      poly(
        ctx,
        [
          [-5, -28],
          [-9, -29],
          [-5, -24],
        ],
        look.skin,
      );
      poly(
        ctx,
        [
          [5, -28],
          [9, -29],
          [5, -24],
        ],
        look.skin,
      );
    }
  } else oval(ctx, 0, -27, 6, 5, look.hair);
  poly(
    ctx,
    [
      [-7, -31],
      [0, -43],
      [8, -34],
      [5, -33],
      [0, -36],
      [6, -31],
    ],
    look.cap,
  );
  stroke(
    ctx,
    [
      [-6, -31],
      [6, -31],
    ],
    player ? palette.white : palette.gold,
    3,
  );
  oval(ctx, 8, -34, 2, 2, player ? palette.white : palette.gold);
  ctx.restore();
  void t;
}
export function archBounds(map: MidwayMap): Box {
  const p = toScreen(map.avenueX + 1, map.height - 0.75);
  return { left: p.x - 65, right: p.x + 65, top: p.y - 80, bottom: p.y + 20 };
}
export function drawArch(ctx: Ctx, map: MidwayMap, t: number) {
  const a = at(map.avenueX - 0.5, map.height - 0.75),
    b = at(map.avenueX + 2.3, map.height - 0.75);
  for (const [x, y] of [a, b]) {
    stroke(
      ctx,
      [
        [x, y],
        [x, y - 57],
      ],
      palette.white,
      5,
    );
    for (let i = 4; i < 57; i += 9)
      stroke(
        ctx,
        [
          [x - 2, y - i],
          [x + 2, y - i - 4],
        ],
        palette.red,
        3,
      );
  }
  lights(ctx, [a[0], a[1] - 58], [b[0], b[1] - 58], t);
  sign(ctx, 'NORTH POLE', (a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 61, 100);
}
export interface Cloud {
  x: number;
  y: number;
  size: number;
  speed: number;
}
export function drawCloud(ctx: Ctx, x: number, y: number, size: number) {
  // Distant stars replace the daytime clouds.
  stroke(
    ctx,
    [
      [x - 3 * size, y],
      [x + 3 * size, y],
    ],
    palette.cream,
    0.7,
  );
  stroke(
    ctx,
    [
      [x, y - 3 * size],
      [x, y + 3 * size],
    ],
    palette.cream,
    0.7,
  );
}
export interface Floater {
  x: number;
  y: number;
  age: number;
  color: string;
}
export function drawFloaters(ctx: Ctx, floaters: readonly Floater[]) {
  for (const f of floaters) oval(ctx, f.x + Math.sin(f.age) * 5, f.y, 2, 2, palette.white);
}
/** Deterministic snow in screen space; frozen when reduced motion is requested. */
export function drawSnow(ctx: Ctx, width: number, height: number, time: number) {
  ctx.save();
  ctx.fillStyle = palette.white;
  ctx.globalAlpha = 0.65;
  for (let i = 0; i < 65; i++) {
    const x = (hash(i, 7) * width + Math.sin(time * 0.4 + i) * 12 + width) % width;
    const y = (hash(i, 9) * height + time * (8 + hash(i, 3) * 15)) % height;
    ctx.beginPath();
    ctx.arc(x, y, 0.8 + hash(i, 2) * 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}
export function label(ctx: Ctx, text: string, x: number, y: number) {
  ctx.font = canvasFont('small', 'bold');
  sign(ctx, text, x, y, 116, true);
}
