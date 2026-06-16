import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FontFamily, FontSize, Radius } from '../constants/theme';

const SECTIONS = [
  { title: '1. מידע שאנו אוספים', body: 'אנו אוספים:\n• פרטי חשבון: כתובת מייל ושם מלא (רשות)\n• נתוני שימוש: תשובות לשאלות, תוצאות תרגול, ציונים ו-ELO\n• נתוני התקדמות: רצפי תרגול, הישגים ורמות\n• מידע טכני: סוג מכשיר וגרסת אפליקציה לצורכי תמיכה' },
  { title: '2. כיצד אנו משתמשים במידע', body: 'המידע משמש אך ורק לצורך:\n• הפעלה ושיפור השירות\n• התאמת תוכן ולמידה אדפטיבית\n• מעקב התקדמות אישי\n• תמיכה טכנית\n• שיפור האלגוריתם' },
  { title: '3. שיתוף מידע', body: 'אנו לא מוכרים, לא מסחרים ולא מעבירים את המידע האישי שלך לצדדים שלישיים, למעט:\n• ספקי שירות הכרחיים להפעלת האפליקציה, כגון Supabase לאחסון נתונים, RevenueCat לניהול זכאות מנויים ו-Apple לעיבוד רכישות בתוך האפליקציה\n• כאשר נדרש על פי חוק' },
  { title: '4. אבטחת מידע', body: 'אנו נוקטים באמצעי אבטחה סבירים כולל הצפנה בהעברה ובאחסון. עם זאת, אין אנו יכולים להבטיח אבטחה מוחלטת של כל העברת מידע.' },
  { title: '5. שמירת מידע', body: 'אנו שומרים את המידע שלך כל עוד החשבון פעיל. עם מחיקת החשבון, נמחק את כל הנתונים האישיים תוך 30 יום.' },
  { title: '6. זכויותיך', body: 'יש לך זכות:\n• לגשת למידע שאנו מחזיקים עליך\n• לתקן מידע שגוי\n• למחוק את חשבונך ונתוניך\n• לייצא את הנתונים שלך\n\nלבקשות, פנה אל: mrmedico111@gmail.com' },
  { title: '7. עוגיות ומעקב', body: 'האפליקציה אינה משתמשת בעוגיות. אנו לא עוקבים אחר פעילותך מחוץ לאפליקציה ולא משתמשים בטכנולוגיות מעקב של צד שלישי.' },
  { title: '8. ילדים', body: 'השירות מיועד למשתמשים מגיל 13 ומעלה. איננו אוספים ביודעין מידע אישי מילדים מתחת לגיל 13.' },
  { title: '9. יצירת קשר', body: 'לשאלות בנוגע למדיניות הפרטיות:\nmrmedico111@gmail.com' },
];

export default function PrivacyScreen() {
  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.backText}>→ חזור</Text>
          </Pressable>
          <Text style={styles.title}>מדיניות פרטיות</Text>
          <View style={{ width: 60 }} />
        </View>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.updated}>עודכן לאחרונה: יוני 2026</Text>
          {SECTIONS.map((section, i) => (
            <View key={i} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              <Text style={styles.sectionBody}>{section.body}</Text>
            </View>
          ))}
          <View style={{ height: 32 }} />
        </ScrollView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: 'transparent' },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  backBtn: { backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: Radius.lg, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },
  title: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: '#F1F5F9' },
  content: { padding: 20 },
  updated: { fontFamily: FontFamily.regular, fontSize: FontSize.xs, color: 'rgba(255,255,255,0.4)', textAlign: 'right', marginBottom: 24 },
  section: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: Radius.xl, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  sectionTitle: { fontFamily: FontFamily.bold, fontSize: FontSize.base, color: '#818CF8', textAlign: 'right', marginBottom: 8 },
  sectionBody: { fontFamily: FontFamily.regular, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.75)', textAlign: 'right', lineHeight: 22 },
});
