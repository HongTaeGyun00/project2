import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';
import '../styles/RoomStats.css';

function RoomStats() {
  const { roomId } = useParams();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchStats();
  }, [roomId]);

const fetchStats = async () => {
  try {
    setLoading(true);
    setError(null);
    
    console.log('📊 Fetching stats for room:', roomId);
    
    const response = await api.get(`/stats/room/${roomId}`);
    
    console.log('📊 Stats response:', response);
    
    if (response.success) {
      setStats(response.stats);
    }
  } catch (error) {
    console.error('❌ Failed to fetch stats:', error);
    
    // 더 자세한 에러 메시지
    if (error.response) {
      // 서버가 응답했지만 에러 상태
      setError(`서버 에러: ${error.response.data?.error || error.response.status}`);
    } else if (error.request) {
      // 요청은 갔지만 응답이 없음
      setError('서버에 연결할 수 없습니다. 서버가 실행 중인지 확인해주세요.');
    } else {
      // 요청 설정 중 에러
      setError(error.message || 'Failed to load statistics');
    }
  } finally {
    setLoading(false);
  }
};

  const getIntimacyLevel = (score) => {
    if (score >= 90) return { level: '💕 소울메이트', color: '#ff1744' };
    if (score >= 70) return { level: '💝 절친', color: '#e91e63' };
    if (score >= 50) return { level: '💖 친한 친구', color: '#9c27b0' };
    if (score >= 30) return { level: '💗 좋은 친구', color: '#673ab7' };
    if (score >= 10) return { level: '💜 친구', color: '#3f51b5' };
    return { level: '🌱 새싹 친구', color: '#2196f3' };
  };

  if (loading) {
    return (
      <div className="stats-loading">
        <div className="loading-spinner">통계를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="stats-error">
        <p>통계를 불러올 수 없습니다.</p>
        <p>{error}</p>
        <button onClick={fetchStats}>다시 시도</button>
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  const intimacyLevel = getIntimacyLevel(stats.intimacyScore?.total || 0);

  return (
    <div className="room-stats-container">
      <div className="stats-header">
        <h2>📊 우리의 친밀도</h2>
        <button className="refresh-btn" onClick={fetchStats}>
          🔄 새로고침
        </button>
      </div>

      {/* 친밀도 레벨 */}
      <div className="intimacy-level-card">
        <div className="level-badge" style={{ backgroundColor: intimacyLevel.color }}>
          <span className="level-text">{intimacyLevel.level}</span>
          <span className="level-score">Level {stats.intimacyScore?.level || 1}</span>
        </div>
        <div className="total-score">
          <span className="score-label">총 점수</span>
          <span className="score-value">{stats.intimacyScore?.total || 0}점</span>
        </div>
      </div>

      {/* 카테고리별 점수 */}
      <div className="score-categories">
        <div className="score-item">
          <div className="score-header">
            <span className="score-icon">💕</span>
            <span className="score-name">공감도</span>
          </div>
          <div className="score-bar">
            <div 
              className="score-fill empathy"
              style={{ width: `${stats.intimacyScore?.empathy || 0}%` }}
            />
          </div>
          <span className="score-percent">{stats.intimacyScore?.empathy || 0}%</span>
        </div>

        <div className="score-item">
          <div className="score-header">
            <span className="score-icon">⚡</span>
            <span className="score-name">활동성</span>
          </div>
          <div className="score-bar">
            <div 
              className="score-fill activity"
              style={{ width: `${stats.intimacyScore?.activity || 0}%` }}
            />
          </div>
          <span className="score-percent">{stats.intimacyScore?.activity || 0}%</span>
        </div>

        <div className="score-item">
          <div className="score-header">
            <span className="score-icon">💬</span>
            <span className="score-name">소통도</span>
          </div>
          <div className="score-bar">
            <div 
              className="score-fill communication"
              style={{ width: `${stats.intimacyScore?.communication || 0}%` }}
            />
          </div>
          <span className="score-percent">{stats.intimacyScore?.communication || 0}%</span>
        </div>

        <div className="score-item">
          <div className="score-header">
            <span className="score-icon">🌟</span>
            <span className="score-name">꾸준함</span>
          </div>
          <div className="score-bar">
            <div 
              className="score-fill consistency"
              style={{ width: `${stats.intimacyScore?.consistency || 0}%` }}
            />
          </div>
          <span className="score-percent">{stats.intimacyScore?.consistency || 0}%</span>
        </div>
      </div>

      {/* 활동 통계 */}
      <div className="activity-stats">
        <h3>📈 활동 통계</h3>
        <div className="stats-grid">
          <div className="stat-card">
            <span className="stat-value">{stats.totalAnswers}</span>
            <span className="stat-label">총 답변</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.totalGames}</span>
            <span className="stat-label">게임 참여</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.daysActive}</span>
            <span className="stat-label">함께한 날</span>
          </div>
          <div className="stat-card">
            <span className="stat-value">{stats.recentActivity}</span>
            <span className="stat-label">최근 7일 활동</span>
          </div>
        </div>
      </div>

      {/* 멤버별 기여도 */}
      <div className="member-contributions">
        <h3>👥 멤버별 참여도</h3>
        <div className="member-list">
          {stats.members?.map((member) => (
            <div key={member.user_id} className="member-stat">
              <div className="member-info">
                <span className="member-name">
                  {member.users?.display_name || member.users?.username}
                </span>
                <span className="member-answers">
                  답변 {member.answerCount}개
                </span>
              </div>
              <div className="contribution-bar">
                <div 
                  className="contribution-fill"
                  style={{ 
                    width: `${(member.answerCount / Math.max(stats.totalAnswers, 1)) * 100}%` 
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default RoomStats;