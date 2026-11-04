// @ts-check
// DOM layer. Game state and scoring live in rules.js.
import {
  API_URL,
  TUNNELS,
  WAGON_COUNT,
  assign,
  createGame,
  currentOverflow,
  formatBlocks,
  formatClock,
  formatCount,
  formatRounds,
  isDone,
  practiceBoard,
  replay,
  selectBoard,
  summarize,
  tunnelStats,
  undo,
} from './rules.js';

const LIVE_TIMEOUT_MS = 10000;
const PRACTICE_VALUE = 'none (practice)';

/** @param {string} id @returns {any} */
const byId = (id) => document.getElementById(id);

/**
 * Children are appended as text nodes, so API values can never become markup.
 * @param {string} tag
 * @param {Record<string, string>} [props]
 * @param {(Node | string)[]} children
 * @returns {any}
 */
function h(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [name, value] of Object.entries(props)) {
    if (name === 'class') node.className = value;
    else node.setAttribute(name, value);
  }
  node.append(...children);
  return node;
}

/** @type {import('./rules.js').Game | null} */
let game = null;
let requestId = 0;
/** @type {number | null} */
let startedAt = null;
/** @type {number | null} */
let finishedAt = null;
/** @type {{ root: any, state: any, load: any, capacity: any, overflow: any, meter: any, button: any }[]} */
let tunnelNodes = [];
/** @type {any[]} */
let trainNodes = [];
/** @type {any[]} */
let manifestTunnelNodes = [];

/** @param {string} message */
function announce(message) {
  byId('announcer').textContent = message;
}

/** @param {'loading' | 'unavailable' | 'game'} view */
function show(view) {
  byId('view-loading').hidden = view !== 'loading';
  byId('view-unavailable').hidden = view !== 'unavailable';
  byId('view-game').hidden = view !== 'game';
}

function elapsedSeconds() {
  if (startedAt === null) return 0;
  return Math.floor(((finishedAt ?? performance.now()) - startedAt) / 1000);
}

function updateClock() {
  if (game) byId('clock').textContent = formatClock(elapsedSeconds());
}

/** @param {boolean} moveFocus */
async function loadLive(moveFocus) {
  requestId += 1;
  const thisRequest = requestId;
  if (game) {
    byId('refresh-status').textContent = 'Fetching a new board. You can keep dispatching.';
    byId('refresh-status').hidden = false;
  } else {
    document.body.dataset.board = 'none';
    show('loading');
  }
  announce('Fetching settlement batches.');

  /** @type {string} */
  let reason;
  try {
    const response = await fetch(API_URL, {
      method: 'GET',
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      cache: 'no-store',
      signal: AbortSignal.timeout(LIVE_TIMEOUT_MS),
    });
    if (!response.ok) {
      reason = `The API answered with HTTP ${response.status}.`;
    } else {
      const selection = selectBoard(await response.json());
      if (thisRequest !== requestId) return;
      if (selection.ok) {
        startBoard(selection.board, moveFocus);
        return;
      }
      reason = selection.reason;
    }
  } catch {
    reason = 'The API could not be reached, or its answer could not be read.';
  }
  if (thisRequest !== requestId) return;

  if (game) {
    const message = `Could not refresh: ${reason} You are still on the previous board. Try New game again.`;
    byId('refresh-status').textContent = message;
    announce(message);
    return;
  }

  byId('unavailable-reason').textContent = reason;
  show('unavailable');
  announce(`Live board unavailable. ${reason}`);
  if (moveFocus) byId('retry').focus();
}

/**
 * The board stays frozen until the next New game, which is the only thing that fetches again.
 * @param {import('./rules.js').Board} board
 * @param {boolean} moveFocus
 */
function startBoard(board, moveFocus) {
  game = createGame(board);
  startedAt = null;
  finishedAt = null;
  byId('refresh-status').hidden = true;
  byId('refresh-status').textContent = '';
  document.body.dataset.board = board.kind;
  buildBoard(game);
  show('game');
  render();
  announce(
    board.kind === 'practice'
      ? 'Practice board ready. These numbers are made up.'
      : 'Live board ready with five Sepolia settlement batches.',
  );
  if (moveFocus) tunnelNodes[0].button.focus();
}

/** @param {import('./rules.js').Game} current */
function buildBoard(current) {
  const practice = current.board.kind === 'practice';
  byId('practice-banner').hidden = !practice;
  byId('source-label').textContent = practice ? 'Practice board' : 'Live Sepolia data';
  byId('manifest-note').textContent = practice
    ? 'Practice wagons have no rounds, work or receipts.'
    : 'Every wagon links to its Sepolia Etherscan receipt. This board stays the same until you start a new game.';
  const total = current.board.wagons.reduce((sum, wagon) => sum + wagon.blocks, 0n);
  byId('total-blocks').textContent = `the ${formatBlocks(total)} on this board`;

  trainNodes = current.board.wagons.map((wagon, index) =>
    h(
      'li',
      { class: 'wagon' },
      h('span', { class: 'wagon-number' }, h('span', { class: 'visually-hidden' }, 'Wagon '), String(index + 1)),
      h('span', { class: 'wagon-blocks value' }, formatCount(wagon.blocks), h('span', { class: 'visually-hidden' }, ' blocks')),
      h('span', { class: 'wagon-state' }),
    ),
  );
  byId('train').replaceChildren(...trainNodes);

  tunnelNodes = TUNNELS.map((letter, tunnel) => {
    const state = h('p', { class: 'tunnel-state' });
    const load = h('dd', { class: 'value' });
    const capacity = h('dd', { class: 'value' });
    const overflow = h('dd', { class: 'value' });
    const meter = h('span', { class: 'meter-fill' });
    const button = h('button', { class: 'send', type: 'button' }, `Send to ${letter}`);
    button.addEventListener('click', () => dispatch(tunnel));
    const root = h(
      'li',
      { class: 'tunnel', 'data-tunnel': String(tunnel) },
      h('h3', {}, `Tunnel ${letter}`),
      state,
      h('span', { class: 'meter', 'aria-hidden': 'true' }, meter),
      h(
        'dl',
        { class: 'tunnel-facts' },
        h('div', {}, h('dt', {}, 'Load'), load),
        h('div', {}, h('dt', {}, 'Capacity'), capacity),
        h('div', {}, h('dt', {}, 'Overflow'), overflow),
      ),
      button,
    );
    return { root, state, load, capacity, overflow, meter, button };
  });
  byId('tunnels').replaceChildren(...tunnelNodes.map((node) => node.root));

  manifestTunnelNodes = [];
  byId('manifest').replaceChildren(
    ...current.board.wagons.map((wagon, index) => {
      const tunnelCell = h('dd', {});
      manifestTunnelNodes.push(tunnelCell);
      return h(
        'li',
        { class: 'manifest-row' },
        h('h3', {}, `Wagon ${index + 1}`),
        h(
          'dl',
          { class: 'facts' },
          h('div', {}, h('dt', {}, 'Blocks'), h('dd', { class: 'value' }, formatCount(wagon.blocks))),
          h('div', {}, h('dt', {}, 'Rounds'), h('dd', { class: 'value' }, roundsText(wagon))),
          h('div', {}, h('dt', {}, 'Work added'), h('dd', { class: 'value' }, workText(wagon))),
          h('div', {}, h('dt', {}, 'Tunnel'), tunnelCell),
          h(
            'div',
            {},
            h('dt', {}, 'Receipt'),
            h(
              'dd',
              {},
              wagon.receiptUrl
                ? h(
                    'a',
                    { class: 'link hash', href: wagon.receiptUrl, target: '_blank', rel: 'noopener noreferrer' },
                    h('span', { class: 'visually-hidden' }, `Wagon ${index + 1} receipt on Sepolia Etherscan: `),
                    wagon.txHash ?? '',
                  )
                : PRACTICE_VALUE,
            ),
          ),
        ),
      );
    }),
  );
}

/** @param {import('./rules.js').Wagon} wagon */
function roundsText(wagon) {
  return wagon.txHash ? formatRounds(wagon) : PRACTICE_VALUE;
}

/** @param {import('./rules.js').Wagon} wagon */
function workText(wagon) {
  return wagon.txHash ? formatCount(wagon.workAdded) : PRACTICE_VALUE;
}

function render() {
  if (!game) return;
  const current = game;
  const done = isDone(current);
  const position = current.assignment.length;
  const stats = tunnelStats(current);
  const nextWagon = done ? null : current.board.wagons[position];

  trainNodes.forEach((node, index) => {
    const tunnel = current.assignment[index];
    if (tunnel !== undefined) {
      node.dataset.state = 'sent';
      node.dataset.tunnel = String(tunnel);
    } else {
      node.dataset.state = index === position ? 'now' : 'waiting';
      delete node.dataset.tunnel;
    }
    const label = tunnel !== undefined ? `To ${TUNNELS[tunnel]}` : index === position ? 'Now' : 'Wait';
    node.querySelector('.wagon-state').textContent = label;
  });

  byId('current-title').textContent = nextWagon ? `Wagon ${position + 1} of ${WAGON_COUNT}` : 'All five wagons sent';
  byId('current-details').hidden = !nextWagon;
  const receipt = byId('current-receipt');
  const note = byId('current-note');
  if (nextWagon) {
    byId('current-blocks').textContent = formatCount(nextWagon.blocks);
    byId('current-rounds').textContent = roundsText(nextWagon);
    byId('current-work').textContent = workText(nextWagon);
  }
  if (nextWagon?.receiptUrl) {
    receipt.href = nextWagon.receiptUrl;
    receipt.textContent = `Open receipt for wagon ${position + 1}`;
    receipt.hidden = false;
    note.hidden = true;
  } else {
    receipt.removeAttribute('href');
    receipt.hidden = true;
    note.hidden = !done;
    note.textContent = 'See how your routing compares, then replay the board or start a new game.';
  }

  stats.forEach((stat, tunnel) => {
    const node = tunnelNodes[tunnel];
    const over = stat.overflow > 0n;
    const full = stat.load === stat.capacity;
    node.root.dataset.state = over ? 'over' : full ? 'full' : 'room';
    node.state.textContent = over ? 'Over' : full ? 'Full' : 'Room';
    node.load.textContent = formatCount(stat.load);
    node.capacity.textContent = formatCount(stat.capacity);
    node.overflow.textContent = formatCount(stat.overflow);
    const percent = stat.capacity === 0n ? (stat.load > 0n ? 100n : 0n) : (stat.load * 100n) / stat.capacity;
    node.meter.style.inlineSize = `${percent > 100n ? 100n : percent}%`;
    node.button.disabled = done;
    node.button.setAttribute(
      'aria-label',
      `Send to ${TUNNELS[tunnel]}, load ${formatCount(stat.load)} of ${formatCount(stat.capacity)}`,
    );
  });

  current.board.wagons.forEach((_wagon, index) => {
    const tunnel = current.assignment[index];
    manifestTunnelNodes[index].textContent = tunnel === undefined ? 'Not sent yet' : `Tunnel ${TUNNELS[tunnel]}`;
  });

  const last = current.assignment[position - 1];
  if (last === undefined) delete byId('rails').dataset.last;
  else byId('rails').dataset.last = String(last);
  byId('running-overflow').textContent = formatCount(currentOverflow(current));
  byId('undo').disabled = position === 0;
  updateClock();
  renderResult(current, done);
}

/**
 * @param {import('./rules.js').Game} current
 * @param {boolean} done
 */
function renderResult(current, done) {
  const section = byId('result');
  section.hidden = !done;
  if (!done) return;
  const { player, best, routing, checked, gap } = summarize(current);
  const seconds = elapsedSeconds();
  byId('result-title').textContent = `Your overflow: ${formatBlocks(player)}`;
  byId('result-verdict').textContent =
    gap === 0n ? 'You matched the best possible result.' : `You finished ${formatBlocks(gap)} above the best possible result.`;
  byId('result-best').textContent = formatBlocks(best);
  byId('result-time').textContent = `${formatClock(seconds)}, ${seconds < 60 ? 'under a minute' : 'over a minute'}`;
  byId('result-routing').replaceChildren(
    ...current.board.wagons.map((wagon, index) =>
      h(
        'tr',
        {},
        h('th', { scope: 'row' }, String(index + 1)),
        h('td', { class: 'value' }, formatCount(wagon.blocks)),
        h('td', {}, TUNNELS[current.assignment[index]]),
        h('td', {}, TUNNELS[routing[index]]),
      ),
    ),
  );
  byId('result-note').textContent = `Game-rule score, not protocol economics. Your browser checked all ${checked} routings to find the best.`;
}

/** @param {number} tunnel */
function dispatch(tunnel) {
  if (!game || isDone(game)) return;
  if (startedAt === null) startedAt = performance.now();
  const wagonNumber = game.assignment.length + 1;
  game = assign(game, tunnel);
  const stat = tunnelStats(game)[tunnel];
  if (isDone(game)) {
    finishedAt = performance.now();
    render();
    const { player, best } = summarize(game);
    announce(`Your overflow is ${formatBlocks(player)}. Best possible is ${formatBlocks(best)}.`);
    byId('result-title').focus();
    return;
  }
  render();
  announce(
    `Wagon ${wagonNumber} sent to tunnel ${TUNNELS[tunnel]}. Load ${formatCount(stat.load)} of ${formatCount(stat.capacity)}. Wagon ${wagonNumber + 1} is next.`,
  );
}

function undoLast() {
  if (!game || game.assignment.length === 0) return;
  const wagonNumber = game.assignment.length;
  game = undo(game);
  // Resume from the stopped time, excluding the time spent reading the result.
  if (finishedAt !== null && startedAt !== null) startedAt += performance.now() - finishedAt;
  finishedAt = null;
  render();
  announce(`Wagon ${wagonNumber} is back on the line.`);
  // The result heading or the Undo button itself may have just been hidden or disabled.
  if (byId('undo').disabled || document.activeElement === document.body) tunnelNodes[0].button.focus();
}

function replayBoard() {
  if (!game) return;
  game = replay(game);
  startedAt = null;
  finishedAt = null;
  render();
  announce('Same board, empty tunnels. Wagon 1 is next.');
  tunnelNodes[0].button.focus();
}

/** @param {KeyboardEvent} event */
function onKeydown(event) {
  if (!byId('shortcuts').checked || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
  if (!game || byId('view-game').hidden) return;
  const key = event.key.toLowerCase();
  if (key === '1' || key === '2' || key === '3') dispatch(Number(key) - 1);
  else if (key === 'u') undoLast();
  else if (key === 'r') replayBoard();
  else if (key === 'n') loadLive(true);
}

byId('retry').addEventListener('click', () => loadLive(true));
byId('practice').addEventListener('click', () => {
  requestId += 1;
  startBoard(practiceBoard(), true);
});
byId('undo').addEventListener('click', undoLast);
byId('replay').addEventListener('click', replayBoard);
byId('new-game').addEventListener('click', () => loadLive(true));
document.addEventListener('keydown', onKeydown);
setInterval(updateClock, 1000);

loadLive(false);
