const supabase = require("../config/supabase");

// 연결된 사용자들 관리
const connectedUsers = new Map();
const roomUsers = new Map();

module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("🔌 New socket connection:", socket.id);

    // 사용자 인증 및 등록
    socket.on("auth", async (data) => {
      const { userId, userName } = data;

      if (!userId) {
        console.log("❌ No userId provided for auth");
        return;
      }

      // 사용자 정보 저장
      connectedUsers.set(socket.id, {
        userId,
        userName,
        socketId: socket.id,
        joinedAt: new Date(),
      });

      console.log(`✅ User authenticated: ${userName} (${userId})`);

      // 인증 성공 알림
      socket.emit("auth_success", {
        message: "Successfully authenticated",
        userId,
      });
    });

    // 방 입장
    socket.on("join_room", async (data) => {
      const { roomId, userId, userName } = data;

      console.log(`📥 User ${userName} joining room ${roomId}`);

      // Socket.io 룸 참가
      socket.join(roomId);

      // 방 사용자 목록 업데이트
      if (!roomUsers.has(roomId)) {
        roomUsers.set(roomId, new Set());
      }
      roomUsers.get(roomId).add(userId);

      // 방의 다른 사용자들에게 알림
      socket.to(roomId).emit("user_joined", {
        userId,
        userName,
        timestamp: new Date(),
      });

      // 현재 방에 있는 사용자 목록 전송
      const usersInRoom = Array.from(roomUsers.get(roomId));
      socket.emit("room_users", {
        roomId,
        users: usersInRoom,
      });

      // 방의 모든 사용자에게 온라인 상태 업데이트
      io.to(roomId).emit("online_users", {
        count: usersInRoom.length,
        users: usersInRoom,
      });
    });

    // 방 퇴장
    socket.on("leave_room", (data) => {
      const { roomId, userId, userName } = data;

      console.log(`📤 User ${userName} leaving room ${roomId}`);

      socket.leave(roomId);

      // 방 사용자 목록에서 제거
      if (roomUsers.has(roomId)) {
        roomUsers.get(roomId).delete(userId);

        // 방이 비었으면 제거
        if (roomUsers.get(roomId).size === 0) {
          roomUsers.delete(roomId);
        }
      }

      // 방의 다른 사용자들에게 알림
      socket.to(roomId).emit("user_left", {
        userId,
        userName,
        timestamp: new Date(),
      });

      // 온라인 상태 업데이트
      const usersInRoom = roomUsers.has(roomId)
        ? Array.from(roomUsers.get(roomId))
        : [];

      io.to(roomId).emit("online_users", {
        count: usersInRoom.length,
        users: usersInRoom,
      });
    });

    // 새 답변 알림
    socket.on("new_answer", async (data) => {
      const { roomId, questionId, userId, userName, questionText, answerText } =
        data;

      console.log(`💬 New answer in room ${roomId} by ${userName}`);

      // 같은 방의 다른 사용자들에게 알림
      socket.to(roomId).emit("answer_notification", {
        userId,
        userName,
        questionText,
        answerText: answerText.substring(0, 50) + "...", // 미리보기만
        timestamp: new Date(),
      });

      // 답변 수 업데이트
      try {
        const { data: count } = await supabase
          .from("answers")
          .select("id", { count: "exact" })
          .eq("room_id", roomId);

        io.to(roomId).emit("answer_count_update", {
          roomId,
          count: count?.length || 0,
        });
      } catch (error) {
        console.error("Failed to get answer count:", error);
      }
    });

    // 실시간 채팅
    socket.on("chat_message", (data) => {
      const { roomId, userId, userName, message } = data;

      console.log(`💬 Chat message in room ${roomId}: ${message}`);

      // 방의 모든 사용자에게 메시지 전송
      io.to(roomId).emit("new_message", {
        id: Date.now(),
        userId,
        userName,
        message,
        timestamp: new Date(),
      });
    });

    // 타이핑 상태
    socket.on("typing_start", (data) => {
      const { roomId, userId, userName } = data;
      socket.to(roomId).emit("user_typing", { userId, userName });
    });

    socket.on("typing_stop", (data) => {
      const { roomId, userId } = data;
      socket.to(roomId).emit("user_stopped_typing", { userId });
    });

    // 연결 해제
    socket.on("disconnect", () => {
      console.log("🔌 Socket disconnected:", socket.id);

      // 사용자 정보 가져오기
      const user = connectedUsers.get(socket.id);

      if (user) {
        // 모든 방에서 사용자 제거
        roomUsers.forEach((users, roomId) => {
          if (users.has(user.userId)) {
            users.delete(user.userId);

            // 방의 다른 사용자들에게 알림
            socket.to(roomId).emit("user_disconnected", {
              userId: user.userId,
              userName: user.userName,
            });

            // 온라인 상태 업데이트
            const usersInRoom = Array.from(users);
            io.to(roomId).emit("online_users", {
              count: usersInRoom.length,
              users: usersInRoom,
            });
          }
        });

        // 연결된 사용자 목록에서 제거
        connectedUsers.delete(socket.id);
      }
    });
    // 실시간 채팅 (개선된 버전)
    socket.on('chat_message', async (data) => {
      const { roomId, userId, userName, message } = data;
      
      console.log(`💬 Chat message in room ${roomId} from ${userName}: ${message}`);
      
      try {
        // DB에 메시지 저장
        const { data: savedMessage, error } = await supabase
          .from('chat_messages')
          .insert({
            room_id: roomId,
            user_id: userId,
            message: message.trim(),
            created_at: new Date().toISOString()
          })
          .select(`
            *,
            users (
              id,
              username,
              display_name,
              avatar_url
            )
          `)
          .single();
        
        if (error) {
          console.error('❌ Failed to save message to DB:', error);
          
          // DB 저장 실패 시에도 실시간 메시지는 전송
          const tempMessage = {
            id: `temp_${Date.now()}`,
            tempId: `temp_${Date.now()}`, // 임시 ID
            userId,
            userName,
            message,
            timestamp: new Date(),
            saved: false
          };
          
          // 방의 모든 사용자에게 전송
          io.to(roomId).emit('new_message', tempMessage);
          
        } else {
          console.log('✅ Message saved to DB:', savedMessage.id);
          
          // DB 저장 성공 시 저장된 메시지 전송
          const formattedMessage = {
            id: savedMessage.id,
            userId: savedMessage.user_id,
            userName: savedMessage.users?.display_name || savedMessage.users?.username || userName,
            message: savedMessage.message,
            created_at: savedMessage.created_at,
            timestamp: savedMessage.created_at,
            users: savedMessage.users,
            saved: true
          };
          
          // 방의 모든 사용자에게 전송 (보낸 사람 포함)
          io.to(roomId).emit('new_message', formattedMessage);
        }
        
      } catch (error) {
        console.error('❌ Chat message error:', error);
        
        // 에러 시 임시 메시지 전송
        const tempMessage = {
          id: `temp_${Date.now()}`,
          tempId: `temp_${Date.now()}`,
          userId,
          userName,
          message,
          timestamp: new Date(),
          saved: false
        };
        
        io.to(roomId).emit('new_message', tempMessage);
      }
    });
  });
};
