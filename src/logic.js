// Hex Hollow rules: build a valley tile by tile, where each tile scores from its neighbours. No drawing here, so it can be tested.
import { Rng } from "./gamekit.js";

export const RADIUS = 4;
export const TILES = {
  meadow: { name: "Meadow", color: "#a3e635", about: "1 per neighbouring meadow, grove or river" },
  grove: { name: "Grove", color: "#16a34a", about: "2 per neighbouring grove, up to 8" },
  river: { name: "River", color: "#38bdf8", about: "2 per river joined in the same stream" },
  hut: { name: "Hut", color: "#f59e0b", about: "3 per neighbouring meadow or river, -2 next to a mine" },
  mine: { name: "Mine", color: "#94a3b8", about: "4 per neighbouring peak, +2 if a hut is beside it" },
  peak: { name: "Peak", color: "#cbd5e1", about: "Scores nothing itself. Groves and mines beside it gain" },
  shrine: { name: "Shrine", color: "#c084fc", about: "5 + 2 per neighbour, if no two neighbours are alike" },
  market: { name: "Market", color: "#fb7185", about: "4 per different tile type around it" },
};
export const KINDS = Object.keys(TILES);
const DIRS = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

export const SEASONS = [
  { name: "Spring", bonus: "meadow", text: "Meadows score double", weights: { meadow: 5, grove: 3, river: 3, hut: 2, peak: 1 } },
  { name: "Summer", bonus: "river", text: "Rivers score double", weights: { meadow: 3, grove: 2, river: 5, hut: 3, mine: 1, peak: 1 } },
  { name: "Autumn", bonus: "grove", text: "Groves score double", weights: { meadow: 2, grove: 5, river: 2, hut: 3, mine: 2, market: 1 } },
  { name: "Winter", bonus: "hut", text: "Huts score double", weights: { grove: 2, river: 1, hut: 5, mine: 3, peak: 2, market: 2, shrine: 1 } },
];
export const TURNS_PER_SEASON = 8;

export const GOALS = [
  { id: "stream", text: "A stream of 6 river tiles", test: (b) => largest(b, "river") >= 6, points: 20 },
  { id: "wood", text: "A wood of 6 joined groves", test: (b) => largest(b, "grove") >= 6, points: 20 },
  { id: "village", text: "A village of 4 joined huts", test: (b) => largest(b, "hut") >= 4, points: 20 },
  { id: "range", text: "A range of 3 joined peaks", test: (b) => largest(b, "peak") >= 3, points: 15 },
  { id: "town", text: "Two markets", test: (b) => count(b, "market") >= 2, points: 15 },
  { id: "pilgrim", text: "A shrine at the edge", test: (b) => [...b.cells.values()].some((c) => c.kind === "shrine" && ring(c) === RADIUS), points: 10 },
  { id: "pasture", text: "8 meadows", test: (b) => count(b, "meadow") >= 8, points: 15 },
  { id: "dig", text: "3 mines", test: (b) => count(b, "mine") >= 3, points: 15 },
];

export const key = (q, r) => q + "," + r;
const ring = (c) => Math.max(Math.abs(c.q), Math.abs(c.r), Math.abs(c.q + c.r));
export const onBoard = (q, r) => Math.max(Math.abs(q), Math.abs(r), Math.abs(q + r)) <= RADIUS;
export const neighbours = (q, r) => DIRS.map(([a, b]) => [q + a, r + b]).filter(([x, y]) => onBoard(x, y));

export function allCells() {
  const out = [];
  for (let q = -RADIUS; q <= RADIUS; q++) for (let r = -RADIUS; r <= RADIUS; r++) if (onBoard(q, r)) out.push([q, r]);
  return out;
}

const count = (b, kind) => [...b.cells.values()].filter((c) => c.kind === kind).length;

/** The size of the largest joined group of a kind of tile. */
export function largest(b, kind) {
  return Math.max(0, ...groups(b, kind).map((g) => g.length));
}

export function groups(b, kind) {
  const seen = new Set();
  const out = [];
  for (const c of b.cells.values()) {
    if (c.kind !== kind || seen.has(key(c.q, c.r))) continue;
    const g = [];
    const stack = [c];
    seen.add(key(c.q, c.r));
    while (stack.length) {
      const t = stack.pop();
      g.push(t);
      for (const [x, y] of neighbours(t.q, t.r)) {
        const n = b.cells.get(key(x, y));
        if (n?.kind === kind && !seen.has(key(x, y))) { seen.add(key(x, y)); stack.push(n); }
      }
    }
    out.push(g);
  }
  return out;
}

export function scoreTile(b, c) {
  const near = neighbours(c.q, c.r).map(([x, y]) => b.cells.get(key(x, y))).filter(Boolean);
  const n = (...k) => near.filter((o) => k.includes(o.kind)).length;
  switch (c.kind) {
    case "meadow": return n("meadow", "grove", "river");
    case "grove": return Math.min(8, n("grove") * 2) + n("peak") * 2;
    case "river": return (groups(b, "river").find((g) => g.some((t) => t.q === c.q && t.r === c.r))?.length || 1) * 2 - 2;
    case "hut": return Math.max(0, n("meadow", "river") * 3 - n("mine") * 2);
    case "mine": return n("peak") * 4 + (n("hut") ? 2 : 0);
    case "shrine": return near.length && new Set(near.map((o) => o.kind)).size === near.length ? 5 + near.length * 2 : 0;
    case "market": return new Set(near.map((o) => o.kind)).size * 4;
    default: return 0;
  }
}

export function boardScore(b, season = null) {
  let sum = 0;
  for (const c of b.cells.values()) {
    const v = scoreTile(b, c);
    sum += season && season.bonus === c.kind ? v * 2 : v;
  }
  return sum;
}

export class Valley {
  constructor(seed = 1) {
    this.seed = seed;
    this.rng = new Rng(seed);
    this.cells = new Map();
    this.season = 0;
    this.turn = 0;
    this.banked = 0;
    this.state = "playing";
    this.log = [];
    const list = new Rng(seed + 9).shuffle([...GOALS]);
    this.goals = list.slice(0, 3);
    for (const [q, r] of new Rng(seed + 3).shuffle(allCells()).slice(0, 4)) this.cells.set(key(q, r), { q, r, kind: "peak", fixed: true });
    this.hand = [];
    this.fill();
    this.rerolls = 2;
  }
  get seasonInfo() { return SEASONS[this.season]; }
  draw1() {
    const w = this.seasonInfo.weights;
    const bag = Object.entries(w).flatMap(([k, n]) => Array(n).fill(k));
    return this.rng.pick(bag);
  }
  fill() { while (this.hand.length < 3) this.hand.push(this.draw1()); }
  reroll() {
    if (this.rerolls <= 0 || this.state !== "playing") return false;
    this.rerolls--;
    this.hand = [];
    this.fill();
    return true;
  }
  canPlace(q, r) { return this.state === "playing" && onBoard(q, r) && !this.cells.has(key(q, r)); }
  /** What placing the tile would add to the score, for the preview shown under a finger. */
  gain(kind, q, r) {
    const before = boardScore(this);
    this.cells.set(key(q, r), { q, r, kind });
    const after = boardScore(this);
    this.cells.delete(key(q, r));
    return after - before;
  }
  place(i, q, r) {
    if (!this.canPlace(q, r) || i < 0 || i >= this.hand.length) return false;
    const [kind] = this.hand.splice(i, 1);
    this.cells.set(key(q, r), { q, r, kind });
    this.fill();
    this.turn++;
    if (this.turn % TURNS_PER_SEASON === 0) this.endSeason();
    else if (this.isFull()) this.endSeason(true);
    return true;
  }
  isFull() { return allCells().every(([q, r]) => this.cells.has(key(q, r))); }
  endSeason(force = false) {
    const pts = boardScore(this, this.seasonInfo);
    this.banked += pts;
    this.log.push({ name: this.seasonInfo.name, pts });
    if (this.season === SEASONS.length - 1 || force) {
      this.finishGoals();
      this.state = "over";
    } else {
      this.season++;
      this.hand = [];
      this.fill();
      this.rerolls = Math.min(3, this.rerolls + 1);
    }
  }
  finishGoals() {
    this.met = this.goals.filter((g) => g.test(this));
    this.goalPoints = this.met.reduce((s, g) => s + g.points, 0);
  }
  total() { return this.banked + (this.goalPoints || 0); }
  rank() {
    const t = this.total();
    return t >= 1100 ? "Legendary Valley" : t >= 800 ? "Thriving Hollow" : t >= 500 ? "Good Harvest" : t >= 250 ? "Humble Hamlet" : "Lonely Vale";
  }
}

/** Place the tile that adds the most right now. Used in the tests as a baseline player. */
export function botMove(v) {
  let best = null;
  const free = allCells().filter(([q, r]) => v.canPlace(q, r));
  v.hand.forEach((kind, i) => {
    for (const [q, r] of free) {
      const g = v.gain(kind, q, r);
      if (!best || g > best.g) best = { g, i, q, r };
    }
  });
  return best ? v.place(best.i, best.q, best.r) : false;
}
