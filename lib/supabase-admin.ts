import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || (!serviceRoleKey && !anonKey)) {
  throw new Error("Missing Supabase server credentials.");
}

export const supabaseAdmin = createClient(url, serviceRoleKey ?? anonKey!, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
