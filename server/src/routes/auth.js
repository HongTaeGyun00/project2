const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");

// 회원가입
router.post("/signup", async (req, res) => {
  try {
    const { email, password, username, display_name } = req.body;

    console.log("📝 Signup attempt:", { email, username }); // 디버깅

    // Supabase Auth로 사용자 생성
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      console.error("❌ Supabase auth error:", authError); // 디버깅
      return res.status(400).json({ error: authError.message });
    }

    console.log("✅ Auth user created:", authData.user?.id); // 디버깅

    // users 테이블에 추가 정보 저장
    const { data: userData, error: userError } = await supabase
      .from("users")
      .insert({
        id: authData.user.id,
        email,
        username,
        display_name: display_name || username,
      })
      .select()
      .single();

    if (userError) {
      console.error("❌ User table error:", userError); // 디버깅
      // Auth는 성공했지만 users 테이블 저장 실패 - 계속 진행
    }

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user: userData || { email, username, display_name },
      session: authData.session,
    });
  } catch (error) {
    console.error("❌ Signup error:", error); // 디버깅
    res.status(500).json({ error: "Failed to create user" });
  }
});

// 로그인
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log("🔐 Login attempt:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error("❌ Login error:", error);
      return res.status(401).json({ error: error.message });
    }

    console.log("✅ Login successful:", data.user?.id);

    // Session 객체 확인
    console.log("📦 Session structure:", {
      hasSession: !!data.session,
      hasAccessToken: !!data.session?.access_token,
      hasRefreshToken: !!data.session?.refresh_token,
      tokenLength: data.session?.access_token?.length,
    });

    // users 테이블에서 추가 정보 가져오기
    let userData = null;
    try {
      const { data: dbUser, error: userError } = await supabase
        .from("users")
        .select("*")
        .eq("id", data.user.id)
        .single();

      if (!userError) {
        userData = dbUser;
      } else if (userError.code === "PGRST116") {
        // 사용자 정보가 없으면 생성
        console.log("📝 Creating user profile...");
        const { data: newUser } = await supabase
          .from("users")
          .insert({
            id: data.user.id,
            email: data.user.email,
            username: data.user.email.split("@")[0],
            display_name: data.user.email.split("@")[0],
          })
          .select()
          .single();
        userData = newUser;
      }
    } catch (dbError) {
      console.error("❌ Database error:", dbError);
    }

    // 응답 전송
    const responseData = {
      success: true,
      user: userData || {
        id: data.user.id,
        email: data.user.email,
        username: data.user.email.split("@")[0],
        display_name: data.user.email.split("@")[0],
      },
      session: {
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
        expires_in: data.session.expires_in,
        expires_at: data.session.expires_at,
        user: data.session.user,
      },
    };

    console.log("📤 Sending response with session");
    res.json(responseData);
  } catch (error) {
    console.error("❌ Login error:", error);
    res.status(500).json({ error: "Login failed" });
  }
});

module.exports = router;
