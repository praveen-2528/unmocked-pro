import React, { useState, useEffect, useRef } from 'react';
import { X, Search, UserPlus, Check, XCircle, MessageCircle, Send, Paperclip } from 'lucide-react';
import useAuthStore from '../store/useAuthStore';
import useChatStore from '../store/useChatStore';
import { socket } from '../socket';
import ChatWindow from './ChatWindow';

export default function FriendsPanel() {
  const currentUser = useAuthStore(state => state.user);
  const { 
    isPanelOpen, setPanelOpen, activeTab, setActiveTab, 
    setPendingFriendRequests, incrementUnreadFriendCount,
    activeRoomCode, lobbyMessages, addLobbyMessage, unreadMatchCount,
    unreadByFriend, clearUnreadForFriend, unreadFriendCount,
    showToast
  } = useChatStore();

  const [friends, setFriends] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [activeChatFriend, setActiveChatFriend] = useState(null);
  const [onlineStatus, setOnlineStatus] = useState({});
  const [matchChatInput, setMatchChatInput] = useState('');
  const [isUploadingMatch, setIsUploadingMatch] = useState(false);
  
  const matchChatEndRef = useRef(null);
  const matchFileInputRef = useRef(null);

  useEffect(() => {
    if (currentUser?.id) {
      fetchFriends();
    }
  }, [currentUser]);

  useEffect(() => {
    if (isPanelOpen && activeChatFriend) {
      clearUnreadForFriend(activeChatFriend.id);
    }
  }, [isPanelOpen, activeChatFriend]);

  useEffect(() => {
    socket.on('userStatusChanged', ({ userId, status }) => {
      setOnlineStatus(prev => ({ ...prev, [userId]: status === 'online' }));
    });
    
    // Listen for new private messages to increment badge if panel/chat is closed
    const handleNewPrivateMessage = (msg) => {
      if (msg.receiver_id === currentUser.id && (!isPanelOpen || activeChatFriend?.id !== msg.sender_id)) {
        incrementUnreadFriendCount(msg.sender_id);
        
        let displayMessage = msg.message || '';
        if (msg.file_url) {
          if (msg.file_type?.startsWith('image/')) {
            displayMessage = displayMessage ? `📷 Photo: ${displayMessage}` : '📷 Sent a photo';
          } else if (msg.file_type?.startsWith('video/')) {
            displayMessage = displayMessage ? `🎥 Video: ${displayMessage}` : '🎥 Sent a video';
          } else {
            displayMessage = displayMessage ? `📎 File: ${displayMessage}` : `📎 Sent ${msg.file_name || 'a file'}`;
          }
        }

        // Find sender's name and show toast
        const sender = friends.find(f => f.id === msg.sender_id);
        if (sender) {
          showToast(sender.name, displayMessage || 'New message');
        } else {
          showToast('New Message', displayMessage || 'New message');
        }
      }
    };
    
    // Listen for Lobby Chat Messages
    const handleLobbyMessage = (msg) => {
      addLobbyMessage(msg);
    };

    socket.on('newPrivateMessage', handleNewPrivateMessage);
    socket.on('chatMessage', handleLobbyMessage);

    return () => {
      socket.off('userStatusChanged');
      socket.off('newPrivateMessage', handleNewPrivateMessage);
      socket.off('chatMessage', handleLobbyMessage);
    };
  }, [activeChatFriend, friends, currentUser, isPanelOpen]);

  useEffect(() => {
    if (activeTab === 'match') {
      setTimeout(() => {
        matchChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    }
  }, [lobbyMessages, activeTab]);

  const fetchFriends = async () => {
    try {
      const res = await fetch(`/api/friends/${currentUser.id}`);
      const data = await res.json();
      setFriends(data);
      const pending = data.filter(f => f.status === 'pending' && f.user_id_1 !== currentUser.id).length;
      setPendingFriendRequests(pending);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    try {
      const res = await fetch('/api/users/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, currentUserId: currentUser.id })
      });
      const data = await res.json();
      setSearchResults(data);
    } catch (err) {
      console.error(err);
    }
  };

  const sendFriendRequest = async (receiverId) => {
    try {
      const res = await fetch('/api/friends/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: currentUser.id, receiverId })
      });
      if (res.ok) alert('Request sent!');
      fetchFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const handleRequest = async (friendId, action) => {
    try {
      await fetch('/api/friends/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senderId: friendId, receiverId: currentUser.id, action })
      });
      fetchFriends();
    } catch (err) {
      console.error(err);
    }
  };

  const handleSendMatchMessage = (e) => {
    e.preventDefault();
    if (!matchChatInput.trim() || !activeRoomCode) return;
    socket.emit('chatMessage', { code: activeRoomCode, user: currentUser, text: matchChatInput.trim() });
    setMatchChatInput('');
  };

  const handleMatchFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !activeRoomCode) return;

    setIsUploadingMatch(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/chat/upload', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (res.ok) {
        socket.emit('chatMessage', {
          code: activeRoomCode,
          user: currentUser,
          text: matchChatInput.trim() || 'Sent an attachment',
          fileUrl: data.fileUrl,
          fileName: data.fileName,
          fileType: data.fileType
        });
        setMatchChatInput('');
      } else {
        alert(data.error || 'Failed to upload file');
      }
    } catch (err) {
      console.error(err);
      alert('Failed to upload file');
    } finally {
      setIsUploadingMatch(false);
      if (matchFileInputRef.current) matchFileInputRef.current.value = '';
    }
  };

  const pendingRequests = friends.filter(f => f.status === 'pending' && f.user_id_1 !== currentUser.id);
  const myFriends = friends.filter(f => f.status === 'accepted');

  return (
    <>
      {/* Floating Panel Widget */}
      <div style={{
        position: 'fixed',
        bottom: isPanelOpen ? '110px' : '-600px',
        right: '30px',
        width: '360px', height: '550px',
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(20px)',
        border: '1px solid var(--glass-border)',
        borderRadius: '16px',
        zIndex: 9998,
        transition: 'bottom 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease, visibility 0.3s',
        opacity: isPanelOpen ? 1 : 0,
        visibility: isPanelOpen ? 'visible' : 'hidden',
        pointerEvents: isPanelOpen ? 'auto' : 'none',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        overflow: 'hidden'
      }}>
        {activeChatFriend ? (
          <ChatWindow 
            friend={activeChatFriend} 
            onClose={() => setActiveChatFriend(null)} 
            currentUser={currentUser} 
          />
        ) : (
          <>
            {/* Header */}
            <div style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ margin: 0, color: 'var(--text-primary)', fontSize: '1.2rem' }}>Chat</h2>
              <button onClick={() => setPanelOpen(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                <X size={24} />
              </button>
            </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)' }}>
          {activeRoomCode && (
            <button 
              onClick={() => setActiveTab('match')}
              style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'match' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'match' ? '2px solid var(--accent-color)' : 'none', position: 'relative' }}
            >
              In Match
              {unreadMatchCount > 0 && activeTab !== 'match' && (
                <span style={{ position: 'absolute', top: '8px', right: '16px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {unreadMatchCount}
                </span>
              )}
            </button>
          )}
          <button 
            onClick={() => setActiveTab('friends')}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'friends' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'friends' ? '2px solid var(--accent-color)' : 'none', position: 'relative' }}
          >
            Friends
            {unreadFriendCount > 0 && activeTab !== 'friends' && (
              <span style={{ position: 'absolute', top: '8px', right: '16px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {unreadFriendCount}
              </span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('add')}
            style={{ flex: 1, padding: '12px', background: 'transparent', border: 'none', color: activeTab === 'add' ? 'var(--accent-color)' : 'var(--text-secondary)', fontWeight: 'bold', cursor: 'pointer', borderBottom: activeTab === 'add' ? '2px solid var(--accent-color)' : 'none', position: 'relative' }}
          >
            Add
            {pendingRequests.length > 0 && (
              <span style={{ position: 'absolute', top: '8px', right: '16px', background: '#ef4444', color: 'white', borderRadius: '50%', width: '16px', height: '16px', fontSize: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {pendingRequests.length}
              </span>
            )}
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          
          {/* Match Chat Tab */}
          {activeTab === 'match' && (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <div style={{ flex: 1, padding: '16px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {lobbyMessages.length === 0 && <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No messages in match yet.</p>}
                {lobbyMessages.map((msg, idx) => {
                  const isMe = msg.user.id === currentUser.id;
                  return (
                    <div key={idx} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                      {!isMe && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '2px', marginLeft: '4px' }}>{msg.user.name}</div>}
                      <div style={{
                        background: isMe ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)',
                        color: isMe ? '#fff' : 'var(--text-primary)',
                        padding: '8px 12px',
                        borderRadius: '12px',
                        borderBottomRightRadius: isMe ? '2px' : '12px',
                        borderBottomLeftRadius: !isMe ? '2px' : '12px',
                        fontSize: '0.9rem'
                      }}>
                        {msg.text && (
                          <div style={{
                            fontStyle: msg.text === 'Sent an attachment' ? 'italic' : 'normal',
                            color: msg.text === 'Sent an attachment' ? (isMe ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)') : 'inherit',
                            fontSize: msg.text === 'Sent an attachment' ? '0.8rem' : 'inherit'
                          }}>
                            {msg.text}
                          </div>
                        )}
                        {msg.fileUrl && (
                          <div style={{ marginTop: msg.text ? '8px' : '0' }}>
                            {msg.fileType?.startsWith('image/') ? (
                              <img src={msg.fileUrl} alt={msg.fileName} style={{ maxWidth: '100%', borderRadius: '8px' }} />
                            ) : msg.fileType?.startsWith('video/') ? (
                              <video src={msg.fileUrl} controls style={{ maxWidth: '100%', borderRadius: '8px' }} />
                            ) : (
                              <a href={msg.fileUrl} download style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '8px 12px', borderRadius: '8px', color: 'inherit', textDecoration: 'none', fontSize: '0.8rem' }}>
                                <Paperclip size={14} /> {msg.fileName || 'Download Attachment'}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                <div ref={matchChatEndRef} />
              </div>
              
              <input type="file" ref={matchFileInputRef} style={{ display: 'none' }} onChange={handleMatchFileUpload} />
              <form onSubmit={handleSendMatchMessage} style={{ padding: '12px', borderTop: '1px solid var(--glass-border)', display: 'flex', gap: '8px', background: 'rgba(0,0,0,0.2)', alignItems: 'center' }}>
                <button type="button" onClick={() => matchFileInputRef.current?.click()} disabled={isUploadingMatch} style={{
                  background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: isUploadingMatch ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  <Paperclip size={20} />
                </button>
                <input
                  type="text"
                  placeholder={isUploadingMatch ? "Uploading..." : "Chat with match..."}
                  value={matchChatInput}
                  onChange={e => setMatchChatInput(e.target.value)}
                  style={{ flex: 1, padding: '8px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid var(--glass-border)', borderRadius: '20px', color: 'var(--text-primary)', outline: 'none' }}
                />
                <button type="submit" disabled={!matchChatInput.trim()} style={{ background: matchChatInput.trim() ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: matchChatInput.trim() ? 'pointer' : 'not-allowed' }}>
                  <Send size={16} style={{ marginLeft: '2px' }} />
                </button>
              </form>
            </div>
          )}

          {/* Friends Tab */}
          {activeTab === 'friends' && (
            <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {myFriends.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>No friends yet. Start adding some!</p>
              ) : (
                myFriends.map(friend => (
                  <div key={friend.id} onClick={() => { setActiveChatFriend(friend); clearUnreadForFriend(friend.id); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.2s' }}>
                    <div style={{ position: 'relative' }}>
                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--accent-color)', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold' }}>
                        {friend.name.charAt(0).toUpperCase()}
                      </div>
                      <div style={{ position: 'absolute', bottom: 0, right: 0, width: '10px', height: '10px', borderRadius: '50%', background: onlineStatus[friend.id] ? '#22c55e' : '#94a3b8', border: '2px solid #0f172a' }}></div>
                    </div>
                    <div style={{ flex: 1 }}>
                      <strong style={{ color: 'var(--text-primary)', display: 'block' }}>{friend.name}</strong>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{onlineStatus[friend.id] ? 'Online' : 'Offline'}</span>
                    </div>
                    {unreadByFriend[friend.id] > 0 && (
                      <span style={{ background: '#ef4444', color: 'white', borderRadius: '50%', padding: '2px 8px', fontSize: '12px', fontWeight: 'bold' }}>
                        {unreadByFriend[friend.id]}
                      </span>
                    )}
                    <MessageCircle size={20} color="var(--accent-color)" />
                  </div>
                ))
              )}
            </div>
          )}

          {/* Add Friend Tab */}
          {activeTab === 'add' && (
            <div style={{ padding: '20px' }}>
              {pendingRequests.length > 0 && (
                <div style={{ marginBottom: '24px' }}>
                  <h3 style={{ color: 'var(--text-primary)', fontSize: '1rem', marginBottom: '12px' }}>Pending Requests</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {pendingRequests.map(req => (
                      <div key={req.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                        <span style={{ color: 'var(--text-primary)' }}>{req.name}</span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button onClick={() => handleRequest(req.id, 'accept')} style={{ background: '#22c55e', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}><Check size={16} /></button>
                          <button onClick={() => handleRequest(req.id, 'reject')} style={{ background: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', padding: '4px', cursor: 'pointer' }}><XCircle size={16} /></button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSearch} style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
                <input 
                  type="text" 
                  placeholder="Search by name or email" 
                  className="input-field" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={{ padding: '8px 12px' }}
                />
                <button type="submit" className="btn btn-primary" style={{ padding: '8px 12px' }}><Search size={16} /></button>
              </form>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {searchResults.map(user => {
                  const isFriend = friends.some(f => f.id === user.id);
                  return (
                    <div key={user.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
                      <span style={{ color: 'var(--text-primary)' }}>{user.name}</span>
                      {!isFriend ? (
                        <button onClick={() => sendFriendRequest(user.id)} style={{ background: 'var(--accent-color)', color: 'white', border: 'none', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <UserPlus size={14} /> Add
                        </button>
                      ) : (
                        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>Added</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </>
    )}
  </div>
</>
  );
}
