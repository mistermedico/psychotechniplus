import React from 'react';
import { ScrollViewStyleReset } from 'expo-router/html';

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, viewport-fit=cover"
        />
        <meta
          name="description"
          content="פסיכוטכני פלוס — פלטפורמה לתרגול פסיכוטכני, סימולציות חכמות, תרגול אדפטיבי ומעקב התקדמות."
        />
        <meta name="theme-color" content="#060912" />
        <meta name="robots" content="index,follow" />
        <meta property="og:locale" content="he_IL" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="פסיכוטכני פלוס" />
        <meta
          property="og:description"
          content="תרגול פסיכוטכני, סימולציות חכמות, תרגול אדפטיבי ומעקב התקדמות."
        />
        <meta property="og:url" content="https://psychotechniplus.vercel.app/" />
        <meta property="og:image" content="https://psychotechniplus.vercel.app/favicon.ico" />
        <meta name="twitter:card" content="summary" />
        <meta name="twitter:title" content="פסיכוטכני פלוס" />
        <meta
          name="twitter:description"
          content="תרגול פסיכוטכני, סימולציות חכמות, תרגול אדפטיבי ומעקב התקדמות."
        />
        <link rel="manifest" href="/manifest.json" />
        <link rel="canonical" href="https://psychotechniplus.vercel.app/" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: `
          html, body, #root {
            direction: rtl;
            min-height: 100%;
            background: #060912;
          }
          body { margin: 0; }
        ` }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
