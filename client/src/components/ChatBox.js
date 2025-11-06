import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSocket } from '../contexts/SocketContext';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import '../styles/ChatBox.css';

function ChatBox({ roomId }) {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [typingUsers, setTypingUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const inputRef = useRef(null);
  const processedMessages = useRef(new Set());
  const pendingMessages = useRef(new Set()); // 전송 중인 메시지 추적
  
  const { socket, sendMessage, startTyping, stopTyping } = useSocket();
  const { user } = useAuth();
  
  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    });
  }, []);

  const isNearBottom = useCallback(() => {
    if (!messagesContainerRef.current) return true;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    return scrollHeight - scrollTop - clientHeight < 100;
  }, []);

  // 채팅 기록 로드 함수
  const loadChatHistory = useCallback(async () => {
    if (!roomId) return;
    
    try {
      setLoading(true);
      console.log('📚 Loading chat history for room:', roomId);
      
      const response = await api.get(`/chat/room/${roomId}`, {
        params: { limit: 50 }
      });
      
      if (response.success) {
        console.log(`✅ Loaded ${response.messages.length} messages`);
        
        // 로드된 메시지들을 처리된 목록에 추가
        response.messages.forEach(msg => {
          if (msg.id) {
            processedMessages.current.add(msg.id);
          }
        });
        
        setMessages(response.messages);
        setHasMore(response.hasMore);
        requestAnimationFrame(scrollToBottom);
      }
    } catch (error) {
      console.error('Failed to load chat history:', error);
    } finally {
      setLoading(false);
    }
  }, [roomId, scrollToBottom]);

  // 컴포넌트 마운트 시 채팅 기록 로드
  useEffect(() => {
    loadChatHistory();
  }, [loadChatHistory]);

  // Socket 이벤트 리스너
  useEffect(() => {
    if (!socket) return;

    // 새 메시지 수신
    const handleNewMessage = (message) => {
      console.log('📨 New message received:', message);
      
      const messageId = message.id;
      const tempId = message.tempId;
      
      // ID로 중복 체크
      if (messageId && processedMessages.current.has(messageId)) {
        console.log('⚠️ Duplicate message by ID, skipping:', messageId);
        return;
      }

      setMessages(prev => {
        // tempId가 있는 경우 낙관적 메시지 찾기
        if (tempId && pendingMessages.current.has(tempId)) {
          console.log('🔄 Replacing optimistic message:', tempId);
          pendingMessages.current.delete(tempId);
          
          // 메시지 ID를 처리된 목록에 추가
          if (messageId) {
            processedMessages.current.add(messageId);
          }
          
          // 낙관적 메시지를 실제 메시지로 교체
          return prev.map(m => 
            m.tempId === tempId 
              ? { ...message, saved: true }
              : m
          );
        }
        
        // 중복 체크 (ID 또는 tempId로)
        const isDuplicate = prev.some(m => 
          (messageId && m.id === messageId) ||
          (tempId && m.tempId === tempId)
        );
        
        if (isDuplicate) {
          console.log('⚠️ Duplicate message in state, skipping');
          return prev;
        }

        // 메시지 ID를 처리된 목록에 추가
        if (messageId) {
          processedMessages.current.add(messageId);
        }
        
        console.log('➕ Adding new message to state');
        const newMessages = [...prev, { ...message, saved: true }];
        
        // 스크롤 처리
        if (message.userId === user?.id || message.user_id === user?.id || isNearBottom()) {
          requestAnimationFrame(scrollToBottom);
        }
        
        return newMessages;
      });
    };

    // 타이핑 상태 수신
    const handleUserTyping = (data) => {
      if (data.userId === user?.id) return; // 자신의 타이핑은 무시
      
      setTypingUsers(prev => {
        if (!prev.find(u => u.userId === data.userId)) {
          return [...prev, data];
        }
        return prev;
      });
    };

    const handleUserStoppedTyping = (data) => {
      setTypingUsers(prev => prev.filter(u => u.userId !== data.userId));
    };

    socket.on('new_message', handleNewMessage);
    socket.on('user_typing', handleUserTyping);
    socket.on('user_stopped_typing', handleUserStoppedTyping);

    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('user_typing', handleUserTyping);
      socket.off('user_stopped_typing', handleUserStoppedTyping);
    };
  }, [socket, user, isNearBottom, scrollToBottom]);

  // 이전 메시지 더 불러오기
  const loadMoreMessages = async () => {
    if (!hasMore || loading || messages.length === 0) return;
    
    try {
      const oldestMessage = messages[0];
      console.log('📚 Loading more messages before:', oldestMessage.created_at);
      
      const response = await api.get(`/chat/room/${roomId}`, {
        params: { 
          limit: 30,
          before: oldestMessage.created_at
        }
      });
      
      if (response.success) {
        // 새로 로드된 메시지들을 처리된 목록에 추가
        response.messages.forEach(msg => {
          if (msg.id) {
            processedMessages.current.add(msg.id);
          }
        });
        
        setMessages(prev => [...response.messages, ...prev]);
        setHasMore(response.hasMore);
      }
    } catch (error) {
      console.error('Failed to load more messages:', error);
    }
  };

  const handleInputChange = (e) => {
    setInputMessage(e.target.value);
    
    // 타이핑 시작 알림
    if (e.target.value && !typingTimeoutRef.current) {
      startTyping(roomId);
    }
    
    // 기존 타임아웃 취소
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // 2초 후 타이핑 중지
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(roomId);
      typingTimeoutRef.current = null;
    }, 2000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    
    if (!inputMessage.trim() || sending) return;
    
    const messageText = inputMessage.trim();
    const tempId = `temp-${user.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const tempMessage = {
      message: messageText,
      userId: user.id,
      user_id: user.id,
      userName: user.display_name || user.username,
      timestamp: new Date().toISOString(),
      tempId: tempId,
      saved: false,
      isPending: true
    };
    
    console.log('📤 Sending message with tempId:', tempId);
    
    // 낙관적 업데이트: 메시지를 즉시 화면에 표시
    setMessages(prev => [...prev, tempMessage]);
    pendingMessages.current.add(tempId);
    
    setInputMessage('');
    setSending(true);
    scrollToBottom();
    
    // 타이핑 중지
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
      stopTyping(roomId);
    }
    
    try {
      // tempId를 포함하여 메시지 전송
      await sendMessage(roomId, messageText, tempId);
      console.log('✅ Message sent successfully');
    } catch (error) {
      console.error('❌ Failed to send message:', error);
      
      // 에러 발생 시 낙관적 메시지 제거
      setMessages(prev => prev.filter(m => m.tempId !== tempId));
      pendingMessages.current.delete(tempId);
      
      alert('메시지 전송에 실패했습니다.');
    } finally {
      setSending(false);
    }
  };

  const handleScroll = (e) => {
    // 스크롤이 맨 위에 도달했을 때 이전 메시지 로드
    if (e.target.scrollTop === 0 && hasMore && !loading) {
      loadMoreMessages();
    }
  };

  // 메시지 시간 포맷
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    
    if (isToday) {
      return date.toLocaleTimeString('ko-KR', { 
        hour: '2-digit', 
        minute: '2-digit' 
      });
    } else {
      return date.toLocaleDateString('ko-KR', { 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit', 
        minute: '2-digit' 
      });
    }
  };

  // 날짜 구분선 표시 여부
  const shouldShowDateDivider = (currentMsg, prevMsg) => {
    if (!prevMsg) return true;
    
    const currentDate = new Date(currentMsg.created_at || currentMsg.timestamp);
    const prevDate = new Date(prevMsg.created_at || prevMsg.timestamp);
    
    return currentDate.toDateString() !== prevDate.toDateString();
  };

  if (loading && messages.length === 0) {
    return (
      <div className="chat-container">
        <div className="chat-loading">
          채팅을 불러오는 중...
        </div>
      </div>
    );
  }

  return (
    <div className="chat-container">
      <div 
        className="messages-container" 
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {hasMore && (
          <div className="load-more">
            <button onClick={loadMoreMessages} disabled={loading}>
              이전 메시지 보기
            </button>
          </div>
        )}
        
        {messages.map((msg, index) => {
          // 메시지의 고유 키 생성
          const messageKey = msg.id || msg.tempId || `${msg.userId}-${msg.timestamp}-${index}`;
          
          return (
            <React.Fragment key={messageKey}>
              {shouldShowDateDivider(msg, messages[index - 1]) && (
                <div className="date-divider">
                  <span>
                    {new Date(msg.created_at || msg.timestamp).toLocaleDateString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
              )}
              
              <div 
                className={`message ${msg.userId === user?.id || msg.user_id === user?.id ? 'own-message' : ''} ${msg.isPending ? 'pending' : ''}`}
              >
                <div className="message-header">
                  <span className="message-user">
                    {msg.userName || msg.users?.display_name || msg.users?.username}
                  </span>
                  <span className="message-time">
                    {formatTime(msg.created_at || msg.timestamp)}
                  </span>
                  {msg.isPending && (
                    <span className="message-status pending" title="전송 중">⏳</span>
                  )}
                  {msg.saved === false && !msg.isPending && (
                    <span className="message-status error" title="저장되지 않음">⚠️</span>
                  )}
                </div>
                <div className="message-text">{msg.message}</div>
              </div>
            </React.Fragment>
          );
        })}
        
        {typingUsers.length > 0 && (
          <div className="typing-indicator">
            {typingUsers.map(u => u.userName).join(', ')} 
            {typingUsers.length === 1 ? '님이' : '님들이'} 입력 중...
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <form className="chat-input-form" onSubmit={handleSendMessage}>
        <input
          type="text"
          className="chat-input"
          placeholder="메시지를 입력하세요..."
          value={inputMessage}
          onChange={handleInputChange}
          disabled={sending}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={!inputMessage.trim() || sending}
        >
          {sending ? '전송 중...' : '전송'}
        </button>
      </form>
    </div>
  );
}

export default ChatBox;