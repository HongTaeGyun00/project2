import React, { useEffect } from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { SocketProvider } from "./contexts/SocketContext";

// Pages
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Dashboard from "./pages/Dashboard";
import Room from "./pages/Room";
import MaterialDesignSample from "./pages/MaterialDesignSample";

// Loading Component
function LoadingScreen() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100vh",
        fontSize: "24px",
      }}
    >
      Loading...
    </div>
  );
}

// Private Route Component
function PrivateRoute({ children }) {
  const { user, loading } = useAuth();

  console.log("🔒 PrivateRoute - User:", user?.email, "Loading:", loading);

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    console.log("❌ No user, redirecting to login");
    return <Navigate to="/login" replace />;
  }

  return children;
}

// Public Route Component (redirect if logged in)
function PublicRoute({ children }) {
  const { user, loading } = useAuth();

  console.log("🔓 PublicRoute - User:", user?.email, "Loading:", loading);

  if (loading) {
    return <LoadingScreen />;
  }

  if (user) {
    console.log("✅ User exists, redirecting to dashboard");
    return <Navigate to="/dashboard" replace />;
  }

  return children;
}

function AppRoutes() {
  const { user, loading } = useAuth();

  useEffect(() => {
    console.log("📱 App - User state changed:", user?.email);
  }, [user]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          <PublicRoute>
            <Login />
          </PublicRoute>
        }
      />
      <Route
        path="/signup"
        element={
          <PublicRoute>
            <Signup />
          </PublicRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <PrivateRoute>
            <Dashboard />
          </PrivateRoute>
        }
      />
      <Route
        path="/room/:roomId"
        element={
          <PrivateRoute>
            <Room />
          </PrivateRoute>
        }
      />
      <Route
        path="/"
        element={
          user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <Navigate to="/login" replace />
          )
        }
      />
      <Route
        path="/design-sample"
        element={<MaterialDesignSample />}
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <SocketProvider>
          <AppRoutes />
        </SocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
