import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = Extract<Provider, 'google' | 'apple'>;

export function getOAuthRedirectUrl(): string {
  return Linking.createURL('auth-callback');
}

function readParam(url: string, key: string): string | null {
  const queryIndex = url.indexOf('?');
  const hashIndex = url.indexOf('#');
  const parts = [
    queryIndex >= 0 ? url.slice(queryIndex + 1, hashIndex >= 0 ? hashIndex : undefined) : '',
    hashIndex >= 0 ? url.slice(hashIndex + 1) : '',
  ].filter(Boolean);

  for (const part of parts) {
    const params = new URLSearchParams(part);
    const value = params.get(key);
    if (value) return value;
  }
  return null;
}

export async function finishOAuthCallback(url: string) {
  const error = readParam(url, 'error_description') ?? readParam(url, 'error');
  if (error) throw new Error(decodeURIComponent(error));

  const code = readParam(url, 'code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }

  const accessToken = readParam(url, 'access_token');
  const refreshToken = readParam(url, 'refresh_token');
  if (accessToken && refreshToken) {
    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    if (sessionError) throw sessionError;
    return;
  }

  throw new Error('לא התקבל אישור התחברות מהספק');
}

export async function signInWithOAuthProvider(provider: OAuthProvider) {
  const redirectTo = getOAuthRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: true,
      scopes: provider === 'apple' ? 'name email' : 'openid email profile',
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error('ספק ההתחברות לא החזיר כתובת אימות');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success' || !result.url) {
    throw new Error(result.type === 'cancel' ? 'ההתחברות בוטלה' : 'לא ניתן להשלים התחברות');
  }

  await finishOAuthCallback(result.url);
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) throw sessionError;
  if (!sessionData.session?.user?.id) throw new Error('לא נוצר סשן משתמש תקין');
  return sessionData.session.user;
}
