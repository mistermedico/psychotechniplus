import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { FontFamily, FontSize, Radius, Shadow } from '../constants/theme';

type ScreenGuideContent = {
  title: string;
  body: string;
  features: string[];
};

const GUIDES: Record<string, ScreenGuideContent> = {
  '/': {
    title: 'מסך הבית',
    body: 'כאן רואים תמונת מצב מהירה של הלמידה: רצף, דיוק, XP, רמה ונושאי תרגול מומלצים.',
    features: ['המשך תרגול מהיר', 'בחירת נושא לפי מסלול', 'סטטיסטיקות והישגים אחרונים'],
  },
  '/landing': {
    title: 'עמוד פתיחה',
    body: 'מסך הכניסה מציג את הערך המרכזי של האפליקציה ומוביל להתחברות או התחלת שימוש.',
    features: ['כניסה לחשבון', 'הצגת יתרונות האפליקציה', 'מעבר להרשמה או התחברות'],
  },
  '/auth': {
    title: 'התחברות והרשמה',
    body: 'במסך זה מתחברים לחשבון קיים או יוצרים משתמש חדש כדי לשמור התקדמות וסנכרון.',
    features: ['כניסה עם אימייל וסיסמה', 'יצירת חשבון', 'שמירת התקדמות בענן'],
  },
  '/onboarding': {
    title: 'בחירת מסלול ראשונית',
    body: 'כאן מגדירים את יעד ההכנה שלך כדי שהשאלות, הרמות והתרגולים יותאמו למסלול הנכון.',
    features: ['בחירת יעד', 'התאמת נושאים', 'הכנה להתחלת תרגול'],
  },
  '/targets': {
    title: 'מסלולים',
    body: 'כאן בוחרים או מחליפים מסלול הכנה. הבחירה משפיעה על הנושאים, המבחנים וההמלצות.',
    features: ['בחירת יעד פסיכוטכני', 'צפייה בנושאי המסלול', 'התאמת התרגול למטרה'],
  },
  '/practice': {
    title: 'תרגול ומבחנים',
    body: 'זהו מרכז התרגול: בוחרים נושא, רמת קושי ומצב תרגול, או מתחילים סימולציה מלאה.',
    features: ['תרגול חופשי', 'תרגול אדפטיבי', 'סימולציות ומבחנים מלאים'],
  },
  '/progress': {
    title: 'התקדמות',
    body: 'כאן עוקבים אחרי ביצועים לאורך זמן ומזהים באילו נושאים כדאי להתמקד.',
    features: ['דיוק לפי נושא', 'רמות ו-XP', 'מגמות שיפור'],
  },
  '/profile': {
    title: 'פרופיל והגדרות חשבון',
    body: 'כאן מנהלים את החשבון, מנוי הפרימיום, נתוני המשתמש ופעולות חשבון חשובות.',
    features: ['ניהול חשבון', 'שדרוג לפרימיום', 'יציאה מהחשבון ומחיקת נתונים'],
  },
  '/practice-session': {
    title: 'סשן תרגול',
    body: 'במסך זה עונים על שאלות בזמן אמת, מקבלים משוב והסברים, ומתקדמים לפי מצב התרגול שנבחר.',
    features: ['מענה על שאלות', 'ניווט בין שאלות', 'הסברים ועדכון ביצועים'],
  },
  '/results': {
    title: 'תוצאות',
    body: 'כאן רואים סיכום ביצוע לאחר תרגול או מבחן, כולל ציון, דיוק ונקודות לשיפור.',
    features: ['ציון ודיוק', 'ניתוח תשובות', 'המלצות להמשך תרגול'],
  },
  '/paywall': {
    title: 'פרימיום',
    body: 'מסך זה מציג את אפשרויות השדרוג ואת היכולות הנוספות שנפתחות למנויי פרימיום.',
    features: ['מבחנים מלאים', 'גישה מורחבת לשאלות', 'תכונות מתקדמות'],
  },
  '/privacy': {
    title: 'מדיניות פרטיות',
    body: 'כאן מופיע פירוט על איסוף, שמירה ושימוש בנתוני המשתמש באפליקציה.',
    features: ['מידע על נתונים', 'שימושים מותרים', 'זכויות משתמש'],
  },
  '/terms': {
    title: 'תנאי שימוש',
    body: 'כאן מוצגים תנאי השימוש באפליקציה, אחריות המשתמש וכללי השירות.',
    features: ['כללי שימוש', 'מנויים ותשלומים', 'אחריות והגבלות'],
  },
  '/maintenance': {
    title: 'תחזוקה',
    body: 'מסך זה מופיע כאשר האפליקציה נמצאת בתחזוקה או כאשר מנהל חסם זמנית שימוש.',
    features: ['הודעת מערכת', 'מצב שירות', 'חזרה כשהמערכת זמינה'],
  },
  '/admin': {
    title: 'פאנל ניהול',
    body: 'זהו מרכז השליטה של המנהל לניהול תוכן, משתמשים, מבחנים, הכנסות והגדרות מערכת.',
    features: ['קיצורי ניהול', 'מדדי מערכת', 'ניווט לכל כלי האדמין'],
  },
  '/admin/questions': {
    title: 'ניהול שאלות',
    body: 'כאן מנהלים את מאגר השאלות: חיפוש, סינון, עריכה, שכפול, מחיקה ופעולות קבוצתיות.',
    features: ['פילטרים ובקרת איכות', 'עריכת שאלות', 'שינוי גישה וסטטוס'],
  },
  '/admin/question-editor': {
    title: 'עורך שאלה',
    body: 'במסך זה יוצרים או עורכים שאלה מלאה, כולל טקסט, אפשרויות, תשובה נכונה, הסבר וגישה.',
    features: ['עריכת כל שדות השאלה', 'סימון תשובה נכונה', 'שמירה למאגר'],
  },
  '/admin/validate': {
    title: 'אימות שאלות',
    body: 'כאן המנהל בודק שאלות לפני אישור, עורך פרטים, מאשר, דוחה או מחזיר לשיפור.',
    features: ['בדיקת תוכן', 'עריכה לפני אישור', 'סימון שאלה כמאומתת'],
  },
  '/admin/json-import': {
    title: 'ייבוא JSON',
    body: 'מסך זה מאפשר להעלות שאלות או נתוני תוכן בפורמט JSON ולשלב אותם במערכת.',
    features: ['הדבקת JSON', 'בדיקת מבנה', 'ייבוא למאגר'],
  },
  '/admin/ai-generator': {
    title: 'מחולל שאלות',
    body: 'כאן יוצרים שאלות חדשות לפי תבניות, נושא ורמת קושי, ואז מעבירים אותן לאימות.',
    features: ['יצירת שאלות', 'בחירת נושא וקושי', 'שליחה לבדיקה'],
  },
  '/admin/export': {
    title: 'ייצוא נתונים',
    body: 'כאן מייצאים שאלות, מבחנים או נתוני מערכת לקובץ לצורך גיבוי, בדיקה או העברה.',
    features: ['ייצוא JSON', 'גיבוי תוכן', 'שיתוף נתונים'],
  },
  '/admin/topics-admin': {
    title: 'ניהול נושאים',
    body: 'במסך זה מנהלים את נושאי הלמידה והשיוך שלהם למסלולים השונים.',
    features: ['יצירת נושא', 'עריכת נושא', 'שיוך למסלול'],
  },
  '/admin/simulation-builder': {
    title: 'בונה סימולציות',
    body: 'כאן מגדירים מבחנים מלאים: מספר שאלות, חלוקה לנושאים, זמן, קושי וכללי בחירה.',
    features: ['תבניות מבחן', 'חלוקה לפרקים', 'כללי בחירת שאלות'],
  },
  '/admin/topic-exam-map': {
    title: 'מפת נושאים ומבחנים',
    body: 'מסך זה מציג ומנהל את הקשר בין נושאים, פרקים ותבניות מבחן.',
    features: ['שיוך נושאים', 'בדיקת כיסוי', 'בקרת מבנה מבחן'],
  },
  '/admin/question-assignment': {
    title: 'שיוך שאלות',
    body: 'כאן משייכים שאלות לנושאים, פרקים ומבחנים כדי לשלוט בדיוק במה שהמשתמשים יקבלו.',
    features: ['שיוך לפי נושא', 'שיוך לפי מבחן', 'בקרת מאגר'],
  },
  '/admin/display-settings': {
    title: 'הגדרות תצוגה',
    body: 'כאן שולטים באופן שבו שאלות, תשובות והסברים מוצגים למשתמשים.',
    features: ['תצוגת שאלה', 'תצוגת הסברים', 'התאמות UI'],
  },
  '/admin/users': {
    title: 'ניהול משתמשים',
    body: 'במסך זה צופים במשתמשים, בודקים מצב מנוי ומעדכנים גישה או הרשאות.',
    features: ['חיפוש משתמשים', 'הפיכת משתמש לפרימיום', 'מעקב פעילות'],
  },
  '/admin/monitor': {
    title: 'ניטור מערכת',
    body: 'כאן רואים מצב חי של שאלות, מבחנים, הגשות ונתוני שימוש כדי לזהות בעיות במהירות.',
    features: ['מעקב הגשות', 'בקרת תוכן', 'איתור חריגות'],
  },
  '/admin/leaderboard-admin': {
    title: 'ניהול דירוגים',
    body: 'מסך זה מאפשר לשלוט בלוח המובילים, לבדוק ביצועים ולנהל דירוג משתמשים.',
    features: ['צפייה בדירוג', 'ניהול ניקוד', 'בקרת תחרות'],
  },
  '/admin/revenue': {
    title: 'הכנסות ומנויים',
    body: 'כאן עוקבים אחרי הכנסות, מנויי פרימיום, שיעורי המרה ומדדי RevenueCat.',
    features: ['MRR והמרות', 'מנויים פעילים', 'מדדי פרימיום'],
  },
  '/admin/promo-codes': {
    title: 'קודי קופון',
    body: 'כאן יוצרים ומנהלים קודי הטבה, גישה זמנית או שדרוגים מיוחדים.',
    features: ['יצירת קוד', 'הגדרת תוקף', 'מעקב שימוש'],
  },
  '/admin/notifications': {
    title: 'הודעות Push',
    body: 'במסך זה יוצרים ושולחים הודעות למשתמשים לפי קהל יעד או אירוע.',
    features: ['כתיבת הודעה', 'בחירת קהל', 'שליחה ומעקב'],
  },
  '/admin/app-settings': {
    title: 'הגדרות אפליקציה',
    body: 'כאן מנהלים פרמטרים גלובליים שמשפיעים על חוויית המשתמש והגישה לתכונות.',
    features: ['הגבלות שימוש', 'דגלי תכונות', 'הודעות מערכת'],
  },
  '/admin/performance': {
    title: 'ביצועים',
    body: 'כאן מנתחים ביצועים לפי נושא, רמת קושי, משתמשים וסוגי שאלות.',
    features: ['דיוק לפי נושא', 'קושי ממוצע', 'זיהוי נקודות חולשה'],
  },
  '/admin/analytics': {
    title: 'אנליטיקה',
    body: 'מסך זה מרכז גרפים ומגמות על שימוש, למידה, תרגולים והתקדמות משתמשים.',
    features: ['מגמות שימוש', 'ניתוח למידה', 'מדדי פעילות'],
  },
  '/admin/app-control': {
    title: 'מרכז שליטה',
    body: 'כאן שולטים במצב המערכת, תחזוקה, חסימות, דגלים ותפעול כללי.',
    features: ['מצב תחזוקה', 'הפעלת תכונות', 'בקרת מערכת'],
  },
  '/admin/session-settings': {
    title: 'הגדרות סשן',
    body: 'במסך זה מגדירים מגבלות תרגול, זמני מבחן, קירור בין סשנים וכללי שימוש.',
    features: ['זמני תרגול', 'מגבלות משתמש', 'כללי מבחן'],
  },
  '/admin/daily-challenge': {
    title: 'אתגר יומי',
    body: 'כאן יוצרים ומנהלים אתגרי תרגול יומיים שמחזקים התמדה ומעניקים XP.',
    features: ['בחירת שאלות', 'בונוס XP', 'הפעלת אתגר'],
  },
  '/admin/activity-log': {
    title: 'יומן פעילות',
    body: 'מסך זה מציג פעולות מערכת ומנהל כדי לעקוב אחרי שינויים חשובים.',
    features: ['מעקב פעולות', 'תיעוד שינויים', 'בדיקת אירועים'],
  },
  '/admin/logs': {
    title: 'לוגים',
    body: 'כאן בודקים שגיאות, אירועים טכניים והודעות מערכת לצורך אבחון תקלות.',
    features: ['שגיאות מערכת', 'אירועים טכניים', 'אבחון בעיות'],
  },
};

function getGuide(pathname: string): ScreenGuideContent {
  if (GUIDES[pathname]) return GUIDES[pathname];
  const adminParent = Object.keys(GUIDES)
    .filter(path => path.startsWith('/admin/') && pathname.startsWith(path))
    .sort((a, b) => b.length - a.length)[0];
  if (adminParent) return GUIDES[adminParent];
  if (pathname.startsWith('/admin')) return GUIDES['/admin'];
  return {
    title: 'מסך באפליקציה',
    body: 'במסך זה מופיעים כלים ותוכן בהתאם לשלב שבו אתה נמצא באפליקציה.',
    features: ['פעולות רלוונטיות למסך', 'נתונים והכוונה', 'ניווט להמשך עבודה'],
  };
}

export default function ScreenGuide() {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const guide = useMemo(() => getGuide(pathname), [pathname]);
  const isTabScreen = ['/', '/targets', '/practice', '/progress', '/profile'].includes(pathname);
  const bottomOffset = insets.bottom + (isTabScreen ? 92 : 16);

  useEffect(() => {
    setExpanded(false);
  }, [pathname]);

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: bottomOffset }]}>
      {expanded ? (
        <View style={styles.card}>
          <View style={styles.header}>
            <Pressable
              onPress={() => setExpanded(false)}
              accessibilityRole="button"
              accessibilityLabel="הסתר הסבר מסך"
              style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}
            >
              <Ionicons name="chevron-up" size={18} color={Colors.text} />
            </Pressable>
            <View style={styles.titleWrap}>
              <Text style={styles.kicker}>מה במסך?</Text>
              <Text style={styles.title}>{guide.title}</Text>
            </View>
            <View style={styles.infoIcon}>
              <Ionicons name="information-circle" size={20} color={Colors.primaryLight} />
            </View>
          </View>
          <Text style={styles.body}>{guide.body}</Text>
          <View style={styles.features}>
            {guide.features.map(feature => (
              <View key={feature} style={styles.featurePill}>
                <Text style={styles.featureText}>{feature}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : (
        <Pressable
          onPress={() => setExpanded(true)}
          accessibilityRole="button"
          accessibilityLabel={`פתח הסבר למסך ${guide.title}`}
          style={({ pressed }) => [styles.collapsed, pressed && styles.pressed]}
        >
          <Ionicons name="information-circle-outline" size={18} color={Colors.primaryLight} />
          <Text style={styles.collapsedText}>מה במסך?</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 1000,
    alignItems: 'flex-start',
  },
  card: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: 'rgba(8,10,18,0.94)',
    padding: 12,
    ...Shadow.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    alignItems: 'flex-end',
  },
  kicker: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.xs,
    color: Colors.primaryLight,
    textAlign: 'right',
  },
  title: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'right',
  },
  body: {
    marginTop: 8,
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    lineHeight: 21,
    color: Colors.textSecondary,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  features: {
    marginTop: 10,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  featurePill: {
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surfaceSecondary,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },
  featureText: {
    fontFamily: FontFamily.medium,
    fontSize: FontSize.xs,
    color: Colors.textSecondary,
    textAlign: 'right',
  },
  infoIcon: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.primaryLighter,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: Radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.surface,
  },
  collapsed: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: Radius.full,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: 'rgba(8,10,18,0.94)',
    paddingVertical: 9,
    paddingHorizontal: 14,
    minHeight: 40,
    ...Shadow.sm,
  },
  collapsedText: {
    fontFamily: FontFamily.semiBold,
    fontSize: FontSize.sm,
    color: Colors.text,
    textAlign: 'right',
  },
  pressed: {
    opacity: 0.8,
  },
});
