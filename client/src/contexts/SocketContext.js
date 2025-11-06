import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from "react";
import io from "socket.io-client";
import { useAuth } from "./AuthContext";

const SocketContext = createContext(null);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within SocketProvider");
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const { user } = useAuth();
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  useEffect(() => {
    // user가 있을 때만 소켓 연결
    if (user && user.id) {
      console.log("🔌 Initializing socket for user:", user.email);

      // Socket.io 연결
      const newSocket = io("http://localhost:3001", {
        withCredentials: true,
        transports: ["websocket", "polling"],
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
        reconnectionAttempts: maxReconnectAttempts,
      });

      newSocket.on("connect", () => {
        console.log("🔌 Socket connected:", newSocket.id);
        setIsConnected(true);
        reconnectAttempts.current = 0;

        // 인증
        newSocket.emit("auth", {
          userId: user.id,
          userName: user.display_name || user.username || user.email,
        });
      });

      newSocket.on("disconnect", (reason) => {
        console.log("🔌 Socket disconnected:", reason);
        setIsConnected(false);
      });

      newSocket.on("connect_error", (error) => {
        console.error("❌ Socket connection error:", error);
        reconnectAttempts.current++;
        
        if (reconnectAttempts.current >= maxReconnectAttempts) {
          console.error("⚠️ Max reconnection attempts reached");
        }
      });

      newSocket.on("auth_success", (data) => {
        console.log("✅ Socket authenticated:", data.message);
      });

      // 온라인 사용자 업데이트
      newSocket.on("online_users", (data) => {
        console.log("👥 Online users updated:", data);
        setOnlineUsers(data.users || []);
      });

      // 답변 알림
      newSocket.on("answer_notification", (data) => {
        console.log("🔔 New answer notification:", data);
        addNotification({
          type: "answer",
          message: `${data.userName}님이 "${data.questionText}"에 답변했습니다`,
          timestamp: data.timestamp,
        });
      });

      // 사용자 입장/퇴장 알림
      newSocket.on("user_joined", (data) => {
        console.log("➕ User joined:", data);
        addNotification({
          type: "join",
          message: `${data.userName}님이 입장했습니다`,
          timestamp: data.timestamp,
        });
      });

      newSocket.on("user_left", (data) => {
        console.log("➖ User left:", data);
        addNotification({
          type: "leave",
          message: `${data.userName}님이 퇴장했습니다`,
          timestamp: data.timestamp,
        });
      });

      // 방 삭제 알림
      newSocket.on("room_deleted", (data) => {
        console.log("🗑️ Room deleted:", data);
        alert("방이 삭제되었습니다.");
        window.location.href = "/dashboard";
      });

      // 게임 취소 알림
      newSocket.on("game_cancelled", (data) => {
        console.log("❌ Game cancelled:", data);
        addNotification({
          type: "game",
          message: "게임이 취소되었습니다",
          timestamp: new Date(),
        });
      });

      // 메시지 에러 처리
      newSocket.on("message_error", (data) => {
        console.error("❌ Message error:", data);
        addNotification({
          type: "error",
          message: "메시지 전송에 실패했습니다",
          timestamp: new Date(),
        });
      });

      setSocket(newSocket);

      // Cleanup
      return () => {
        console.log("🔌 Cleaning up socket connection");
        newSocket.close();
      };
    } else {
      console.log("⚠️ No user, skipping socket connection");
      setSocket(null);
      setIsConnected(false);
    }
  }, [user]);

  const addNotification = useCallback((notification) => {
    const newNotification = { ...notification, id: Date.now() };
    setNotifications((prev) => [...prev, newNotification]);

    // 5초 후 자동 제거
    setTimeout(() => {
      setNotifications((prev) =>
        prev.filter((n) => n.id !== newNotification.id)
      );
    }, 5000);
  }, []);

  const joinRoom = useCallback((roomId) => {
    if (socket && user) {
      console.log("🏠 Joining room:", roomId);
      socket.emit("join_room", {
        roomId,
        userId: user.id,
        userName: user.display_name || user.username || user.email,
      });
    } else {
      console.warn("⚠️ Cannot join room: socket or user not available");
    }
  }, [socket, user]);

  const leaveRoom = useCallback((roomId) => {
    if (socket && user) {
      console.log("🚪 Leaving room:", roomId);
      socket.emit("leave_room", {
        roomId,
        userId: user.id,
        userName: user.display_name || user.username || user.email,
      });
    }
  }, [socket, user]);

  const sendAnswer = useCallback((roomId, questionText, answerText, questionId) => {
    if (socket && user) {
      socket.emit("new_answer", {
        roomId,
        questionId,
        userId: user.id,
        userName: user.display_name || user.username || user.email,
        questionText,
        answerText,
      });
    }
  }, [socket, user]);

  const sendMessage = useCallback((roomId, message, tempId) => {
    return new Promise((resolve, reject) => {
      if (!socket) {
        const error = new Error("Socket not initialized");
        console.error("❌", error.message);
        reject(error);
        return;
      }

      if (!isConnected) {
        const error = new Error("Socket not connected");
        console.error("❌", error.message);
        reject(error);
        return;
      }

      if (!user) {
        const error = new Error("User not authenticated");
        console.error("❌", error.message);
        reject(error);
        return;
      }

      console.log("📤 Sending message with tempId:", tempId);

      // send_message 이벤트로 변경 (서버와 맞춤)
      socket.emit("send_message", {
        roomId,
        message,
        tempId,
      });

      resolve();
    });
  }, [socket, isConnected, user]);

  const startTyping = useCallback((roomId) => {
    if (socket && user) {
      socket.emit("typing_start", {
        roomId,
        userId: user.id,
        userName: user.display_name || user.username || user.email,
      });
    }
  }, [socket, user]);

  const stopTyping = useCallback((roomId) => {
    if (socket && user) {
      socket.emit("typing_stop", {
        roomId,
        userId: user.id,
      });
    }
  }, [socket, user]);

  const value = {
    socket,
    isConnected,
    onlineUsers,
    notifications,
    joinRoom,
    leaveRoom,
    sendAnswer,
    sendMessage,
    startTyping,
    stopTyping,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
};