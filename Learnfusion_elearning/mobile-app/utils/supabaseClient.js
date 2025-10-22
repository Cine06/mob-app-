import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = "https://msmmyxosdbvrcflhkcbr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbW15eG9zZGJ2cmNmbGhrY2JyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDMzMzMwMDIsImV4cCI6MjA1ODkwOTAwMn0.H2dnnnn34dybdafMzXoiVVg58V24EtdvErF_UTBaOSc";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
