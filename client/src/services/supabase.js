import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("URL:", supabaseUrl);
  console.error("Anon Key exists:", !!supabaseAnonKey);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    storage: window.localStorage,
    storageKey: "between-us-auth",
  },
});

// 세션 체크 헬퍼
export const checkSession = async () => {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  console.log("🔍 Session check:", session?.user?.email, error);
  return session;
};
