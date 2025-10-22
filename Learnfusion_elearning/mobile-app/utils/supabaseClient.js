import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

// Retrieve Supabase credentials from environment variables via app.config.js
const supabaseUrl = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = Constants.expoConfig.extra.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// For convenience, you can still export the URL if other parts of your app need it
export const SUPABASE_URL = supabaseUrl;
