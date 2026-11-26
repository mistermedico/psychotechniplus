import assert from 'node:assert/strict';
import { test } from 'node:test';
import { attentionForms } from '../data/attentionTests.ts';
import { reasoningForms as allReasoningForms, scoreReasoning } from '../data/reasoningTests.ts';

const reasoningForms = allReasoningForms.filter(f => f.id !== 'expert');
const expectedNumeric = {
  'c-n1':'6 דקות','c-n2':'10%','c-n3':'12%','c-n4':'4/7','c-n5':'4.8 קמ״ש','c-n6':'88',
  'a-n1':'54','a-n2':'לא השתנה','a-n3':'7 ק״ג','a-n4':'1/3','a-n5':'8 דקות','a-n6':'6 ערכות',
  'b-n1':'38','b-n2':'200 ש״ח','b-n3':'12 ש״ח','b-n4':'3/10','b-n5':'81','b-n6':'08:36',
};
const expectedSpatial = {
  'c-s1':[0,2,3,6],'c-s2':[0,3,6,7,8],'c-s3':[1,4,6,8],'c-s4':[0,1,3,6],'c-s5':[0,1,4,7],'c-s6':[0,2,4,6],
  'a-s1':[1,2,3,5],'a-s2':[0,1,4,6,8],'a-s3':[0,2,6,7],'a-s4':[0,1,2,4,6],'a-s5':[0,1,3,4,6],'a-s6':[0,3,5,6,8],
  'b-s1':[0,1,3,5,6],'b-s2':[1,2,5,6,7],'b-s3':[1,2,3,7,8],'b-s4':[1,3,4,6,8],'b-s5':[0,3,4,5,7],'b-s6':[0,1,2,6,7],
};
test('three distinct forms with 72 items total, balanced domains and correct-option positions',()=>{
  const all=reasoningForms.flatMap(f=>f.items);
  assert.equal(reasoningForms.length,3);
  assert.equal(new Set(all.map(q=>q.id)).size,72);
  assert.equal(new Set(all.map(q=>q.grid?q.prompt+q.grid.join(','):q.prompt)).size,72);
  for(const f of reasoningForms){
    assert.equal(f.items.length,24);
    const result=scoreReasoning(f,[]);
    assert.deepEqual(Object.values(result.byDomain).filter(r=>r.total).map(r=>r.total),[6,6,6,6]);
    assert.deepEqual([0,1,2,3].map(i=>f.items.filter(q=>q.answer===i).length),[6,6,6,6]);
    for(const q of f.items){
      assert.equal(new Set(q.options).size,4,q.id);
      assert.ok(q.explanation&&q.prompt&&q.options[q.answer],q.id);
    }
  }
});
test('answer keys match the separately solved numeric and spatial items',()=>{
  for(const q of reasoningForms.flatMap(f=>f.items)){
    if(q.domain==='numeric') assert.equal(q.options[q.answer],expectedNumeric[q.id],q.id);
    if(q.domain==='spatial'){
      assert.equal(new Set(q.optionGrids.map(g=>g.join(','))).size,4,q.id);
      assert.deepEqual(q.optionGrids[q.answer],expectedSpatial[q.id],q.id);
      for(const g of q.optionGrids) assert.ok(g.length===q.grid.length&&g.every(n=>n>=0&&n<9),q.id);
    }
  }
});
test('full, empty, and mixed attempts score correctly without inflating skipped results',()=>{
  for(const f of reasoningForms){
    const good=f.items.map(q=>q.answer);
    assert.deepEqual(scoreReasoning(f,good),{ correct:24,total:24,skipped:0,byDomain:{verbal:{correct:6,total:6},logic:{correct:6,total:6},numeric:{correct:6,total:6},spatial:{correct:6,total:6},scan:{correct:0,total:0},rules:{correct:0,total:0}} });
    assert.equal(scoreReasoning(f,[]).skipped,24);
    assert.equal(scoreReasoning(f,[]).correct,0);
    good[0]=null;
    good[1]=(good[1]+1)%4;
    const mixed=scoreReasoning(f,good);
    assert.equal(mixed.correct,22);
    assert.equal(mixed.skipped,1);
    assert.equal(mixed.byDomain.verbal.correct,5);
    assert.equal(mixed.byDomain.logic.correct,5);
  }
});

test('all 24 attention boards have unique content and independently verified answers',()=>{
  assert.deepEqual(attentionForms.map(f=>f.id), ['scan','rules']);
  const all=[...reasoningForms,...attentionForms].flatMap(f=>f.items);
  assert.equal(new Set(all.map(q=>q.id)).size,96);
  const boards=attentionForms.flatMap(f=>f.items.map(q=>JSON.stringify(q.board)));
  assert.equal(new Set(boards).size,24);
  for(const form of attentionForms){
    assert.equal(form.items.length,12);
    assert.deepEqual([0,1,2,3].map(i=>form.items.filter(q=>q.answer===i).length),[3,3,3,3]);
    form.items.forEach((q,i)=>{
      assert.equal(q.board.length, i < 4 ? 3 : 4);
      const wanted=q.prompt.match(/הצירוף (\d{2})/)?.[1];
      const counts=q.board.map(({cue,tokens})=>{
        assert.equal(tokens.length,5);
        if (form.id==='scan'){
          assert.ok(wanted && !cue);
          assert.ok(tokens.every(t=>/^\d{2}$/.test(t)));
          return tokens.reduce((n,t)=>n+Number(t===wanted),0);
        }
        assert.ok(cue==='זוגי' || cue==='אי־זוגי');
        assert.ok(tokens.every(t=>/^[1-9]$/.test(t)));
        return tokens.reduce((n,t)=>n+Number((cue==='זוגי'?'2468':'13579').includes(t)),0);
      });
      if (form.id==='rules') for(let r=1;r<q.board.length;r++) assert.notEqual(q.board[r].cue,q.board[r-1].cue);
      const correct=String(counts.reduce((a,b)=>a+b,0));
      assert.equal(new Set(q.options).size,4,q.id);
      assert.equal(q.options[q.answer],correct,q.id);
      assert.ok(q.explanation.includes(counts.join(', ')),q.id);
      assert.ok(q.explanation.endsWith(`${correct}.`),q.id);
    });
  }
});
test('attention scoring distinguishes correct, incorrect and skipped answers',()=>{
  for(const f of attentionForms){
    const good=f.items.map(q=>q.answer);
    const clean=scoreReasoning(f,good);
    assert.equal(clean.correct,12);
    assert.equal(clean.skipped,0);
    assert.deepEqual(clean.byDomain[f.id],{correct:12,total:12});
    assert.equal(Object.values(clean.byDomain).filter(d=>d.total>0).length,1);
    good[0]=null;
    good[1]=(good[1]+1)%4;
    const mixed=scoreReasoning(f,good);
    assert.equal(mixed.correct,10);
    assert.equal(mixed.total,12);
    assert.equal(mixed.skipped,1);
    assert.equal(scoreReasoning(f,[]).skipped,12);
  }
});
