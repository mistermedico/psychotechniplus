import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { attentionForms, visualSearchItems } from '../data/attentionTests.ts';

const expected = [
  { exact: '27', either: ['37', '74'], reverse: '94' },
  { exact: '63', either: ['16', '81'], reverse: '62' },
  { exact: '38', either: ['24', '92'], reverse: '78' },
  { exact: '94', either: ['53', '68'], reverse: '81' },
];

const originalItems = visualSearchItems.slice(0, 20);
const expansionItems = visualSearchItems.slice(20);

test('visual search has 48 unique boards, with four rounds of each of 12 mechanics', () => {
  assert.deepEqual(attentionForms.map(form => form.items.length), [12, 12]);
  assert.equal(visualSearchItems.length, 48);
  assert.equal(new Set(visualSearchItems.map(item => item.id)).size, 48);
  assert.equal(new Set(visualSearchItems.map(item => JSON.stringify(item.board))).size, 48);
  const counts = new Map();
  for (const item of visualSearchItems) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    const width = item.board[0].tokens.length;
    assert.ok(item.board.every(row => row.tokens.length === width));
    const format = item.id.startsWith('visual-feature-') ? /^[○△□◇][1-9]$/u : /^[1-9]{2}$/;
    assert.ok(item.board.flatMap(row => row.tokens).every(token => format.test(token)));
    const area = item.board.length * width;
    const round = Number(item.id.at(-1)) - 1;
    assert.equal(area, (originalItems.includes(item) ? [12, 15, 20, 25] : [12, 20, 20, 25])[round]);
    assert.ok(item.targets.length > 0 && item.targets.length < area);
    assert.deepEqual(item.targets, [...new Set(item.targets)].sort((a, b) => a - b));
    assert.ok(item.targets.every(index => Number.isInteger(index) && index >= 0 && index < area));
  }
  assert.equal(counts.size, 12);
  assert.ok([...counts.values()].every(count => count === 4));
});

test('original answer keys match their five rules and each row count', () => {
  for (const item of originalItems) {
    const [, mechanic, round] = item.id.split('-');
    const fixture = expected[Number(round) - 1];
    const cells = item.board.flatMap(({ cue, tokens }, row) => tokens.map(token => ({ token, row, cue })));
    const freq = {};
    for (const { token } of cells) freq[token] = (freq[token] ?? 0) + 1;
    const allowed = ({ token, cue }) => {
      switch (mechanic) {
        case 'exact': return token === fixture.exact;
        case 'either': return fixture.either.includes(token);
        case 'unique': return freq[token] === 1;
        case 'reverse': return token === fixture.reverse;
        case 'order': {
          const left = Math.floor(Number(token) / 10);
          const right = Number(token) % 10;
          if (cue === 'עולה') return left < right;
          assert.equal(cue, 'יורד');
          return left > right;
        }
        default: assert.fail('unknown visual question type');
      }
    };
    const matches = cells.reduce((out, cell, i) => allowed(cell) ? [...out, i] : out, []);
    assert.deepEqual(item.targets, matches, item.id);
    if (mechanic === 'unique') assert.equal(matches.length, 1);
    if (mechanic === 'either') assert.deepEqual(new Set(matches.map(i => cells[i].token)), new Set(fixture.either));
    if (mechanic === 'order') assert.equal(new Set(item.board.map(row => row.cue)).size, 2);
    const rowCounts = item.board.map((_, row) => matches.filter(i => cells[i].row === row).length);
    assert.ok(item.explanation.includes(`סומנו ${matches.length} תאי מטרה`), item.id);
    assert.ok(item.explanation.endsWith(`${rowCounts.join(', ')}.`), item.id);
  }
});

const shapeRules = [['○', 0], ['△', 1], ['□', 0], ['◇', 1]];
test('expansion answer keys are independently solved from board coordinates and clues', () => {
  assert.equal(expansionItems.length, 28);
  for (const item of expansionItems) {
    const [, mechanic, round] = item.id.split('-');
    const rows = item.board.map(row => row.tokens);
    const width = rows[0].length;
    const keys = new Set();
    const add = (row, col) => keys.add(row * width + col);
    switch (mechanic) {
      case 'twin':
        rows.forEach((row, y) => row.slice(1).forEach((cell, x) => {
          if (cell === row[x]) { add(y, x); add(y, x + 1); }
        }));
        break;
      case 'position':
        rows.forEach((row, y) => {
          const reversed = row.toReversed();
          for (let x = 0; x < Math.floor(width / 2); x++) {
            if (row[x] === reversed[x]) { add(y, x); add(y, width - 1 - x); }
          }
        });
        break;
      case 'peak':
        rows.forEach((row, y) => {
          for (let i = 0; i < width - 2; i++) {
            const [a, b, c] = row.slice(i, i + 3).map(Number);
            if (Math.max(a, c) < b) add(y, i + 1);
          }
        });
        break;
      case 'column':
        for (let x = 0; x < width; x++) {
          const occurrences = Object.groupBy(rows.keys().toArray(), y => rows[y][x]);
          for (const ys of Object.values(occurrences)) if (ys.length === 2) ys.forEach(y => add(y, x));
        }
        break;
      case 'feature': {
        const [shape, parity] = shapeRules[Number(round) - 1];
        assert.ok(item.prompt.includes(shape));
        assert.ok(item.prompt.includes(parity === 0 ? 'ספרה זוגית' : 'ספרה אי־זוגית'));
        rows.forEach((row, y) => row.forEach((cell, x) => {
          if (cell[0] === shape && Number(cell[1]) % 2 === parity) add(y, x);
        }));
        assert.ok(rows.flat().some(([g, n]) => g === shape && Number(n) % 2 !== parity));
        assert.ok(rows.flat().some(([g, n]) => g !== shape && Number(n) % 2 === parity));
        break;
      }
      case 'above':
        rows.slice(0, -1).forEach((row, y) => row.forEach((cell, x) => {
          const number = Number(cell);
          const [tens, ones] = [Math.floor(number / 10), number % 10];
          if (tens !== ones && ones * 10 + tens === Number(rows[y + 1][x])) add(y + 1, x);
        }));
        break;
      case 'ending':
        assert.equal(new Set(item.board.map(row => row.cue)).size, rows.length);
        for (const [y, row] of item.board.entries()) {
          assert.match(row.cue, /^סיומת [1-9]$/u);
          const digit = Number(row.cue.at(-1));
          row.tokens.forEach((cell, x) => { if (Number(cell) % 10 === digit) add(y, x); });
          assert.ok(row.tokens.some(cell => Math.floor(Number(cell) / 10) === digit && Number(cell) % 10 !== digit));
        }
        break;
      default: assert.fail('unknown expansion mechanic');
    }
    const solved = [...keys].sort((a, b) => a - b);
    assert.deepEqual(item.targets, solved, item.id);
    const rowCounts = rows.map((_, y) => solved.filter(i => Math.floor(i / width) === y).length);
    assert.ok(item.explanation.includes(`סומנו ${solved.length} תאי מטרה`), item.id);
    assert.ok(item.explanation.endsWith(`${rowCounts.join(', ')}.`), item.id);
  }
});
