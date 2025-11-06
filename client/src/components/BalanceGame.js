import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useSocket } from '../contexts/SocketContext';
import api from '../services/api';
import '../styles/BalanceGame.css';

function BalanceGame({ onClose }) {
  const { roomId } = useParams();
  const { user } = useAuth();
  const { socket } = useSocket();
  
  const [gameState, setGameState] = useState('initial');
  const [sessionId, setSessionId] = useState(null);
  const [activeSessions, setActiveSessions] = useState([]);
  const [players, setPlayers] = useState([]);
  const [currentQuestion, setCurrentQuestion] = useState(null);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [roundResults, setRoundResults] = useState(null);
  const [allAnswered, setAllAnswered] = useState(false);
  const [isCreator, setIsCreator] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteTargetSession, setDeleteTargetSession] = useState(null);

  // 초기화 순서를 변경하여 함수 선언을 먼저 합니다.
  const checkActiveGames = useCallback(async () => {
    try {
      console.log('🔍 Checking active games...');
      setLoading(true);
      const response = await api.get(`/games/room/${roomId}/active`);
      
      if (response.success) {
        setActiveSessions(response.sessions || []);
      }
    } catch (error) {
      console.error('Failed to check active games:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId]);

  const cleanupOldSessions = useCallback(async () => {
    try {
      console.log('🧹 Cleaning up old sessions...');
      await api.delete(`/games/room/${roomId}/cleanup`);
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
    }
  }, [roomId]);

  const deleteGame = useCallback(async (targetSessionId = sessionId) => {
    try {
      setLoading(true);
      const response = await api.delete(`/games/session/${targetSessionId}`);
      
      if (response.success) {
        if (targetSessionId === sessionId) {
          setSessionId(null);
          setGameState('initial');
          setPlayers([]);
        }
        await checkActiveGames();
        setShowDeleteConfirm(false);
        setDeleteTargetSession(null);
      }
    } catch (error) {
      console.error('Failed to delete game:', error);
      alert(error.error || 'Failed to delete game');
    } finally {
      setLoading(false);
    }
  }, [sessionId, checkActiveGames]);

  useEffect(() => {
    console.log('🎮 BalanceGame mounted');
    checkActiveGames();
    cleanupOldSessions();

    // 컴포넌트 언마운트 시 세션 정리
    return () => {
      if (sessionId) {
        deleteGame(sessionId).catch(console.error);
      }
    };
  }, [sessionId, checkActiveGames, cleanupOldSessions, deleteGame]);

  useEffect(() => {
    if (socket) {
      console.log('🔌 Setting up socket listeners');
      
      const handleGameCreated = (data) => {
        console.log('🎮 [Socket] Game created:', data);
        checkActiveGames();
      };

      const handlePlayerJoined = (data) => {
        console.log('👤 [Socket] Player joined:', data);
        if (data.sessionId === sessionId) {
          setPlayers(data.allParticipants || []);
        }
      };

      const handleGameStarted = (data) => {
        console.log('🚀 [Socket] Game started:', data);
        if (data.sessionId === sessionId) {
          setGameState('playing');
          setCurrentQuestion(data.questions);
          setQuestionIndex(0);
          setSelectedAnswer(null);
          setAllAnswered(false);
          setPlayers(data.participants || players);
        }
      };

      const handleGameCancelled = (data) => {
        console.log('❌ [Socket] Game cancelled:', data);
        if (data.sessionId === sessionId) {
          alert('게임이 취소되었습니다.');
          setSessionId(null);
          setGameState('initial');
          setPlayers([]);
          checkActiveGames();
        } else {
          // 다른 게임이 취소된 경우에도 목록 업데이트
          checkActiveGames();
        }
      };

      // 나머지 소켓 이벤트들...
      const handleAnswerSubmitted = (data) => {
        if (data.sessionId === sessionId && data.allAnswered) {
          setAllAnswered(true);
        }
      };

      const handleRoundComplete = (data) => {
        if (data.sessionId === sessionId) {
          setRoundResults(data.answers);
          setGameState('results');
        }
      };

      const handleNextQuestion = (data) => {
        if (data.sessionId === sessionId) {
          setCurrentQuestion(data.question);
          setQuestionIndex(data.questionIndex);
          setSelectedAnswer(null);
          setRoundResults(null);
          setAllAnswered(false);
          setGameState('playing');
        }
      };

      const handleGameFinished = (data) => {
        if (data.sessionId === sessionId) {
          setGameState('finished');
          setPlayers(data.participants || players);
        }
      };

      socket.on('game_created', handleGameCreated);
      socket.on('player_joined', handlePlayerJoined);
      socket.on('game_started', handleGameStarted);
      socket.on('answer_submitted', handleAnswerSubmitted);
      socket.on('round_complete', handleRoundComplete);
      socket.on('next_question', handleNextQuestion);
      socket.on('game_finished', handleGameFinished);
      socket.on('game_cancelled', handleGameCancelled);

      return () => {
        socket.off('game_created', handleGameCreated);
        socket.off('player_joined', handlePlayerJoined);
        socket.off('game_started', handleGameStarted);
        socket.off('answer_submitted', handleAnswerSubmitted);
        socket.off('round_complete', handleRoundComplete);
        socket.off('next_question', handleNextQuestion);
        socket.off('game_finished', handleGameFinished);
        socket.off('game_cancelled', handleGameCancelled);
      };
    }
  }, [socket, sessionId, players, checkActiveGames]);

  const createGame = async () => {
    try {
      console.log('🎮 Creating new game...');
      setLoading(true);
      const response = await api.post('/games/create', {
        room_id: roomId,
        game_type: 'balance_game'
      });
      
      if (response.success) {
        setSessionId(response.session.id);
        setIsCreator(true);
        setGameState('lobby');
        setPlayers([{
          user_id: user.id,
          users: {
            id: user.id,
            username: user.username,
            display_name: user.display_name
          }
        }]);
      }
    } catch (error) {
      console.error('Failed to create game:', error);
      alert(error.error || 'Failed to create game');
    } finally {
      setLoading(false);
    }
  };

  const joinGame = async (gameSessionId) => {
    try {
      console.log('🎮 Joining game:', gameSessionId);
      setLoading(true);
      const response = await api.post(`/games/join/${gameSessionId}`);
      
      if (response.success) {
        setSessionId(gameSessionId);
        setGameState('lobby');
        setIsCreator(false);
        setPlayers(response.participants || []);
      }
    } catch (error) {
      console.error('Failed to join game:', error);
      alert(error.error || 'Failed to join game');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteClick = (session) => {
    setDeleteTargetSession(session);
    setShowDeleteConfirm(true);
  };

  const startGame = async () => {
    try {
      console.log('🚀 Starting game...');
      setLoading(true);
      const response = await api.post(`/games/start/${sessionId}`);
      
      if (response.success) {
        console.log('✅ Game start request sent');
      }
    } catch (error) {
      console.error('Failed to start game:', error);
      alert(error.error || 'Failed to start game');
    } finally {
      setLoading(false);
    }
  };

  const submitAnswer = async (answer) => {
    if (selectedAnswer !== null) return;
    
    setSelectedAnswer(answer);
    
    try {
      const response = await api.post(`/games/answer/${sessionId}`, {
        answer,
        questionIndex
      });
      
      console.log('Answer submitted:', response);
    } catch (error) {
      console.error('Failed to submit answer:', error);
      setSelectedAnswer(null);
    }
  };

  const nextQuestion = async () => {
    try {
      const response = await api.post(`/games/next/${sessionId}`);
      console.log('Next question:', response);
    } catch (error) {
      console.error('Failed to get next question:', error);
    }
  };

  // 초기 화면 - 게임 목록
  if (gameState === 'initial') {
    return (
      <div className="balance-game-container">
        <div className="game-header">
          <h2>🎯 밸런스 게임</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="game-content">
          <div className="game-intro">
            <p>서로의 선택을 맞춰보세요!</p>
            <p>같은 선택을 할수록 친밀도가 올라갑니다 💕</p>
          </div>
          
          {activeSessions.length > 0 && (
            <div className="active-games">
              <h3>진행 중인 게임</h3>
              {activeSessions.map((session) => (
                <div key={session.id} className="game-session-card">
                  <div className="session-info">
                    <span className="session-status">
                      {session.status === 'waiting' ? '🟡 대기중' : '🟢 진행중'}
                    </span>
                    <span className="session-players">
                      참가자: {session.game_participants?.length || 0}명
                    </span>
                    {session.created_by === user.id && (
                      <button 
                        className="delete-session-btn"
                        onClick={() => handleDeleteClick(session)}
                        title="게임 삭제"
                      >
                        🗑️
                      </button>
                    )}
                  </div>
                  
                  <div className="session-players-list">
                    {session.game_participants?.map(p => (
                      <span key={p.user_id} className="player-chip">
                        {p.users?.display_name || p.users?.username}
                        {p.user_id === session.created_by && ' 👑'}
                      </span>
                    ))}
                  </div>
                  
                  <div className="session-actions">
                    {session.status === 'waiting' && (
                      <>
                        {session.created_by === user.id ? (
                          <div className="owner-actions">
                            <button 
                              className="manage-game-btn"
                              onClick={() => {
                                setSessionId(session.id);
                                setIsCreator(true);
                                setGameState('lobby');
                                setPlayers(session.game_participants || []);
                              }}
                            >
                              관리하기
                            </button>
                          </div>
                        ) : (
                          <button 
                            className="join-game-btn"
                            onClick={() => joinGame(session.id)}
                            disabled={loading}
                          >
                            참가하기
                          </button>
                        )}
                      </>
                    )}
                    {session.status === 'playing' && (
                      <span className="game-in-progress">게임 진행 중...</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="game-actions">
            <button 
              className="create-game-btn"
              onClick={createGame}
              disabled={loading}
            >
              {loading ? '생성 중...' : '새 게임 만들기'}
            </button>
            
            {activeSessions.length === 0 && (
              <p className="no-games-message">
                진행 중인 게임이 없습니다. 새 게임을 만들어보세요!
              </p>
            )}
          </div>
        </div>

        {/* 삭제 확인 모달 */}
        {showDeleteConfirm && (
          <>
            <div className="modal-overlay" onClick={() => setShowDeleteConfirm(false)} />
            <div className="confirm-modal">
              <h3>게임 삭제</h3>
              <p>정말 이 게임을 삭제하시겠습니까?</p>
              <p className="warning-text">⚠️ 모든 참가자가 게임에서 나가게 됩니다.</p>
              <div className="modal-buttons">
                <button 
                  className="confirm-btn delete"
                  onClick={() => deleteGame(deleteTargetSession.id)}
                  disabled={loading}
                >
                  {loading ? '삭제 중...' : '삭제'}
                </button>
                <button 
                  className="cancel-btn"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeleteTargetSession(null);
                  }}
                >
                  취소
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  }

  // 대기실
  if (gameState === 'lobby' && sessionId) {
    return (
      <div className="balance-game-container">
        <div className="game-header">
          <h2>🎯 밸런스 게임 - 대기실</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="game-content">
          <div className="session-id-info">
            <span className="session-id-label">세션 ID: {sessionId.substring(0, 8)}...</span>
          </div>
          
          <div className="players-list">
            <h3>참가자 ({players.length}명)</h3>
            {players.map((player) => (
              <div key={player.user_id} className="player-item">
                <span className="player-name">
                  {player.users?.display_name || player.users?.username}
                  {player.user_id === user.id && ' (나)'}
                </span>
                {isCreator && player.user_id === user.id && (
                  <span className="owner-badge">방장</span>
                )}
              </div>
            ))}
            
            {players.length < 2 && (
              <p className="waiting-players">다른 플레이어를 기다리는 중...</p>
            )}
          </div>
          
          <div className="lobby-actions">
            {isCreator && players.length >= 2 && (
              <button 
                className="start-game-btn"
                onClick={startGame}
                disabled={loading}
              >
                {loading ? '시작 중...' : '게임 시작'}
              </button>
            )}
            
            {isCreator && (
              <button 
                className="cancel-game-btn"
                onClick={() => {
                  if (window.confirm('정말 게임을 취소하시겠습니까?')) {
                    deleteGame();
                  }
                }}
                disabled={loading}
              >
                게임 취소
              </button>
            )}
            
            {!isCreator && (
              <>
                <p className="waiting-message">방장이 게임을 시작하기를 기다리는 중...</p>
                <button 
                  className="leave-game-btn"
                  onClick={() => {
                    setSessionId(null);
                    setGameState('initial');
                    setPlayers([]);
                    checkActiveGames();
                  }}
                >
                  나가기
                </button>
              </>
            )}
            
            {players.length < 2 && (
              <p className="need-players">게임을 시작하려면 최소 2명이 필요합니다.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 게임 진행 중
  if (gameState === 'playing' && currentQuestion) {
    return (
      <div className="balance-game-container">
        <div className="game-header">
          <h2>🎯 밸런스 게임 - 질문 {questionIndex + 1}</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="game-content">
          <div className="question-container">
            <h3>둘 중 하나를 선택하세요!</h3>
            
            <div className="options-container">
              <button
                className={`option-btn option-a ${selectedAnswer === 'A' ? 'selected' : ''}`}
                onClick={() => submitAnswer('A')}
                disabled={selectedAnswer !== null}
              >
                <span className="option-label">A</span>
                <span className="option-text">{currentQuestion.option_a}</span>
              </button>
              
              <div className="vs-divider">VS</div>
              
              <button
                className={`option-btn option-b ${selectedAnswer === 'B' ? 'selected' : ''}`}
                onClick={() => submitAnswer('B')}
                disabled={selectedAnswer !== null}
              >
                <span className="option-label">B</span>
                <span className="option-text">{currentQuestion.option_b}</span>
              </button>
            </div>
            
            {selectedAnswer && !allAnswered && (
              <p className="waiting-others">다른 플레이어를 기다리는 중...</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 결과 화면
  if (gameState === 'results' && roundResults) {
    return (
      <div className="balance-game-container">
        <div className="game-header">
          <h2>🎯 밸런스 게임 - 결과</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="game-content">
          <div className="results-container">
            <h3>이번 라운드 결과</h3>
            
            <div className="answer-summary">
              <div className="answer-group">
                <h4>A를 선택한 사람</h4>
                {roundResults
                  .filter(r => r.answer === 'A')
                  .map(r => (
                    <span key={r.userId} className="player-badge">
                      {players.find(p => p.user_id === r.userId)?.users?.display_name}
                    </span>
                  ))}
              </div>
              
              <div className="answer-group">
                <h4>B를 선택한 사람</h4>
                {roundResults
                  .filter(r => r.answer === 'B')
                  .map(r => (
                    <span key={r.userId} className="player-badge">
                      {players.find(p => p.user_id === r.userId)?.users?.display_name}
                    </span>
                  ))}
              </div>
            </div>
            
            {isCreator && (
              <button className="next-btn" onClick={nextQuestion}>
                다음 질문 →
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // 게임 종료
  if (gameState === 'finished') {
    return (
      <div className="balance-game-container">
        <div className="game-header">
          <h2>🎊 게임 종료!</h2>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        
        <div className="game-content">
          <div className="final-results">
            <h3>게임이 끝났습니다!</h3>
            <p>서로에 대해 더 알게 되셨나요? 😊</p>
            
            <button 
              className="play-again-btn" 
              onClick={() => {
                setSessionId(null);
                setGameState('initial');
                setPlayers([]);
                checkActiveGames();
              }}
            >
              다시 하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

export default BalanceGame;