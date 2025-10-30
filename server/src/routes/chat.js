const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const authMiddleware = require('../middleware/auth');

// 채팅 메시지 저장
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { room_id, message } = req.body;
    const userId = req.userId;
    
    console.log('💬 Saving chat message:', { room_id, userId, messageLength: message?.length });
    
    // 입력 검증
    if (!room_id || !message || !message.trim()) {
      return res.status(400).json({ 
        error: 'Room ID and message are required' 
      });
    }
    
    // 멤버십 확인
    const { data: member } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', room_id)
      .eq('user_id', userId)
      .single();
    
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }
    
    // 메시지 저장
    const { data: savedMessage, error } = await supabase
      .from('chat_messages')
      .insert({
        room_id,
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
      console.error('❌ Save message error:', error);
      throw error;
    }
    
    console.log('✅ Message saved:', savedMessage.id);
    
    res.status(201).json({
      success: true,
      message: savedMessage
    });
    
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      message: error.message 
    });
  }
});

// 채팅 기록 조회
router.get('/room/:roomId', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { limit = 50, before = null } = req.query;
    const userId = req.userId;
    
    console.log('📚 Fetching chat history:', { roomId, limit, before });
    
    // 멤버십 확인
    const { data: member } = await supabase
      .from('room_members')
      .select('*')
      .eq('room_id', roomId)
      .eq('user_id', userId)
      .single();
    
    if (!member) {
      return res.status(403).json({ error: 'Not a member of this room' });
    }
    
    // 메시지 조회 쿼리
    let query = supabase
      .from('chat_messages')
      .select(`
        *,
        users (
          id,
          username,
          display_name,
          avatar_url
        )
      `)
      .eq('room_id', roomId)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));
    
    // 페이지네이션 (이전 메시지 로드용)
    if (before) {
      query = query.lt('created_at', before);
    }
    
    const { data: messages, error } = await query;
    
    if (error) {
      console.error('❌ Fetch messages error:', error);
      throw error;
    }
    
    // 시간 순서대로 정렬 (최신 메시지가 아래로)
    const sortedMessages = (messages || []).reverse();
    
    console.log(`✅ Fetched ${sortedMessages.length} messages`);
    
    res.json({
      success: true,
      messages: sortedMessages,
      hasMore: messages?.length === parseInt(limit)
    });
    
  } catch (error) {
    console.error('❌ Get chat history error:', error);
    res.status(500).json({ 
      error: 'Failed to get chat history',
      message: error.message 
    });
  }
});

// 최근 메시지 확인 (읽지 않은 메시지 수 등)
router.get('/room/:roomId/recent', authMiddleware, async (req, res) => {
  try {
    const { roomId } = req.params;
    const { since } = req.query; // 특정 시간 이후의 메시지
    
    let query = supabase
      .from('chat_messages')
      .select('id', { count: 'exact', head: true })
      .eq('room_id', roomId);
    
    if (since) {
      query = query.gt('created_at', since);
    }
    
    const { count, error } = await query;
    
    if (error) throw error;
    
    res.json({
      success: true,
      count: count || 0
    });
    
  } catch (error) {
    console.error('❌ Get recent messages error:', error);
    res.status(500).json({ error: 'Failed to get recent messages' });
  }
});

module.exports = router;