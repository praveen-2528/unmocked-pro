import { create } from 'zustand';

const useChatStore = create((set, get) => ({
  unreadFriendCount: 0,
  unreadMatchCount: 0,
  pendingFriendRequests: 0,
  
  activeRoomCode: null,
  lobbyMessages: [],

  latestToast: null,
  toastTimer: null,
  showToast: (title, message) => set((state) => {
    if (state.toastTimer) clearTimeout(state.toastTimer);
    const timer = setTimeout(() => {
      set({ latestToast: null });
    }, 5000);
    return { latestToast: { title, message }, toastTimer: timer };
  }),

  setActiveRoomCode: (code) => set({ activeRoomCode: code }),
  addLobbyMessage: (msg) => set((state) => ({ 
    lobbyMessages: [...state.lobbyMessages, msg],
    unreadMatchCount: state.isPanelOpen && state.activeTab === 'match' ? 0 : state.unreadMatchCount + 1
  })),
  clearLobbyMessages: () => set({ lobbyMessages: [], unreadMatchCount: 0, activeRoomCode: null }),

  unreadByFriend: {},

  setUnreadFriendCount: (count) => set({ unreadFriendCount: count }),
  incrementUnreadFriendCount: (friendId) => set((state) => ({ 
    unreadFriendCount: state.unreadFriendCount + 1,
    unreadByFriend: {
      ...state.unreadByFriend,
      [friendId]: (state.unreadByFriend[friendId] || 0) + 1
    }
  })),
  clearUnreadForFriend: (friendId) => set((state) => {
    const count = state.unreadByFriend[friendId] || 0;
    return {
      unreadFriendCount: Math.max(0, state.unreadFriendCount - count),
      unreadByFriend: { ...state.unreadByFriend, [friendId]: 0 }
    };
  }),
  setPendingFriendRequests: (count) => set({ pendingFriendRequests: count }),

  // Panel state
  isPanelOpen: false,
  activeTab: 'friends', // 'friends', 'match', 'add'
  
  setPanelOpen: (isOpen) => set((state) => {
    const updates = { isPanelOpen: isOpen };
    if (isOpen) {
      if (state.activeTab === 'match') updates.unreadMatchCount = 0;
    }
    return updates;
  }),
  setActiveTab: (tab) => set((state) => {
    const updates = { activeTab: tab };
    if (state.isPanelOpen) {
      if (tab === 'match') updates.unreadMatchCount = 0;
    }
    return updates;
  }),
}));

export default useChatStore;
