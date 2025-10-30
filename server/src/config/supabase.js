const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY;

console.log("🔧 Supabase URL:", supabaseUrl); // URL 확인
console.log("🔧 Has Service Key:", !!supabaseServiceKey); // 키 존재 여부

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing Supabase environment variables");
  console.error("URL:", supabaseUrl);
  console.error("Key exists:", !!supabaseServiceKey);
  process.exit(1);
}

try {
  const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  console.log("✅ Supabase client created successfully");

  module.exports = supabase;
} catch (error) {
  console.error("❌ Failed to create Supabase client:", error);
  process.exit(1);
}
