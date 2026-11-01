// Hex Hollow screens: the hex board, the hand of tiles and the seasons.
import { Game, Help, Result, Scene, Title, backdrop, compose, panel, para, text, TAU } from "./gamekit.js";
import { RADIUS, TILES, TURNS_PER_SEASON, Valley, allCells, boardScore, key, scoreTile } from "./logic.js";

export const game = new Game({ id: "hex-hollow", title: "Hex Hollow", theme: { accent: "#a3e635", onAccent: "#0f1f07", bg: "#0a1409", bg2: "#17301a", panel: "#1f3a22" }, defaults: { best: 0, played: 0, dailyBest: {} } });
const data = game.store.data;
const S = Math.floor(190 / (Math.sqrt(3) * (RADIUS + 0.5)));

const HELP = [
  ["Your valley", "Four seasons, eight tiles each. Pick a tile from your hand, then tap an empty space to place it. A number shows what it would add."],
  ["Scoring", "At the end of each season every tile scores from its neighbours, and that score is added to your harvest. Good early tiles keep paying all year."],
  ["The tiles", "Meadow: likes meadows, groves, rivers.\nGrove: likes groves.\nRiver: longer streams pay more.\nHut: likes meadows and rivers, hates mines.\nMine: likes peaks.\nMarket: likes variety.\nShrine: needs all different neighbours."],
  ["Seasons", "Each season doubles one tile's score and changes which tiles you draw. Three goals are shown on screen, and each one pays a bonus at the end of the year."],
];

function hexPath(c, x, y, s) {
  c.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 6 + (i * TAU) / 6;
    c.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
  }
  c.closePath();
}

function art(c, g, t) {
  backdrop(c, g, t);
  const kinds = Object.values(TILES);
  for (let i = 0; i < 19; i++) {
    const a = (i % 6) * (TAU / 6) + t * 0.08, r = i === 0 ? 0 : i < 7 ? 56 : 106;
    hexPath(c, 195 + Math.cos(a + i) * r, 360 + Math.sin(a + i) * r, 26);
    c.fillStyle = kinds[i % kinds.length].color + "55";
    c.fill();
  }
}

const dayKey = () => new Date().toISOString().slice(0, 10);
const title = () => new Title(game, {
  tag: data.best ? `Best harvest ${data.best}` : "A year in the valley",
  art,
  help: HELP,
  play: () => game.go(new Board(game, Date.now() % 1000000)),
  buttons: [["Today's valley", () => game.go(new Board(game, Number(dayKey().replaceAll("-", ""))))]],
});

class Board extends Scene {
  constructor(g, seed) { super(g); this.seed = seed; }
  enter() {
    if (!this.returning) {
      this.v = new Valley(this.seed);
      this.pick = 0;
      this.g.sound.music(compose(this.seed % 40, 76, 130));
    }
    this.returning = false;
    this.layout();
  }
  get cy() { return (106 + this.g.H - 140) / 2; }
  pos(q, r) { return { x: 195 + S * Math.sqrt(3) * (q + r / 2), y: this.cy + S * 1.5 * r }; }
  layout() {
    const g = this.g, v = this.v, ui = this.ui;
    ui.clear();
    const y = g.H - 104;
    v.hand.forEach((kind, i) => {
      const b = ui.button(22 + i * 92, y, 84, 92, TILES[kind].name, () => { this.pick = i; this.layout(); }, {
        stroke: this.pick === i ? "#fff" : undefined,
        draw: (c) => {
          hexPath(c, b.x + 42, b.y + 36, 22);
          c.fillStyle = TILES[kind].color;
          c.fill();
          text(c, TILES[kind].name, b.x + 42, b.y + 74, { size: 12, weight: 700 });
        },
      });
    });
    ui.button(300, y, 68, 92, "Redraw", () => { if (v.reroll()) { this.layout(); g.sound.play("ok"); } }, { sub: `${v.rerolls} left`, size: 12, disabled: v.rerolls <= 0 });
    ui.button(g.W - 70, 8, 60, 32, "Help", () => { this.returning = true; g.go(new Help(g, HELP, this)); }, { size: 12 });
  }
  cellAt(p) {
    let best = null, bd = S * 1.05;
    for (const [q, r] of allCells()) {
      const a = this.pos(q, r);
      const d = Math.hypot(a.x - p.x, a.y - p.y);
      if (d < bd) { bd = d; best = [q, r]; }
    }
    return best;
  }
  down(p) { this.hover = this.cellAt(p); }
  move(p) { if (this.hover) this.hover = this.cellAt(p) || this.hover; }
  up(p) {
    const cell = this.cellAt(p) || null;
    this.hover = null;
    if (!cell) return;
    const g = this.g, v = this.v;
    const [q, r] = cell;
    if (!v.canPlace(q, r)) { const t = v.cells.get(key(q, r)); if (t) this.info = t; return; }
    const gain = v.gain(v.hand[this.pick], q, r);
    const before = v.season;
    v.place(this.pick, q, r);
    g.sound.play("tap");
    g.buzz(10);
    const a = this.pos(q, r);
    if (gain) g.fx.float(a.x, a.y - 10, (gain > 0 ? "+" : "") + gain, gain > 0 ? g.theme.gold : "#fda4af", 15);
    this.pick = Math.min(this.pick, v.hand.length - 1);
    if (v.state === "over") return this.finish();
    if (v.season !== before) { g.sound.play("win"); this.banner = 1.8; }
    this.layout();
  }
  finish() {
    const g = this.g, v = this.v;
    g.sound.stopMusic();
    const total = v.total();
    data.best = Math.max(data.best, total);
    data.played++;
    g.store.save();
    g.go(new Result(g, {
      title: v.rank(),
      lines: [`Harvest ${total}`, v.log.map((s) => `${s.name} ${s.pts}`).join(", "), `Goals: ${v.met.length} of ${v.goals.length}, +${v.goalPoints}`, `Best ${data.best}`],
      buttons: [["New year", () => g.go(new Board(g, Date.now() % 1000000)), "primary"], ["Menu", () => g.go(title())]],
    }));
  }
  update(dt) { this.banner = Math.max(0, (this.banner || 0) - dt); }
  draw(c) {
    const g = this.g, v = this.v, season = v.seasonInfo;
    backdrop(c, g, this.t * 0.2);
    text(c, season.name, 14, 18, { size: 18, align: "left", weight: 800 });
    text(c, season.text, 14, 38, { size: 11, align: "left", color: g.theme.accent });
    text(c, `${boardScore(v, season)}`, 195, 16, { size: 19, weight: 800, color: g.theme.gold });
    text(c, `this season, ${v.banked} banked`, 195, 35, { size: 10, color: g.theme.muted });
    const left = TURNS_PER_SEASON - (v.turn % TURNS_PER_SEASON);
    text(c, `${left} tile${left === 1 ? "" : "s"} to go`, g.W - 76, 18, { size: 11, align: "right", color: g.theme.muted });
    v.goals.forEach((o, i) => {
      const done = o.test(v);
      text(c, `${done ? "[x]" : "[ ]"} ${o.text}  +${o.points}`, 14, 54 + i * 15, { size: 11, align: "left", color: done ? "#bef264" : g.theme.muted });
    });
    const hand = v.hand[this.pick];
    for (const [q, r] of allCells()) {
      const a = this.pos(q, r);
      const t = v.cells.get(key(q, r));
      hexPath(c, a.x, a.y, S - 1);
      c.fillStyle = t ? TILES[t.kind].color : "rgba(255,255,255,.07)";
      c.fill();
      if (t) {
        const sc = scoreTile(v, t);
        if (sc) text(c, String(sc), a.x, a.y + 1, { size: 12, color: "#0f1f07", weight: 800 });
        if (t.kind === "peak") { c.fillStyle = "#64748b"; c.beginPath(); c.moveTo(a.x - 9, a.y + 7); c.lineTo(a.x, a.y - 9); c.lineTo(a.x + 9, a.y + 7); c.closePath(); c.fill(); }
      }
    }
    if (this.hover && hand) {
      const [q, r] = this.hover;
      const a = this.pos(q, r);
      if (v.canPlace(q, r)) {
        hexPath(c, a.x, a.y, S - 1);
        c.fillStyle = TILES[hand].color + "cc";
        c.fill();
        const n = v.gain(hand, q, r);
        panel(c, a.x - 22, a.y - 44, 44, 24, "#0b1020", 8);
        text(c, (n > 0 ? "+" : "") + n, a.x, a.y - 32, { size: 14, weight: 800, color: n > 0 ? g.theme.gold : "#fda4af" });
      }
    }
    const y = g.H - 136;
    if (hand) para(c, TILES[hand].about, g.W / 2, y, 350, { size: 12, color: g.theme.ink, align: "center" });
    if (this.banner > 0) {
      c.globalAlpha = Math.min(1, this.banner);
      panel(c, 45, 250, 300, 90, g.theme.panel, 16, g.theme.line);
      text(c, season.name, g.W / 2, 282, { size: 26, weight: 800 });
      text(c, season.text, g.W / 2, 314, { size: 14, color: g.theme.accent });
      c.globalAlpha = 1;
    }
  }
}

game.start(title());
