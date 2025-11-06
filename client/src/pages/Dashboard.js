import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import api from "../services/api";
import "../styles/Dashboard.css";

function Dashboard() {
  const [rooms, setRooms] = useState([]);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomName, setRoomName] = useState("");
  const [roomType, setRoomType] = useState("friend");
  const [roomCode, setRoomCode] = useState("");
  const [loading, setLoading] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchMyRooms();
  }, []);

  const fetchMyRooms = async () => {
    try {
      const response = await api.get("/rooms/my-rooms");
      setRooms(response.rooms || []);
    } catch (error) {
      console.error("Failed to fetch rooms:", error);
    }
  };

  const handleCreateRoom = async () => {
    setLoading(true);
    try {
      const response = await api.post("/rooms", {
        room_name: roomName,
        room_type: roomType,
      });

      if (response.success) {
        setShowCreateModal(false);
        setRoomName("");
        fetchMyRooms();
      }
    } catch (error) {
      alert(error.error || "Failed to create room");
    }
    setLoading(false);
  };

  const handleJoinRoom = async () => {
    setLoading(true);
    try {
      const response = await api.post("/rooms/join", {
        room_code: roomCode,
      });

      if (response.success) {
        setShowJoinModal(false);
        setRoomCode("");
        fetchMyRooms();
      }
    } catch (error) {
      alert(error.error || "Failed to join room");
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>🤝 Between Us</h1>
        <div className="user-info">
          <span>안녕하세요, {user?.display_name}님!</span>
          <button onClick={handleLogout} className="logout-btn">
            로그아웃
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-actions">
          <button
            className="action-btn create-btn"
            onClick={() => setShowCreateModal(true)}
          >
            ➕ 방 만들기
          </button>
          <button
            className="action-btn join-btn"
            onClick={() => setShowJoinModal(true)}
          >
            🔗 방 참가하기
          </button>
        </div>

        <div className="rooms-section">
          <h2>내 방 목록</h2>
          <div className="rooms-grid">
            {rooms.length === 0 ? (
              <p className="no-rooms">참여 중인 방이 없습니다.</p>
            ) : (
              rooms.map((room) => (
                <div
                  key={room.room_id}
                  className="room-card"
                  onClick={() => navigate(`/room/${room.room_id}`)}
                >
                  <h3>{room.rooms.room_name}</h3>
                  <p className="room-type">{room.rooms.room_type}</p>
                  <p className="room-code">코드: {room.rooms.room_code}</p>
                  <p className="room-role">역할: {room.role}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </main>

      {/* 방 만들기 모달 */}
      {showCreateModal && (
        <div
          className="modal-overlay"
          onClick={() => setShowCreateModal(false)}
        >
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>새 방 만들기</h2>
            <input
              type="text"
              placeholder="방 이름"
              value={roomName}
              onChange={(e) => setRoomName(e.target.value)}
            />
            <select
              value={roomType}
              onChange={(e) => setRoomType(e.target.value)}
            >
              <option value="couple">커플</option>
              <option value="friend">친구</option>
              <option value="family">가족</option>
              <option value="team">팀</option>
            </select>
            <div className="modal-buttons">
              <button onClick={handleCreateRoom} disabled={loading}>
                {loading ? "생성 중..." : "만들기"}
              </button>
              <button onClick={() => setShowCreateModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}

      {/* 방 참가 모달 */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h2>방 참가하기</h2>
            <input
              type="text"
              placeholder="방 코드 입력"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
            <div className="modal-buttons">
              <button onClick={handleJoinRoom} disabled={loading}>
                {loading ? "참가 중..." : "참가하기"}
              </button>
              <button onClick={() => setShowJoinModal(false)}>취소</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default Dashboard;
