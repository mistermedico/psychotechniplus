import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { FontFamily, Radius } from '../constants/theme';
import { visualSearchItems, type VisualSearchItem } from '../data/attentionTests';
import { hitScore, percent, scoreVisual } from '../data/practiceScoring';

type Markings = readonly number[] | null;
const allKinds=[...new Set(visualSearchItems.map(q=>q.kind))];
const spoken=(token:string)=>token.replace(/○/g,'עיגול ').replace(/△/g,'משולש ').replace(/□/g,'ריבוע ').replace(/◇/g,'מעוין ');
function Board({ item, selected, onToggle, reveal=false }: {
  item:VisualSearchItem; selected:readonly number[]; onToggle?:(index:number)=>void; reveal?:boolean;
}) {
  let index=0;
  return <View style={styles.board}>
    {item.board.map(({tokens,cue},row)=><View key={row} style={styles.rowBlock}>
      {!!cue&&<Text style={styles.note}>{cue}</Text>}
      <View style={styles.row}>
        {tokens.map((token,col)=>{
          const i=index++;
          const marked=selected.includes(i);
          const target=reveal&&item.targets.includes(i);
          const error=reveal&&marked&&!target;
          const label=`שורה ${row+1}, עמודה ${col+1} משמאל: ${spoken(token)}`;
          const flags=target?(marked?' ✓':' +'):error?' ×':marked?' ✓':'';
          const style=[styles.cell,marked&&styles.marked,target&&styles.target,error&&styles.error];
          if (!onToggle) return <View key={i} accessible
            accessibilityLabel={label+(target?(marked?', זוהתה':', הוחמצה'):error?', סימון שגוי':'')}
            style={style}><Text style={styles.symbol} adjustsFontSizeToFit numberOfLines={1}>{token}{flags}</Text></View>;
          return <Pressable key={i} accessibilityRole="checkbox" accessibilityLabel={label}
            accessibilityState={{checked:marked}} aria-checked={marked}
            onPress={()=>onToggle(i)} style={({pressed})=>[...style,pressed&&styles.pressed]}>
            <Text style={styles.symbol} adjustsFontSizeToFit numberOfLines={1}>{token}{flags}</Text>
          </Pressable>;
        })}
      </View>
    </View>)}
  </View>;
}

function Button({title,onPress,secondary=false,disabled=false}: {
  title:string; onPress:()=>void; secondary?:boolean; disabled?:boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{disabled}} disabled={disabled}
    onPress={onPress} style={({pressed})=>[styles.button,secondary&&styles.secondary,disabled&&styles.disabled,pressed&&styles.pressed]}>
    <Text style={[styles.buttonText,secondary&&styles.secondaryText]}>{title}</Text>
  </Pressable>;
}

export function VisualSearch({onExit}:{onExit:()=>void}){
  const scroll=useRef<ScrollView>(null);
  const [items,setItems]=useState<readonly VisualSearchItem[]>([]);
  const [answers,setAnswers]=useState<Markings[]>([]);
  const [index,setIndex]=useState(0);
  const [done,setDone]=useState(false);
  const [quit,setQuit]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [reviewIndex,setReviewIndex]=useState<number|null>(null);
  const [onlyMisses,setOnlyMisses]=useState(false);
  const item=items[index];
  const selected=answers[index]??[];
  const total=items.length;
  const answered=answers.filter(a=>a!==null).length;
  const stats=useMemo(()=>done?scoreVisual(items,answers):null,[items,answers,done]);
  const focus=stats?.skipped!==stats?.total
    ? stats?.byKind.filter(r=>r.skipped<r.total&&r.index!==null&&r.index<1).sort((a,b)=>(a.index??1)-(b.index??1))[0] : undefined;
  function start(list:readonly VisualSearchItem[]){
    setItems(list);
    setAnswers(Array(list.length).fill(null));
    setIndex(0);setDone(false);setConfirm(false);setQuit(false);setReviewIndex(null);setOnlyMisses(false);
  }
  function mixed(){
    start(allKinds.map((kind,i)=>{
      const group=visualSearchItems.filter(q=>q.kind===kind);
      return group[i%group.length];
    }));
  }
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[index,done,quit,confirm,items]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(!total) onExit();
      else if(done) start([]);
      else if(quit) setQuit(false);
      else if(confirm) setConfirm(false);
      else setQuit(true);
      return true;
    });
    return ()=>sub.remove();
  },[onExit,done,quit,confirm,total]);
  function update(value:Markings){setAnswers(old=>old.map((v,i)=>i===index?value:v));}
  function toggle(value:number){setAnswers(old=>old.map((v,i)=>{
    if(i!==index)return v;
    const previous=v??[];
    const next=previous.includes(value)?previous.filter(n=>n!==value):[...previous,value];
    return next.length?next:null;
  }));}
  function forward(){
    if(index+1<total) setIndex(index+1);
    else if(answered<total) setConfirm(true);
    else setDone(true);
  }
  function back(){
    if(!total) onExit();
    else if(done) start([]);
    else if(confirm) setConfirm(false);
    else if(quit) setQuit(false);
    else setQuit(true);
  }
  const reviewItem=reviewIndex===null?null:items[reviewIndex];
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <Button title="חזרה" onPress={back} secondary/>
      <Text accessibilityRole="header" style={styles.heading}>חיפוש חזותי</Text>
    </View>
    <ScrollView ref={scroll} contentContainerStyle={styles.content}>
      {!total?<View style={styles.group}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>אימון חיפוש חזותי</Text>
          <Text accessibilityRole="header" style={styles.title}>איך תרצו לתרגל?</Text>
          <Text style={styles.body}>{visualSearchItems.length} לוחות, {allKinds.length} סוגי חיפוש. אפשר לערבב סוגים או להתמקד בכלל אחד.</Text>
          <Button title={`מסלול מעורב · ${allKinds.length} לוחות`} onPress={mixed}/>
          <Button title={`כל הלוחות · ${visualSearchItems.length}`} onPress={()=>start(visualSearchItems)} secondary/>
        </View>
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.section}>אימון ממוקד לפי סוג</Text>
          {allKinds.map(kind=><Button key={kind} title={kind} secondary onPress={()=>start(visualSearchItems.filter(q=>q.kind===kind))}/>)}
        </View>
      </View>:quit&&!done?<View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>לצאת מהתרגול?</Text>
        <Text style={styles.body}>הסימונים בניסיון הזה לא יישמרו.</Text>
        <Button title="המשך לתרגול" onPress={()=>setQuit(false)}/>
        <Button title="יציאה לבחירת מסלול" onPress={()=>start([])} secondary/>
      </View>:stats?<View style={styles.group}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>תוצאות · חיפוש חזותי</Text>
          <Text accessibilityRole="header" style={styles.title}>{stats.exact} מתוך {total} לוחות מדויקים</Text>
          <Text style={styles.body}>מטרות שזוהו: {stats.hits} · מטרות שהוחמצו: {stats.misses} · סימונים שגויים: {stats.falseMarks}</Text>
          <Text style={styles.section}>מדד איתור משולב: {percent(stats.index)}</Text>
          <Text style={styles.body}>דיוק הסימונים: {percent(stats.precision)} · כיסוי המטרות: {percent(stats.coverage)} · לוחות פתוחים: {stats.skipped}</Text>
          <Text style={styles.note}>מדד האיתור הוא 2×זיהויים חלקי (2×זיהויים + החמצות + סימונים שגויים). ״—״ מציין שלא היו סימונים למדוד.</Text>
          <Text style={styles.note}>לוח מדויק הוא לוח שבו סומנו כל המטרות ורק הן. לוחות שדולגו נספרים כלא מדויקים. זה תרגול, לא אבחון.</Text>
        </View>
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.section}>ביצועים לפי סוג חיפוש</Text>
          {stats.byKind.map(row=><View key={row.name} style={styles.rowBlock}>
            <Text style={styles.kicker}>{row.name} · {percent(row.index)}</Text>
            <Text style={styles.note}>{row.hits} זוהו · {row.misses} הוחמצו · {row.falseMarks} סימונים שגויים</Text>
          </View>)}
          {focus&&<Button title={`תרגול ממוקד: ${focus.name}`} onPress={()=>start(visualSearchItems.filter(q=>q.kind===focus.name))} secondary/>}
        </View>
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.section}>סקירת הלוחות</Text>
          <Button title={onlyMisses?'הצגת כל הלוחות':'סינון ללוחות לשיפור'} secondary onPress={()=>{setOnlyMisses(v=>!v);setReviewIndex(null);}}/>
          <View style={styles.picker}>
            {items.map((q,i)=>!onlyMisses||answers[i]===null||!hitScore(answers[i]??[],q.targets).exact?<Pressable key={q.id} accessibilityRole="button" accessibilityLabel={`הסבר ללוח ${i+1}`}
              onPress={()=>setReviewIndex(i)} style={[styles.pick,i===reviewIndex&&styles.marked]}><Text style={styles.symbol}>{i+1}</Text></Pressable>:null)}
          </View>
          {reviewItem&&reviewIndex!==null&&<>
            <Text style={styles.kicker}>לוח {reviewIndex+1} · {reviewItem.kind}</Text>
            <Text style={styles.body}>{reviewItem.prompt}</Text>
            <Board item={reviewItem} selected={answers[reviewIndex]??[]} reveal/>
            <Text style={styles.note}>✓ זוהתה · + הוחמצה · × סימון שגוי</Text>
            <Text style={styles.body}>{reviewItem.explanation}</Text>
          </>}
        </View>
        <Button title="תרגול חוזר" onPress={()=>start(items)}/>
        <Button title="לבחירת מסלול חיפוש" onPress={()=>start([])} secondary/>
        <Button title="למבחנים נוספים" onPress={onExit} secondary/>
      </View>:confirm?<View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>להגיש עם לוחות פתוחים?</Text>
        <Text style={styles.body}>{total-answered} לוחות ללא סימונים. אפשר לחזור אליהם לפני ההגשה.</Text>
        <Button title="להמשיך בלוח הנוכחי" onPress={()=>setConfirm(false)} secondary/>
        <Button title="ללוח הראשון ללא סימונים" onPress={()=>{setIndex(answers.findIndex(a=>a===null));setConfirm(false);}}/>
        <Button title="הגשה והצגת תוצאות" onPress={()=>{setConfirm(false);setDone(true);}} secondary/>
      </View>:item&&<>
        <View style={styles.hero}>
          <Text style={styles.kicker} accessibilityLiveRegion="polite">לוח {index+1} מתוך {total} · {item.kind}</Text>
          <Text accessibilityRole="header" style={styles.section}>{item.prompt}</Text>
          <Text style={styles.note}>לחצו על תאים לסימון, ולחצו שוב לביטול. אין הגבלת זמן.</Text>
        </View>
        <View style={styles.panel}>
          <Board item={item} selected={selected} onToggle={toggle}/>
          <Text accessibilityLiveRegion="polite" style={styles.note}>תאים מסומנים: {selected.length}</Text>
        </View>
        <Button title={index+1<total?'ללוח הבא':'לסיום התרגול'} onPress={forward} disabled={!selected.length}/>
        {!selected.length&&<Button title={index+1<total?'דלג על הלוח':'בדיקה והגשה'} onPress={forward} secondary/>}
        {selected.length>0&&<Button title="ניקוי סימונים" onPress={()=>update(null)} secondary/>}
        {index>0&&<Button title="ללוח הקודם" onPress={()=>setIndex(i=>i-1)} secondary/>}
        {index+1<total&&<Button title="הגשה מוקדמת" onPress={()=>answered<total?setConfirm(true):setDone(true)} secondary/>}
      </>}
    </ScrollView>
  </SafeAreaView>;
}

const styles=StyleSheet.create({
  safe:{flex:1,backgroundColor:Colors.background},
  header:{width:'100%',maxWidth:640,alignSelf:'center',paddingHorizontal:12,paddingVertical:8,alignItems:'center',flexDirection:'row',gap:10},
  heading:{flex:1,textAlign:'right',color:Colors.text,fontFamily:FontFamily.bold,fontSize:20},
  content:{width:'100%',maxWidth:640,alignSelf:'center',padding:12,paddingBottom:32,gap:12},
  group:{gap:12},
  hero:{backgroundColor:'#192442',padding:14,borderRadius:Radius.lg,borderColor:'#405780',borderWidth:1,gap:8},
  panel:{backgroundColor:Colors.background2,padding:12,borderRadius:Radius.lg,borderColor:Colors.border,borderWidth:1,gap:8},
  board:{padding:4,gap:4},
  rowBlock:{gap:3},
  row:{direction:'ltr',flexDirection:'row',gap:4},
  cell:{flex:1,minWidth:0,minHeight:46,alignItems:'center',justifyContent:'center',backgroundColor:'#263653',borderWidth:2,borderColor:'#263653',borderRadius:8,paddingHorizontal:1},
  marked:{backgroundColor:'#173C54',borderColor:Colors.cyan},
  target:{backgroundColor:'#164837',borderColor:'#5FDEAD'},
  error:{backgroundColor:'#662838',borderColor:'#FF9FA9'},
  symbol:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:18,textAlign:'center',writingDirection:'ltr'},
  kicker:{color:Colors.cyan,fontFamily:FontFamily.bold,fontSize:14,textAlign:'right',writingDirection:'rtl'},
  title:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:25,textAlign:'right',writingDirection:'rtl'},
  section:{color:Colors.text,fontFamily:FontFamily.bold,fontSize:20,textAlign:'right',writingDirection:'rtl'},
  body:{color:Colors.textSecondary,fontFamily:FontFamily.regular,fontSize:16,textAlign:'right',writingDirection:'rtl'},
  note:{color:'#C7D4EB',fontFamily:FontFamily.regular,fontSize:14,textAlign:'right',writingDirection:'rtl'},
  button:{minHeight:46,paddingVertical:9,paddingHorizontal:12,borderRadius:11,justifyContent:'center',backgroundColor:'#AB9CFF'},
  secondary:{backgroundColor:Colors.surface,borderWidth:1,borderColor:Colors.border},
  buttonText:{fontFamily:FontFamily.bold,fontSize:16,textAlign:'center',color:'#120E29'},
  secondaryText:{color:Colors.text},
  pressed:{opacity:.8},
  disabled:{opacity:.48},
  picker:{flexDirection:'row-reverse',flexWrap:'wrap',gap:5},
  pick:{width:44,height:44,justifyContent:'center',alignItems:'center',backgroundColor:'#263653',borderColor:'#52617A',borderWidth:1,borderRadius:8},
});
