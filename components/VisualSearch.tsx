import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '../constants/colors';
import { FontFamily, Radius } from '../constants/theme';
import { visualSearchItems, type VisualSearchItem } from '../data/attentionTests';

type Markings = readonly number[] | null;
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
          const label=`שורה ${row+1}, עמודה ${col+1} משמאל: ${token}`;
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

const initial=():Markings[]=>Array(visualSearchItems.length).fill(null);
export function VisualSearch({onExit}:{onExit:()=>void}){
  const scroll=useRef<ScrollView>(null);
  const [answers,setAnswers]=useState(initial);
  const [index,setIndex]=useState(0);
  const [done,setDone]=useState(false);
  const [quit,setQuit]=useState(false);
  const [confirm,setConfirm]=useState(false);
  const [reviewIndex,setReviewIndex]=useState<number|null>(null);
  const item=visualSearchItems[index];
  const selected=answers[index]??[];
  const total=visualSearchItems.length;
  const answered=answers.filter(a=>a!==null).length;
  const stats=useMemo(()=>{
    if(!done) return null;
    let perfect=0,hits=0,misses=0,falseMarks=0;
    for(const [i,q] of visualSearchItems.entries()){
      const picked=answers[i]??[];
      const good=q.targets.filter(t=>picked.includes(t)).length;
      const bad=picked.length-good;
      hits+=good; misses+=q.targets.length-good; falseMarks+=bad;
      if(good===q.targets.length&&!bad) perfect++;
    }
    return {perfect,hits,misses,falseMarks};
  },[answers,done]);
  useEffect(()=>{scroll.current?.scrollTo({y:0,animated:false});},[index,done,quit,confirm,reviewIndex]);
  useEffect(()=>{
    const sub=BackHandler.addEventListener('hardwareBackPress',()=>{
      if(done) onExit();
      else if(quit) setQuit(false);
      else if(confirm) setConfirm(false);
      else setQuit(true);
      return true;
    });
    return ()=>sub.remove();
  },[onExit,done,quit,confirm]);
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
    if(done) onExit();
    else if(confirm) setConfirm(false);
    else if(quit) setQuit(false);
    else setQuit(true);
  }
  const reviewItem=reviewIndex===null?null:visualSearchItems[reviewIndex];
  return <SafeAreaView style={styles.safe}>
    <View style={styles.header}>
      <Button title="חזרה" onPress={back} secondary/>
      <Text accessibilityRole="header" style={styles.heading}>חיפוש חזותי</Text>
    </View>
    <ScrollView ref={scroll} contentContainerStyle={styles.content}>
      {quit&&!done?<View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>לצאת מהתרגול?</Text>
        <Text style={styles.body}>הסימונים בניסיון הזה לא יישמרו.</Text>
        <Button title="המשך לתרגול" onPress={()=>setQuit(false)}/>
        <Button title="יציאה לרשימת המבחנים" onPress={onExit} secondary/>
      </View>:stats?<View style={styles.group}>
        <View style={styles.hero}>
          <Text style={styles.kicker}>תוצאות · חיפוש חזותי</Text>
          <Text accessibilityRole="header" style={styles.title}>{stats.perfect} מתוך {total} לוחות מדויקים</Text>
          <Text style={styles.body}>מטרות שזוהו: {stats.hits} · מטרות שהוחמצו: {stats.misses} · סימונים שגויים: {stats.falseMarks}</Text>
          <Text style={styles.note}>לוח מדויק הוא לוח שבו סומנו כל המטרות ורק הן. לוחות שדולגו נספרים כלא מדויקים. זה תרגול, לא אבחון.</Text>
        </View>
        <View style={styles.panel}>
          <Text accessibilityRole="header" style={styles.section}>סקירת הלוחות</Text>
          <View style={styles.picker}>
            {visualSearchItems.map((q,i)=><Pressable key={q.id} accessibilityRole="button" accessibilityLabel={`הסבר ללוח ${i+1}`}
              onPress={()=>setReviewIndex(i)} style={[styles.pick,i===reviewIndex&&styles.marked]}><Text style={styles.symbol}>{i+1}</Text></Pressable>)}
          </View>
          {reviewItem&&reviewIndex!==null&&<>
            <Text style={styles.kicker}>לוח {reviewIndex+1} · {reviewItem.kind}</Text>
            <Text style={styles.body}>{reviewItem.prompt}</Text>
            <Board item={reviewItem} selected={answers[reviewIndex]??[]} reveal/>
            <Text style={styles.note}>✓ זוהתה · + הוחמצה · × סימון שגוי</Text>
            <Text style={styles.body}>{reviewItem.explanation}</Text>
          </>}
        </View>
        <Button title="תרגול חוזר" onPress={()=>{setAnswers(initial());setIndex(0);setDone(false);setReviewIndex(null);setConfirm(false);}}/>
        <Button title="למבחנים נוספים" onPress={onExit} secondary/>
      </View>:confirm?<View style={styles.panel}>
        <Text accessibilityRole="header" style={styles.title}>להגיש עם לוחות פתוחים?</Text>
        <Text style={styles.body}>{total-answered} לוחות ללא סימונים. אפשר לחזור אליהם לפני ההגשה.</Text>
        <Button title="ללוח הראשון ללא סימונים" onPress={()=>{setIndex(answers.findIndex(a=>a===null));setConfirm(false);}}/>
        <Button title="הגשה והצגת תוצאות" onPress={()=>{setConfirm(false);setDone(true);}} secondary/>
      </View>:<>
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
