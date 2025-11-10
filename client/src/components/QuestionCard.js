import React, { useState, useEffect } from 'react';
import api from '../services/api';
import { useSocket } from '../contexts/SocketContext';
import '../styles/QuestionCard.css';

function QuestionCard({ roomId }) {
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [answered, setAnswered] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [questionLevel, setQuestionLevel] = useState(1);
  const [seenQuestionIds, setSeenQuestionIds] = useState([]);
  const [isDailyQuestion, setIsDailyQuestion] = useState(true);
  
  const socketContext = useSocket();
  const { sendAnswer } = socketContext || {};

  useEffect(() => {
    // 컴포넌트 마운트 시 오늘의 질문 로드
    fetchDailyQuestion();
  }, [roomId]);

  const fetchDailyQuestion = async () => {
    try {
      setLoading(true);
      setAnswer('');
      
      console.log('📅 Fetching daily question...');
      
      const response = await api.get(`/questions/daily/${roomId}`);
      
      if (response.success && response.question) {
        setQuestion(response.question);
        setAnswered(response.answered);
        setIsDailyQuestion(true);
        console.log('✅ Daily question loaded:', response.question.question_text);
      } else {
        // 오늘의 질문이 없으면 랜덤 질문
        fetchRandomQuestion(1);
      }
    } catch (error) {
      console.error('Failed to fetch daily question:', error);
      // 에러 시 랜덤 질문으로 폴백
      fetchRandomQuestion(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchRandomQuestion = async (level) => {
    try {
      setLoading(true);
      setAnswer('');
      setAnswered(false);
      
      console.log('🎲 Fetching random question, level:', level);
      
      // 이미 본 질문 제외하고 요청
      const excludeIds = seenQuestionIds.join(',');
      const response = await api.get('/questions/random', {
        params: { 
          level, 
          excludeIds 
        }
      });
      
      if (response.success && response.question) {
        setQuestion(response.question);
        setIsDailyQuestion(false);
        
        // 본 질문 목록에 추가 (최대 20개까지만 저장)
        setSeenQuestionIds(prev => {
          const newIds = [...prev, response.question.id];
          return newIds.slice(-20); // 최근 20개만 유지
        });
        
        console.log('✅ Random question loaded:', response.question.question_text);
      } else if (!response.success) {
        // 모든 질문을 다 봤으면 초기화
        console.log('🔄 Resetting seen questions...');
        setSeenQuestionIds([]);
        
        // 다시 시도
        const retryResponse = await api.get('/questions/random', {
          params: { level }
        });
        
        if (retryResponse.success && retryResponse.question) {
          setQuestion(retryResponse.question);
          setIsDailyQuestion(false);
        }
      }
    } catch (error) {
      console.error('Failed to fetch random question:', error);
      
      // 에러 시 폴백: 모든 질문 가져와서 랜덤 선택
      try {
        const fallbackResponse = await api.get('/questions', {
          params: { level, limit: 1, random: true }
        });
        
        if (fallbackResponse.success && fallbackResponse.questions.length > 0) {
          setQuestion(fallbackResponse.questions[0]);
          setIsDailyQuestion(false);
        }
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLevelChange = (level) => {
    console.log('📊 Changing level to:', level);
    setQuestionLevel(level);
    fetchRandomQuestion(level);
  };

  const handleSubmit = async () => {
    if (!answer.trim()) {
      alert('답변을 입력해주세요!');
      return;
    }

    try {
      setSubmitting(true);
      
      console.log('💾 Submitting answer...');
      
      const response = await api.post(`/questions/${question.id}/answer`, {
        room_id: roomId,
        answer_text: answer
      });
      
      if (response.success) {
        setAnswered(true);
        
        // Socket.io로 실시간 알림 전송
        if (sendAnswer) {
          sendAnswer(roomId, question.question_text, answer, question.id);
        }
        
        alert('답변이 저장되었습니다!');
        console.log('✅ Answer saved');
      }
    } catch (error) {
      console.error('Failed to submit answer:', error);
      alert('답변 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSkipQuestion = () => {
    console.log('⏭️ Skipping to next question...');
    fetchRandomQuestion(questionLevel);
  };

  const handleNewQuestion = () => {
    console.log('🆕 Getting new question...');
    fetchRandomQuestion(questionLevel);
  };

  if (loading) {
    return <div className="question-loading">질문을 불러오는 중...</div>;
  }

  if (!question) {
    return (
      <div className="question-empty">
        <p>질문을 불러올 수 없습니다.</p>
        <button onClick={() => fetchRandomQuestion(questionLevel)}>
          새 질문 가져오기
        </button>
      </div>
    );
  }

  return (
    <div className="question-card">
      <div className="question-header">
        <h2>
          {isDailyQuestion ? '💬 오늘의 질문' : '💭 랜덤 질문'}
        </h2>
        <div className="level-selector">
          <button 
            className={`level-btn ${questionLevel === 1 ? 'active' : ''}`}
            onClick={() => handleLevelChange(1)}
          >
            🌱 가벼운
          </button>
          <button 
            className={`level-btn ${questionLevel === 2 ? 'active' : ''}`}
            onClick={() => handleLevelChange(2)}
          >
            🌿 깊이있는
          </button>
          <button 
            className={`level-btn ${questionLevel === 3 ? 'active' : ''}`}
            onClick={() => handleLevelChange(3)}
          >
            🌳 친밀한
          </button>
        </div>
      </div>

      <div className="question-content">
        <div className="question-text">
          <span className="question-category">{question.category}</span>
          <h3>{question.question_text}</h3>
          {question.id && (
            <span className="question-id">#{question.id.substring(0, 8)}</span>
          )}
        </div>

        {!answered ? (
          <div className="answer-section">
            <textarea
              className="answer-input"
              placeholder="솔직한 답변을 적어주세요..."
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              rows={4}
            />
            <button 
              className="submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? '저장 중...' : '답변 저장'}
            </button>
          </div>
        ) : (
          <div className="answered-section">
            <p className="answered-message">이미 답변하셨습니다!</p>
            <button 
              className="new-question-btn"
              onClick={handleNewQuestion}
            >
              다른 질문 보기
            </button>
          </div>
        )}
      </div>

      <div className="question-footer">
        <button 
          className="skip-btn"
          onClick={handleSkipQuestion}
          title="다른 질문 보기"
        >
          다음 질문으로 →
        </button>
        
        {isDailyQuestion && (
          <button 
            className="random-btn"
            onClick={() => fetchRandomQuestion(questionLevel)}
            title="랜덤 질문 보기"
          >
            랜덤 질문
          </button>
        )}
        
        {!isDailyQuestion && (
          <button 
            className="daily-btn"
            onClick={fetchDailyQuestion}
            title="오늘의 질문으로 돌아가기"
          >
            오늘의 질문
          </button>
        )}
      </div>
    </div>
  );
}

export default QuestionCard;