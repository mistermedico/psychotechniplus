import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { attentionForms, visualSearchItems } from '../data/attentionTests.ts';

const expected = [
  { exact: '27', either: ['37', '74'], reverse: '94' },
  { exact: '63', either: ['16', '81'], reverse: '62' },
  { exact: '38', either: ['24', '92'], reverse: '78' },
  { exact: '94', either: ['53', '68'], reverse: '81' },
];

test('visual search has four progressively larger sets of five unique mechanics', () => {
  assert.deepEqual(attentionForms.map(form => form.items.length), [12, 12]);
  assert.equal(visualSearchItems.length, 20);
  assert.equal(new Set(visualSearchItems.map(item => item.id)).size, 20);
  assert.equal(new Set(visualSearchItems.map(item => JSON.stringify(item.board))).size, 20);
  const counts = new Map();
  for (const item of visualSearchItems) {
    counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
    const width = item.board[0].tokens.length;
    assert.ok(item.board.every(row => row.tokens.length === width));
    assert.ok(item.board.flatMap(row => row.tokens).every(token => /^[1-9]{2}$/.test(token)));
    const area = item.board.length * width;
    const round = Number(item.id.at(-1)) - 1;
    assert.equal(area, [12, 15, 20, 25][round]);
    assert.ok(item.targets.length > 0 && item.targets.length < area);
    assert.deepEqual(item.targets, [...new Set(item.targets)].sort((a, b) => a - b));
    assert.ok(item.targets.every(index => Number.isInteger(index) && index >= 0 && index < area));
  }
  assert.deepEqual([...counts.values()], [4, 4, 4, 4, 4]);
});

test('every answer key matches its visual rule and the explanation counts each row', () => {
  for (const item of visualSearchItems) {
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
