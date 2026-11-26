import React, { useEffect, useRef, useState } from 'react';
import { AppState, BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Rect } from 'react-native-svg';
import { router } from 'expo-router';
import { Colors } from '../constants/colors';
import { FontFamily, Radius } from '../constants/theme';
import { AttentionBoard, Grid, ReasoningForm, reasoningDomains, reasoningForms } from '../data/reasoningTests';
import { attentionForms, visualSearchItems } from '../data/attentionTests';
import { minutesForForm, remainingMs, timerText } from '../data/reasoningClock';
import { VisualSearch } from '../components/VisualSearch';
import { ConstructionPractice } from '../components/ConstructionPractice';
import { constructionItems } from '../data/constructionTests';
import { multipleChoiceDetail, percent } from '../data/practiceScoring';

const notice = 'זהו תרגול בסגנון IQ, לא מבחן IQ מתוקנן ולא אבחון. הציונים מתארים דיוק במבחן הזה בלבד ואינם מיועדים להשוואה לאוכלוסייה.';
const attentionNotice = 'זהו תרגול דיוק במשימות ריכוז, לא אבחון קשב (ADHD). לא נועד להשוואה לאוכלוסייה.';
const letters = ['א', 'ב', 'ג', 'ד'];

function Diagram({ cells, size=91, side=3 }: { cells: Grid; size?: number; side?: number }) {
  const descriptions = cells.map(i => `שורה ${Math.floor(i/side)+1}, עמודה ${i%side+1} משמאל`);
  const pitch=96/side;
  return <View accessible accessibilityLabel={`משבצות מסומנות: ${descriptions.join('; ')}`} style={styles.diagram}>
    <Svg width={size} height={size} viewBox="0 0 96 96" accessible={false}>
      {Array.from({length:side*side},(_,i)=><Rect key={i} x={2+(i%side)*pitch} y={2+Math.floor(i/side)*pitch} width={pitch-4} height={pitch-4} rx={5}
        fill={cells.includes(i)?Colors.cyan:'#26314C'} stroke={cells.includes(i)?'#A9F1F7':'#60718E'} strokeWidth={1}/>)}
    </Svg>
  </View>;
}

function Board({ rows }: {rows: AttentionBoard}) {
  return <View style={styles.board}>
    {rows.map(({cue,tokens}, row)=><View key={row} accessible
      accessibilityLabel={`שורה ${row+1}${cue ? `, ${cue}` : ''}: ${tokens.join(', ')}`} style={styles.boardRow}>
      {cue && <Text style={styles.cue}>{cue}</Text>}
      <View style={styles.cells}>
        {tokens.map((token, col)=><View key={col} style={styles.cell}><Text style={styles.token}>{token}</Text></View>)}
      </View>
    </View>)}
  </View>;
}

function Action({ title, onPress, secondary=false, disabled=false }: { title:string; onPress:()=>void; secondary?:boolean; disabled?:boolean }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({pressed})=>[styles.action,secondary&&styles.secondary,disabled&&styles.disabled,pressed&&styles.pressed]}>
    <Text style={[styles.actionLabel,secondary&&styles.secondaryLabel]}>{title}</Text>
  </Pressable>;
}

export default function ReasoningTestsScreen() {
  const scroll = useRef<ScrollView>(null);
  const [visual,setVisual] = useState(false);
  const [construction,setConstruction] = useState(false);
  const [onlyIncorrect,setOnlyIncorrect] = useState(false);
  const [showTimer,setShowTimer] = useState(true);
  const [deadline,setDeadline] = useState<number|null>(null);
  const deadlineRef=useRef<number|null>(null);
  const settled=useRef(false);
  const [msLeft,setMsLeft] = useState(0);
  const [usedMs,setUsedMs] = useState<number|null>(null);
  const [timedOut,setTimedOut] = useState(false);
  const [form,setForm] = useState<ReasoningForm|null>(null);
  const [index,setIndex] = useState(0);
  const [answers,setAnswers] = useState<(number|null)[]>([]);
  const [complete,setComplete] = useState(false);
  const [confirm,setConfirm] = useState(false);
  const [review,setReview] = useState(false);
  const [checking,setChecking] = useState(false);
  const [reviewJump,setReviewJump] = useState(false);
  const [submitConfirm,setSubmitConfirm] = useState(false);
  const question = form?.items[index];
  const result = form && complete ? multipleChoiceDetail(form,answers) : null;

  const isAttention = form?.id === 'scan' || form?.id === 'rules';
  const answered = answers.filter(a => a !== null).length;
  useEffect(()=>{
    if (deadline===null||complete) return;
    const sync=()=>{
      if (settled.current||deadlineRef.current!==deadline) return;
      const left=remainingMs(deadline,Date.now());
      setMsLeft(Math.ceil(left/1000)*1000);
      if (left===0) finish(true,0);
    };
    sync();
    const interval=setInterval(sync,200);
    const appState=AppState.addEventListener('change',sync);
    const onVisibility=()=>sync();
    if (typeof document!=='undefined') document.addEventListener('visibilitychange',onVisibility);
    return ()=>{
      clearInterval(interval);
      appState.remove();
      if (typeof document!=='undefined') document.removeEventListener('visibilitychange',onVisibility);
    };
  },[deadline,complete,form]); // The deadline is absolute, even if ticks are suspended in the background.
  useEffect(()=>{ scroll.current?.scrollTo({y:0,animated:false}); },[form,index,complete,checking,confirm,submitConfirm]);
  useEffect(() => {
    if (!form || complete || visual) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (confirm) setConfirm(false);
      else if (submitConfirm) setSubmitConfirm(false);
      else setConfirm(true);
      return true;
    });
    return () => subscription.remove();
  }, [form, complete, confirm, submitConfirm,visual]);
  function resetClock(next:number|null) {
    deadlineRef.current=next;
    settled.current=false;
    setDeadline(next);
    setMsLeft(next===null?0:remainingMs(next,Date.now()));
    setUsedMs(null);
    setTimedOut(false);
    setShowTimer(true);
  }
  function menu() { resetClock(null); setForm(null); setIndex(0); setAnswers([]); setComplete(false); setConfirm(false); setReview(false); setOnlyIncorrect(false); setChecking(false); setReviewJump(false); setSubmitConfirm(false); }
  function start(f:ReasoningForm,minutes?: number) { resetClock(minutes===undefined?null:Date.now()+minutes*60000); setForm(f); setIndex(0); setAnswers(Array(f.items.length).fill(null)); setComplete(false); setConfirm(false); setReview(false); setOnlyIncorrect(false); setChecking(false); setReviewJump(false); setSubmitConfirm(false); }
  function leave() {
    if (submitConfirm) { setSubmitConfirm(false); return; }
    if (form && !complete) { setConfirm(true); scroll.current?.scrollTo({y:0,animated:false}); return; }
    if (form) { menu(); return; }
    if (router.canGoBack()) router.back(); else router.replace('/(tabs)/practice');
  }
  function openCheck() { setChecking(true); setReviewJump(false); setSubmitConfirm(false); }
  function jumpTo(i: number) { setIndex(i); setReviewJump(true); setChecking(false); setSubmitConfirm(false); }
  function finish(expired:boolean,left:number) {
    if (settled.current) return;
    settled.current=true;
    setTimedOut(expired);
    const minutes=form?minutesForForm(form.id):undefined;
    if (deadlineRef.current!==null&&minutes!==undefined) setUsedMs(Math.max(0,minutes*60000-left));
    setConfirm(false);
    setComplete(true);
    setChecking(false);
    setReviewJump(false);
    setSubmitConfirm(false);
  }
  function canContinue() {
    if (settled.current) return false;
    const d=deadlineRef.current;
    if (d!==null&&remainingMs(d,Date.now())===0) {
      finish(true,0);
      return false;
    }
    return true;
  }
  function submit() {
    if (!canContinue()) return;
    const d=deadlineRef.current;
    const left=d===null?0:remainingMs(d,Date.now());
    finish(d!==null&&left===0,left);
  }
  function answer(value:number|null) {
    if (canContinue()) setAnswers(old=>old.map((a,j)=>j===index?value:a));
  }
  function next(skip=false) {
    if (!form || !question || !canContinue()) return;
    if (!skip && answers[index] == null) return;
    if (reviewJump || index === form.items.length - 1) openCheck();
    else setIndex(index+1);
  }

  if (construction) return <ConstructionPractice onExit={()=>setConstruction(false)}/>;
  if (visual) return <VisualSearch onExit={()=>setVisual(false)}/>;
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <Pressable accessibilityRole="button" accessibilityLabel="חזרה" onPress={leave} style={styles.back}><Text style={styles.backLabel}>‹</Text></Pressable>
      <Text accessibilityRole="header" style={styles.heading}>מבחני חשיבה וריכוז</Text>
    </View>
    {deadline!==null&&!complete&&<View style={[styles.timer,msLeft<=60000&&styles.timerWarning]}>
      <Text style={styles.timerDigits} accessibilityLabel={showTimer?`זמן נותר ${timerText(msLeft)}`:'השעון פועל'}>
        {showTimer?timerText(msLeft):'השעון פועל'}
      </Text>
      <Pressable accessibilityRole="button" accessibilityLabel={showTimer?'הסתרת שעון':'הצגת שעון'} onPress={()=>setShowTimer(v=>!v)} style={styles.timerToggle}>
        <Text style={styles.kicker}>{showTimer?'הסתרה':'הצגה'}</Text>
      </Pressable>
      <Text style={styles.note} accessibilityLiveRegion="polite">{msLeft<=60000?'דקה אחרונה':'מצב מתוזמן'}</Text>
    </View>}
    <ScrollView ref={scroll} contentContainerStyle={styles.content}>
      {confirm ? <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>לחזור לרשימת המבחנים?</Text>
        <Text style={styles.body}>התשובות במבחן הנוכחי לא יישמרו.{deadline!==null?' הטיימר ממשיך לספור גם במסך הזה.':''}</Text>
        <Action title="המשך למבחן" onPress={()=>setConfirm(false)} />
        <Action title="יציאה מהמבחן" onPress={menu} secondary />
      </View> : !form ? <>
        <View style={styles.hero}>
          <Text style={styles.kicker}>פסיכוטכני פלוס · מבחנים מיוחדים</Text>
          <Text accessibilityRole="header" style={styles.title}>איך תרצו להתאמן?</Text>
          <Text style={styles.body}>בחרו אתגר עם ספירה לאחור, או תרגלו בקצב אישי. בחיפוש החזותי מסמנים את המטרות ישירות על הלוח.</Text>
        </View>
        <View style={styles.hero}>
          <Text style={styles.kicker}>חדש · משחק אינטראקטיבי</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>חיפוש חזותי אינטראקטיבי</Text>
          <Text style={styles.body}>{visualSearchItems.length} לוחות ב־{new Set(visualSearchItems.map(q=>q.kind)).size} סוגים. תרגלו מסלול מעורב או התמקדו בסוג אחד.</Text>
          <Action title="פתיחת חיפוש חזותי אינטראקטיבי" onPress={()=>setVisual(true)}/>
        </View>
        <View style={styles.hero}>
          <Text style={styles.kicker}>חדש · בונים תשובות</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>מעבדת חשיבה אינטראקטיבית</Text>
          <Text style={styles.body}>{constructionItems.length} משימות שבהן מסדרים, משייכים, מסמנים, בונים לוח או מקלידים מספר. כולל ניקוד חלקי ודוח לפי יכולת.</Text>
          <Action title="פתיחת מעבדת חשיבה אינטראקטיבית" onPress={()=>setConstruction(true)}/>
        </View>
        {[
          { title: 'חשיבה בסגנון IQ', notice, forms: reasoningForms },
          { title: 'ריכוז ודיוק', notice: attentionNotice, forms: attentionForms.filter(f=>f.id!=='scan') },
        ].map(section=><View key={section.title} style={styles.group}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{section.title}</Text>
          <Text style={styles.note}>{section.notice}</Text>
          {section.forms.map(f=><View key={f.id} style={styles.panel}>
            <Text style={styles.sectionTitle}>{f.title}</Text>
            <Text style={styles.body}>{f.description ?? 'חשיבה מילולית, לוגית, כמותית ומרחבית.'}</Text>
            <Text style={styles.note}>{f.items.length} שאלות · תוצאות והסברים בסיום</Text>
            {minutesForForm(f.id)!==undefined&&<>
              <Text style={styles.note}>במצב מתוזמן השעון ממשיך גם ברקע ובהגעה לאפס התשובות מוגשות אוטומטית.</Text>
              <Action title={`${f.title} · ${minutesForForm(f.id)} דקות`} onPress={()=>start(f,minutesForForm(f.id))}/>
            </>}
            <Action title={minutesForForm(f.id)!==undefined?`${f.title} · ללא הגבלת זמן`:`להתחיל את ${f.title}`} onPress={()=>start(f)} secondary={minutesForForm(f.id)!==undefined}/>
          </View>)}
        </View>)}
        <Text style={styles.note}>התוצאות מוצגות במכשיר בסיום ולא נשמרות בפרופיל.</Text>
      </> : result ? <>
        <View style={styles.hero}>
          <Text style={styles.kicker}>{form.title} · תוצאות</Text>
          <Text accessibilityRole="header" style={styles.title}>{result.correct} מתוך {result.total} נכונות</Text>
          <Text style={styles.body}>{result.correct} נכונות · {result.wrong} שגויות · {result.skipped} ללא תשובה</Text>
          <Text style={styles.body}>ציון תרגול: {percent(result.overallAccuracy)} · דיוק מבין השאלות שנענו: {percent(result.attemptedAccuracy)} · השלמה: {percent(result.completion)}</Text>
          {usedMs!==null&&<Text style={styles.body}>{timedOut?'הזמן נגמר. התשובות הוגשו אוטומטית.':'המבחן הוגש לפני תום הזמן.'} זמן שנוצל: {timerText(usedMs)}.</Text>}
          <Text style={styles.note}>{isAttention ? attentionNotice : notice}</Text>
        </View>
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.sectionTitle}>דיוק לפי תחום</Text>
          {result.byDomain.map(r=><View key={r.name} style={styles.domainRow}>
            <Text style={styles.score}>{r.correct}/{r.total}</Text>
            <Text style={styles.body}>{reasoningDomains[r.name as keyof typeof reasoningDomains]} · {r.wrong} שגויות · {r.skipped} פתוחות</Text>
          </View>)}
        </View>
        <Action title={review?'הסתרת פירוט התשובות':'הצגת התשובות וההסברים'} onPress={()=>setReview(r=>!r)} secondary />
        {review&&<Action title={onlyIncorrect?'כל התשובות':'רק שאלות לשיפור'} onPress={()=>setOnlyIncorrect(v=>!v)} secondary/>}
        {review&&onlyIncorrect&&result.correct===result.total&&<Text style={styles.note}>אין שאלות לשיפור בניסיון הזה.</Text>}
        {review && form.items.map((q,i)=>(!onlyIncorrect||answers[i]!==q.answer)&&<View key={q.id} style={styles.panel}>
          <Text style={styles.kicker}>שאלה {i+1} · {reasoningDomains[q.domain]}</Text>
          <Text style={styles.sectionTitle}>{q.prompt}</Text>
          {q.board && <Board rows={q.board}/>}
          <Text style={styles.body}>התשובה שלך: {answers[i]==null?'לא נענתה':q.options[answers[i] as number]}</Text>
          <Text style={styles.score}>תשובה נכונה: {q.options[q.answer]}</Text>
          {q.optionGrids && <Diagram cells={q.optionGrids[q.answer]} size={68} side={q.gridSize}/>}
          <Text style={styles.body}>{q.explanation}</Text>
        </View>)}
        <Action title="לבחירת מבחן אחר" onPress={menu}/>
      </> : checking && submitConfirm ? <View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>להגיש עם שאלות פתוחות?</Text>
        <Text style={styles.body}>לא נענו {form.items.length-answered} שאלות. הן ייכללו בסך השאלות ולא יוסיפו נקודות.</Text>
        <Action title="לחזור לבדיקה" onPress={()=>setSubmitConfirm(false)} />
        <Action title="להגיש ולהציג תוצאות" onPress={submit} secondary />
      </View> : checking ? <>
        <View style={styles.hero}>
          <Text style={styles.kicker}>{form.title}</Text>
          <Text accessibilityRole="header" style={styles.title}>בדיקה לפני הגשה</Text>
          <Text style={styles.body}>נענו {answered} מתוך {form.items.length}. אפשר לפתוח כל שאלה ולשנות תשובה לפני ההגשה.</Text>
        </View>
        <View style={styles.panel}>
          <View style={styles.reviewGrid}>
            {form.items.map((q,i)=><Pressable key={q.id} onPress={()=>jumpTo(i)} accessibilityRole="button"
              accessibilityLabel={`שאלה ${i+1}, ${answers[i]==null?'ללא תשובה':'נענתה'}`}
              style={({pressed})=>[styles.reviewTile,answers[i]!=null&&styles.reviewAnswered,pressed&&styles.pressed]}>
              <Text style={styles.tileLabel}>{i+1}</Text>
              <Text style={styles.tileStatus}>{answers[i]==null?'פתוחה':'נענתה'}</Text>
            </Pressable>)}
          </View>
        </View>
        {answered<form.items.length && <Action title="לשאלה הראשונה ללא תשובה" onPress={()=>jumpTo(answers.findIndex(a=>a==null))} secondary />}
        <Action title="הגשת המבחן" onPress={()=>answered<form.items.length?setSubmitConfirm(true):submit()} />
        <Action title="חזרה לשאלה הנוכחית" onPress={()=>setChecking(false)} secondary />
      </> : question && <>
        <View style={styles.panel}>
          <Text style={styles.kicker} accessibilityLiveRegion="polite">{form.title} · שאלה {index+1} מתוך {form.items.length}</Text>
          <View style={styles.track}><View style={[styles.fill,{width:`${((index+1)/form.items.length)*100}%`}]}/></View>
          <Text style={styles.note}>{reasoningDomains[question.domain]} · נענו {answered} מתוך {form.items.length}</Text>
          <Text accessibilityRole="header" style={styles.sectionTitle}>{question.prompt}</Text>
          {question.board && <Board rows={question.board}/>}
          {question.grid && <Diagram cells={question.grid} side={question.gridSize}/>}
        </View>
        <View style={question.grid?styles.gridOptions:styles.textOptions}>
          {question.options.map((option,i)=><Pressable key={`${question.id}-${i}`} accessibilityRole="radio"
            accessibilityState={{checked:answers[index]===i}} aria-checked={answers[index]===i}
            accessibilityLabel={question.optionGrids?`${option}: ${question.optionGrids[i].map(p=>`שורה ${Math.floor(p/(question.gridSize??3))+1}, עמודה ${p%(question.gridSize??3)+1} משמאל`).join('; ')}`:option}
            onPress={()=>answer(i)}
            style={({pressed})=>[styles.option,question.grid&&styles.gridOption,answers[index]===i&&styles.selected,pressed&&styles.pressed]}>
            {question.optionGrids && <Diagram cells={question.optionGrids[i]} size={62} side={question.gridSize}/>}
            <Text style={styles.optionLabel}>{question.grid?option:`${letters[i]}. ${option}`}</Text>
          </Pressable>)}
        </View>
        {reviewJump || index===form.items.length-1
          ? <Action title="לבדיקה לפני הגשה" onPress={openCheck} />
          : <Action title="לשאלה הבאה" onPress={()=>next()} disabled={answers[index]==null}/>}
        {!reviewJump && index<form.items.length-1 && answers[index]==null && <Action title="דלג על השאלה" onPress={()=>next(true)} secondary/>}
        {answers[index]!=null && <Action title="ניקוי התשובה" onPress={()=>answer(null)} secondary/>}
        {!reviewJump && index>0 && <Action title="לשאלה הקודמת" onPress={()=>setIndex(index-1)} secondary/>}
        {!reviewJump && index<form.items.length-1 && <Action title="סקירת השאלות" onPress={openCheck} secondary/>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.background},
  header:{width:'100%',maxWidth:740,alignSelf:'center',paddingHorizontal:16,paddingVertical:9,alignItems:'center',flexDirection:'row',gap:12},
  back:{minWidth:44,minHeight:44,alignItems:'center',justifyContent:'center',backgroundColor:Colors.surface,borderRadius:12},
  backLabel:{color:Colors.text,fontSize:29},
  heading:{flex:1,textAlign:'right',color:Colors.text,fontFamily:FontFamily.bold,fontSize:20},
  timer:{width:'100%',maxWidth:740,alignSelf:'center',minHeight:44,paddingHorizontal:16,backgroundColor:'#192442',flexDirection:'row',justifyContent:'space-between',alignItems:'center',gap:8},
  timerWarning:{backgroundColor:'#682533'},
  timerDigits:{color:Colors.text,fontFamily:FontFamily.bold,fontVariant:['tabular-nums'],fontSize:21},
  timerToggle:{paddingHorizontal:8,minHeight:44,justifyContent:'center'},
  content:{width:'100%',maxWidth:740,alignSelf:'center',padding:16,paddingBottom:36,gap:12},
  hero:{backgroundColor:'#192442',padding:17,borderRadius:Radius.lg,borderColor:'#405780',borderWidth:1,gap:9},
  panel:{backgroundColor:Colors.background2,padding:15,borderRadius:Radius.lg,borderColor:Colors.border,borderWidth:1,gap:9},
  kicker:{color:Colors.cyan,fontFamily:FontFamily.bold,fontSize:14,textAlign:'right',writingDirection:'rtl'},
  title:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:27,textAlign:'right',writingDirection:'rtl'},
  sectionTitle:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:19,textAlign:'right',writingDirection:'rtl'},
  body:{color:Colors.textSecondary,fontFamily:FontFamily.regular,fontSize:16,textAlign:'right',writingDirection:'rtl'},
  note:{color:'#C7D4EB',fontFamily:FontFamily.regular,fontSize:14,textAlign:'right',writingDirection:'rtl'},
  action:{paddingHorizontal:13,paddingVertical:11,borderRadius:12,minHeight:48,justifyContent:'center',backgroundColor:'#AB9CFF'},
  secondary:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border},
  disabled:{opacity:0.48},
  pressed:{opacity:.8},
  actionLabel:{fontFamily:FontFamily.bold,fontSize:16,color:'#120E29',textAlign:'center'},
  secondaryLabel:{color:Colors.text},
  group:{gap:9},
  board:{gap:5,padding:7,backgroundColor:'#18253C',borderRadius:12},
  boardRow:{direction:'ltr',gap:3},
  cue:{color:Colors.cyan,fontFamily:FontFamily.bold,textAlign:'right',writingDirection:'rtl',fontSize:14},
  cells:{direction:'ltr',flexDirection:'row',gap:4},
  cell:{flex:1,alignItems:'center',justifyContent:'center',minHeight:34,borderRadius:6,backgroundColor:'#263653'},
  token:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:17,textAlign:'center',writingDirection:'ltr'},
  diagram:{alignSelf:'center'},
  gridOptions:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between',rowGap:8},
  textOptions:{gap:8},
  option:{backgroundColor:Colors.surface,minHeight:49,borderRadius:12,borderWidth:2,borderColor:'transparent',padding:11,justifyContent:'center'},
  gridOption:{width:'49%',alignItems:'center',gap:4},
  optionLabel:{color:Colors.text,fontFamily:FontFamily.medium,fontSize:16,textAlign:'right',writingDirection:'rtl'},
  selected:{borderColor:Colors.cyan,backgroundColor:'#233A54'},
  track:{height:5,borderRadius:5,backgroundColor:'#394266',overflow:'hidden'},
  fill:{height:5,backgroundColor:Colors.cyan,borderRadius:5,alignSelf:'flex-end'},
  domainRow:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',borderTopWidth:1,borderColor:Colors.border,paddingTop:7,gap:8},
  reviewGrid:{flexDirection:'row-reverse',flexWrap:'wrap',gap:8},
  reviewTile:{alignItems:'center',justifyContent:'center',flexBasis:'22%',flexGrow:0,minHeight:50,borderWidth:1,borderColor:'#7182a1',borderRadius:9,backgroundColor:'#202a42'},
  reviewAnswered:{borderColor:Colors.cyan,backgroundColor:'#173a4a'},
  tileLabel:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:16},
  tileStatus:{color:Colors.textSecondary,fontFamily:FontFamily.regular,fontSize:12},
  score:{color:Colors.cyan,fontFamily:FontFamily.bold,fontSize:16,textAlign:'right'},
});
