import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assign,
  capacitiesFor,
  createGame,
  currentOverflow,
  formatCount,
  formatRounds,
  isDone,
  parseCount,
  practiceBoard,
  replay,
  selectBoard,
  solve,
  summarize,
  tunnelStats,
  undo,
} from '../src/rules.js';

const FIXTURE = [48n, 41n, 44n, 41n, 45n];
const hash = (n) => `0x${String(n).padStart(64, '0')}`;
const row = (n, extra = {}) => ({
  safe: true,
  transactionHash: hash(n),
  logIndex: 0,
  completedBlockCount: String(10 + n),
  previousSettledThroughRound: String(n * 100),
  settledThroughRound: String((n + 1) * 100),
  workAdded: String(n * 7),
  ...extra,
});
const payload = (rows, extra = {}) => ({
  status: 'available',
  chain: { chainId: 11155111 },
  recentSettlements: rows,
  ...extra,
});

test('fixture capacities are 98, 72 and 49', () => {
  assert.deepEqual(capacitiesFor(FIXTURE), [98n, 72n, 49n]);
});

test('fixture minimum overflow is 10 across all 243 routings', () => {
  const { best, routing, checked } = solve(FIXTURE, capacitiesFor(FIXTURE));
  assert.equal(best, 10n);
  assert.equal(checked, 243);
  assert.deepEqual(routing, [0, 1, 0, 1, 2]);
});

test('selection keeps the latest five, oldest first', () => {
  const result = selectBoard(payload([7, 1, 6, 2, 5, 3, 4].map((n) => row(n))));
  assert.equal(result.ok, true);
  assert.deepEqual(result.board.wagons.map((w) => w.toRound), [400n, 500n, 600n, 700n, 800n]);
});

test('the reported confirmationStatus safe field qualifies rows', () => {
  const rows = [1,2,3,4,5].map(n => {
    const candidate = row(n, {confirmationStatus:'safe'});
    delete candidate.safe;
    return candidate;
  });
  assert.equal(selectBoard(payload(rows)).ok, true);
  rows[4].confirmationStatus = 'pending';
  assert.equal(selectBoard(payload(rows)).ok, false);
});

test('selection dedupes on transactionHash plus logIndex only', () => {
  const rows = [row(1), row(1), row(1, { logIndex: 1 }), row(2), row(3), row(4)];
  const result = selectBoard(payload(rows));
  assert.equal(result.ok, true);
  assert.equal(result.board.wagons.length, 5);
  assert.equal(new Set(result.board.wagons.map((w) => w.id)).size, 5);
});

test('selection rejects unsafe, zero-block and unmarked rows', () => {
  const unmarked = row(5);
  delete unmarked.safe;
  const rows = [row(1), row(2), row(3), row(4), row(5, { safe: false }), row(6, { completedBlockCount: '0' }), unmarked];
  const result = selectBoard(payload(rows));
  assert.equal(result.ok, false);
  assert.match(result.reason, /7 settlements and 4 qualify/);
});

test('selection refuses a wrong status or chain', () => {
  const rows = [1, 2, 3, 4, 5].map((n) => row(n));
  assert.equal(selectBoard(payload(rows, { status: 'degraded' })).ok, false);
  assert.equal(selectBoard(payload(rows, { chain: { chainId: 1 } })).ok, false);
  assert.equal(selectBoard(payload(rows, { chain: undefined })).ok, false);
  assert.equal(selectBoard(null).ok, false);
});

test('absent values stay unknown and a reported zero stays zero', () => {
  const missing = row(1);
  delete missing.workAdded;
  delete missing.previousSettledThroughRound;
  delete missing.settledThroughRound;
  const zero = row(2, { workAdded: '0' });
  const result = selectBoard(payload([missing, zero, row(3), row(4), row(5)]));
  assert.equal(result.ok, true);
  const [first, second] = result.board.wagons;
  assert.equal(formatCount(first.workAdded), 'unknown');
  assert.equal(formatRounds(first), 'unknown');
  assert.equal(formatCount(second.workAdded), '0');
});

test('decimal strings beyond the safe integer range stay exact', () => {
  assert.equal(parseCount('9007199254740993'), 9007199254740993n);
  assert.equal(parseCount(9007199254740993), null);
  assert.equal(parseCount('-1'), null);
  assert.equal(parseCount('1.5'), null);
  assert.equal(parseCount(''), null);
  assert.equal(parseCount(undefined), null);
});

test('a game plays to completion and scores against the best result', () => {
  let game = createGame(practiceBoard());
  for (const tunnel of [0, 0, 1, 1, 2]) game = assign(game, tunnel);
  assert.equal(isDone(game), true);
  assert.deepEqual(tunnelStats(game).map((s) => s.load), [89n, 85n, 45n]);
  assert.equal(currentOverflow(game), 13n);
  const summary = summarize(game);
  assert.equal(summary.player, 13n);
  assert.equal(summary.best, 10n);
  assert.equal(summary.gap, 3n);
  assert.equal(assign(game, 0), game);
});

test('undo removes only the last assignment and replay keeps the same board', () => {
  const start = createGame(practiceBoard());
  const two = assign(assign(start, 0), 2);
  assert.deepEqual(undo(two).assignment, [0]);
  assert.deepEqual(undo(start).assignment, []);
  const replayed = replay(two);
  assert.deepEqual(replayed.assignment, []);
  assert.equal(replayed.board, start.board);
});
