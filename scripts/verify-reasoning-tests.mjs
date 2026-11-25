import assert from 'node:assert/strict';
import { test } from 'node:test';
import { reasoningForms, scoreReasoning } from '../data/reasoningTests.ts';

const expectedNumeric = {
  'a-n1':'54','a-n2':'לא השתנה','a-n3':'7 ק״ג','a-n4':'1/3','a-n5':'8 דקות','a-n6':'6 ערכות',
  'b-n1':'38','b-n2':'200 ש״ח','b-n3':'12 ש״ח','b-n4':'3/10','b-n5':'81','b-n6':'08:36',
};
const expectedSpatial = {
  'a-s1':[1,2,3,5],'a-s2':[0,1,4,6,8],'a-s3':[0,2,6,7],'a-s4':[0,1,2,4,6],'a-s5':[0,1,3,4,6],'a-s6':[0,3,5,6,8],
  'b-s1':[0,1,3,5,6],'b-s2':[1,2,5,6,7],'b-s3':[1,2,3,7,8],'b-s4':[1,3,4,6,8],'b-s5':[0,3,4,5,7],'b-s6':[0,1,2,6,7],
};
test('two distinct forms with 48 items total, balanced domains and correct-option positions',()=>{
  const all=reasoningForms.flatMap(f=>f.items);
  assert.equal(reasoningForms.length,2);
  assert.equal(new Set(all.map(q=>q.id)).size,48);
  assert.equal(new Set(all.map(q=>q.grid?q.prompt+q.grid.join(','):q.prompt)).size,48);
  for(const f of reasoningForms){
    assert.equal(f.items.length,24);
    const result=scoreReasoning(f,[]);
    assert.deepEqual(Object.values(result.byDomain).map(r=>r.total),[6,6,6,6]);
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
    assert.deepEqual(scoreReasoning(f,good),{ correct:24,total:24,skipped:0,byDomain:{verbal:{correct:6,total:6},logic:{correct:6,total:6},numeric:{correct:6,total:6},spatial:{correct:6,total:6}} });
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
