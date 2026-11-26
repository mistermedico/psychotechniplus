import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reasoningForms, scoreReasoning } from '../data/reasoningTests.ts';
import { minutesForForm, remainingMs, timerText } from '../data/reasoningClock.ts';

test('only IQ forms have time limits; the absolute deadline survives delayed ticks',()=>{
  assert.deepEqual(reasoningForms.map(f=>minutesForForm(f.id)),[20,18,16,14]);
  assert.equal(minutesForForm('scan'),undefined);
  assert.equal(minutesForForm('rules'),undefined);
  assert.equal(minutesForForm('toString'),undefined);
  const deadline=1_000_000;
  assert.equal(remainingMs(deadline,deadline-4_537),4537);
  assert.equal(remainingMs(deadline,deadline),0);
  assert.equal(remainingMs(deadline,deadline+70_000),0);
  for(const [ms,expected] of [[0,'0:00'],[1,'0:01'],[60000,'1:00'],[60001,'1:01'],[840000,'14:00']])
    assert.equal(timerText(ms),expected);
});
test('advanced challenge has 16 new items with equal domain and option coverage',()=>{
  const f=reasoningForms.find(f=>f.id==='expert');
  assert.equal(f.items.length,16);
  const all=reasoningForms.flatMap(f=>f.items);
  assert.equal(new Set(all.map(q=>q.id)).size,88);
  assert.deepEqual([0,1,2,3].map(n=>f.items.filter(q=>q.answer===n).length),[4,4,4,4]);
  for(const q of f.items){
    assert.equal(new Set(q.options).size,4,q.id);
    assert.ok(q.options[q.answer]&&q.explanation,q.id);
  }
  const answers=f.items.map(q=>q.answer);
  assert.equal(scoreReasoning(f,answers).correct,16);
  assert.deepEqual(Object.values(scoreReasoning(f,[]).byDomain).filter(x=>x.total>0).map(x=>x.total),[4,4,4,4]);
  assert.equal(scoreReasoning(f,answers.slice(0,3)).correct,3);
  assert.equal(scoreReasoning(f,answers.slice(0,3)).skipped,13);
});
test('advanced arithmetic, logic and 4×4 matrices have independent answer keys',()=>{
  const f=reasoningForms.find(f=>f.id==='expert');
  const answers={'x-l1':'אמיר','x-l2':'א׳','x-l3':'א׳ וב׳ שקר, ג׳ אמת.','x-l4':'ב׳ וג׳ דולקים.',
    'x-n1':'5/11','x-n2':'16%','x-n3':'27','x-n4':'27/47'};
  for(const q of f.items){
    if(q.id in answers) assert.equal(q.options[q.answer],answers[q.id],q.id);
    if(!q.grid) continue;
    assert.equal(q.gridSize,4);
    assert.equal(new Set(q.optionGrids.map(c=>c.join(','))).size,4,q.id);
    assert.ok(q.optionGrids.every(c=>c.every(n=>Number.isInteger(n)&&n>=0&&n<16)),q.id);
    // Read the rotated/mirrored source from the destination cell using inverse transforms.
    const mirror=q.id==='x-s2';
    const union=q.id==='x-s3';
    const expected=Array.from({length:16},(_,idx)=>idx).filter(idx=>{
      const row=Math.floor(idx/4),col=idx%4;
      const source=mirror ? row*4+(3-col) : (3-col)*4+row;
      const a=q.grid.includes(idx), b=q.grid.includes(source);
      return union ? a||b : a!==b;
    });
    assert.deepEqual(q.optionGrids[q.answer],expected,q.id);
  }
});
