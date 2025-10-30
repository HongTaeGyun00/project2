const supabase = require("../config/supabase");

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("🔐 Auth header:", authHeader ? "Present" : "Missing");

    const token = authHeader?.replace("Bearer ", "");

    if (!token) {
      console.log("❌ No token provided");
      return res.status(401).json({
        error: "No token provided",
        code: "NO_TOKEN",
      });
    }

    // Supabase로 토큰 검증
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);

    if (error) {
      console.error("❌ Token validation error:", error.message);
      return res.status(401).json({
        error: "Invalid token",
        code: "INVALID_TOKEN",
        message: error.message,
      });
    }

    if (!user) {
      console.log("❌ No user found for token");
      return res.status(401).json({
        error: "User not found",
        code: "USER_NOT_FOUND",
      });
    }

    console.log("✅ Auth successful for user:", user.email);
    req.user = user;
    req.userId = user.id;
    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    res.status(500).json({
      error: "Authentication error",
      code: "AUTH_ERROR",
      message: error.message,
    });
  }
};

module.exports = authMiddleware;
