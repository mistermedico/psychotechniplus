import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const SUPABASE_URL = 'https://kdnkrvltgptiffxkclyg.supabase.co';
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtkbmtydmx0Z3B0aWZmeGtjbHlnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMzgyODcsImV4cCI6MjA5NDYxNDI4N30.FPfk0H5ln1gTkWgyt84atBJ3MgnSnWJR9Xi6ujYM6pM';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === 'web' ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});
