import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Pressable,
  Animated, Linking, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as Haptics from '../utils/haptics';
import { useColors } from '../hooks/useColors';
import { ThemeColors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

// ── Data (dynamic — depends on colors) ───────────────────────────────────────

function getModes(colors: ThemeColors) {
  return [
    { icon: '📖', title: 'תרגול חופשי', color: colors.primary, desc: 'תרגל שאלות מכל רמת קושי ללא לחץ זמן. מושלם לחזרה על חומר ולהיכרות ראשונית עם סגנון השאלות.' },
    { icon: '🧠', title: 'תרגול אדפטיבי', color: colors.accent, desc: 'המערכת עוקבת אחרי הביצועים שלך ומתאימה את קושי השאלות בזמן אמת — קשה יותר כשאתה מצליח, קל יותר כשאתה מתקשה.' },
    { icon: '⚡', title: 'מצב מהירות', color: colors.warning, desc: 'שאלות עם מגבלת זמן קצרה לכל שאלה. מאמן קבלת החלטות מהירה — מיומנות קריטית בתנאי הפסיכוטכני האמיתי.' },
    { icon: '🏆', title: 'סימולציה מלאה', color: colors.success, desc: 'מבחן מלא בתנאים הדומים לבחינה האמיתית — זמן קצוב, רצף שאלות, ניקוד אוטומטי. לפרמיום בלבד.' },
  ];
}

const FEATURES = [
  { icon: '📊', title: 'דירוג ELO', desc: 'בדיוק כמו בשחמט — כל שאלה שאתה פותר עדכן את הדירוג שלך. ציון 1200 הוא ממוצע. מעל 1400 — מצוין. מעל 1600 — מומחה.' },
  { icon: '🔥', title: 'רצף ימים', desc: 'תרגל לפחות פעם ביום כדי לשמור על הרצף. הרצף נשבר אם לא תרגלת יום שלם. מוטיבציה לעקביות!' },
  { icon: '⭐', title: 'XP ורמות', desc: 'כל שאלה נכונה מעניקה XP. ככל שמצטברים יותר נקודות, עולים ברמה (1–5). רמות גבוהות יותר מציגות אייקונים מיוחדים.' },
  { icon: '🏅', title: 'תגים והישגים', desc: 'קבל תגים על ציוני דרך: סשן ראשון, 7 ימי רצף, 30 יום, ניקוד מושלם, מהירות, ועוד. תגים מוצגים בפרופיל.' },
  { icon: '🎯', title: 'אתגר יומי', desc: 'כל יום מתפרסם אתגר מיוחד עם שאלה ייחודית ובונוס XP. מי שמשלים את האתגר מקבל XP נוסף ומופיע בלוח המובילים.' },
  { icon: '📈', title: 'מעקב התקדמות', desc: 'בלשונית "התקדמות" תראה גרפים מפורטים — דיוק לפי נושא, שיפור לאורך זמן, ורמת ELO מעודכנת.' },
];

const FAQ: { q: string; a: string }[] = [
  { q: 'מה ההבדל בין חינמי לפרמיום?', a: 'גרסת החינם מאפשרת עד 30 שאלות תרגול ליום ותרגול חופשי בלבד. פרמיום פותח שאלות ללא הגבלה, תרגול אדפטיבי, מצב מהירות, סימולציות מלאות, אנליטיקס מפורט, ואתגרים יומיים עם בונוס XP.' },
  { q: 'איך עובד האלגוריתם האדפטיבי?', a: 'המערכת מחשבת את רמת הביצוע שלך בכל נושא בנפרד. לאחר 5 שאלות לפחות היא מתאימה את הקושי: שיפור → שאלות קשות יותר, קושי → שאלות קלות יותר. כך תמיד תהיה באזור האתגר האופטימלי.' },
  { q: 'האם ניתן לשנות את המסלול שנבחר?', a: 'כן. גש ללשונית "מסלולים" (הלשונית השנייה) ולחץ על כל מסלול אחר. כרגע זמינים: פסיכומטרי, קצינות, ועוד בקרוב.' },
  { q: 'מה קורה אם מפספסים יום ברצף?', a: 'הרצף מתאפס ל-1 ביום הבא שתרגל. הרצף הארוך ביותר שהשגת נשמר תמיד ומוצג בפרופיל.' },
  { q: 'האם הנתונים שלי נשמרים בין מכשירים?', a: 'כן — כל הנתונים (ביצועים, רמות, XP, תגים) מסונכרנים לחשבון שלך ב-Supabase. כניסה עם אותו חשבון במכשיר חדש תשחזר הכל.' },
  { q: 'הקוד שלי לא עובד — מה לעשות?', a: 'ודא שהקוד פעיל ולא פג תוקפו. אם הבעיה נמשכת, פנה לתמיכה עם הקוד שניסית ונבדוק.' },
  { q: 'כיצד מבטלים מנוי?', a: 'מנוי מנוהל דרך Apple App Store. כנס להגדרות → Apple ID → מנויים → PsychoTechni+ → בטל מנוי. הגישה נשמרת עד סוף תקופת החיוב.' },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, subtitle }: { icon: string; title: string; subtitle?: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginTop: 8, marginBottom: 10 }}>
      <View style={{ width: 38, height: 38, borderRadius: Radius.lg, backgroundColor: colors.primaryLighter, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 20 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.base, color: colors.text }}>{title}</Text>
        {subtitle && <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textSecondary, marginTop: 1 }}>{subtitle}</Text>}
      </View>
    </View>
  );
}

function ModeCard({ icon, title, color, desc }: { icon: string; title: string; color: string; desc: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surfaceCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: color + '30', padding: 14, ...Shadow.sm }}>
      <View style={{ width: 44, height: 44, borderRadius: Radius.lg, backgroundColor: color + '20', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <Text style={{ fontSize: 22 }}>{icon}</Text>
      </View>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.base, color, marginBottom: 4 }}>{title}</Text>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'right', lineHeight: 20 }}>{desc}</Text>
      </View>
    </View>
  );
}

function FeatureRow({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  const colors = useColors();
  return (
    <View style={{ flexDirection: 'row-reverse', alignItems: 'flex-start', paddingHorizontal: 16, paddingVertical: 14, gap: 14 }}>
      <Text style={{ fontSize: 22, width: 28, textAlign: 'center', marginTop: 1 }}>{icon}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        <Text style={{ fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: colors.text, marginBottom: 3 }}>{title}</Text>
        <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'right', lineHeight: 18 }}>{desc}</Text>
      </View>
    </View>
  );
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const colors = useColors();
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
    <View style={{ overflow: 'hidden' }}>
      <Pressable onPress={toggle} style={{ flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 10 }}>
        <Animated.Text style={{ fontFamily: FontFamily.bold, fontSize: 16, color: colors.primary, flexShrink: 0, transform: [{ rotate }] }}>▾</Animated.Text>
        <Text style={{ flex: 1, fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: colors.text, textAlign: 'right' }}>{q}</Text>
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 14, paddingTop: 2 }}>
          <Text style={{ fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'right', lineHeight: 22 }}>{a}</Text>
        </View>
      )}
    </View>
  );
}

// ── Main Screen ────────────────────────────────────────────────────────────────

export default function HelpScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  const modes = useMemo(() => getModes(colors), [colors]);

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
      <LinearGradient colors={colors.gradients.primaryDeep} style={styles.header}>
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

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
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
          {modes.map(m => <ModeCard key={m.title} {...m} />)}
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
            { label: 'בינוני',  range: '1100–1300', color: colors.primary, bar: 0.45 },
            { label: 'טוב',     range: '1300–1500', color: colors.success, bar: 0.65 },
            { label: 'מצוין',   range: '1500–1700', color: colors.warning, bar: 0.82 },
            { label: 'מומחה',   range: '1700+',   color: '#F59E0B', bar: 1.0 },
          ].map(item => (
            <View key={item.label} style={styles.eloRow}>
              <Text style={styles.eloRange}>{item.range}</Text>
              <View style={styles.eloBarTrack}>
                <View style={[styles.eloBarFill, { width: `${item.bar * 100}%` as any, backgroundColor: item.color }]} />
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
          <Pressable onPress={handleContact} style={({ pressed }) => [styles.contactBtn, pressed && { opacity: 0.8 }]}>
            <LinearGradient colors={colors.gradients.primary} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.contactBtnGrad}>
              <Text style={styles.contactBtnText}>שלח הודעה לתמיכה ←</Text>
            </LinearGradient>
          </Pressable>
          <Text style={styles.contactEmail}>support@psychotechniplus.com</Text>
        </View>

        <Text style={styles.version}>PsychoTechni+ · גרסה 1.0.0</Text>
        <View style={{ height: 32 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

function makeStyles(colors: ThemeColors) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },

    header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 28 },
    backBtn: { marginBottom: 16 },
    backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)' },
    heroRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 6 },
    heroBadge: { width: 48, height: 48, borderRadius: Radius.xl, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
    heroBadgeEmoji: { fontSize: 26 },
    headerTitle: { fontFamily: FontFamily.heading, fontSize: FontSize['2xl'], color: '#fff' },
    headerSub: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.65)', textAlign: 'right', marginTop: 2 },

    content: { padding: 16, gap: 8 },

    card: { backgroundColor: colors.surfaceCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: 16, ...Shadow.sm },
    divider: { height: 1, backgroundColor: colors.border, marginHorizontal: 16 },

    quickCard: { backgroundColor: colors.primaryLighter, borderRadius: Radius.xl, borderWidth: 1.5, borderColor: colors.primary + '35', padding: 18, marginBottom: 20 },
    quickTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: colors.primaryLight, textAlign: 'right', marginBottom: 14 },
    quickStep: { flexDirection: 'row-reverse', alignItems: 'center', gap: 12, marginBottom: 10 },
    quickNum: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    quickNumText: { fontFamily: FontFamily.bold, fontSize: 13, color: '#fff' },
    quickStepText: { flex: 1, fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: colors.text, textAlign: 'right' },

    tabRow: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13, gap: 14 },
    tabRowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    tabRowIcon: { fontSize: 22, width: 28, textAlign: 'center' },
    tabRowBody: { flex: 1, alignItems: 'flex-end' },
    tabRowTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.sm, color: colors.text },
    tabRowDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textSecondary, textAlign: 'right', marginTop: 2 },

    modesGrid: { gap: 10, marginBottom: 16 },

    eloCard: { backgroundColor: colors.surfaceCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 12, ...Shadow.sm },
    eloRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
    eloLabel: { fontFamily: FontFamily.bold, fontSize: FontSize.xs, width: 50, textAlign: 'right' },
    eloBarTrack: { flex: 1, height: 8, backgroundColor: colors.surfaceSecondary, borderRadius: 4, overflow: 'hidden' },
    eloBarFill: { height: 8, borderRadius: 4 },
    eloRange: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textTertiary, width: 72, textAlign: 'left' },

    tipsCard: { backgroundColor: colors.surfaceCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: 16, marginBottom: 16, gap: 12, ...Shadow.sm },
    tip: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: 10 },
    tipBullet: { fontFamily: FontFamily.bold, fontSize: 14, color: colors.primary, marginTop: 1, flexShrink: 0 },
    tipText: { flex: 1, fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.text, textAlign: 'right', lineHeight: 20 },

    faqCard: { backgroundColor: colors.surfaceCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, marginBottom: 16, ...Shadow.sm, overflow: 'hidden' },

    contactCard: { backgroundColor: colors.surfaceCard, borderRadius: Radius.xl, borderWidth: 1, borderColor: colors.border, padding: 20, marginBottom: 16, alignItems: 'center', gap: 10, ...Shadow.sm },
    contactTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.lg, color: colors.text },
    contactDesc: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: colors.textSecondary, textAlign: 'center', lineHeight: 20 },
    contactBtn: { width: '100%', borderRadius: Radius.xl, overflow: 'hidden', ...Shadow.primary },
    contactBtnGrad: { paddingVertical: 16, alignItems: 'center' },
    contactBtnText: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#fff' },
    contactEmail: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textTertiary },

    version: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: colors.textTertiary, textAlign: 'center', marginTop: 4 },
  });
}
