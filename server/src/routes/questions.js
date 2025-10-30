const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// 질문 목록 가져오기 (랜덤 순서 추가)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { category, level, limit = 10, random = false } = req.query;
    
    console.log('📋 Fetching questions:', { category, level, limit, random });
    
    // 모든 질문 가져오기
    let query = supabase
      .from('questions')
      .select('*');
    
    if (category) {
      query = query.eq('category', category);
    }
    
    if (level) {
      query = query.eq('level', parseInt(level));
    }
    
    const { data: questions, error } = await query;
    
    if (error) {
      console.error('❌ Supabase error:', error);
      return res.status(500).json({ 
        error: 'Database query failed',
        message: error.message
      });
    }
    
    let filteredQuestions = questions || [];
    
    // 랜덤 섞기
    if (random === 'true' && filteredQuestions.length > 0) {
      filteredQuestions = filteredQuestions.sort(() => Math.random() - 0.5);
    }
    
    // 제한 적용
    filteredQuestions = filteredQuestions.slice(0, parseInt(limit));
    
    console.log(`✅ Returning ${filteredQuestions.length} questions`);
    
    res.json({
      success: true,
      questions: filteredQuestions
    });
  } catch (error) {
    console.error('❌ Get questions error:', error);
    res.status(500).json({ 
      error: 'Failed to get questions',
      message: error.message 
    });
  }
});

// 랜덤 질문 하나 가져오기
router.get('/random', authMiddleware, async (req, res) => {
  try {
    const { level, excludeIds = '' } = req.query;
    const userId = req.userId;
    
    console.log('🎲 Getting random question:', { level, excludeIds });
    
    // 모든 질문 가져오기
    let query = supabase
      .from('questions')
      .select('*');
    
    if (level) {
      query = query.eq('level', parseInt(level));
    }
    
    const { data: questions, error } = await query;
    
    if (error) {
      console.error('❌ Supabase error:', error);
      throw error;
    }
    
    if (!questions || questions.length === 0) {
      return res.json({
        success: false,
        message: 'No questions available'
      });
    }
    
    // 제외할 ID 목록 파싱
    const excludeIdArray = excludeIds ? excludeIds.split(',') : [];
    
    // 제외 ID를 필터링
    let availableQuestions = questions;
    if (excludeIdArray.length > 0) {
      availableQuestions = questions.filter(q => !excludeIdArray.includes(q.id));
    }
    
    // 사용 가능한 질문이 없으면 전체에서 다시 선택
    if (availableQuestions.length === 0) {
      console.log('⚠️ All questions seen, resetting...');
      availableQuestions = questions;
    }
    
    // 랜덤 선택
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const randomQuestion = availableQuestions[randomIndex];
    
    console.log('✅ Selected question:', randomQuestion.id);
    
    res.json({
      success: true,
      question: randomQuestion
    });
  } catch (error) {
    console.error('❌ Get random question error:', error);
    res.status(500).json({ 
      error: 'Failed to get random question',
      message: error.message 
    });
  }
});

// 오늘의 질문 가져오기 (수정)
router.get('/daily/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const userId = req.userId;
    
    console.log('📅 Getting daily question for room:', roomId, 'user:', userId);
    
    // 오늘 날짜를 시드로 사용하여 일관된 랜덤 선택
    const today = new Date();
    const dateString = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const seed = dateString + roomId;
    
    // 모든 질문 가져오기
    const { data: questions, error: questionsError } = await supabase
      .from('questions')
      .select('*');
    
    if (questionsError) {
      console.error('❌ Questions fetch error:', questionsError);
      return res.status(500).json({ 
        error: 'Failed to fetch questions',
        message: questionsError.message 
      });
    }
    
    if (!questions || questions.length === 0) {
      return res.json({
        success: true,
        question: null,
        answered: false,
        message: 'No questions available'
      });
    }
    
    // 시드 기반 랜덤 선택 (오늘은 같은 질문)
    const hashCode = seed.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    
    const questionIndex = Math.abs(hashCode) % questions.length;
    const dailyQuestion = questions[questionIndex];
    
    // 답변 여부 확인
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    
    const { data: todayAnswer } = await supabase
      .from('answers')
      .select('id')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .eq('question_id', dailyQuestion.id)
      .gte('answered_at', todayStart.toISOString())
      .single();
    
    res.json({
      success: true,
      question: dailyQuestion,
      answered: !!todayAnswer
    });
    
  } catch (error) {
    console.error('❌ Daily question error:', error);
    res.status(500).json({ 
      error: 'Failed to get daily question',
      message: error.message 
    });
  }
});

// 답변 제출 라우트 - 이 부분이 누락되었거나 잘못된 것 같습니다
router.post('/:questionId/answer', authMiddleware, async (req, res) => {
  try {
    const { questionId } = req.params;
    const { room_id, answer_text, answer_data } = req.body;
    const userId = req.userId;
    
    console.log('💬 Submitting answer:', { 
      questionId, 
      room_id, 
      userId,
      textLength: answer_text?.length 
    });

    // 입력 유효성 검사
    if (!room_id || !answer_text) {
      return res.status(400).json({ 
        error: 'Missing required fields',
        required: ['room_id', 'answer_text']
      });
    }

    // 이미 답변이 있는지 확인
    const { data: existingAnswer, error: checkError } = await supabase
      .from('answers')
      .select('id')
      .eq('room_id', room_id)
      .eq('question_id', questionId)
      .eq('user_id', userId)
      .single();

    if (checkError && checkError.code !== 'PGRST116') {
      console.error('❌ Check existing answer error:', checkError);
    }

    let result;

    if (existingAnswer) {
      // 기존 답변 업데이트
      console.log('📝 Updating existing answer...');
      
      const { data: updatedAnswer, error: updateError } = await supabase
        .from('answers')
        .update({
          answer_text,
          answer_data,
          answered_at: new Date().toISOString()
        })
        .eq('id', existingAnswer.id)
        .select()
        .single();

      if (updateError) {
        console.error('❌ Update answer error:', updateError);
        throw updateError;
      }

      result = updatedAnswer;
      console.log('✅ Answer updated:', result.id);
    } else {
      // 새 답변 생성
      console.log('📝 Creating new answer...');
      
      const { data: newAnswer, error: insertError } = await supabase
        .from('answers')
        .insert({
          room_id,
          question_id: questionId,
          user_id: userId,
          answer_text,
          answer_data,
          answered_at: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Insert answer error:', insertError);
        throw insertError;
      }

      result = newAnswer;
      console.log('✅ Answer created:', result.id);
    }
    
    res.status(existingAnswer ? 200 : 201).json({
      success: true,
      answer: result,
      updated: !!existingAnswer
    });
    
  } catch (error) {
    console.error('❌ Submit answer error:', error);
    res.status(500).json({ 
      error: 'Failed to submit answer',
      message: error.message,
      hint: error.hint
    });
  }
});

// 방의 모든 답변 가져오기
router.get('/room/:roomId/answers', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 20, offset = 0 } = req.query;
    
    console.log('📚 Getting room answers:', { roomId, limit, offset });
    
    // 먼저 answers만 가져오기
    const { data: answers, error: answersError } = await supabase
      .from('answers')
      .select('*')
      .eq('room_id', roomId)
      .order('answered_at', { ascending: false })
      .limit(parseInt(limit))
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);
    
    if (answersError) {
      console.error('❌ Answers fetch error:', answersError);
      return res.status(500).json({ 
        error: 'Failed to fetch answers',
        message: answersError.message 
      });
    }
    
    // 각 답변에 대한 질문과 사용자 정보 가져오기
    const enrichedAnswers = [];
    
    for (const answer of answers || []) {
      // 질문 정보
      const { data: question } = await supabase
        .from('questions')
        .select('question_text, category, level')
        .eq('id', answer.question_id)
        .single();
      
      // 사용자 정보
      const { data: user } = await supabase
        .from('users')
        .select('username, display_name, avatar_url')
        .eq('id', answer.user_id)
        .single();
      
      enrichedAnswers.push({
        ...answer,
        questions: question,
        users: user
      });
    }
    
    console.log(`✅ Found ${enrichedAnswers.length} answers`);
    
    res.json({
      success: true,
      answers: enrichedAnswers
    });
  } catch (error) {
    console.error('❌ Get room answers error:', error);
    res.status(500).json({ 
      error: 'Failed to get answers',
      message: error.message 
    });
  }
});

module.exports = router;