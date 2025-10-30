const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// 디버깅용 테스트 라우트
router.get('/test', (req, res) => {
  console.log('📊 Stats test route hit');
  res.json({ success: true, message: 'Stats API is working!' });
});

// 친밀도 점수 계산 함수
const calculateIntimacyScore = (data) => {
  const {
    totalAnswers = 0,
    matchingAnswers = 0,
    totalGames = 0,
    gameWins = 0,
    messageCount = 0,
    daysActive = 0
  } = data;

  const answerScore = totalAnswers * 10;
  const matchScore = matchingAnswers * 20;
  const gameScore = totalGames * 15;
  const winScore = gameWins * 25;
  const chatScore = Math.min(messageCount * 2, 100);
  const consistencyScore = Math.min(daysActive * 5, 100);

  const totalScore = answerScore + matchScore + gameScore + winScore + chatScore + consistencyScore;
  
  const scores = {
    total: totalScore,
    empathy: Math.round((matchScore / Math.max(totalAnswers * 20, 1)) * 100),
    activity: Math.round(((answerScore + gameScore) / 500) * 100),
    communication: Math.round((chatScore / 100) * 100),
    consistency: Math.round((consistencyScore / 100) * 100)
  };

  scores.level = Math.floor(totalScore / 100) + 1;
  
  return scores;
};

// 방의 친밀도 점수 조회
router.get('/room/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;
    
    console.log('📊 Getting room stats for:', roomId, 'user:', userId);

    // 멤버 확인
    const { data: member, error: memberError } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();

    if (memberError) {
      console.error('❌ Member check error:', memberError);
      return res.status(403).json({ 
        error: 'Not a member of this room',
        details: memberError.message 
      });
    }

    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }

    // 1. 전체 답변 수
    const { count: totalAnswers, error: answersError } = await supabase
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('room_id', roomId);

    if (answersError) {
      console.error('❌ Answers count error:', answersError);
    }

    // 2. 방 생성일로부터 경과일
    const { data: room, error: roomError } = await supabase
      .from('rooms')
      .select('created_at')
      .eq('id', roomId)
      .single();

    if (roomError) {
      console.error('❌ Room fetch error:', roomError);
    }

    const daysActive = room ? Math.floor(
      (new Date() - new Date(room.created_at)) / (1000 * 60 * 60 * 24)
    ) : 0;

    // 3. 게임 참여 횟수 (간단화된 쿼리)
    const { data: gameSessions } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'finished');

    const totalGames = gameSessions?.length || 0;

    // 4. 최근 활동 (7일)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: recentAnswers } = await supabase
      .from('answers')
      .select('answered_at')
      .eq('room_id', roomId)
      .gte('answered_at', sevenDaysAgo.toISOString());

    // 5. 멤버 목록
    const { data: members, error: membersError } = await supabase
      .from('room_members')
      .select(`
        user_id,
        joined_at,
        users (
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('room_id', roomId);

    if (membersError) {
      console.error('❌ Members fetch error:', membersError);
    }

    // 간단한 멤버 통계
    const memberStats = members?.map(member => ({
      ...member,
      answerCount: 0 // 일단 0으로 설정 (성능상 이유)
    })) || [];

    // 친밀도 점수 계산
    const intimacyScore = calculateIntimacyScore({
      totalAnswers: totalAnswers || 0,
      matchingAnswers: 0,
      totalGames: totalGames,
      gameWins: 0,
      messageCount: 0,
      daysActive: daysActive
    });

    // 응답 전송
    res.json({
      success: true,
      stats: {
        roomId,
        totalAnswers: totalAnswers || 0,
        totalGames,
        daysActive,
        recentActivity: recentAnswers?.length || 0,
        members: memberStats,
        intimacyScore,
        previousScore: null,
        currentScore: intimacyScore
      }
    });

    console.log('✅ Stats sent successfully');

  } catch (error) {
    console.error('❌ Get room stats error:', error);
    res.status(500).json({ 
      error: 'Failed to get room stats',
      message: error.message 
    });
  }
});

// 사용자 개인 통계
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const requesterId = req.userId;
    
    if (userId !== requesterId) {
      return res.status(403).json({ error: 'Can only view own stats' });
    }

    console.log('📊 Getting user stats:', userId);

    const { data: rooms } = await supabase
      .from('room_members')
      .select('room_id')
      .eq('user_id', userId);

    const { count: totalAnswers } = await supabase
      .from('answers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    res.json({
      success: true,
      stats: {
        userId,
        totalRooms: rooms?.length || 0,
        totalAnswers: totalAnswers || 0,
        totalGames: 0,
        completedGames: 0,
        recentActivity: 0,
        dailyActivity: {},
        achievements: []
      }
    });

  } catch (error) {
    console.error('❌ Get user stats error:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

module.exports = router;