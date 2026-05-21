import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { FontFamily, FontSize, Radius } from '../constants/theme';

const SECTIONS = [
  {
    title: '1. קבלת התנאים',
    body: 'בשימוש באפליקציית PsychoTechniPlus ("השירות"), אתה מאשר שקראת, הבנת והסכמת לתנאי שימוש אלו. אם אינך מסכים לתנאים, אנא הפסק להשתמש בשירות.',
  },
  {
    title: '2. תיאור השירות',
    body: 'PsychoTechniPlus מספקת פלטפורמת הכנה לבחינות פסיכוטכניות. השירות כולל שאלות תרגול, סימולציות, מעקב התקדמות ותוכן חינוכי.',
  },
  {
    title: '3. חשבון משתמש',
    body: 'עליך ליצור חשבון כדי לגשת לחלק מתכונות השירות. אתה אחראי לשמור על סודיות פרטי ההתחברות שלך ולכל פעילות שמתרחשת תחת חשבונך. עליך להיות בן 13 לפחות כדי להשתמש בשירות.',
  },
  {
    title: '4. שימוש מותר',
    body: 'אתה מסכים להשתמש בשירות אך ורק למטרות חינוכיות אישיות. אין להעתיק, לשכפל, למכור או להפיץ תוכן מהשירות ללא אישור מפורש בכתב.',
  },
  {
    title: '5. רכישות ומנויים',
    body: 'רכישות מתבצעות דרך Apple App Store. המנויים מתחדשים אוטומטית אלא אם ביטלת לפחות 24 שעות לפני תום התקופה. ניתן לנהל ולבטל מנויים דרך הגדרות החשבון ב-App Store.',
  },
  {
    title: '6. הגבלת אחריות',
    body: 'השירות מסופק "כפי שהוא". איננו מתחייבים שהשירות יהיה זמין ללא הפרעות. לא נישא באחריות לכל נזק ישיר או עקיף הנובע משימוש בשירות.',
  },
  {
    title: '7. שינויים בתנאים',
    body: 'אנו שומרים את הזכות לשנות תנאים אלו בכל עת. שינויים מהותיים יפורסמו בהודעה באפליקציה. המשך השימוש לאחר פרסום השינויים מהווה הסכמה לתנאים החדשים.',
  },
  {
    title: '8. יצירת קשר',
    body: 'לשאלות בנוגע לתנאי השימוש, פנה אלינו בכתובת: support@psychotechniplus.com',
  },
];

export default function TermsScreen() {
  return (
    <LinearGradient colors={['#060912', '#0D1425', '#1A0F2E']} style={{ flex: 1 }}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backBtn, pressed && { opacity: 0.7 }]}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <Text style={styles.backText}>→ חזור</Text>
          </Pressable>
          <Text style={styles.title}>תנאי שימוש</Text>
          <View style={{ width: 60 }} />
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <Text style={styles.updated}>עודכן לאחרונה: ינואר 2025</Text>

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
  header: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  backBtn: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: Radius.lg,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  backText: { fontFamily: FontFamily.medium, fontSize: FontSize.sm, color: 'rgba(255,255,255,0.8)' },
  title: { fontFamily: FontFamily.heading, fontSize: FontSize.xl, color: '#F1F5F9' },
  content: { padding: 20 },
  updated: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.xs,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'right',
    marginBottom: 24,
  },
  section: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.xl,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: FontSize.base,
    color: '#818CF8',
    textAlign: 'right',
    marginBottom: 8,
  },
  sectionBody: {
    fontFamily: FontFamily.regular,
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.75)',
    textAlign: 'right',
    lineHeight: 22,
  },
});
