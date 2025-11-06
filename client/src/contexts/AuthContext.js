import React, { createContext, useContext, useState, useEffect } from "react";
import { supabase } from "../services/supabase";
import api from "../services/api";

const AuthContext = createContext({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 초기 세션 체크
    checkUser();

    // Auth 상태 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("🔄 Auth state changed:", event, session?.user?.email);

      if (event === "SIGNED_IN" && session) {
        console.log("👤 Setting user from session");
        // API 호출 없이 바로 세션 정보 사용
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.email.split("@")[0],
          display_name: session.user.email.split("@")[0],
        });
      } else if (event === "SIGNED_OUT") {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const checkUser = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();
      console.log("📱 Current session:", session?.user?.email, error);

      if (session?.user) {
        setUser({
          id: session.user.id,
          email: session.user.email,
          username: session.user.email.split("@")[0],
          display_name: session.user.email.split("@")[0],
        });
      } else {
        setUser(null);
      }
    } catch (error) {
      console.error("Check user error:", error);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    try {
      setError(null);
      console.log("🔐 Logging in:", email);

      // 서버에 로그인 요청
      const response = await api.post("/auth/login", { email, password });
      console.log("🔐 Login response:", response);

      if (!response.success || !response.session) {
        console.error("❌ Invalid response structure");
        return { success: false, error: "Invalid server response" };
      }

      // Session 객체 확인
      console.log("📦 Session object:", {
        hasAccessToken: !!response.session.access_token,
        hasRefreshToken: !!response.session.refresh_token,
        hasUser: !!response.session.user,
      });

      try {
        // Supabase 세션 설정
        console.log("🔑 Setting session...");
        const { data, error: sessionError } = await supabase.auth.setSession({
          access_token: response.session.access_token,
          refresh_token: response.session.refresh_token,
        });

        if (sessionError) {
          console.error("❌ Session error:", sessionError);
          return { success: false, error: sessionError.message };
        }

        console.log("✅ Session set result:", data);

        // 즉시 사용자 정보 설정
        const userData = response.user || {
          email,
          username: email.split("@")[0],
          display_name: email.split("@")[0],
        };

        console.log("👤 Setting user:", userData);
        setUser(userData);

        // 세션 재확인
        const {
          data: { session: newSession },
        } = await supabase.auth.getSession();
        console.log("📱 Session verified:", !!newSession);

        return { success: true };
      } catch (sessionError) {
        console.error("❌ Session setting failed:", sessionError);
        return { success: false, error: "Failed to set session" };
      }
    } catch (error) {
      console.error("❌ Login error:", error);
      setError(error.error || "Login failed");
      return { success: false, error: error.error || error.message };
    }
  };

  const logout = async () => {
    try {
      console.log("👋 Logging out...");
      await supabase.auth.signOut();
      setUser(null);
      console.log("✅ Logged out successfully");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const value = {
    user,
    loading,
    error,
    signup: async (userData) => {
      try {
        setError(null);
        const response = await api.post("/auth/signup", userData);
        if (response.success && response.session) {
          await supabase.auth.setSession({
            access_token: response.session.access_token,
            refresh_token: response.session.refresh_token,
          });
          setUser(response.user);
          return { success: true };
        }
        return { success: false, error: "No session returned" };
      } catch (error) {
        setError(error.error || "Signup failed");
        return { success: false, error: error.error };
      }
    },
    login,
    logout,
    checkUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
