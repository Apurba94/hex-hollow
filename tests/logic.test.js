import assert from "node:assert/strict";
import test from "node:test";
import { GOALS, RADIUS, SEASONS, TILES, TURNS_PER_SEASON, Valley, allCells, boardScore, botMove, groups, key, largest, neighbours, onBoard, scoreTile } from "../src/logic.js";

function board(tiles) {
  const v = new Valley(1);
  v.cells = new Map();
  for (const [q, r, kind] of tiles) v.cells.set(key(q, r), { q, r, kind });
  return v;
}
const score = (v, q, r) => scoreTile(v, v.cells.get(key(q, r)));

test("the board is a hexagon", () => {
  assert.equal(allCells().length, 1 + 3 * RADIUS * (RADIUS + 1));
  assert.ok(onBoard(RADIUS, -RADIUS));
  assert.equal(onBoard(RADIUS, 1), false);
  assert.equal(neighbours(0, 0).length, 6);
  assert.equal(neighbours(RADIUS, 0).length, 3);
});

test("every tile named in a season exists", () => {
  for (const s of SEASONS) {
    assert.ok(TILES[s.bonus]);
    for (const k of Object.keys(s.weights)) assert.ok(TILES[k], k);
  }
});

test("meadows like green and water", () => {
  const v = board([[0, 0, "meadow"], [1, 0, "meadow"], [0, 1, "grove"], [-1, 0, "river"], [0, -1, "mine"]]);
  assert.equal(score(v, 0, 0), 3);
});

test("groves cap at 8 and enjoy peaks", () => {
  const v = board([[0, 0, "grove"], ...neighbours(0, 0).map(([q, r]) => [q, r, "grove"])]);
  assert.equal(score(v, 0, 0), 8);
  assert.equal(score(board([[0, 0, "grove"], [1, 0, "peak"]]), 0, 0), 2);
});

test("river tiles are worth more in a longer stream", () => {
  const v = board([[0, 0, "river"], [1, 0, "river"], [2, 0, "river"], [-3, 0, "river"]]);
  assert.equal(score(v, 0, 0), 4);
  assert.equal(score(v, -3, 0), 0);
  assert.equal(largest(v, "river"), 3);
  assert.equal(groups(v, "river").length, 2);
});

test("huts like meadows and dislike mines, but never go negative", () => {
  assert.equal(score(board([[0, 0, "hut"], [1, 0, "meadow"], [0, 1, "river"]]), 0, 0), 6);
  assert.equal(score(board([[0, 0, "hut"], [1, 0, "meadow"], [0, 1, "mine"]]), 0, 0), 1);
  assert.equal(score(board([[0, 0, "hut"], [0, 1, "mine"]]), 0, 0), 0);
});

test("mines want peaks and a hut for workers", () => {
  assert.equal(score(board([[0, 0, "mine"], [1, 0, "peak"], [0, 1, "peak"], [-1, 0, "hut"]]), 0, 0), 10);
});

test("markets count variety, shrines demand it", () => {
  assert.equal(score(board([[0, 0, "market"], [1, 0, "hut"], [0, 1, "hut"], [-1, 0, "river"]]), 0, 0), 8);
  assert.equal(score(board([[0, 0, "shrine"], [1, 0, "hut"], [0, 1, "river"]]), 0, 0), 9);
  assert.equal(score(board([[0, 0, "shrine"], [1, 0, "hut"], [0, 1, "hut"]]), 0, 0), 0);
});

test("a season doubles its favourite tile", () => {
  const v = board([[0, 0, "meadow"], [1, 0, "meadow"]]);
  assert.equal(boardScore(v), 2);
  assert.equal(boardScore(v, SEASONS[0]), 4);
  assert.equal(boardScore(v, SEASONS[3]), 2);
});

test("a new valley is the same for a seed, with fixed peaks and three goals", () => {
  const a = new Valley(5), b = new Valley(5);
  assert.deepEqual([...a.cells.keys()], [...b.cells.keys()]);
  assert.deepEqual(a.hand, b.hand);
  assert.equal(a.cells.size, 4);
  assert.equal(a.goals.length, 3);
  assert.equal(a.hand.length, 3);
});

test("placing uses a tile from the hand, and taken spaces are refused", () => {
  const v = new Valley(3);
  const [q, r] = allCells().find(([a, b]) => v.canPlace(a, b));
  assert.ok(v.place(0, q, r));
  assert.equal(v.hand.length, 3);
  assert.equal(v.turn, 1);
  assert.equal(v.place(0, q, r), false);
  assert.equal(v.place(9, 0, 0), false);
  assert.equal(v.turn, 1);
});

test("the preview matches what placing really adds and leaves the board alone", () => {
  const v = new Valley(3);
  const [q, r] = allCells().find(([a, b]) => v.canPlace(a, b));
  const size = v.cells.size, before = boardScore(v), kind = v.hand[0];
  const g = v.gain(kind, q, r);
  assert.equal(v.cells.size, size);
  v.cells.set(key(q, r), { q, r, kind });
  assert.equal(boardScore(v) - before, g);
});

test("redraws are limited", () => {
  const v = new Valley(2);
  assert.ok(v.reroll());
  assert.ok(v.reroll());
  assert.equal(v.reroll(), false);
});

test("a year runs four seasons and banks each one", () => {
  const v = new Valley(4);
  let turns = 0;
  while (v.state === "playing") { assert.ok(botMove(v)); turns++; }
  assert.equal(turns, TURNS_PER_SEASON * SEASONS.length);
  assert.deepEqual(v.log.map((s) => s.name), SEASONS.map((s) => s.name));
  assert.equal(v.banked, v.log.reduce((a, s) => a + s.pts, 0));
  assert.equal(v.total(), v.banked + v.goalPoints);
});

test("goals are checked at the end of the year", () => {
  const stream = GOALS.find((g) => g.id === "stream");
  assert.equal(stream.test(board([[0, 0, "river"], [1, 0, "river"]])), false);
  assert.ok(stream.test(board([0, 1, 2, 3, -1, -2].map((q) => [q, 0, "river"]))));
  assert.ok(GOALS.find((g) => g.id === "pilgrim").test(board([[RADIUS, 0, "shrine"]])));
  assert.equal(GOALS.find((g) => g.id === "pilgrim").test(board([[0, 0, "shrine"]])), false);
});

test("thinking pays: a greedy player beats a random one, and ranks are reachable", () => {
  const greedy = [], random = [];
  for (let seed = 1; seed <= 25; seed++) {
    const v = new Valley(seed);
    while (v.state === "playing") botMove(v);
    greedy.push(v.total());
    const w = new Valley(seed);
    let s = seed;
    while (w.state === "playing") {
      const free = allCells().filter(([q, r]) => w.canPlace(q, r));
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      w.place(0, ...free[s % free.length]);
    }
    random.push(w.total());
  }
  const mean = (a) => a.reduce((x, y) => x + y) / a.length;
  assert.ok(mean(greedy) > mean(random) * 1.4, `${mean(greedy)} against ${mean(random)}`);
  assert.ok(mean(greedy) >= 500, String(mean(greedy)));
  assert.ok(Math.max(...greedy) < 1500);
  assert.ok(mean(random) < 400, "careless play stays at the bottom of the ranks");
});
