import React, { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

// ── Data ──────────────────────────────────────────────────────────────────────

const MODES = [
  {
    icon: '📖',
    title: 'תרגול חופשי',
    color: Colors.primary,
    desc: 'תרגל שאלות מכל רמת קושי ללא לחץ זמן. מושלם לחזרה על חומר ולהיכרות ראשונית עם סגנון השאלות.',
  },
  {
    icon: '🧠',
    title: 'תרגול אדפטיבי',
    color: Colors.accent,
    desc: 'המערכת עוקבת אחרי הביצועים שלך ומתאימה את קושי השאלות בזמן אמת — קשה יותר כשאתה מצליח, קל יותר כשאתה מתקשה.',
  },
  {
    icon: '⚡',
    title: 'מצב מהירות',
    color: Colors.warning,
    desc: 'שאלות עם מגבלת זמן קצרה לכל שאלה. מאמן קבלת החלטות מהירה — מיומנות קריטית בתנאי הפסיכוטכני האמיתי.',
  },
  {
    icon: '🏆',
    title: 'סימולציה מלאה',
    color: Colors.success,
    desc: 'מבחן מלא בתנאים הדומים לבחינה האמיתית — זמן קצוב, רצף שאלות, ניקוד אוטומטי. לפרמיום בלבד.',
  },
];

const FEATURES = [
  {
    icon: '📊',
    title: 'דירוג ELO',
    desc: 'בדיוק כמו בשחמט — כל שאלה שאתה פותר עדכן את הדירוג שלך. ציון 1200 הוא ממוצע. מעל 1400 — מצוין. מעל 1600 — מומחה.',
  },
  {
    icon: '🔥',
    title: 'רצף ימים',
    desc: 'תרגל לפחות פעם ביום כדי לשמור על הרצף. הרצף נשבר אם לא תרגלת יום שלם. מוטיבציה לעקביות!',
  },
  {
    icon: '⭐',
    title: 'XP ורמות',
    desc: 'כל שאלה נכונה מעניקה XP. ככל שמצטברים יותר נקודות, עולים ברמה (1–5). רמות גבוהות יותר מציגות אייקונים מיוחדים.',
  },
  {
    icon: '🏅',
    title: 'תגים והישגים',
    desc: 'קבל תגים על ציוני דרך: סשן ראשון, 7 ימי רצף, 30 יום, ניקוד מושלם, מהירות, ועוד. תגים מוצגים בפרופיל.',
  },
  {
    icon: '🎯',
    title: 'אתגר יומי',
    desc: 'כל יום מתפרסם אתגר מיוחד עם שאלה ייחודית ובונוס XP. מי שמשלים את האתגר מקבל XP נוסף ומופיע בלוח המובילים.',
  },
  {
    icon: '📈',
    title: 'מעקב התקדמות',
    desc: 'בלשונית "התקדמות" תראה גרפים מפורטים — דיוק לפי נושא, שיפור לאורך זמן, ורמת ELO מעודכנת.',
  },
];

const FAQ: { q: string; a: string }[] = [
  {
    q: 'מה ההבדל בין חינמי לפרמיום?',
    a: 'גרסת החינם מאפשרת עד 30 שאלות תרגול ליום ותרגול חופשי בלבד. פרמיום פותח שאלות ללא הגבלה, תרגול אדפטיבי, מצב מהירות, סימולציות מלאות, אנליטיקס מפורט, ואתגרים יומיים עם בונוס XP.',
  },
  {
    q: 'איך עובד האלגוריתם האדפטיבי?',
    a: 'המערכת מחשבת את רמת הביצוע שלך בכל נושא בנפרד. לאחר 5 שאלות לפחות היא מתאימה את הקושי: שיפור → שאלות קשות יותר, קושי → שאלות קלות יותר. כך תמיד תהיה באזור האתגר האופטימלי.',
  },
  {
    q: 'האם ניתן לשנות את המסלול שנבחר?',
    a: 'כן. גש ללשונית "מסלולים" (הלשונית השנייה) ולחץ על כל מסלול אחר. כרגע זמינים: פסיכומטרי, קצינות, ועוד בקרוב.',
  },
  {
    q: 'מה קורה אם מפספסים יום ברצף?',
    a: 'הרצף מתאפס ל-1 ביום הבא שתרגל. הרצף הארוך ביותר שהשגת נשמר תמיד ומוצג בפרופיל.',
  },
  {
    q: 'האם הנתונים שלי נשמרים בין מכשירים?',
    a: 'כן — כל הנתונים (ביצועים, רמות, XP, תגים) מסונכרנים לחשבון שלך ב-Supabase. כניסה עם אותו חשבון במכשיר חדש תשחזר הכל.',
  },
  {
    q: 'הקוד שלי לא עובד — מה לעשות?',
    a: 'ודא שהקוד פעיל ולא פג תוקפו. אם הבעיה נמשכת, פנה לתמיכה עם הקוד שניסית ונבדוק.',
  },
  {
    q: 'כיצד מבטלים מנוי?',
    a: 'מנוי מנוהל דרך Apple App Store. כנס להגדרות → Apple ID → מנויים → PsychoTechni+ → בטל מנוי. הגישה נשמרת עד סוף תקופת החיוב.',
  },
];

// ── Components ────────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  return (
    <View style={sectionStyles.wrap}>
      <View style={sectionStyles.iconCircle}>
        <Text style={sectionStyles.icon}>{icon}</Text>
      </View>
      <View style={sectionStyles.text}>
        <Text style={sectionStyles.title}>{title}</Text>
        {subtitle && <Text style={sectionStyles.subtitle}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function ModeCard({ icon, title, color, desc }: typeof MODES[0]) {
  return (
    <View style={[modeStyles.card, { borderColor: color + '30' }]}>
      <View style={[modeStyles.iconWrap, { backgroundColor: color + '20' }]}>
        <Text style={modeStyles.icon}>{icon}</Text>
      </View>
      <View style={modeStyles.body}>
        <Text style={[modeStyles.title, { color }]}>{title}</Text>
        <Text style={modeStyles.desc}>{desc}</Text>
      </View>
    </View>
  );
}

function FeatureRow({ icon, title, desc }: typeof FEATURES[0]) {
  return (
    <View style={featureStyles.row}>
      <Text style={featureStyles.icon}>{icon}</Text>
      <View style={featureStyles.body}>
        <Text style={featureStyles.title}>{title}</Text>
        <Text style={featureStyles.desc}>{desc}</Text>
      </View>
    </View>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  const toggle = () => {
    Haptics.selectionAsync();
    const toVal = open ? 0 : 1;
    setOpen(!open);
    Animated.spring(anim, { toValue: toVal, friction: 8, tension: 100, useNativeDriver: true }).start();
  };

  const rotate = anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });

  return (
    <View style={faqStyles.item}>
      <Pressable onPress={toggle} style={faqStyles.question}>
        <Animated.Text style={[faqStyles.arrow, { transform: [{ rotate }] }]}>▾</Animated.Text>
        <Text style={faqStyles.questionText}>{q}</Text>
      </Pressable>
      {open && (
        <View style={faqStyles.answerWrap}>
          <Text style={faqStyles.answer}>{a}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ───────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const handleContact = () => {
    Haptics.selectionAsync();
    const url = 'mailto:support@psychotechniplus.com?subject=תמיכה%20פסיכוטכניPlus';
    Linking.canOpenURL(url).then(ok => {
      if (ok) Linking.openURL(url).catch(() => showContactAlert());
      else showContactAlert();
    }).catch(() => showContactAlert());
  };

  const showContactAlert = () => {
    Alert.alert('צור קשר', 'שלח מייל לכתובת:\nsupport@psychotechniplus.com');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      {/* Header */}
      <LinearGradient colors={['#0F172A', '#1A1040', '#0F172A']} style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>→ חזרה</Text>
        </Pressable>
        <View style={styles.heroRow}>
          <View style={styles.heroBadge}>
            <Text style={styles.heroBadgeEmoji}>💡</Text>
          </View>
          <Text style={styles.headerTitle}>עזרה ומדריך</Text>
        </View>
        <Text style={styles.headerSub}>כל מה שצריך לדעת על PsychoTechni+</Text>
      </LinearGradient>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Quick-start steps */}
        <View style={styles.quickCard}>
          <Text style={styles.quickTitle}>🚀 התחלה מהירה</Text>
          {[
            'בחר מסלול (פסיכומטרי, קצינות...)',
            'הכנס ללשונית "תרגול" ובחר מצב',
            'ענה על שאלות וקבל הסבר מיד',
            'עקוב אחרי ההתקדמות בלשונית "התקדמות"',
            'אל תשכח את האתגר היומי בדף הבית!',
          ].map((step, i) => (
            <View key={i} style={styles.quickStep}>
              <View style={styles.quickNum}>
                <Text style={styles.quickNumText}>{i + 1}</Text>
              </View>
              <Text style={styles.quickStepText}>{step}</Text>
            </View>
          ))}
        </View>

        {/* Tabs explained */}
        <SectionHeader icon="🗂️" title="לשוניות האפליקציה" subtitle="מה תמצאו בכל לשונית" />
        <View style={styles.card}>
          {[
            { icon: '🏠', tab: 'בית',       desc: 'סיכום יומי, אתגר יומי, ELO ורצף נוכחי' },
            { icon: '🎯', tab: 'מסלולים',   desc: 'בחר ועדכן את מסלול הלימוד שלך' },
            { icon: '✏️', tab: 'תרגול',      desc: 'כל מצבי התרגול — חופשי, אדפטיבי, מהירות וסימולציה' },
            { icon: '📊', tab: 'התקדמות',   desc: 'גרפים, סטטיסטיקות וביצועים לפי נושא' },
            { icon: '👤', tab: 'פרופיל',     desc: 'הגדרות, הישגים, מנוי ויציאה מהחשבון' },
          ].map((item, i, arr) => (
            <View key={item.tab} style={[styles.tabRow, i < arr.length - 1 && styles.tabRowBorder]}>
              <Text style={styles.tabRowIcon}>{item.icon}</Text>
              <View style={styles.tabRowBody}>
                <Text style={styles.tabRowTitle}>{item.tab}</Text>
                <Text style={styles.tabRowDesc}>{item.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Practice modes */}
        <SectionHeader icon="🎮" title="מצבי תרגול" subtitle="בחר את המצב המתאים למטרה שלך" />
        <View style={styles.modesGrid}>
          {MODES.map(m => <ModeCard key={m.title} {...m} />)}
        </View>

        {/* Features */}
        <SectionHeader icon="⚙️" title="פיצ׳רים ומנגנונים" />
        <View style={styles.card}>
          {FEATURES.map((f, i) => (
            <View key={f.title}>
              <FeatureRow {...f} />
              {i < FEATURES.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* ELO scale */}
        <SectionHeader icon="📊" title="סולם ה-ELO" subtitle="איפה אתה עומד?" />
        <View style={styles.eloCard}>
          {[
            { label: 'מתחיל',   range: '< 1100', color: '#94A3B8', bar: 0.2 },
            { label: 'בינוני',  range: '1100–1300', color: Colors.primary, bar: 0.45 },
            { label: 'טוב',     range: '1300–1500', color: Colors.success, bar: 0.65 },
            { label: 'מצוין',   range: '1500–1700', color: Colors.warning, bar: 0.82 },
            { label: 'מומחה',   range: '1700+',   color: '#F59E0B', bar: 1.0 },
          ].map(item => (
            <View key={item.label} style={styles.eloRow}>
              <Text style={styles.eloRange}>{item.range}</Text>
              <View style={styles.eloBarTrack}>
                <View style={[styles.eloBarFill, { width: `${item.bar * 100}%`, backgroundColor: item.color }]} />
              </View>
              <Text style={[styles.eloLabel, { color: item.color }]}>{item.label}</Text>
            </View>
          ))}
        </View>

        {/* Tips */}
        <SectionHeader icon="💡" title="טיפים לשיפור מהיר" />
        <View style={styles.tipsCard}>
          {[
            'תרגל כל יום — עקביות עדיפה על בלוק גדול אחת לשבוע',
            'קרא את ההסבר גם כשצדקת — מחזק את ההבנה',
            'התמקד בנושאים החלשים שלך — הם המקום הגדול ביותר לשיפור',
            'השתמש במצב מהירות לפחות פעם בשבוע לאימון לחץ',
            'השלם את האתגר היומי — XP בונוס ולוח מובילים',
            'בדוק את גרף ה-ELO בלשונית ״התקדמות״ לראות מגמות',
          ].map((tip, i) => (
            <View key={i} style={styles.tip}>
              <Text style={styles.tipBullet}>✦</Text>
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>

        {/* FAQ */}
        <SectionHeader icon="❓" title="שאלות נפוצות" />
        <View style={styles.faqCard}>
          {FAQ.map((item, i) => (
            <View key={i}>
              <FaqItem q={item.q} a={item.a} />
              {i < FAQ.length - 1 && <View style={styles.divider} />}
            </View>
          ))}
        </View>

        {/* Contact */}
        <View style={styles.contactCard}>
          <Text style={styles.contactTitle}>📬 עדיין יש שאלה?</Text>
          <Text style={styles.contactDesc}>
            הצוות שלנו זמין לעזור בכל שאלה, דיווח על תקלה, או בקשת פיצ׳ר.
          </Text>
          <Pressable
            onPress={handleContact}
            style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}
          >
            <LinearGradient
              colors={Colors.gradients.primary}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={styles.contactBtnGrad}
            >
              <Text style={styles.contactBtnText}>שלח הודעה לתמיכה ←</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.contactEmail}>support@psychotechniplus.com</Text>
        </View>

        {/* Version */}
        <Text style={styles.version}>PsychoTechni+ · גרסה 1.0.0</Text>

        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
  backBtn: { marginBottom: 16 },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: '#94A3B8' },
  heroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 6 },
  heroBadge: {
    width: 48, height: 48, borderRadius: Radius.xl,
    backgroundColor: Colors.warning + '30',
    alignItems: 'center', justifyContent: 'center',
  },
  heroBadgeEmoji: { fontSize: 26 },
  headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
  headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: '#94A3B8', textAlign: 'right', marginTop: 2 },

  content: { padding: 16, gap: 8 },

  card: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, ...Shadow.sm,
  },
  divider: { height: 1, backgroundColor: Colors.border, marginHorizontal: 16 },

  // Quick start
  quickCard: {
    backgroundColor: Colors.primary + '12',
    borderRadius: Radius.xl, borderWidth: 1.5,
    borderColor: Colors.primary + '35',
    padding: 18, marginBottom: 20,
  },
  quickTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.primaryLight, textAlign: 'right', marginBottom: 14 },
  quickStep: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 10 },
  quickNum: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  quickNumText: { fontFamily: FontFamily.bold, fontSize: 13, color: '#fff' },
  quickStepText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },

  // Tabs
  tabRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 14 },
  tabRowBorder: { borderBottomWidth: 1, borderBottomColor: Colors.border },
  tabRowIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  tabRowBody: { flex: 1, alignItems: 'flex-end' },
  tabRowTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text },
  tabRowDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', marginTop: 2 },

  // Modes
  modesGrid: { gap: 10, marginBottom: 16 },

  // ELO
  eloCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 16, gap: 12, ...Shadow.sm,
  },
  eloRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  eloLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, width: 50, textAlign: 'right' },
  eloBarTrack: { flex: 1, height: 8, backgroundColor: Colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' },
  eloBarFill: { height: 8, borderRadius: 4 },
  eloRange: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, width: 72, textAlign: 'left' },

  // Tips
  tipsCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 16, marginBottom: 16, gap: 12, ...Shadow.sm,
  },
  tip: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
  tipBullet: { fontFamily: FontFamily.bold, fontSize: 14, color: Colors.primary, marginTop: 1, flexShrink: 0 },
  tipText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right', lineHeight: 20 },

  // FAQ
  faqCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    marginBottom: 16, ...Shadow.sm, overflow: 'hidden',
  },

  // Contact
  contactCard: {
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, borderColor: Colors.border,
    padding: 20, marginBottom: 16, alignItems: 'center', gap: 10, ...Shadow.sm,
  },
  contactTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: Colors.text },
  contactDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'center', lineHeight: 20 },
  contactBtn: { width: '100%', borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
  contactBtnGrad: { paddingVertical: 16, alignItems: 'center' },
  contactBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
  contactEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary },

  version: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textTertiary, textAlign: 'center', marginTop: 4 },
});

const sectionStyles = StyleSheet.create({
  wrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 10 },
  iconCircle: {
    width: 38, height: 38, borderRadius: Radius.lg,
    backgroundColor: Colors.primary + '20', alignItems: 'center', justifyContent: 'center',
  },
  icon: { fontSize: 20 },
  text: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: Colors.text },
  subtitle: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, marginTop: 1 },
});

const modeStyles = StyleSheet.create({
  card: {
    flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12,
    backgroundColor: Colors.surface, borderRadius: Radius.xl,
    borderWidth: 1, padding: 14, ...Shadow.sm,
  },
  iconWrap: { width: 44, height: 44, borderRadius: Radius.lg, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  icon: { fontSize: 22 },
  body: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.base, marginBottom: 4 },
  desc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 20 },
});

const featureStyles = StyleSheet.create({
  row: { flexDirection: 'row-reverse', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 14 },
  icon: { fontSize: 22, width: 28, textAlign: 'center', marginTop: 1 },
  body: { flex: 1, alignItems: 'flex-end' },
  title: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, marginBottom: 3 },
  desc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: Colors.textSecondary, textAlign: 'right', lineHeight: 18 },
});

const faqStyles = StyleSheet.create({
  item: { overflow: 'hidden' },
  question: {
    flexDirection: 'row-reverse', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, gap: 10,
  },
  arrow: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.primary, flexShrink: 0 },
  questionText: { flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: Colors.text, textAlign: 'right' },
  answerWrap: { paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 },
  answer: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: Colors.textSecondary, textAlign: 'right', lineHeight: 22 },
});
