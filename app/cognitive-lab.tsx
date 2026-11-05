import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { AdBanner } from '../components/AdBanner';
import { PremiumUpgradeCard } from '../components/PremiumUpgradeCard';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';
import { useAdminStore } from '../store/adminStore';
import { useUserStore } from '../store/userStore';
import { showInterstitialAfterSession } from '../lib/ads';
import { logger } from '../utils/logger';

type GameId = 'memory' | 'reaction' | 'pressure' | 'switching' | 'coding' | 'sequence' | 'scanning' | 'spatial' | 'inhibition' | 'dual';
type Phase = 'menu' | 'intro' | 'memorize' | 'play' | 'result';

const GAMES: Record<GameId, { title: string; subtitle: string; icon: string; color: string; seconds: number; premium?: boolean }> = {
  memory: { title: 'זיכרון עבודה', subtitle: 'זכור רצף סמלים ושחזר אותו בדיוק', icon: '🧠', color: Colors.cyan, seconds: 35 },
  reaction: { title: 'זריזות תגובה', subtitle: 'זהה במהירות את הסמל החריג', icon: '⚡', color: Colors.warning, seconds: 30 },
  pressure: { title: 'דיוק תחת לחץ', subtitle: 'פתור כמה שיותר השוואות לפני שהזמן נגמר', icon: '⏱️', color: Colors.danger, seconds: 45 },
  switching: { title: 'גמישות מחשבתית', subtitle: 'החלף במהירות בין כללי מיון משתנים', icon: '🔁', color: '#9B8CFF', seconds: 40 },
  coding: { title: 'קידוד סמלים', subtitle: 'המר במהירות סמלים למספרים לפי המקרא', icon: '⌘', color: '#46C2FF', seconds: 45 },
  sequence: { title: 'השלמת רצפים', subtitle: 'זהה את החוק ובחר את המספר הבא', icon: '∑', color: '#F7B955', seconds: 45 },
  scanning: { title: 'סריקה חזותית', subtitle: 'ספור במהירות כמה פעמים מופיע סמל המטרה', icon: '⌕', color: '#64D8A5', seconds: 40 },
  spatial: { title: 'זיכרון מרחבי', subtitle: 'זכור את מיקום המשבצות המוארות ושחזר אותו', icon: '🧩', color: '#47D7AC', seconds: 45, premium: true },
  inhibition: { title: 'בקרת קשב', subtitle: 'פעל לפי משמעות המילה והתעלם מהצבע המטעה', icon: '🎯', color: '#FF78A8', seconds: 40, premium: true },
  dual: { title: 'קשב מפוצל', subtitle: 'עקוב אחר מספר וסמל במקביל תחת מגבלת זמן', icon: '🛰️', color: '#58B8FF', seconds: 50, premium: true },
};
const SYMBOLS = ['●', '▲', '■', '◆', '★', '✚'];
const DUAL_SYMBOLS = ['●', '○', '■', '□', '▲', '△'];
const COLORS = [
  { name: 'אדום', value: '#FF6B6B' },
  { name: 'כחול', value: '#4DABF7' },
  { name: 'ירוק', value: '#51CF66' },
  { name: 'צהוב', value: '#FFD43B' },
];

function randomInt(max: number) { return Math.floor(Math.random() * max); }
function makeMemorySequence(length: number) { return Array.from({ length }, () => SYMBOLS[randomInt(SYMBOLS.length)]); }
function makeReactionRound() {
  const common = SYMBOLS[randomInt(SYMBOLS.length)];
  const alternatives = SYMBOLS.filter(item => item !== common);
  const odd = alternatives[randomInt(alternatives.length)];
  const oddIndex = randomInt(9);
  return { oddIndex, cells: Array.from({ length: 9 }, (_, index) => index === oddIndex ? odd : common) };
}
function makePressureRound() {
  const left = 5 + randomInt(45);
  const right = 5 + randomInt(45);
  const operators = ['+', '-'] as const;
  const operator = operators[randomInt(operators.length)];
  const result = operator === '+' ? left + right : left - right;
  const shown = result + (Math.random() < 0.5 ? 0 : (Math.random() < 0.5 ? 1 : -1) * (1 + randomInt(3)));
  return { label: `${left} ${operator} ${right} = ${shown}`, correct: result === shown };
}
function makeSwitchRound() {
  const number = 1 + randomInt(9);
  const isEven = number % 2 === 0;
  const rule = Math.random() < 0.5 ? 'even' : 'high';
  return { number, rule, correct: rule === 'even' ? isEven : number >= 5 } as const;
}
function makeSpatialRound() {
  const selected = new Set<number>();
  while (selected.size < 4) selected.add(randomInt(16));
  return [...selected];
}
function makeInhibitionRound() {
  const word = COLORS[randomInt(COLORS.length)];
  const ink = COLORS[randomInt(COLORS.length)];
  return { word, ink };
}
function makeDualRound() {
  const number = 1 + randomInt(9);
  const symbol = DUAL_SYMBOLS[randomInt(DUAL_SYMBOLS.length)];
  return { number, symbol, correct: number >= 5 && ['●', '■', '▲'].includes(symbol) };
}
function makeCodingRound() {
  const shuffled = [...SYMBOLS].sort(() => Math.random() - 0.5).slice(0, 4);
  const targetIndex = randomInt(shuffled.length);
  return { symbols: shuffled, target: shuffled[targetIndex], correct: targetIndex + 1 };
}
function makeSequenceRound() {
  const start = 1 + randomInt(8);
  const step = 1 + randomInt(5);
  const values = Array.from({ length: 4 }, (_, index) => start + step * index);
  const correct = start + step * 4;
  const options = [correct, correct + step, correct - 1, correct + 1]
    .filter((value, index, all) => value > 0 && all.indexOf(value) === index)
    .sort(() => Math.random() - 0.5);
  while (options.length < 4) {
    const candidate = correct + 2 + options.length;
    if (!options.includes(candidate)) options.push(candidate);
  }
  return { values, correct, options };
}
function makeScanningRound() {
  const target = SYMBOLS[randomInt(SYMBOLS.length)];
  const count = 3 + randomInt(5);
  const cells = Array.from({ length: 16 }, (_, index) => index < count
    ? target
    : SYMBOLS.filter(symbol => symbol !== target)[randomInt(SYMBOLS.length - 1)]);
  cells.sort(() => Math.random() - 0.5);
  const options = [count, count + 1, Math.max(1, count - 1), count + 2]
    .filter((value, index, all) => all.indexOf(value) === index)
    .sort(() => Math.random() - 0.5);
  return { target, count, cells, options };
}

export default function CognitiveLab() {
  const insets = useSafeAreaInsets();
  const { isPremium, userId, name, recordSession } = useUserStore();
  const { isAdmin, addSessionRecord } = useAdminStore();
  const [game, setGame] = useState<GameId>('memory');
  const [phase, setPhase] = useState<Phase>('menu');
  const [remaining, setRemaining] = useState(0);
  const [score, setScore] = useState(0);
  const [attempts, setAttempts] = useState(0);
  const [startedAt, setStartedAt] = useState<Date | null>(null);
  const [memorySequence, setMemorySequence] = useState<string[]>([]);
  const [memoryInput, setMemoryInput] = useState<string[]>([]);
  const [reactionRound, setReactionRound] = useState(makeReactionRound);
  const [pressureRound, setPressureRound] = useState(makePressureRound);
  const [switchRound, setSwitchRound] = useState(makeSwitchRound);
  const [spatialSequence, setSpatialSequence] = useState<number[]>(makeSpatialRound);
  const [spatialInput, setSpatialInput] = useState<number[]>([]);
  const [inhibitionRound, setInhibitionRound] = useState(makeInhibitionRound);
  const [dualRound, setDualRound] = useState(makeDualRound);
  const [codingRound, setCodingRound] = useState(makeCodingRound);
  const [sequenceRound, setSequenceRound] = useState(makeSequenceRound);
  const [scanningRound, setScanningRound] = useState(makeScanningRound);
  const finishingRef = useRef(false);
  const answerLockedRef = useRef(false);
  const revealTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const answerUnlockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const config = GAMES[game];
  const accuracy = attempts > 0 ? Math.round((score / attempts) * 100) : 0;

  const finish = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    answerLockedRef.current = true;
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (answerUnlockTimerRef.current) clearTimeout(answerUnlockTimerRef.current);
    setPhase('result');
    const completedAt = new Date();
    const started = startedAt ?? completedAt;
    const total = Math.max(1, attempts);
    const correct = Math.min(score, total);
    if (userId) {
      const id = `cognitive_${game}_${Date.now()}`;
      try {
        const saved = await addSessionRecord({
          id,
          userId,
          userName: name || undefined,
          targetId: 'target_psychometric',
          topicId: `cognitive_${game}`,
          mode: `cognitive_${game}`,
          templateName: config.title,
          totalQuestions: total,
          correctAnswers: correct,
          skippedQuestions: 0,
          score: Math.round((correct / total) * 100),
          timeSpentSeconds: Math.max(1, Math.round((completedAt.getTime() - started.getTime()) / 1000)),
          startedAt: started.toISOString(),
          completedAt: completedAt.toISOString(),
          answers: [],
        });
        if (saved) recordSession(correct, total);
      } catch (error: any) {
        logger.warn('cognitive-lab', `Could not persist result: ${error?.message ?? String(error)}`);
      }
    }
    if (!isPremium && !isAdmin) showInterstitialAfterSession().catch(() => null);
  }, [addSessionRecord, attempts, config.title, game, isAdmin, isPremium, name, recordSession, score, startedAt, userId]);

  useEffect(() => {
    if ((phase !== 'play' && phase !== 'memorize') || remaining <= 0) return;
    const timer = setTimeout(() => setRemaining(value => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [phase, remaining]);
  useEffect(() => {
    if ((phase === 'play' || phase === 'memorize') && remaining === 0 && startedAt) void finish();
  }, [finish, phase, remaining, startedAt]);
  useEffect(() => () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (answerUnlockTimerRef.current) clearTimeout(answerUnlockTimerRef.current);
  }, []);

  const acceptSingleAnswer = (correct: boolean, advance: () => void) => {
    if (answerLockedRef.current || finishingRef.current || remaining <= 0) return;
    answerLockedRef.current = true;
    setAttempts(value => value + 1);
    if (correct) setScore(value => value + 1);
    advance();
    if (answerUnlockTimerRef.current) clearTimeout(answerUnlockTimerRef.current);
    answerUnlockTimerRef.current = setTimeout(() => { answerLockedRef.current = false; }, 120);
  };

  const start = () => {
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    if (answerUnlockTimerRef.current) clearTimeout(answerUnlockTimerRef.current);
    answerLockedRef.current = false;
    finishingRef.current = false;
    setScore(0); setAttempts(0); setMemoryInput([]); setRemaining(config.seconds); setStartedAt(new Date());
    if (game === 'memory') {
      setMemorySequence(makeMemorySequence(4));
      setPhase('memorize');
      revealTimerRef.current = setTimeout(() => setPhase('play'), 2400);
    } else if (game === 'spatial') {
      setSpatialSequence(makeSpatialRound()); setSpatialInput([]); setPhase('memorize');
      revealTimerRef.current = setTimeout(() => setPhase('play'), 2200);
    } else {
      setReactionRound(makeReactionRound()); setPressureRound(makePressureRound()); setSwitchRound(makeSwitchRound());
      setInhibitionRound(makeInhibitionRound()); setDualRound(makeDualRound()); setCodingRound(makeCodingRound());
      setSequenceRound(makeSequenceRound()); setScanningRound(makeScanningRound()); setPhase('play');
    }
  };

  const chooseMemory = (symbol: string) => {
    if (finishingRef.current || remaining <= 0) return;
    const next = [...memoryInput, symbol];
    setMemoryInput(next);
    if (next.length < memorySequence.length) return;
    const correct = next.every((item, index) => item === memorySequence[index]);
    setAttempts(value => value + 1);
    if (correct) setScore(value => value + 1);
    const nextLength = Math.min(8, 4 + Math.floor((attempts + 1) / 2));
    setMemoryInput([]); setMemorySequence(makeMemorySequence(nextLength)); setPhase('memorize');
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setPhase('play'), 1600);
  };
  const chooseReaction = (index: number) => {
    acceptSingleAnswer(index === reactionRound.oddIndex, () => setReactionRound(makeReactionRound()));
  };
  const choosePressure = (answer: boolean) => {
    acceptSingleAnswer(answer === pressureRound.correct, () => setPressureRound(makePressureRound()));
  };
  const chooseSwitch = (answer: boolean) => {
    acceptSingleAnswer(answer === switchRound.correct, () => setSwitchRound(makeSwitchRound()));
  };
  const chooseSpatial = (index: number) => {
    if (finishingRef.current || remaining <= 0 || spatialInput.includes(index)) return;
    const next = [...spatialInput, index];
    setSpatialInput(next);
    if (next.length < spatialSequence.length) return;
    setAttempts(value => value + 1);
    if (next.every(item => spatialSequence.includes(item))) setScore(value => value + 1);
    setSpatialSequence(makeSpatialRound()); setSpatialInput([]); setPhase('memorize');
    if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
    revealTimerRef.current = setTimeout(() => setPhase('play'), 1500);
  };
  const chooseInhibition = (colorName: string) => {
    acceptSingleAnswer(colorName === inhibitionRound.word.name, () => setInhibitionRound(makeInhibitionRound()));
  };
  const chooseDual = (answer: boolean) => {
    acceptSingleAnswer(answer === dualRound.correct, () => setDualRound(makeDualRound()));
  };
  const chooseCoding = (answer: number) => acceptSingleAnswer(answer === codingRound.correct, () => setCodingRound(makeCodingRound()));
  const chooseSequence = (answer: number) => acceptSingleAnswer(answer === sequenceRound.correct, () => setSequenceRound(makeSequenceRound()));
  const chooseScanning = (answer: number) => acceptSingleAnswer(answer === scanningRound.count, () => setScanningRound(makeScanningRound()));

  const openGame = (id: GameId) => {
    if (GAMES[id].premium && !isPremium && !isAdmin) {
      router.push('/paywall');
      return;
    }
    setGame(id); setPhase('intro'); Haptics.selectionAsync();
  };
  const leave = () => {
    if (phase === 'play' || phase === 'memorize') {
      const confirmLeave = () => {
        if (revealTimerRef.current) clearTimeout(revealTimerRef.current);
        if (answerUnlockTimerRef.current) clearTimeout(answerUnlockTimerRef.current);
        answerLockedRef.current = false;
        setPhase('menu'); setStartedAt(null);
      };
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        if (window.confirm('לצאת מהאימון? התוצאה הנוכחית לא תישמר.')) confirmLeave();
        return;
      }
      Alert.alert('לצאת מהאימון?', 'התוצאה הנוכחית לא תישמר.', [
        { text: 'המשך אימון', style: 'cancel' },
        { text: 'יציאה', style: 'destructive', onPress: confirmLeave },
      ]);
    } else if (phase === 'menu') router.back(); else setPhase('menu');
  };

  return (
    <LinearGradient colors={['#080A12', '#11152B']} style={styles.root}>
      <SafeAreaView style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={leave} accessibilityRole="button" accessibilityLabel="חזרה" style={styles.iconButton}><Text style={styles.iconButtonText}>×</Text></Pressable>
          <View style={styles.headerCopy}><Text style={styles.eyebrow}>מעבדת ביצועים</Text><Text style={styles.headerTitle}>{phase === 'menu' ? 'מיומנויות פסיכוטכניות' : config.title}</Text></View>
          <View style={styles.headerSpacer} />
        </View>

        {phase === 'menu' ? (
          <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 48 }]} showsVerticalScrollIndicator={false}>
            <Text style={styles.lead}>אימונים קצרים למדידת זיכרון, קשב, גמישות מחשבתית, מהירות תגובה ודיוק תחת לחץ.</Text>
            <AdBanner isPremium={isPremium} isAdmin={isAdmin} placement="practice" />
            {(Object.keys(GAMES) as GameId[]).map(id => {
              const item = GAMES[id];
              return <Pressable key={id} onPress={() => openGame(id)} style={({ pressed }) => [styles.gameCard, pressed && styles.pressed]}>
                <View style={[styles.gameIcon, { backgroundColor: `${item.color}22`, borderColor: `${item.color}66` }]}><Text style={styles.gameIconText}>{item.icon}</Text></View>
                <View style={styles.gameCopy}><Text style={styles.gameTitle}>{item.title}</Text><Text style={styles.gameSubtitle}>{item.subtitle}</Text><Text style={[styles.gameMeta, { color: item.color }]}>{item.seconds} שניות · {item.premium ? 'למנויי פרימיום' : 'חינמי'}</Text></View>
                {item.premium && !isPremium && !isAdmin ? <View style={styles.lockBadge}><Text style={styles.lockText}>נעול</Text></View> : null}
                <Text style={styles.chevron}>‹</Text>
              </Pressable>;
            })}
            {!isPremium && !isAdmin && <PremiumUpgradeCard compact title="אימון נקי מפרסומות" body="פרימיום כולל את כל התרגולים, המבחנים והסימולציות ללא מודעות." />}
          </ScrollView>
        ) : phase === 'intro' ? (
          <View style={styles.center}><Text style={styles.heroIcon}>{config.icon}</Text><Text style={styles.heroTitle}>{config.title}</Text><Text style={styles.heroBody}>{config.subtitle}</Text><Text style={styles.instructions}>התרגיל מתחיל מיד לאחר הלחיצה. עבוד מהר, אבל אל תנחש: הדיוק חשוב לא פחות מהמהירות.</Text><Pressable onPress={start} style={styles.primaryButton}><Text style={styles.primaryButtonText}>התחל אימון</Text></Pressable></View>
        ) : phase === 'result' ? (
          <ScrollView contentContainerStyle={[styles.center, { paddingBottom: insets.bottom + 32 }]}><Text style={styles.heroIcon}>🏁</Text><Text style={styles.heroTitle}>האימון הושלם</Text><View style={styles.resultRow}><Result value={String(score)} label="נכונות" /><Result value={`${accuracy}%`} label="דיוק" /><Result value={String(attempts)} label="ניסיונות" /></View><AdBanner isPremium={isPremium} isAdmin={isAdmin} placement="practice" /><Pressable onPress={start} style={styles.primaryButton}><Text style={styles.primaryButtonText}>נסה שוב</Text></Pressable><Pressable onPress={() => setPhase('menu')} style={styles.secondaryButton}><Text style={styles.secondaryButtonText}>חזרה לכל האימונים</Text></Pressable></ScrollView>
        ) : (
          <ScrollView contentContainerStyle={[styles.playArea, { paddingBottom: insets.bottom + 28 }]} showsVerticalScrollIndicator={false}>
            <View style={styles.timerRow}><Text style={styles.timer}>{remaining}</Text><Text style={styles.liveScore}>נכון {score} מתוך {attempts}</Text></View>
            {phase === 'memorize' && game === 'memory' ? <><Text style={styles.prompt}>זכור את הרצף</Text><View style={styles.sequence}>{memorySequence.map((symbol, index) => <View key={`${symbol}-${index}`} style={styles.symbolCard}><Text style={styles.symbol}>{symbol}</Text></View>)}</View></>
              : phase === 'memorize' && game === 'spatial' ? <><Text style={styles.prompt}>זכור את מיקום המשבצות</Text><SpatialGrid highlighted={spatialSequence} onPress={() => undefined} disabled /></>
              : game === 'memory' ? <><Text style={styles.prompt}>בנה את הרצף לפי הסדר</Text><View style={styles.sequence}>{memoryInput.map((symbol, index) => <View key={`${symbol}-${index}`} style={styles.inputChip}><Text style={styles.symbolSmall}>{symbol}</Text></View>)}</View><View style={styles.symbolGrid}>{SYMBOLS.map(symbol => <Pressable key={symbol} onPress={() => chooseMemory(symbol)} style={styles.symbolButton}><Text style={styles.symbol}>{symbol}</Text></Pressable>)}</View></>
              : game === 'reaction' ? <><Text style={styles.prompt}>לחץ על הסמל החריג</Text><View style={styles.reactionGrid}>{reactionRound.cells.map((symbol, index) => <Pressable key={index} onPress={() => chooseReaction(index)} style={styles.reactionCell}><Text style={styles.symbol}>{symbol}</Text></Pressable>)}</View></>
              : game === 'pressure' ? <><Text style={styles.prompt}>האם השוויון נכון?</Text><View style={styles.equationCard}><Text style={styles.equation}>{pressureRound.label}</Text></View><BinaryAnswers onAnswer={choosePressure} /></>
              : game === 'switching' ? <><Text style={styles.prompt}>{switchRound.rule === 'even' ? 'האם המספר זוגי?' : 'האם המספר 5 ומעלה?'}</Text><View style={styles.equationCard}><Text style={styles.equation}>{switchRound.number}</Text></View><BinaryAnswers onAnswer={chooseSwitch} /></>
              : game === 'coding' ? <><Text style={styles.prompt}>איזה מספר מייצג את הסמל?</Text><View style={styles.codeLegend}>{codingRound.symbols.map((symbol, index) => <View key={symbol} style={styles.codeKey}><Text style={styles.symbolSmall}>{symbol}</Text><Text style={styles.codeNumber}>{index + 1}</Text></View>)}</View><View style={styles.equationCard}><Text style={styles.codingTarget}>{codingRound.target}</Text></View><NumberAnswers values={[1, 2, 3, 4]} onAnswer={chooseCoding} /></>
              : game === 'sequence' ? <><Text style={styles.prompt}>מה המספר הבא ברצף?</Text><View style={styles.sequenceQuestion}>{sequenceRound.values.map((value, index) => <Text key={`${value}-${index}`} style={styles.sequenceNumber}>{value}</Text>)}</View><NumberAnswers values={sequenceRound.options} onAnswer={chooseSequence} /></>
              : game === 'scanning' ? <><Text style={styles.prompt}>כמה פעמים מופיע הסמל <Text style={styles.inlineTarget}>{scanningRound.target}</Text>?</Text><View style={styles.scanGrid}>{scanningRound.cells.map((symbol, index) => <View key={index} style={styles.scanCell}><Text style={styles.symbolSmall}>{symbol}</Text></View>)}</View><NumberAnswers values={scanningRound.options} onAnswer={chooseScanning} /></>
              : game === 'spatial' ? <><Text style={styles.prompt}>סמן את המשבצות שהוארו</Text><SpatialGrid highlighted={spatialInput} onPress={chooseSpatial} /></>
              : game === 'inhibition' ? <><Text style={styles.prompt}>בחר את משמעות המילה, לא את צבע הדיו</Text><View style={styles.equationCard}><Text style={[styles.colorWord, { color: inhibitionRound.ink.value }]}>{inhibitionRound.word.name}</Text></View><View style={styles.colorAnswers}>{COLORS.map(color => <Pressable key={color.name} onPress={() => chooseInhibition(color.name)} style={[styles.colorButton, { borderColor: color.value }]}><Text style={styles.colorButtonText}>{color.name}</Text></Pressable>)}</View></>
              : <><Text style={styles.prompt}>האם המספר 5 ומעלה וגם הסמל מלא?</Text><View style={styles.dualCard}><Text style={styles.equation}>{dualRound.number}</Text><Text style={styles.dualSymbol}>{dualRound.symbol}</Text></View><BinaryAnswers onAnswer={chooseDual} /></>}
          </ScrollView>
        )}
      </SafeAreaView>
    </LinearGradient>
  );
}

function Result({ value, label }: { value: string; label: string }) { return <View style={styles.result}><Text style={styles.resultValue}>{value}</Text><Text style={styles.resultLabel}>{label}</Text></View>; }
function BinaryAnswers({ onAnswer }: { onAnswer: (answer: boolean) => void }) { return <View style={styles.answerRow}><Pressable onPress={() => onAnswer(true)} style={[styles.answerButton, styles.trueButton]}><Text style={styles.answerText}>כן</Text></Pressable><Pressable onPress={() => onAnswer(false)} style={[styles.answerButton, styles.falseButton]}><Text style={styles.answerText}>לא</Text></Pressable></View>; }
function NumberAnswers({ values, onAnswer }: { values: number[]; onAnswer: (answer: number) => void }) { return <View style={styles.numberAnswers}>{values.map(value => <Pressable key={value} onPress={() => onAnswer(value)} style={styles.numberButton}><Text style={styles.numberButtonText}>{value}</Text></Pressable>)}</View>; }
function SpatialGrid({ highlighted, onPress, disabled = false }: { highlighted: number[]; onPress: (index: number) => void; disabled?: boolean }) { return <View style={styles.spatialGrid}>{Array.from({ length: 16 }, (_, index) => <Pressable key={index} disabled={disabled} onPress={() => onPress(index)} style={[styles.spatialCell, highlighted.includes(index) && styles.spatialCellActive]} accessibilityRole="button" accessibilityLabel={`משבצת ${index + 1}`} />)}</View>; }

const styles = StyleSheet.create({
  root: { flex: 1 }, safe: { flex: 1 }, content: { padding: 18, gap: 14 }, header: { minHeight: 72, paddingHorizontal: 16, flexDirection: 'row-reverse', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: Colors.border }, headerCopy: { flex: 1, alignItems: 'center' }, headerSpacer: { width: 44 }, iconButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }, iconButtonText: { color: Colors.text, fontSize: 28 }, eyebrow: { color: Colors.primaryLight, fontFamily: FontFamily.medium, fontSize: FontSize.xs }, headerTitle: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize.lg, textAlign: 'center' }, lead: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: FontSize.base, textAlign: 'right', writingDirection: 'rtl', lineHeight: 24 }, gameCard: { minHeight: 116, borderRadius: Radius.lg, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface, padding: 16, flexDirection: 'row-reverse', alignItems: 'center', gap: 14, ...Shadow.sm }, pressed: { opacity: 0.78 }, gameIcon: { width: 66, height: 66, borderRadius: Radius.md, borderWidth: 1, alignItems: 'center', justifyContent: 'center' }, gameIconText: { fontSize: 30 }, gameCopy: { flex: 1, alignItems: 'flex-end' }, gameTitle: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize.lg, textAlign: 'right' }, gameSubtitle: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: FontSize.sm, textAlign: 'right', writingDirection: 'rtl', marginTop: 4 }, gameMeta: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, marginTop: 8 }, lockBadge: { borderRadius: 12, backgroundColor: Colors.primaryLighter, paddingHorizontal: 9, paddingVertical: 5 }, lockText: { color: Colors.primaryLight, fontFamily: FontFamily.bold, fontSize: FontSize.xs }, chevron: { color: Colors.textSecondary, fontSize: 28 }, center: { flexGrow: 1, padding: 24, alignItems: 'center', justifyContent: 'center', gap: 16 }, heroIcon: { fontSize: 58 }, heroTitle: { color: Colors.text, fontFamily: FontFamily.heading, fontSize: FontSize['3xl'], textAlign: 'center' }, heroBody: { color: Colors.primaryLight, fontFamily: FontFamily.bold, fontSize: FontSize.lg, textAlign: 'center', writingDirection: 'rtl' }, instructions: { maxWidth: 520, color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: FontSize.base, lineHeight: 25, textAlign: 'center', writingDirection: 'rtl' }, primaryButton: { width: '100%', maxWidth: 440, minHeight: 56, borderRadius: Radius.md, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', marginTop: 12 }, primaryButtonText: { color: '#fff', fontFamily: FontFamily.bold, fontSize: FontSize.lg }, secondaryButton: { minHeight: 48, paddingHorizontal: 22, justifyContent: 'center' }, secondaryButtonText: { color: Colors.primaryLight, fontFamily: FontFamily.bold, fontSize: FontSize.base }, playArea: { flexGrow: 1, minHeight: 560, padding: 20, alignItems: 'center', justifyContent: 'center' }, timerRow: { width: '100%', maxWidth: 440, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 26 }, timer: { color: Colors.warning, fontFamily: FontFamily.bold, fontSize: FontSize['2xl'] }, liveScore: { color: Colors.textSecondary, fontFamily: FontFamily.medium, fontSize: FontSize.sm, textAlign: 'right' }, prompt: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize.xl, textAlign: 'center', writingDirection: 'rtl', marginBottom: 22 }, sequence: { minHeight: 72, flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'center', gap: 10, marginBottom: 22 }, symbolCard: { width: 58, height: 66, borderRadius: Radius.md, borderWidth: 1, borderColor: Colors.primaryLight, backgroundColor: Colors.primaryLighter, alignItems: 'center', justifyContent: 'center' }, inputChip: { width: 42, height: 48, borderRadius: Radius.sm, backgroundColor: Colors.surfaceStrong, alignItems: 'center', justifyContent: 'center' }, symbol: { color: Colors.text, fontSize: 29 }, symbolSmall: { color: Colors.text, fontSize: 21 }, symbolGrid: { width: '100%', maxWidth: 360, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }, symbolButton: { width: '29%', aspectRatio: 1, maxWidth: 96, borderRadius: Radius.md, backgroundColor: Colors.surfaceStrong, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' }, reactionGrid: { width: '100%', maxWidth: 360, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 }, reactionCell: { width: '30%', aspectRatio: 1, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }, equationCard: { width: '100%', maxWidth: 440, minHeight: 150, borderRadius: Radius.lg, backgroundColor: Colors.surfaceStrong, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' }, equation: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize['3xl'] }, answerRow: { width: '100%', maxWidth: 440, flexDirection: 'row-reverse', gap: 12, marginTop: 20 }, answerButton: { flex: 1, minHeight: 62, borderRadius: Radius.md, alignItems: 'center', justifyContent: 'center' }, trueButton: { backgroundColor: Colors.success }, falseButton: { backgroundColor: Colors.danger }, answerText: { color: '#081018', fontFamily: FontFamily.bold, fontSize: FontSize.lg }, spatialGrid: { width: '100%', maxWidth: 340, aspectRatio: 1, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 }, spatialCell: { width: '23%', height: '23%', borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.borderStrong }, spatialCellActive: { backgroundColor: Colors.success, borderColor: '#9FFFD8' }, colorWord: { fontFamily: FontFamily.bold, fontSize: 48 }, colorAnswers: { width: '100%', maxWidth: 440, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10, marginTop: 18 }, colorButton: { width: '48%', minHeight: 58, borderRadius: Radius.md, borderWidth: 2, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' }, colorButtonText: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize.base }, dualCard: { width: '100%', maxWidth: 440, minHeight: 150, borderRadius: Radius.lg, backgroundColor: Colors.surfaceStrong, borderWidth: 1, borderColor: Colors.borderStrong, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', gap: 36 }, dualSymbol: { color: Colors.primaryLight, fontSize: 48 }, resultRow: { width: '100%', maxWidth: 480, flexDirection: 'row-reverse', gap: 10 }, result: { flex: 1, minHeight: 92, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }, resultValue: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize['2xl'] }, resultLabel: { color: Colors.textSecondary, fontFamily: FontFamily.regular, fontSize: FontSize.sm },
  codeLegend: { width: '100%', maxWidth: 440, flexDirection: 'row-reverse', gap: 8, marginBottom: 14 }, codeKey: { flex: 1, minHeight: 64, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center', gap: 4 }, codeNumber: { color: Colors.textSecondary, fontFamily: FontFamily.bold, fontSize: FontSize.sm }, codingTarget: { color: Colors.primaryLight, fontSize: 58 }, numberAnswers: { width: '100%', maxWidth: 440, flexDirection: 'row-reverse', gap: 10, marginTop: 18 }, numberButton: { flex: 1, minWidth: 56, minHeight: 58, borderRadius: Radius.md, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.primaryLight, alignItems: 'center', justifyContent: 'center' }, numberButtonText: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize.xl }, sequenceQuestion: { width: '100%', maxWidth: 440, minHeight: 120, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-evenly', borderRadius: Radius.lg, backgroundColor: Colors.surfaceStrong, borderWidth: 1, borderColor: Colors.borderStrong }, sequenceNumber: { color: Colors.text, fontFamily: FontFamily.bold, fontSize: FontSize['2xl'] }, scanGrid: { width: '100%', maxWidth: 360, flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }, scanCell: { width: '21%', aspectRatio: 1, borderRadius: Radius.sm, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, alignItems: 'center', justifyContent: 'center' }, inlineTarget: { color: Colors.success, fontSize: FontSize['2xl'] },
});
