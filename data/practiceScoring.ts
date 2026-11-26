import type { ConstructionItem } from './constructionTests';
import type { VisualSearchItem } from './attentionTests';
import type { ReasoningForm } from './reasoningTests';

export function hitScore(marked: readonly number[], targets: readonly number[]) {
  const picked=new Set(marked), expected=new Set(targets);
  let hits=0;
  for(const n of picked) if(expected.has(n)) hits++;
  const misses=expected.size-hits;
  const falseMarks=picked.size-hits;
  return {
    hits, misses, falseMarks,
    precision:picked.size?hits/picked.size:null,
    coverage:expected.size?hits/expected.size:null,
    fraction:picked.size+expected.size?2*hits/(picked.size+expected.size):1,
    exact:misses===0&&falseMarks===0,
  };
}

export function percent(fraction:number|null) {
  return fraction===null?'—':`${Math.round(fraction*1000)/10}%`;
}

type VisualSummary={hits:number;misses:number;falseMarks:number;exact:number;skipped:number;total:number};
const emptyVisual=():VisualSummary=>({hits:0,misses:0,falseMarks:0,exact:0,skipped:0,total:0});
function visualRates(g:VisualSummary) {
  const marks=g.hits+g.falseMarks, targets=g.hits+g.misses;
  return {...g,precision:marks?g.hits/marks:null,coverage:targets?g.hits/targets:null,
    index:marks+targets?2*g.hits/(marks+targets):null};
}
export function scoreVisual(items:readonly VisualSearchItem[], answers:ReadonlyArray<readonly number[]|null>) {
  const summary=emptyVisual();
  const byKind=new Map<string,VisualSummary>();
  for (const [i,item] of items.entries()) {
    const group=byKind.get(item.kind)??emptyVisual();
    const answer=answers[i]??null;
    const s=hitScore(answer??[],item.targets);
    for(const g of [summary,group]){
      g.total++; g.hits+=s.hits; g.misses+=s.misses; g.falseMarks+=s.falseMarks;
      if(answer===null) g.skipped++;
      else if(s.exact) g.exact++;
    }
    byKind.set(item.kind,group);
  }
  return {...visualRates(summary),byKind:[...byKind].map(([name,g])=>({name,...visualRates(g)}))};
}

export type ConstructionAnswer=number|string|readonly number[]|null;
const numeric='[+-]?(?:\\d+(?:[.,]\\d+)?|[.,]\\d+)';
const decimal=/^[+-]?(?:\d+(?:[.,]\d+)?|[.,]\d+)$/;
const ratio=new RegExp(`^(${numeric})\\s*/\\s*(${numeric})$`);
export function parsePracticeNumber(raw: string):number|null {
  const value=raw.trim().replace(/−/g,'-');
  if(value.length>40) return null;
  const number=(s:string)=>Number(s.replace(',','.'));
  const match=value.match(ratio);
  if(!match&&!decimal.test(value)) return null;
  const n=match?number(match[1])/number(match[2]):number(value);
  return Number.isFinite(n)?n:null;
}

export function constructionGrade(item:ConstructionItem, answer:ConstructionAnswer) {
  if(item.type==='number'){
    const n=typeof answer==='string'?parsePracticeNumber(answer):typeof answer==='number'&&Number.isFinite(answer)?answer:null;
    const skipped=answer===null||(typeof answer==='string'&&!answer.trim());
    const exact=n!==null&&Math.abs(n-item.correct)<=Math.max(1e-10,Math.abs(item.correct)*1e-10);
    return {exact,fraction:exact?1:0,skipped,complete:n!==null};
  }
  const a=Array.isArray(answer)?answer as readonly number[]:[];
  if(item.type==='order'){
    const matched=item.correct.filter((n,i)=>a[i]===n).length;
    const exact=matched===item.correct.length&&a.length===item.correct.length;
    return {exact,fraction:matched/item.correct.length,skipped:a.length===0,complete:a.length===item.correct.length};
  }
  const result=hitScore(a,item.correct);
  return {exact:!!a.length&&result.exact,fraction:a.length?result.fraction:0,skipped:a.length===0,complete:a.length>0};
}

export function constructionGradeCategory(grade:ReturnType<typeof constructionGrade>) {
  return grade.skipped?'skipped':grade.exact?'correct':grade.fraction>0?'partial':'wrong';
}

export function scoreConstruction(items:readonly ConstructionItem[], answers:readonly ConstructionAnswer[]) {
  type T=ReturnType<typeof empty>;
  function empty(){return {correct:0,points:0,total:0,partial:0,wrong:0,skipped:0};}
  const total=empty();
  const byDomain=new Map<string,T>();
  const byType=new Map<string,T>();
  for(const [i,item] of items.entries()){
    const result=constructionGrade(item,answers[i]??null);
    const category=constructionGradeCategory(result);
    const d=byDomain.get(item.domain)??empty(), t=byType.get(item.label)??empty();
    for(const row of [total,d,t]){
      row.total++;
      row.points+=result.fraction;
      row[category]++;
    }
    byDomain.set(item.domain,d); byType.set(item.label,t);
  }
  return {...total,index:total.total?total.points/total.total:null,
    byDomain:[...byDomain].map(([name,s])=>({name,...s})),byType:[...byType].map(([name,s])=>({name,...s}))};
}

export function multipleChoiceDetail(form:ReasoningForm,answers:ReadonlyArray<number|null>){
  const blank=()=>({correct:0,wrong:0,skipped:0,total:0});
  const overall=blank();
  const byDomain=new Map<string,ReturnType<typeof blank>>();
  for(const [i,item] of form.items.entries()){
    const answer=answers[i];
    const group=byDomain.get(item.domain)??blank();
    for(const r of [overall,group]){
      r.total++;
      if(answer==null)r.skipped++;
      else if(answer===item.answer)r.correct++;
      else r.wrong++;
    }
    byDomain.set(item.domain,group);
  }
  const answered=overall.correct+overall.wrong;
  return {...overall,answered,attemptedAccuracy:answered?overall.correct/answered:null,
    overallAccuracy:overall.total?overall.correct/overall.total:null,
    completion:overall.total?answered/overall.total:null,
    byDomain:[...byDomain].map(([name,row])=>({name,...row}))};
}
