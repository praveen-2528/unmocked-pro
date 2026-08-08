import React from 'react';
import { MessageCircle } from 'lucide-react';
import useChatStore from '../store/useChatStore';

export default function GlobalChatBubble() {
  const { isPanelOpen, setPanelOpen, unreadFriendCount, unreadMatchCount, pendingFriendRequests, latestToast } = useChatStore();
  
  const totalNotifications = unreadFriendCount + unreadMatchCount + pendingFriendRequests;

  return (
    <div 
      style={{
        position: 'fixed',
        bottom: '30px',
        right: '30px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'flex-end',
        gap: '16px'
      }}
    >
      {/* Toast Popup */}
      {latestToast && (
        <div className="animate-fade-in" style={{
          background: 'rgba(15, 23, 42, 0.95)',
          backdropFilter: 'blur(20px)',
          border: '1px solid var(--glass-border)',
          padding: '12px 16px',
          borderRadius: '12px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
          marginBottom: '8px',
          maxWidth: '250px'
        }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 'bold', color: 'var(--accent-color)', marginBottom: '4px' }}>{latestToast.title}</div>
          <div style={{ fontSize: '0.9rem', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{latestToast.message}</div>
        </div>
      )}

      <button
        onClick={() => setPanelOpen(!isPanelOpen)}
        style={{
          width: '60px', height: '60px',
          borderRadius: '50%',
          background: 'var(--accent-color)',
          color: 'white',
          border: 'none',
          boxShadow: '0 8px 32px rgba(37, 99, 235, 0.4)',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'transform 0.2s',
          transform: isPanelOpen ? 'scale(0.8)' : 'scale(1)'
        }}
      >
        <MessageCircle size={28} />
        
        {/* Notification Badge */}
        {totalNotifications > 0 && (
          <div style={{
            position: 'absolute',
            top: '-5px', right: '-5px',
            background: '#ef4444',
            color: 'white',
            borderRadius: '50%',
            width: '24px', height: '24px',
            fontSize: '12px', fontWeight: 'bold',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
            animation: 'pulse 2s infinite'
          }}>
            {totalNotifications > 99 ? '99+' : totalNotifications}
          </div>
        )}
      </button>
      <style>{`
        @keyframes pulse {
          0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1.1); box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
          100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
