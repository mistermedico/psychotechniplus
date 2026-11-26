import React, {useEffect,useRef,useState} from 'react';
import {BackHandler,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Colors} from '../constants/colors';
import {FontFamily} from '../constants/theme';
import {constructionItems,type ConstructionItem} from '../data/constructionTests';
import {constructionGrade,constructionGradeCategory,parsePracticeNumber,percent,scoreConstruction,type ConstructionAnswer} from '../data/practiceScoring';
import {reasoningDomains} from '../data/reasoningTests';

const domainNames=reasoningDomains as Record<string,string>;
const asIndexes=(a:ConstructionAnswer)=>Array.isArray(a)?a as readonly number[]:[];
const kinds=[...new Set(constructionItems.map(q=>q.label))];
const domains=[...new Set(constructionItems.map(q=>q.domain))];

function Button({title,onPress,alt=false,disabled=false,label}:{
  title:string; onPress:()=>void; alt?:boolean; disabled?:boolean; label?:string;
}){return <Pressable accessibilityRole="button" accessibilityLabel={label} disabled={disabled}
  onPress={onPress} accessibilityState={{disabled}}
  style={({pressed})=>[s.action,alt&&s.alt,disabled&&s.disabled,pressed&&s.pressed]}>
  <Text style={[s.actionText,alt&&s.altText]}>{title}</Text>
</Pressable>;}

function Grid({side,picked,onToggle,label}:{
  side:3|4; picked:readonly number[]; onToggle?:(n:number)=>void;label:string;
}){
  return <View>
    <Text style={s.note}>{label}</Text>
    <View style={s.tileGrid}>
      {Array.from({length:side},(_,r)=><View key={r} style={s.row}>
        {Array.from({length:side},(_,c)=>{
          const n=r*side+c, marked=picked.includes(n);
          const name=`שורה ${r+1}, עמודה ${c+1} משמאל`;
          return onToggle?<Pressable key={n} accessibilityRole="checkbox" accessibilityLabel={name}
            accessibilityState={{checked:marked}} aria-checked={marked} onPress={()=>onToggle(n)} style={[s.tile,marked&&s.active]}>
            <Text style={s.tileText}>{marked?'✓':'·'}</Text>
          </Pressable>:<View key={n} accessible accessibilityLabel={`${name}, ${marked?'מסומן':'ריק'}`}
            style={[s.tile,marked&&s.active]}><Text style={s.tileText}>{marked?'✓':'·'}</Text></View>;
        })}
      </View>)}
    </View>
  </View>;
}

function AnswerEditor({item,answer,onChange}:{item:ConstructionItem;answer:ConstructionAnswer;onChange:(a:ConstructionAnswer)=>void}){
  const chosen=asIndexes(answer);
  function toggle(n:number){
    const next=chosen.includes(n)?chosen.filter(x=>x!==n):[...chosen,n];
    onChange(next.length?next:null);
  }
  function move(index:number,to:number){
    if(to<0||to>=chosen.length)return;
    const next=[...chosen];
    [next[index],next[to]]=[next[to],next[index]];
    onChange(next);
  }
  if(item.type==='number'){
    const value=typeof answer==='string'?answer:'';
    const invalid=!!value.trim()&&parsePracticeNumber(value)===null;
    return <View style={s.panel}>
      <Text style={s.section}>הזנת תשובה מספרית</Text>
      <TextInput accessibilityLabel="תשובה מספרית" value={value} onChangeText={onChange}
        placeholder="למשל 12 או 3/4" placeholderTextColor="#A8B3CA" maxLength={40}
        autoCorrect={false} autoCapitalize="none" style={s.input}/>
      <Text style={s.note}>אפשר להזין מספר, מספר עשרוני או שבר, בלי יחידות.</Text>
      {invalid&&<Text style={s.alert} accessibilityLiveRegion="polite">הפורמט לא תקין. בדקו שהוזן מספר אחד או שבר.</Text>}
    </View>;
  }
  if(item.type==='grid') return <View style={s.panel}>
    {item.source&&<Grid side={item.side} picked={item.source} label="לוח נתון"/>}
    <Grid side={item.side} picked={chosen} onToggle={toggle} label="הלוח שלכם · לחצו לסימון או לביטול"/>
  </View>;
  if(item.type==='set') return <View style={s.panel}>
    <Text style={s.section}>סמנו את כל הפריטים המתאימים</Text>
    {item.options.map((value,i)=><Pressable key={i} accessibilityRole="checkbox" accessibilityLabel={value}
      accessibilityState={{checked:chosen.includes(i)}} aria-checked={chosen.includes(i)} onPress={()=>toggle(i)}
      style={[s.choice,chosen.includes(i)&&s.active]}>
      <Text style={s.body}>{chosen.includes(i)?'✓ ':''}{value}</Text>
    </Pressable>)}
  </View>;
  return <View style={s.panel}>
    <Text style={s.section}>הסדר שלכם · {chosen.length} מתוך {item.options.length}</Text>
    <Text style={s.note}>הוסיפו פריטים בסדר הרצוי. אפשר להזיז פריט למעלה או למטה, או להסירו.</Text>
    {chosen.map((value,i)=><View key={value} style={s.orderLine}>
      <Text style={[s.body,s.flex]}>{i+1}. {item.options[value]}</Text>
      <View style={s.orderButtons}>
        <Button title="↑" label={`להקדים את ${item.options[value]}`} onPress={()=>move(i,i-1)} disabled={i===0} alt/>
        <Button title="↓" label={`לאחר את ${item.options[value]}`} onPress={()=>move(i,i+1)} disabled={i===chosen.length-1} alt/>
        <Button title="×" label={`להסיר את ${item.options[value]}`} onPress={()=>toggle(value)} alt/>
      </View>
    </View>)}
    {item.options.map((value,i)=>!chosen.includes(i)&&<Button key={i} title={`הוספה: ${value}`} onPress={()=>toggle(i)} alt/>)}
  </View>;
}

function Explain({item,answer}:{item:ConstructionItem;answer:ConstructionAnswer}){
  const grade=constructionGrade(item,answer);
  const list=asIndexes(answer);
  const display=(ids:readonly number[],options:readonly string[])=>ids.map(n=>options[n]).join(' · ');
  const status={skipped:'לא נענתה',correct:'פתרון מלא',partial:`ניקוד חלקי: ${percent(grade.fraction)}`,wrong:'תשובה שגויה'}[constructionGradeCategory(grade)];
  return <View style={s.panel}>
    <Text style={s.kicker}>{item.label} · {status}</Text>
    <Text style={s.section}>{item.prompt}</Text>
    {item.type==='grid'?<>
      <Grid side={item.side} picked={list} label="הלוח שלכם"/>
      <Grid side={item.side} picked={item.correct} label="הלוח הנכון"/>
    </>:item.type==='number'?<>
      <Text style={s.body}>התשובה שלכם: {grade.skipped?'—':String(answer)}</Text>
      <Text style={s.kicker}>תשובה נכונה: {item.correct}</Text>
    </>:<>
      <Text style={s.body}>התשובה שלכם: {display(list,item.options)||'—'}</Text>
      <Text style={s.kicker}>תשובה נכונה: {display(item.correct,item.options)}</Text>
    </>}
    <Text style={s.body}>{item.explanation}</Text>
  </View>;
}

export function ConstructionPractice({onExit}:{onExit:()=>void}){
  const scroll=useRef<ScrollView>(null);
  const [items,setItems]=useState<readonly ConstructionItem[]>([]);
  const [answers,setAnswers]=useState<ConstructionAnswer[]>([]);
  const [index,setIndex]=useState(0);
  const [page,setPage]=useState<'work'|'check'|'result'|'quit'>('work');
  const [onlyPractice,setOnlyPractice]=useState(false);
  const [reviewIndex,setReviewIndex]=useState<number|null>(null);
  const [confirmed,setConfirmed]=useState(false);
  const [resume,setResume]=useState<'work'|'check'>('work');
  const current=items[index];
  const grades=items.map((q,i)=>constructionGrade(q,answers[i]??null));
  const done=grades.filter(g=>g.complete).length;
  const report=page==='result'?scoreConstruction(items,answers):null;
  function start(next:readonly ConstructionItem[]){
    setItems(next);setAnswers(Array(next.length).fill(null));setIndex(0);setPage('work');setReviewIndex(null);setOnlyPractice(false);setConfirmed(false);
  }
  function mixed(){start(kinds.map((label,i)=>{
    const group=constructionItems.filter(q=>q.label===label);
    return group[i%group.length];
  }));}
  function goBack(){
    if(!items.length)onExit();
    else if(page==='result')start([]);
    else if(page==='quit')setPage(resume);
    else{setResume(page);setPage('quit');}
  }
  useEffect(()=>{
    const listener=BackHandler.addEventListener('hardwareBackPress',()=>{goBack();return true;});
    return ()=>listener.remove();
  });
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[index,page,items]);
  function change(a:ConstructionAnswer){setAnswers(old=>old.map((v,i)=>i===index?a:v));}
  function jump(i:number){setIndex(i);setConfirmed(false);setPage('work');}
  const needWork=report?.byDomain.filter(d=>d.skipped<d.total&&d.points<d.total)
    .sort((a,b)=>a.points/a.total-b.points/b.total)[0];
  return <SafeAreaView style={s.safe}>
    <View style={s.header}><Button title="חזרה" onPress={goBack} alt/><Text accessibilityRole="header" style={s.section}>מעבדת חשיבה</Text></View>
    <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {!current?<View style={s.group}>
        <View style={s.hero}>
          <Text accessibilityRole="header" style={s.title}>בונים את התשובה</Text>
          <Text style={s.body}>{constructionItems.length} משימות ב־{kinds.length} סוגים: סדרו פריטים, סמנו קבוצות, בנו לוחות והקלידו תשובות.</Text>
          <Button title={`אתגר מעורב · ${kinds.length} משימות`} onPress={mixed}/>
          <Button title={`כל המשימות · ${constructionItems.length}`} onPress={()=>start(constructionItems)} alt/>
          <Text style={s.note}>תרגול ללא טיימר. התוצאות אינן נשמרות בפרופיל ואינן ציון IQ מתוקנן.</Text>
        </View>
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.section}>תרגול לפי יכולת</Text>
          {domains.map(d=><Button key={d} title={domainNames[d]} onPress={()=>start(constructionItems.filter(q=>q.domain===d))} alt/>)}
        </View>
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.section}>תרגול לפי סוג משימה</Text>
          {kinds.map(k=><Button key={k} title={k} onPress={()=>start(constructionItems.filter(q=>q.label===k))} alt/>)}
        </View>
      </View>:page==='quit'?<View style={s.panel}>
        <Text accessibilityRole="header" style={s.title}>לצאת מהניסיון?</Text>
        <Text style={s.body}>התשובות לא יישמרו.</Text>
        <Button title="להמשיך לתרגל" onPress={()=>setPage(resume)}/>
        <Button title="יציאה לבחירת מסלול" onPress={()=>start([])} alt/>
      </View>:report?<View style={s.group}>
        <View style={s.hero}>
          <Text accessibilityRole="header" style={s.title}>{report.correct} מתוך {report.total} פתרונות מלאים</Text>
          <Text style={s.section}>ציון תרגול עם ניקוד חלקי: {percent(report.index)}</Text>
          <Text style={s.body}>{report.partial} חלקיות · {report.wrong} שגויות · {report.skipped} ללא תשובה</Text>
          <Text style={s.note}>כל משימה שווה נקודה. בסדר נותנים חלק יחסי על מקומות נכונים. בקבוצות ובלוחות, החמצה או סימון מיותר מקטינים את הניקוד. תשובה מספרית מזכה רק אם היא נכונה.</Text>
        </View>
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.section}>לפי יכולת</Text>
          {report.byDomain.map(d=><Text key={d.name} style={s.body}>{domainNames[d.name]} · {d.correct}/{d.total} מלאים · {percent(d.points/d.total)} עם ניקוד חלקי</Text>)}
          {needWork&&<Button title={`תרגול נוסף: ${domainNames[needWork.name]}`} onPress={()=>start(constructionItems.filter(q=>q.domain===needWork.name))} alt/>}
        </View>
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.section}>לפי סוג משימה</Text>
          {report.byType.map(d=><Text key={d.name} style={s.body}>{d.name} · {percent(d.points/d.total)}</Text>)}
        </View>
        <View style={s.panel}>
          <Text accessibilityRole="header" style={s.section}>סקירת פתרונות</Text>
          <Button title={onlyPractice?'כל המשימות':'רק משימות לשיפור'} alt onPress={()=>{setOnlyPractice(v=>!v);setReviewIndex(null);}}/>
          <View style={s.picker}>{items.map((q,i)=>(!onlyPractice||!grades[i].exact)&&<Button key={q.id} title={String(i+1)} label={`פתרון משימה ${i+1}`} onPress={()=>setReviewIndex(i)} alt/>)}</View>
          {reviewIndex!==null&&<Explain item={items[reviewIndex]} answer={answers[reviewIndex]??null}/>}
        </View>
        <Button title="ניסיון חוזר" onPress={()=>start(items)}/>
        <Button title="בחירת מסלול חדש" onPress={()=>start([])} alt/>
      </View>:page==='check'?<View style={s.panel}>
        <Text accessibilityRole="header" style={s.title}>בדיקה לפני הגשה</Text>
        <Text style={s.body}>נענו במלואן {done} מתוך {items.length}. תשובה חלקית תיבדק כפי שהיא.</Text>
        <View style={s.picker}>{items.map((q,i)=><Button key={q.id} title={String(i+1)} label={`משימה ${i+1}, ${grades[i].complete?'נענתה':grades[i].skipped?'פתוחה':'חלקית'}`} alt onPress={()=>jump(i)}/>)}</View>
        {confirmed&&<Text accessibilityLiveRegion="polite" style={s.alert}>יש משימות פתוחות או חלקיות. להגיש בכל זאת?</Text>}
        <Button title={confirmed?'הגשה בכל זאת':'הגשת התרגול'} onPress={()=>done===items.length||confirmed?setPage('result'):setConfirmed(true)}/>
        <Button title="לחזור למשימה הנוכחית" onPress={()=>jump(index)} alt/>
      </View>:<View style={s.group}>
        <View style={s.hero}>
          <Text style={s.kicker} accessibilityLiveRegion="polite">משימה {index+1} מתוך {items.length} · {current.label}</Text>
          <Text accessibilityRole="header" style={s.section}>{current.prompt}</Text>
        </View>
        <AnswerEditor key={current.id} item={current} answer={answers[index]??null} onChange={change}/>
        <Button title={index+1<items.length?'למשימה הבאה':'לבדיקה לפני הגשה'} onPress={()=>index+1<items.length?jump(index+1):setPage('check')}/>
        {!grades[index].skipped&&<Button title="ניקוי תשובה" onPress={()=>change(null)} alt/>}
        {index>0&&<Button title="למשימה הקודמת" onPress={()=>jump(index-1)} alt/>}
        {index+1<items.length&&<Button title="סקירה מוקדמת" onPress={()=>setPage('check')} alt/>}
      </View>}
    </ScrollView>
  </SafeAreaView>;
}

const s=StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.background},header:{width:'100%',maxWidth:720,alignSelf:'center',padding:12,flexDirection:'row',justifyContent:'space-between',alignItems:'center'},
  content:{width:'100%',maxWidth:720,alignSelf:'center',padding:12,paddingBottom:32},group:{gap:11},
  hero:{backgroundColor:'#192442',borderWidth:1,borderColor:'#405780',padding:14,borderRadius:14,gap:8},
  panel:{backgroundColor:Colors.background2,borderWidth:1,borderColor:Colors.border,padding:12,borderRadius:12,gap:8},
  title:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:25,textAlign:'right',writingDirection:'rtl'},
  section:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:19,textAlign:'right',writingDirection:'rtl'},
  body:{color:Colors.textSecondary,fontFamily:FontFamily.regular,fontSize:16,textAlign:'right',writingDirection:'rtl'},
  note:{color:'#C7D4EB',fontFamily:FontFamily.regular,fontSize:14,textAlign:'right',writingDirection:'rtl'},
  alert:{color:'#FFB4C0',fontFamily:FontFamily.bold,fontSize:15,textAlign:'right'},
  kicker:{color:Colors.cyan,fontFamily:FontFamily.bold,fontSize:15,textAlign:'right',writingDirection:'rtl'},
  action:{minHeight:45,minWidth:40,padding:8,justifyContent:'center',backgroundColor:'#AB9CFF',borderRadius:10},
  alt:{backgroundColor:Colors.surface,borderColor:Colors.border,borderWidth:1},pressed:{opacity:.8},disabled:{opacity:.4},
  actionText:{color:'#120E29',fontFamily:FontFamily.bold,fontSize:15,textAlign:'center'},altText:{color:Colors.text},
  row:{direction:'ltr',flexDirection:'row',gap:5},tileGrid:{gap:5,marginTop:5,maxWidth:290,width:'100%',alignSelf:'center'},
  tile:{flex:1,minHeight:46,borderWidth:2,borderColor:'#62728F',borderRadius:7,backgroundColor:'#253650',justifyContent:'center',alignItems:'center'},
  tileText:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:18},active:{borderColor:Colors.cyan,backgroundColor:'#1C4556'},
  choice:{minHeight:46,justifyContent:'center',borderRadius:10,borderWidth:1,borderColor:'#62728F',padding:10},
  picker:{flexDirection:'row-reverse',flexWrap:'wrap',gap:5},orderLine:{flexDirection:'row-reverse',alignItems:'center',flexWrap:'wrap',gap:6},
  orderButtons:{flexDirection:'row',gap:3},flex:{flex:1,minWidth:95},
  input:{minHeight:47,borderWidth:1,borderColor:'#7788AA',color:Colors.text,backgroundColor:'#172339',borderRadius:9,
    fontFamily:FontFamily.regular,fontSize:20,textAlign:'left',writingDirection:'ltr',padding:8},
});
