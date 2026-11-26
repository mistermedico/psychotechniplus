import assert from 'node:assert/strict';
import { test } from 'node:test';
import { constructionItems as bank } from '../data/constructionTests.ts';

test('construction bank has 28 original, balanced, valid items with four interaction types', () => {
  assert.equal(bank.length, 28);
  assert.equal(new Set(bank.map(x=>x.id)).size, bank.length);
  assert.equal(new Set(bank.map(x=>x.prompt)).size, bank.length);
  assert.deepEqual(new Set(bank.map(x=>x.type)),new Set(['order','set','grid','number']));
  assert.equal(new Set(bank.map(x=>x.label)).size,7);
  for(const label of new Set(bank.map(x=>x.label))) assert.equal(bank.filter(x=>x.label===label).length,4);
  for(const x of bank){
    assert.ok(x.explanation.length>=30,x.id);
    if(x.type==='number'){assert.ok(Number.isFinite(x.correct),x.id);continue;}
    const size = x.type==='grid' ? x.side**2 : x.options.length;
    if(x.type!=='grid') assert.equal(new Set(x.options).size,size,x.id);
    for(const arr of [x.correct,...(x.type==='grid'&&x.source?[x.source]:[])]){
      assert.equal(new Set(arr).size,arr.length,x.id);
      assert.ok(arr.length&&arr.every(n=>Number.isInteger(n)&&n>=0&&n<size),x.id);
    }
    if(x.type==='order') assert.equal(x.correct.length,size,x.id);
  }
});

function permutations(arr) {
  if(!arr.length) return [[]];
  return arr.flatMap((v,i)=>permutations(arr.filter((_,j)=>i!==j)).map(xs=>[v,...xs]));
}
test('step-order and placement prompts uniquely determine the stored sequences',()=>{
  const ruleById={
    'build-process-1': order=>order.indexOf(3)<order.indexOf(1)&&order.indexOf(1)<order.indexOf(2)&&order.indexOf(2)<order.indexOf(0),
    'build-process-2': order=>order.indexOf(2)<order.indexOf(0)&&order.indexOf(0)<order.indexOf(3)&&order.indexOf(3)<order.indexOf(1),
    'build-process-3': order=>order.indexOf(1)<order.indexOf(3)&&order.indexOf(3)<order.indexOf(2)&&order.indexOf(2)<order.indexOf(0),
    'build-process-4': order=>order.indexOf(1)<order.indexOf(3)&&order.indexOf(3)<order.indexOf(0)&&order.indexOf(0)<order.indexOf(2),
    'build-constraint-1': order=>order[0]===3&&order[4]===2&&order.indexOf(4)===order.indexOf(0)+1&&order.indexOf(1)>order.indexOf(4),
    'build-constraint-2': order=>order[0]===2&&order[4]===4&&order.indexOf(3)+1===order.indexOf(1)&&order.indexOf(0)<order.indexOf(3),
    'build-constraint-3': order=>order[2]===0&&order[4]===2&&order.indexOf(3)<order.indexOf(4)&&order.indexOf(1)>order.indexOf(0),
    'build-constraint-4': order=>order[2]===3&&order.indexOf(0)===order.indexOf(2)+1&&order[0]===4&&order.indexOf(1)<order.indexOf(3),
  };
  for(const [id,rule] of Object.entries(ruleById)){
    const item=bank.find(q=>q.id===id);
    const orders=permutations(item.options.map((_,i)=>i)).filter(rule);
    assert.deepEqual(orders,[item.correct],id);
  }
});

test('group keys, numeric pairing, rotations, revisiting routes and numbers match independently solved answers',()=>{
  const exact={
    'build-match-1':['11','7','13','5'],
    'build-match-2':['21','3','15','9','7'],
    'build-match-3':['-1','13','17','3'],
    'build-match-4':['5','19','1','11','15'],
    'build-set-1':[0,2],
    'build-set-2':[0,3],
    'build-set-3':[0,1,3],
    'build-set-4':[0,2,4],
    'build-rotate-1':[1,2,6],
    'build-rotate-2':[3,4,6,10,15],
    'build-rotate-3':[1,4,5,7],
    'build-rotate-4':[2,6,7,8,13],
    'build-path-1':[0,1,4,5,8],
    'build-path-2':[1,2,5,9,10,14],
    'build-path-3':[1,2,4,5,7],
    'build-path-4':[3,7,9,10,11,12,13],
    'build-number-1':88,
    'build-number-2':7.5,
    'build-number-3':19,
    'build-number-4':24,
  };
  for(const [id,expected] of Object.entries(exact)){
    const x=bank.find(q=>q.id===id);
    assert.deepEqual(id.startsWith('build-match-')?x.correct.map(i=>x.options[i]):x.correct,expected,id);
  }
});
