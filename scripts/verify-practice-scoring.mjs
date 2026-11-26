import assert from 'node:assert/strict';
import {test} from 'node:test';
import {constructionItems} from '../data/constructionTests.ts';
import {visualSearchItems} from '../data/attentionTests.ts';
import {reasoningForms} from '../data/reasoningTests.ts';
import {hitScore,scoreVisual,parsePracticeNumber,constructionGrade,constructionGradeCategory,scoreConstruction,multipleChoiceDetail,percent} from '../data/practiceScoring.ts';

test('visual index separates over-marking from missing targets and deduplicates marks',()=>{
  const exact=hitScore([1,3,3],[3,1]);
  assert.ok(exact.exact); assert.equal(exact.fraction,1);
  const over=hitScore([1,3,4,5],[1,3]); assert.equal(over.coverage,1); assert.equal(over.precision,0.5); assert.equal(over.fraction,2/3);
  const under=hitScore([1],[1,3]); assert.equal(under.coverage,0.5); assert.equal(under.precision,1); assert.equal(under.fraction,2/3);
  const wrong=hitScore([2,4],[1,3]); assert.equal(wrong.fraction,0); assert.equal(wrong.falseMarks,2);
  const blank=scoreVisual(visualSearchItems,[]);
  assert.equal(blank.skipped,48);assert.equal(blank.coverage,0);assert.equal(blank.precision,null);assert.equal(blank.index,0);
  const all=scoreVisual(visualSearchItems,visualSearchItems.map(q=>q.targets));
  assert.equal(all.exact,48);assert.equal(all.byKind.length,12);assert.equal(all.index,1);
  assert.equal(all.byKind.reduce((n,k)=>n+k.total,0),48);
});
test('numeric input accepts decimals and ordinary fractions, not units, zero divisions or truncated input',()=>{
  for(const [value,wanted] of [['3/4',.75],[' -3 / 4 ',-.75],['0,75',.75],['−2',-2],['.5',.5],['10',10],['0',0]])
    assert.equal(parsePracticeNumber(value),wanted,value);
  for(const value of ['', ' ', '2/0', '3/2/4', '12 ק״מ', '0x10', '1,234,5','1e8','∞','.','1.'])
    assert.equal(parsePracticeNumber(value),null,value);
  assert.equal(percent(null),'—');
  assert.equal(percent(2/3),'66.7%');
});
test('construction gives transparent partial credit without counting a partial answer as exact',()=>{
  const order=constructionItems.find(x=>x.type==='order');
  const first=constructionGrade(order,order.correct.slice(0,1));
  assert.equal(first.fraction,1/order.correct.length);assert.equal(first.exact,false);assert.equal(first.complete,false);
  assert.equal(constructionGrade(order,order.correct).exact,true);
  const grid=constructionItems.find(x=>x.type==='grid');
  const extra=Array.from({length:grid.side**2},(_,i)=>i).find(x=>!grid.correct.includes(x));
  assert.ok(Number.isInteger(extra));
  const bad=constructionGrade(grid,[...grid.correct,extra]);
  assert.ok(bad.fraction<1&&bad.fraction>0);
  assert.equal(bad.exact,false);
  const num=constructionItems.find(x=>x.type==='number');
  assert.equal(constructionGrade(num,'bad input').complete,false);
  assert.equal(constructionGrade(num,'bad input').skipped,false);
  const result=scoreConstruction(constructionItems,constructionItems.map(q=>q.correct));
  assert.equal(result.correct,28);
  assert.equal(result.byType.length,7);
  assert.equal(result.byDomain.length,4);
  assert.equal(result.index,1);
  assert.equal(scoreConstruction(constructionItems,[]).skipped,28);
  const mixed=scoreConstruction([order,grid,num],[order.correct.slice(0,1),null,'bad']);
  assert.deepEqual([mixed.correct,mixed.partial,mixed.skipped,mixed.wrong],[0,1,1,1]);
});
test('construction review distinguishes skipped, full, partial and wrong answers',()=>{
  const num=constructionItems.find(x=>x.type==='number');
  const order=constructionItems.find(x=>x.type==='order');
  const items=[num,num,order,num];
  const answers=[' ',String(num.correct),order.correct.slice(0,1),String(num.correct+1)];
  const categories=items.map((q,i)=>constructionGradeCategory(constructionGrade(q,answers[i])));
  assert.deepEqual(categories,['skipped','correct','partial','wrong']);
  const report=scoreConstruction(items,answers);
  for(const category of categories)assert.equal(report[category],1);
});
test('reasoning result distinguishes attempted accuracy from total score and completion',()=>{
  const q=reasoningForms[0];
  const scored=multipleChoiceDetail(q,[q.items[0].answer,(q.items[1].answer+1)%4,null]);
  assert.deepEqual([scored.correct,scored.wrong,scored.skipped,scored.attemptedAccuracy,scored.overallAccuracy,scored.completion],
    [1,1,22,.5,1/24,2/24]);
  assert.equal(multipleChoiceDetail(q,[]).attemptedAccuracy,null);
  assert.equal(scored.byDomain.reduce((sum,d)=>sum+d.skipped,0),22);
});
