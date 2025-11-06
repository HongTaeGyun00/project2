import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "../styles/Auth.css";

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const { login, user } = useAuth();
  const navigate = useNavigate();

  // user가 있으면 대시보드로 리다이렉트
  useEffect(() => {
    if (user) {
      console.log("🚀 User detected, redirecting to dashboard");
      navigate("/dashboard");
    }
  }, [user, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    console.log("🔐 Login form submitted:", email);

    try {
      const result = await login(email, password);
      console.log("📝 Login complete, result:", result);

      if (result.success) {
        console.log("✅ Login successful, waiting for redirect...");
        // useEffect가 user 변경을 감지하고 리다이렉트합니다
      } else {
        console.error("❌ Login failed:", result.error);
        setError(result.error || "Login failed");
        setLoading(false);
      }
    } catch (error) {
      console.error("❌ Login exception:", error);
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-box">
        <h2>🤝 Between Us</h2>
        <h3>로그인</h3>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <input
              type="email"
              placeholder="이메일"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <input
              type="password"
              placeholder="비밀번호"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" disabled={loading}>
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>

        <p className="auth-link">
          계정이 없으신가요? <Link to="/signup">회원가입</Link>
        </p>

        <div
          style={{
            marginTop: "20px",
            padding: "10px",
            background: "#f0f0f0",
            borderRadius: "5px",
            fontSize: "12px",
          }}
        >
          <div>🔍 디버그 정보:</div>
          <div>User: {user ? user.email : "null"}</div>
          <div>Loading: {loading.toString()}</div>
        </div>
      </div>
    </div>
  );
}

export default Login;
