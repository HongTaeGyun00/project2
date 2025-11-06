import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useSocket } from "../contexts/SocketContext";
import api from "../services/api";
import QuestionCard from "../components/QuestionCard";
import MembersList from "../components/MembersList";
import ChatBox from "../components/ChatBox";
import NotificationBar from "../components/NotificationBar";
import BalanceGame from "../components/BalanceGame";
import RoomStats from '../components/RoomStats';
import "../styles/Room.css";

function Room() {
  const { roomId } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  // Socket 관련 값들을 안전하게 가져오기
  const socketContext = useSocket();
  const {
    joinRoom = () => {},
    leaveRoom = () => {},
    onlineUsers = [],
    notifications = [],
  } = socketContext || {};

  const [room, setRoom] = useState(null);
  const [activeTab, setActiveTab] = useState("questions");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showBalanceGame, setShowBalanceGame] = useState(false);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    fetchRoomDetails();

    if (roomId && joinRoom) {
      joinRoom(roomId);
    }

    return () => {
      if (roomId && leaveRoom) {
        leaveRoom(roomId);
      }
    };
  }, [roomId]);

  const fetchRoomDetails = async () => {
    try {
      setLoading(true);
      const response = await api.get(`/rooms/${roomId}`);

      if (response.success) {
        setRoom(response.room);
        // 방장인지 확인
        setIsOwner(response.room.created_by === user?.id);
      }
    } catch (error) {
      console.error("Failed to fetch room:", error);
      setError(error.error || "Failed to load room");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (
      !window.confirm(
        "정말 이 방을 삭제하시겠습니까? 모든 데이터가 삭제됩니다."
      )
    ) {
      return;
    }

    try {
      const response = await api.delete(`/rooms/${roomId}`);

      if (response.success) {
        alert("방이 삭제되었습니다.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Failed to delete room:", error);
      alert(error.error || "방 삭제에 실패했습니다.");
    }
  };

  const handleLeaveRoom = async () => {
    if (!window.confirm("정말 이 방을 나가시겠습니까?")) {
      return;
    }

    try {
      const response = await api.post(`/rooms/${roomId}/leave`);

      if (response.success) {
        alert("방을 나갔습니다.");
        navigate("/dashboard");
      }
    } catch (error) {
      console.error("Failed to leave room:", error);
      alert(error.error || "방 나가기에 실패했습니다.");
    }
  };

  const handleBack = () => {
    navigate("/dashboard");
  };

  const copyRoomCode = () => {
    if (room?.room_code) {
      navigator.clipboard.writeText(room.room_code);
      alert("방 코드가 복사되었습니다!");
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>오류가 발생했습니다</h2>
        <p>{error}</p>
        <button onClick={handleBack}>돌아가기</button>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="error-container">
        <h2>방을 찾을 수 없습니다</h2>
        <button onClick={handleBack}>돌아가기</button>
      </div>
    );
  }

  return (
    <div className="room-container">
      {/* 알림 바 */}
      <NotificationBar notifications={notifications} />

      <header className="room-header">
        <button className="back-button" onClick={handleBack}>
          ← 뒤로
        </button>
        <div className="room-info">
          <h1>{room.room_name}</h1>
          <div className="room-meta">
            <span className="room-type">{room.room_type}</span>
            <button className="room-code" onClick={copyRoomCode}>
              코드: {room.room_code} 📋
            </button>
            <span className="online-indicator">
              🟢 온라인: {onlineUsers.length}명
            </span>
          </div>
        </div>
        <div className="room-actions">
          {isOwner ? (
            <button
              className="delete-room-btn"
              onClick={handleDeleteRoom}
              title="방 삭제"
            >
              🗑️ 방 삭제
            </button>
          ) : (
            <button
              className="leave-room-btn"
              onClick={handleLeaveRoom}
              title="방 나가기"
            >
              🚪 방 나가기
            </button>
          )}
        </div>
      </header>

      <nav className="room-nav">
        <button
          className={`nav-tab ${activeTab === "questions" ? "active" : ""}`}
          onClick={() => setActiveTab("questions")}
        >
          💬 질문
        </button>
        <button
          className={`nav-tab ${activeTab === "chat" ? "active" : ""}`}
          onClick={() => setActiveTab("chat")}
        >
          💭 채팅
        </button>
        <button
          className={`nav-tab ${activeTab === "games" ? "active" : ""}`}
          onClick={() => setActiveTab("games")}
        >
          🎮 게임
        </button>
        <button
          className={`nav-tab ${activeTab === "members" ? "active" : ""}`}
          onClick={() => setActiveTab("members")}
        >
          👥 멤버
        </button>
        <button
          className={`nav-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          📚 히스토리
        </button>
        <button 
        className={`nav-tab ${activeTab === 'stats' ? 'active' : ''}`}
        onClick={() => setActiveTab('stats')}
        >
          📊 통계
        </button>
      </nav>

      <main className="room-content">
        {activeTab === "questions" && <QuestionCard roomId={roomId} />}

        {activeTab === "chat" && <ChatBox roomId={roomId} />}

        {activeTab === "games" && (
          <div className="games-section">
            <h2>🎮 미니게임</h2>
            <div className="games-grid">
              <div className="game-card">
                <h3>밸런스 게임</h3>
                <p>서로의 선택을 맞춰보세요</p>
                <button
                  className="game-start-btn"
                  onClick={() => setShowBalanceGame(true)}
                >
                  시작하기
                </button>
              </div>
              <div className="game-card">
                <h3>스피드 퀴즈</h3>
                <p>서로에 대한 OX 퀴즈</p>
                <button className="game-start-btn">시작하기</button>
              </div>
              <div className="game-card coming-soon">
                <h3>그림 퀴즈</h3>
                <p>Coming Soon...</p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "members" && (
          <MembersList members={room.room_members} onlineUsers={onlineUsers} />
        )}

        {activeTab === "history" && (
          <div className="history-section">
            <h2>📚 우리의 기록</h2>
            <AnswersHistory roomId={roomId} />
          </div>
        )}
        {activeTab === 'stats' && (
          <RoomStats />
        )}

      </main>
      {/* 밸런스 게임 모달 */}
      {showBalanceGame && (
        <>
          <div
            className="game-modal-overlay"
            onClick={() => setShowBalanceGame(false)}
          />
          <BalanceGame onClose={() => setShowBalanceGame(false)} />
        </>
      )}
    </div>
  );
}

// 답변 히스토리 컴포넌트
function AnswersHistory({ roomId }) {
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  useEffect(() => {
    fetchAnswers();

    // 실시간 답변 업데이트 리스너
    if (socket) {
      socket.on("answer_count_update", () => {
        fetchAnswers();
      });
    }

    return () => {
      if (socket) {
        socket.off("answer_count_update");
      }
    };
  }, [roomId, socket]);

  const fetchAnswers = async () => {
    try {
      const response = await api.get(`/questions/room/${roomId}/answers`);
      if (response.success) {
        setAnswers(response.answers);
      }
    } catch (error) {
      console.error("Failed to fetch answers:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div className="answers-list">
      {answers.length === 0 ? (
        <p className="no-answers">아직 답변이 없습니다.</p>
      ) : (
        answers.map((answer) => (
          <div key={answer.id} className="answer-card">
            <div className="answer-header">
              <span className="answer-user">
                {answer.users?.display_name || answer.users?.username}
              </span>
              <span className="answer-date">
                {new Date(answer.answered_at).toLocaleDateString()}
              </span>
            </div>
            <div className="answer-question">
              Q: {answer.questions?.question_text}
            </div>
            <div className="answer-text">A: {answer.answer_text}</div>
          </div>
        ))
      )}
    </div>
  );
}

export default Room;
