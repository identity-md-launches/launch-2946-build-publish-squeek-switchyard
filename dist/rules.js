// @ts-check
// Pure game logic: no DOM and no network, so it runs in the browser and under `node --test`.
// All block arithmetic uses BigInt, because the API reports counts as decimal strings.

export const API_URL = 'https://api.squeekchain.com/v1/settlements';
export const SEPOLIA_CHAIN_ID = '11155111';
export const WAGON_COUNT = 5;
export const TUNNELS = ['A', 'B', 'C'];
export const PRACTICE_BLOCKS = [48n, 41n, 44n, 41n, 45n];

/**
 * @typedef {object} Wagon
 * @property {string} id
 * @property {bigint} blocks
 * @property {bigint | null} fromRound
 * @property {bigint | null} toRound
 * @property {bigint | null} workAdded
 * @property {string | null} txHash
 * @property {string | null} receiptUrl
 *
 * @typedef {{ kind: 'live' | 'practice', wagons: readonly Wagon[] }} Board
 * @typedef {{ board: Board, capacities: bigint[], assignment: number[] }} Game
 */

/**
 * Reads a non-negative whole number. Anything else, including an absent value, is unknown (null).
 * Zero stays zero, so a reported 0 is never mistaken for a missing value.
 * @param {unknown} value
 * @returns {bigint | null}
 */
export function parseCount(value) {
  if (typeof value === 'bigint') return value >= 0n ? value : null;
  if (typeof value === 'number') return Number.isSafeInteger(value) && value >= 0 ? BigInt(value) : null;
  if (typeof value === 'string' && /^\d+$/.test(value)) return BigInt(value);
  return null;
}

// ASSUMPTION, not checked against a live response (see VALIDATION.md): the brief says "safe" rows
// but does not name the field. A row with no recognised signal is rejected, so a mismatch shows the
// unavailable state and never presents unconfirmed rows as safe.
const SAFE_WORDS = new Set(['safe', 'finalized']);
const ROW_SAFETY_FIELDS = ['finality', 'safety', 'blockTag', 'confirmationStatus', 'status'];
const PAYLOAD_SAFETY_FIELDS = ['finality', 'safety', 'blockTag'];

/**
 * @param {Record<string, unknown>} row
 * @param {Record<string, unknown>} payload
 */
function isSafeRow(row, payload) {
  for (const flag of ['safe', 'isSafe']) {
    if (typeof row[flag] === 'boolean') return row[flag];
  }
  for (const field of ROW_SAFETY_FIELDS) {
    const word = row[field];
    if (typeof word === 'string') return SAFE_WORDS.has(word.toLowerCase());
  }
  for (const field of PAYLOAD_SAFETY_FIELDS) {
    const word = payload[field];
    if (typeof word === 'string') return SAFE_WORDS.has(word.toLowerCase());
  }
  return false;
}

/** @param {unknown} value @returns {value is Record<string, unknown>} */
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);

/** @param {bigint | null} a @param {bigint | null} b */
function compareRounds(a, b) {
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
}

/**
 * Applies the brief's selection: status and chain gates, safe rows with positive blocks, dedupe by
 * transactionHash + logIndex, the latest five, then oldest first.
 * @param {unknown} payload
 * @returns {{ ok: true, board: Board } | { ok: false, reason: string }}
 */
export function selectBoard(payload) {
  if (!isRecord(payload)) return { ok: false, reason: 'The API answer was not a settlements object.' };
  if (payload.status !== 'available') {
    return { ok: false, reason: `The API status is ${String(payload.status ?? 'missing')}, not available.` };
  }
  const chainId = isRecord(payload.chain) ? payload.chain.chainId : undefined;
  if (String(chainId) !== SEPOLIA_CHAIN_ID) {
    return { ok: false, reason: `The API chain is ${String(chainId ?? 'missing')}, not Sepolia (${SEPOLIA_CHAIN_ID}).` };
  }
  if (!Array.isArray(payload.recentSettlements)) {
    return { ok: false, reason: 'The API answer has no recentSettlements list.' };
  }

  /** @type {Map<string, Wagon & { logIndexValue: bigint | null }>} */
  const unique = new Map();
  for (const row of payload.recentSettlements) {
    if (!isRecord(row) || !isSafeRow(row, payload)) continue;
    const blocks = parseCount(row.completedBlockCount);
    const txHash = row.transactionHash;
    if (blocks === null || blocks <= 0n) continue;
    if (typeof txHash !== 'string' || !/^0x[0-9a-fA-F]{64}$/.test(txHash)) continue;
    const logIndexValue = parseCount(row.logIndex);
    const id = `${txHash.toLowerCase()}:${logIndexValue ?? 'unknown'}`;
    if (unique.has(id)) continue;
    const previous = parseCount(row.previousSettledThroughRound);
    unique.set(id, {
      id,
      blocks,
      fromRound: previous === null ? null : previous + 1n,
      toRound: parseCount(row.settledThroughRound),
      workAdded: parseCount(row.workAdded),
      txHash,
      receiptUrl: `https://sepolia.etherscan.io/tx/${txHash}`,
      logIndexValue,
    });
  }

  const eligible = [...unique.values()].sort(
    (a, b) => compareRounds(a.toRound, b.toRound) || compareRounds(a.logIndexValue, b.logIndexValue),
  );
  if (eligible.length < WAGON_COUNT) {
    const reported = payload.recentSettlements.length;
    return {
      ok: false,
      reason: `The API reported ${reported} settlements and ${eligible.length} qualify. A game needs ${WAGON_COUNT}.`,
    };
  }
  const wagons = eligible.slice(-WAGON_COUNT).map(({ logIndexValue: _unused, ...wagon }) => Object.freeze(wagon));
  return { ok: true, board: Object.freeze({ kind: 'live', wagons: Object.freeze(wagons) }) };
}

/** @returns {Board} */
export function practiceBoard() {
  const wagons = PRACTICE_BLOCKS.map((blocks, index) =>
    Object.freeze({
      id: `practice-${index + 1}`,
      blocks,
      fromRound: null,
      toRound: null,
      workAdded: null,
      txHash: null,
      receiptUrl: null,
    }),
  );
  return Object.freeze({ kind: 'practice', wagons: Object.freeze(wagons) });
}

/** @param {readonly bigint[]} blocks @returns {bigint[]} */
export function capacitiesFor(blocks) {
  const total = blocks.reduce((sum, count) => sum + count, 0n);
  const first = (45n * total) / 100n;
  const second = (33n * total) / 100n;
  return [first, second, total - first - second];
}

/**
 * @param {readonly bigint[]} blocks
 * @param {readonly number[]} routing tunnel index per wagon, possibly partial
 * @returns {bigint[]}
 */
export function loadsFor(blocks, routing) {
  const loads = TUNNELS.map(() => 0n);
  routing.forEach((tunnel, wagon) => {
    loads[tunnel] += blocks[wagon];
  });
  return loads;
}

/** @param {readonly bigint[]} loads @param {readonly bigint[]} capacities */
export function overflowFor(loads, capacities) {
  return loads.reduce((sum, load, tunnel) => sum + (load > capacities[tunnel] ? load - capacities[tunnel] : 0n), 0n);
}

/**
 * Enumerates every routing (3^5 for five wagons). Ties keep the first routing found, with the first
 * wagon as the most significant digit, so the answer is the same on every run.
 * @param {readonly bigint[]} blocks
 * @param {readonly bigint[]} capacities
 */
export function solve(blocks, capacities) {
  const checked = TUNNELS.length ** blocks.length;
  /** @type {bigint | null} */
  let best = null;
  /** @type {number[]} */
  let routing = [];
  for (let code = 0; code < checked; code += 1) {
    const candidate = new Array(blocks.length).fill(0);
    let rest = code;
    for (let wagon = blocks.length - 1; wagon >= 0; wagon -= 1) {
      candidate[wagon] = rest % TUNNELS.length;
      rest = Math.floor(rest / TUNNELS.length);
    }
    const score = overflowFor(loadsFor(blocks, candidate), capacities);
    if (best === null || score < best) {
      best = score;
      routing = candidate;
    }
  }
  return { best: best ?? 0n, routing, checked };
}

/** @param {Board} board @returns {Game} */
export function createGame(board) {
  const blocks = board.wagons.map((wagon) => wagon.blocks);
  return { board, capacities: capacitiesFor(blocks), assignment: [] };
}

/** @param {Game} game */
export const isDone = (game) => game.assignment.length === game.board.wagons.length;

/** @param {Game} game @param {number} tunnel @returns {Game} */
export function assign(game, tunnel) {
  if (isDone(game) || !Number.isInteger(tunnel) || tunnel < 0 || tunnel >= TUNNELS.length) return game;
  return { ...game, assignment: [...game.assignment, tunnel] };
}

/** @param {Game} game @returns {Game} */
export const undo = (game) => ({ ...game, assignment: game.assignment.slice(0, -1) });

/** Clears the routing and keeps the same frozen board. @param {Game} game @returns {Game} */
export const replay = (game) => ({ ...game, assignment: [] });

/** @param {Game} game */
export function tunnelStats(game) {
  const blocks = game.board.wagons.map((wagon) => wagon.blocks);
  return loadsFor(blocks, game.assignment).map((load, tunnel) => {
    const capacity = game.capacities[tunnel];
    return { load, capacity, overflow: load > capacity ? load - capacity : 0n };
  });
}

/** @param {Game} game */
export function currentOverflow(game) {
  return tunnelStats(game).reduce((sum, stat) => sum + stat.overflow, 0n);
}

/** @param {Game} game */
export function summarize(game) {
  const blocks = game.board.wagons.map((wagon) => wagon.blocks);
  const { best, routing, checked } = solve(blocks, game.capacities);
  const player = currentOverflow(game);
  return { player, best, routing, checked, gap: player - best };
}

/** @param {bigint | null} value */
export const formatCount = (value) => (value === null ? 'unknown' : value.toLocaleString('en-US'));

/** @param {bigint} value */
export const formatBlocks = (value) => `${formatCount(value)} ${value === 1n ? 'block' : 'blocks'}`;

/** @param {number} seconds */
export const formatClock = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** @param {Wagon} wagon */
export function formatRounds(wagon) {
  if (wagon.fromRound === null && wagon.toRound === null) return 'unknown';
  return `${formatCount(wagon.fromRound)} to ${formatCount(wagon.toRound)}`;
}
