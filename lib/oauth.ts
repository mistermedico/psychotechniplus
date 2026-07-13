import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';
import { Provider } from '@supabase/supabase-js';
import { supabase } from './supabase';

WebBrowser.maybeCompleteAuthSession();

export type OAuthProvider = Extract<Provider, 'google' | 'apple'>;

export function getOAuthRedirectUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth-callback`;
  }

  return Linking.createURL('auth-callback', { scheme: 'psychotechniplus' });
}

export function getCurrentOAuthCallbackUrl(): string | null {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return window.location.href;
  }

  return null;
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
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, '/auth-callback');
    }
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
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.history.replaceState({}, document.title, '/auth-callback');
    }
    return;
  }

  throw new Error('לא התקבל אישור התחברות מהספק');
}

async function assertOAuthProviderReady(authUrl: string) {
  if (Platform.OS !== 'web' || typeof fetch === 'undefined') return;

  try {
    const response = await fetch(authUrl, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'include',
    });
    if (response.status < 400) return;

    const payload = await response.json().catch(() => null);
    const message = typeof payload?.msg === 'string'
      ? payload.msg
      : typeof payload?.message === 'string'
        ? payload.message
        : 'ספק ההתחברות לא זמין כרגע';
    const providerError = new Error(message);
    (providerError as Error & { fromOAuthPreflight?: boolean }).fromOAuthPreflight = true;
    throw providerError;
  } catch (error: any) {
    if (error?.fromOAuthPreflight) throw error;
    // If the browser blocks this preflight, continue to the normal OAuth redirect.
  }
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

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    await assertOAuthProviderReady(data.url);
    window.location.assign(data.url);
    await new Promise<never>(() => {});
  }

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
