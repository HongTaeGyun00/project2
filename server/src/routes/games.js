const express = require("express");
const router = express.Router();
const supabase = require("../config/supabase");
const authMiddleware = require("../middleware/auth");

// 게임 세션 생성
router.post("/create", authMiddleware, async (req, res) => {
  try {
    const { room_id, game_type } = req.body;
    const userId = req.userId;

    console.log("🎮 Creating game session:", { room_id, game_type, userId });

    // 이미 진행 중인 게임이 있는지 확인
    const { data: existingGame } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("room_id", room_id)
      .in("status", ["waiting", "playing"])
      .single();

    if (existingGame) {
      return res.status(400).json({
        error: "Game already in progress",
        session: existingGame,
      });
    }

    // 게임 세션 생성
    const { data: session, error: sessionError } = await supabase
      .from("game_sessions")
      .insert({
        room_id,
        game_type,
        status: "waiting",
        created_by: userId,
        game_data: {},
      })
      .select()
      .single();

    if (sessionError) throw sessionError;

    // 생성자를 참가자로 추가
    const { error: participantError } = await supabase
      .from("game_participants")
      .insert({
        session_id: session.id,
        user_id: userId,
      });

    if (participantError) throw participantError;

    console.log("✅ Game session created:", session.id);

    // Socket.io로 방에 알림
    const io = req.app.get("io");
    if (io) {
      io.to(room_id).emit("game_created", {
        sessionId: session.id,
        gameType: game_type,
        createdBy: userId,
      });
    }

    res.status(201).json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("❌ Create game error:", error);
    res.status(500).json({ error: "Failed to create game" });
  }
});

// 게임 참가 (수정)
router.post('/join/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    
    console.log('🎮 User joining game:', { sessionId, userId });
    
    // 게임 세션 확인
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return res.status(404).json({ error: 'Game session not found' });
    }
    
    if (session.status !== 'waiting') {
      return res.status(400).json({ error: 'Game already started' });
    }
    
    // 이미 참가했는지 확인
    const { data: existing } = await supabase
      .from('game_participants')
      .select('*')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .single();
    
    if (existing) {
      console.log('✅ Already joined, fetching current state');
      
      // 이미 참가한 경우, 현재 참가자 목록 반환
      const { data: allParticipants } = await supabase
        .from('game_participants')
        .select(`
          *,
          users (
            id,
            username,
            display_name
          )
        `)
        .eq('session_id', sessionId);
      
      return res.json({
        success: true,
        message: 'Already joined',
        session,
        participants: allParticipants || []
      });
    }
    
    // 참가자 추가
    const { data: newParticipant, error: joinError } = await supabase
      .from('game_participants')
      .insert({
        session_id: sessionId,
        user_id: userId
      })
      .select(`
        *,
        users (
          id,
          username,
          display_name
        )
      `)
      .single();
    
    if (joinError) throw joinError;
    
    // 모든 참가자 정보 가져오기
    const { data: allParticipants } = await supabase
      .from('game_participants')
      .select(`
        *,
        users (
          id,
          username,
          display_name
        )
      `)
      .eq('session_id', sessionId);
    
    console.log('✅ User joined, total participants:', allParticipants?.length);
    
    // Socket.io로 모든 참가자에게 알림
    const io = req.app.get('io');
    if (io) {
      // 방의 모든 사용자에게 업데이트된 참가자 목록 전송
      io.to(session.room_id).emit('player_joined', {
        sessionId,
        userId,
        newPlayer: newParticipant,
        allParticipants: allParticipants || [],
        playerCount: allParticipants?.length || 0
      });
      
      console.log('📤 Emitted player_joined event to room:', session.room_id);
    }
    
    res.json({
      success: true,
      session,
      participants: allParticipants || []
    });
  } catch (error) {
    console.error('❌ Join game error:', error);
    res.status(500).json({ error: 'Failed to join game' });
  }
});

// 게임 상태 조회 (수정)
router.get('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    
    console.log('📊 Getting session status:', sessionId);
    
    const { data: session, error } = await supabase
      .from('game_sessions')
      .select(`
        *,
        game_participants (
          *,
          users (
            id,
            username,
            display_name
          )
        )
      `)
      .eq('id', sessionId)
      .single();
    
    if (error) {
      console.error('❌ Session query error:', error);
      throw error;
    }
    
    if (!session) {
      return res.status(404).json({ error: 'Game session not found' });
    }
    
    console.log('✅ Session found with', session.game_participants?.length, 'participants');
    
    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('❌ Get session error:', error);
    res.status(500).json({ error: 'Failed to get session' });
  }
});

// 게임 시작 (수정)
router.post('/start/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    
    console.log('🚀 Starting game:', sessionId);
    
    // 게임 세션 확인
    const { data: session } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (!session) {
      return res.status(404).json({ error: 'Game session not found' });
    }
    
    if (session.created_by !== userId) {
      return res.status(403).json({ error: 'Only the creator can start the game' });
    }
    
    // 참가자 확인
    const { data: participants } = await supabase
      .from('game_participants')
      .select(`
        *,
        users (
          id,
          username,
          display_name
        )
      `)
      .eq('session_id', sessionId);
    
    console.log('📊 Participants count:', participants?.length);
    
    if (!participants || participants.length < 2) {
      return res.status(400).json({ 
        error: 'Need at least 2 players',
        currentPlayers: participants?.length || 0
      });
    }
    
    // 밸런스 게임 질문 가져오기
    const { data: questions } = await supabase
      .from('balance_game_questions')
      .select('*')
      .limit(10);
    
    if (!questions || questions.length === 0) {
      return res.status(500).json({ error: 'No questions available' });
    }
    
    // 게임 시작 - 상태 업데이트
    const { data: updatedSession, error: updateError } = await supabase
      .from('game_sessions')
      .update({
        status: 'playing',
        started_at: new Date().toISOString(),
        game_data: {
          questions: questions,
          current_question_index: 0,
          total_questions: questions.length
        }
      })
      .eq('id', sessionId)
      .select()
      .single();
    
    if (updateError) throw updateError;
    
    console.log('✅ Game started successfully');
    
    // Socket.io로 게임 시작 알림
    const io = req.app.get('io');
    if (io) {
      io.to(session.room_id).emit('game_started', {
        sessionId,
        questions: questions[0], // 첫 번째 질문만 전송
        totalQuestions: questions.length,
        participants: participants
      });
      
      console.log('📤 Emitted game_started event');
    }
    
    res.json({
      success: true,
      message: 'Game started',
      firstQuestion: questions[0],
      participants: participants
    });
  } catch (error) {
    console.error('❌ Start game error:', error);
    res.status(500).json({ 
      error: 'Failed to start game',
      details: error.message 
    });
  }
});

// 답변 제출
router.post("/answer/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { answer, questionIndex } = req.body;
    const userId = req.userId;

    console.log("🎯 Answer submitted:", {
      sessionId,
      userId,
      answer,
      questionIndex,
    });

    // 참가자 정보 가져오기
    const { data: participant } = await supabase
      .from("game_participants")
      .select("*")
      .eq("session_id", sessionId)
      .eq("user_id", userId)
      .single();

    if (!participant) {
      return res.status(403).json({ error: "Not a participant" });
    }

    // 답변 저장
    const currentAnswers = participant.answers || [];
    currentAnswers[questionIndex] = answer;

    const { error: updateError } = await supabase
      .from("game_participants")
      .update({
        answers: currentAnswers,
      })
      .eq("id", participant.id);

    if (updateError) throw updateError;

    // 모든 참가자가 답변했는지 확인
    const { data: allParticipants } = await supabase
      .from("game_participants")
      .select("*")
      .eq("session_id", sessionId);

    const allAnswered = allParticipants.every(
      (p) => p.answers && p.answers[questionIndex] !== undefined
    );

    // Socket.io로 답변 상태 업데이트
    const io = req.app.get("io");
    const { data: session } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (io && session) {
      io.to(session.room_id).emit("answer_submitted", {
        sessionId,
        userId,
        questionIndex,
        allAnswered,
      });

      // 모두 답변했으면 결과 공개
      if (allAnswered) {
        const answers = allParticipants.map((p) => ({
          userId: p.user_id,
          answer: p.answers[questionIndex],
        }));

        io.to(session.room_id).emit("round_complete", {
          sessionId,
          questionIndex,
          answers,
        });
      }
    }

    res.json({
      success: true,
      allAnswered,
    });
  } catch (error) {
    console.error("❌ Submit answer error:", error);
    res.status(500).json({ error: "Failed to submit answer" });
  }
});

// 다음 질문
router.post("/next/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    // 게임 세션 가져오기
    const { data: session } = await supabase
      .from("game_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();

    if (!session || !session.game_data) {
      return res.status(404).json({ error: "Game session not found" });
    }

    const currentIndex = session.game_data.current_question_index || 0;
    const questions = session.game_data.questions || [];
    const nextIndex = currentIndex + 1;

    if (nextIndex >= questions.length) {
      // 게임 종료
      await supabase
        .from("game_sessions")
        .update({
          status: "finished",
          ended_at: new Date().toISOString(),
        })
        .eq("id", sessionId);

      // 최종 결과 계산
      const { data: participants } = await supabase
        .from("game_participants")
        .select("*")
        .eq("session_id", sessionId);

      const io = req.app.get("io");
      if (io) {
        io.to(session.room_id).emit("game_finished", {
          sessionId,
          participants,
        });
      }

      return res.json({
        success: true,
        finished: true,
        participants,
      });
    }

    // 다음 질문으로 업데이트
    const { error: updateError } = await supabase
      .from("game_sessions")
      .update({
        game_data: {
          ...session.game_data,
          current_question_index: nextIndex,
        },
      })
      .eq("id", sessionId);

    if (updateError) throw updateError;

    const nextQuestion = questions[nextIndex];

    // Socket.io로 다음 질문 전송
    const io = req.app.get("io");
    if (io) {
      io.to(session.room_id).emit("next_question", {
        sessionId,
        questionIndex: nextIndex,
        question: nextQuestion,
      });
    }

    res.json({
      success: true,
      question: nextQuestion,
      questionIndex: nextIndex,
    });
  } catch (error) {
    console.error("❌ Next question error:", error);
    res.status(500).json({ error: "Failed to get next question" });
  }
});

// 게임 상태 조회
router.get("/session/:sessionId", authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;

    const { data: session } = await supabase
      .from("game_sessions")
      .select(
        `
        *,
        game_participants (
          *,
          users (
            id,
            username,
            display_name
          )
        )
      `
      )
      .eq("id", sessionId)
      .single();

    if (!session) {
      return res.status(404).json({ error: "Game session not found" });
    }

    res.json({
      success: true,
      session,
    });
  } catch (error) {
    console.error("❌ Get session error:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

// 방의 활성 게임 세션 조회
router.get("/room/:roomId/active", authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;

    console.log("🎮 Checking active games for room:", roomId);

    // 활성 게임 세션 찾기
    const { data: sessions, error } = await supabase
      .from("game_sessions")
      .select(
        `
        *,
        game_participants (
          *,
          users (
            id,
            username,
            display_name
          )
        )
      `
      )
      .eq("room_id", roomId)
      .in("status", ["waiting", "playing"])
      .order("created_at", { ascending: false });

    if (error) throw error;

    console.log(`✅ Found ${sessions?.length || 0} active sessions`);

    res.json({
      success: true,
      sessions: sessions || [],
    });
  } catch (error) {
    console.error("❌ Get active games error:", error);
    res.status(500).json({ error: "Failed to get active games" });
  }
});

// 게임 세션 삭제 (개선된 버전)
router.delete('/session/:sessionId', authMiddleware, async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.userId;
    
    console.log('🗑️ Delete game request:', { sessionId, userId });
    
    // 세션 확인
    const { data: session, error: sessionError } = await supabase
      .from('game_sessions')
      .select('*')
      .eq('id', sessionId)
      .single();
    
    if (sessionError || !session) {
      return res.status(404).json({ error: 'Game session not found' });
    }
    
    // 생성자 확인 (또는 관리자 권한)
    if (session.created_by !== userId) {
      return res.status(403).json({ error: 'Only creator can delete the game' });
    }
    
    // 참가자들 정보 가져오기 (알림용)
    const { data: participants } = await supabase
      .from('game_participants')
      .select('user_id')
      .eq('session_id', sessionId);
    
    // 게임 삭제 (CASCADE로 participants도 자동 삭제)
    const { error: deleteError } = await supabase
      .from('game_sessions')
      .delete()
      .eq('id', sessionId);
    
    if (deleteError) throw deleteError;
    
    console.log('✅ Game session deleted:', sessionId);
    
    // Socket.io로 모든 참가자에게 알림
    const io = req.app.get('io');
    if (io && session.room_id) {
      io.to(session.room_id).emit('game_cancelled', { 
        sessionId,
        message: '게임이 취소되었습니다.'
      });
      
      console.log('📤 Emitted game_cancelled event to room:', session.room_id);
    }
    
    res.json({
      success: true,
      message: 'Game session deleted successfully'
    });
  } catch (error) {
    console.error('❌ Delete game error:', error);
    res.status(500).json({ error: 'Failed to delete game' });
  }
});

// 방의 모든 게임 세션 정리 (오래된 세션 정리용)
router.delete('/room/:roomId/cleanup', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    
    console.log('🧹 Cleaning up old game sessions for room:', roomId);
    
    // 24시간 이상 된 'waiting' 상태 게임 삭제
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    
    const { data: oldSessions, error: fetchError } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('room_id', roomId)
      .eq('status', 'waiting')
      .lt('created_at', oneDayAgo.toISOString());
    
    if (fetchError) throw fetchError;
    
    if (oldSessions && oldSessions.length > 0) {
      const sessionIds = oldSessions.map(s => s.id);
      
      const { error: deleteError } = await supabase
        .from('game_sessions')
        .delete()
        .in('id', sessionIds);
      
      if (deleteError) throw deleteError;
      
      console.log(`✅ Cleaned up ${oldSessions.length} old sessions`);
    }
    
    res.json({
      success: true,
      cleaned: oldSessions?.length || 0
    });
  } catch (error) {
    console.error('❌ Cleanup error:', error);
    res.status(500).json({ error: 'Failed to cleanup sessions' });
  }
});
module.exports = router;
