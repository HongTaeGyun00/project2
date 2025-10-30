const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/auth");

// 랜덤 room code 생성
const generateRoomCode = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
};

// 방 생성
router.post("/", authMiddleware, async (req, res) => {
  try {
    const { room_name, room_type } = req.body;
    const userId = req.userId;

    const roomCode = generateRoomCode();

    // 방 생성
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .insert({
        room_code: roomCode,
        room_name,
        room_type,
        created_by: userId,
      })
      .select()
      .single();

    if (roomError) throw roomError;

    // 생성자를 멤버로 추가
    const { error: memberError } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
      role: "owner",
    });

    if (memberError) throw memberError;

    res.status(201).json({
      success: true,
      room: room,
    });
  } catch (error) {
    console.error("Create room error:", error);
    res.status(500).json({ error: "Failed to create room" });
  }
});

// 방 참가
router.post("/join", authMiddleware, async (req, res) => {
  try {
    const { room_code } = req.body;
    const userId = req.userId;

    // 방 찾기
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("room_code", room_code)
      .eq("is_active", true)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // 이미 멤버인지 확인
    const { data: existingMember } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", room.id)
      .eq("user_id", userId)
      .single();

    if (existingMember) {
      return res.status(400).json({ error: "Already a member" });
    }

    // 멤버로 추가
    const { error: joinError } = await supabase.from("room_members").insert({
      room_id: room.id,
      user_id: userId,
      role: "member",
    });

    if (joinError) throw joinError;

    res.json({
      success: true,
      room: room,
    });
  } catch (error) {
    console.error("Join room error:", error);
    res.status(500).json({ error: "Failed to join room" });
  }
});

// 내 방 목록
router.get("/my-rooms", authMiddleware, async (req, res) => {
  try {
    const userId = req.userId;

    const { data: rooms, error } = await supabase
      .from("room_members")
      .select(
        `
        room_id,
        role,
        joined_at,
        rooms!inner (
          id,
          room_code,
          room_name,
          room_type,
          created_at
        )
      `
      )
      .eq("user_id", userId);

    if (error) throw error;

    res.json({
      success: true,
      rooms: rooms,
    });
  } catch (error) {
    console.error("Get rooms error:", error);
    res.status(500).json({ error: "Failed to get rooms" });
  }
});

// 방 상세 정보
router.get("/:roomId", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    // 멤버인지 확인
    const { data: member } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (!member) {
      return res.status(403).json({ error: "Not a member of this room" });
    }

    // 방 정보와 멤버 목록 가져오기
    const { data: room, error } = await supabase
      .from("rooms")
      .select(
        `
        *,
        room_members!inner (
          user_id,
          role,
          joined_at,
          users!inner (
            id,
            username,
            display_name,
            avatar_url
          )
        )
      `
      )
      .eq("id", roomId)
      .single();

    if (error) throw error;

    res.json({
      success: true,
      room: room,
    });
  } catch (error) {
    console.error("Get room details error:", error);
    res.status(500).json({ error: "Failed to get room details" });
  }
});

// 방 삭제 (방장만 가능)
router.delete("/:roomId", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    console.log("🗑️ Delete room request:", { roomId, userId });

    // 방 정보 확인
    const { data: room, error: roomError } = await supabase
      .from("rooms")
      .select("*")
      .eq("id", roomId)
      .single();

    if (roomError || !room) {
      return res.status(404).json({ error: "Room not found" });
    }

    // 방장인지 확인
    if (room.created_by !== userId) {
      return res
        .status(403)
        .json({ error: "Only room owner can delete the room" });
    }

    // 방 삭제 (CASCADE로 관련 데이터도 삭제됨)
    const { error: deleteError } = await supabase
      .from("rooms")
      .delete()
      .eq("id", roomId);

    if (deleteError) throw deleteError;

    console.log("✅ Room deleted:", roomId);

    // Socket.io로 방 삭제 알림
    const io = req.app.get("io");
    if (io) {
      io.to(roomId).emit("room_deleted", { roomId });
    }

    res.json({
      success: true,
      message: "Room deleted successfully",
    });
  } catch (error) {
    console.error("❌ Delete room error:", error);
    res.status(500).json({ error: "Failed to delete room" });
  }
});

// 방 나가기 (멤버)
router.post("/:roomId/leave", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;

    console.log("🚪 Leave room request:", { roomId, userId });

    // 멤버십 확인
    const { data: member, error: memberError } = await supabase
      .from("room_members")
      .select("*")
      .eq("room_id", roomId)
      .eq("user_id", userId)
      .single();

    if (memberError || !member) {
      return res.status(404).json({ error: "Not a member of this room" });
    }

    // 방장인지 확인
    if (member.role === "owner") {
      return res.status(400).json({
        error: "Room owner cannot leave. Delete the room instead.",
      });
    }

    // 멤버십 삭제
    const { error: deleteError } = await supabase
      .from("room_members")
      .delete()
      .eq("room_id", roomId)
      .eq("user_id", userId);

    if (deleteError) throw deleteError;

    console.log("✅ User left room:", { roomId, userId });

    res.json({
      success: true,
      message: "Left room successfully",
    });
  } catch (error) {
    console.error("❌ Leave room error:", error);
    res.status(500).json({ error: "Failed to leave room" });
  }
});

module.exports = router;
