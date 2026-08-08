import React, { useState, useEffect, useRef } from 'react';
import { ArrowLeft, Send, Paperclip } from 'lucide-react';
import { socket } from '../socket';

export default function ChatWindow({ friend, onClose, currentUser }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [friendTyping, setFriendTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    fetchMessages();
    
    // Listen for new private messages
    const handleNewMessage = (msg) => {
      if ((msg.sender_id === friend.id && msg.receiver_id === currentUser.id) || 
          (msg.sender_id === currentUser.id && msg.receiver_id === friend.id)) {
        setMessages(prev => [...prev, msg]);
        scrollToBottom();
      }
    };

    // Listen for typing indicator
    const handleTyping = ({ senderId, isTyping }) => {
      if (senderId === friend.id) {
        setFriendTyping(isTyping);
      }
    };

    socket.on('newPrivateMessage', handleNewMessage);
    socket.on('userTyping', handleTyping);

    return () => {
      socket.off('newPrivateMessage', handleNewMessage);
      socket.off('userTyping', handleTyping);
    };
  }, [friend.id]);

  const fetchMessages = async () => {
    try {
      const res = await fetch(`/api/messages/${currentUser.id}/${friend.id}`);
      const data = await res.json();
      setMessages(data);
      scrollToBottom();
    } catch (err) {
      console.error(err);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    socket.emit('privateMessage', {
      senderId: currentUser.id,
      receiverId: friend.id,
      message: newMessage.trim()
    });

    setNewMessage('');
    handleStopTyping();
  };

  const handleTyping = (e) => {
    setNewMessage(e.target.value);
    
    if (!isTyping) {
      setIsTyping(true);
      socket.emit('typing', { senderId: currentUser.id, receiverId: friend.id, isTyping: true });
    }

    clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(handleStopTyping, 2000);
  };

  const handleStopTyping = () => {
    setIsTyping(false);
    socket.emit('typing', { senderId: currentUser.id, receiverId: friend.id, isTyping: false });
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        socket.emit('privateMessage', {
          senderId: currentUser.id,
          receiverId: friend.id,
          message: newMessage.trim() || 'Sent an attachment',
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType
        });
        setNewMessage('');
      } else {
        alert(data.error || 'Failed to upload file');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload file');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  return (
    <div style={{
      flex: 1,
      background: 'rgba(15, 23, 42, 0.95)',
      display: 'flex', flexDirection: 'column',
      height: '100%',
      width: '100%'
    }}>
      {/* Header */}
      <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)' }}>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          <ArrowLeft size={24} />
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '16px' }}>
            {friend.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <strong style={{ color: 'var(--text-primary)', fontSize: '1.1rem', display: 'block' }}>{friend.name}</strong>
            {friendTyping && <span style={{ color: 'var(--accent-color)', fontSize: '0.8rem' }}>typing...</span>}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg, idx) => {
          const isMe = msg.sender_id === currentUser.id;
          return (
            <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '80%' }}>
              <div style={{
                background: isMe ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                color: isMe ? '#ffffff' : 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: '12px',
                borderBottomRightRadius: isMe ? '2px' : '12px',
                borderBottomLeftRadius: !isMe ? '2px' : '12px',
                fontSize: '0.9rem'
              }}>
                {msg.message && (
                  <div style={{
                    fontStyle: msg.message === 'Sent an attachment' ? 'italic' : 'normal',
                    color: msg.message === 'Sent an attachment' ? (isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)') : 'inherit',
                    fontSize: msg.message === 'Sent an attachment' ? '0.8rem' : 'inherit'
                  }}>
                    {msg.message}
                  </div>
                )}
                
                {msg.file_url && (
                  <div style={{ marginTop: msg.message ? '8px' : '0' }}>
                    {msg.file_type?.startsWith('image/') ? (
                      <img src={msg.file_url} alt={msg.file_name} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                    ) : msg.file_type?.startsWith('video/') ? (
                      <video src={msg.file_url} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />
                    ) : (
                      <a href={msg.file_url} download style={{ display: 'block', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Paperclip size={14} /> {msg.file_name || 'Download Attachment'}
                      </a>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileUpload} />
      <form onSubmit={handleSendMessage} style={{ padding: '12px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '8px', background: 'rgba(255,255,255,0.02)', alignItems: 'center' }}>
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isUploading} style={{
          background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: isUploading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
        }}>
          <Paperclip size={20} />
        </button>
        <input
          type="text"
          placeholder={isUploading ? "Uploading..." : "Type a message..."}
          value={newMessage}
          onChange={handleTyping}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: 'rgba(0,0,0,0.2)',
            border: '1px solid var(--glass-border)',
            borderRadius: '20px',
            color: 'var(--text-primary)',
            outline: 'none',
            fontSize: '0.9rem'
          }}
        />
        <button type="submit" disabled={!newMessage.trim()} style={{
          background: newMessage.trim() ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: '36px', height: '36px',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: newMessage.trim() ? 'pointer' : 'not-allowed'
        }}>
          <Send size={16} style={{ marginLeft: '2px' }} />
        </button>
      </form>
    </div>
  );
}
