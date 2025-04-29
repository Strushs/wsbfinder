// lib/supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

// Ensure these environment variables are set in your .env.local file
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  console.error("Missing environment variable: NEXT_PUBLIC_SUPABASE_URL");
  // Optionally throw an error or handle it gracefully
  // throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_URL');
}
if (!supabaseAnonKey) {
  console.error("Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY");
  // Optionally throw an error or handle it gracefully
  // throw new Error('Missing environment variable: NEXT_PUBLIC_SUPABASE_ANON_KEY');
}

// Create and export the Supabase client
// Handle the case where keys might be missing during initial setup or build time
export const supabase = createClient(supabaseUrl || "", supabaseAnonKey || "");

// You might want a separate admin client for server-side operations
// that require bypassing RLS, using the SERVICE_ROLE_KEY.
// const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
// export const supabaseAdmin = createClient(supabaseUrl || '', supabaseServiceKey || '');
