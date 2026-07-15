import { create } from 'zustand';

const getInitialUser = () => {
  try {
    const item = localStorage.getItem('unmocked_user');
    if (!item || item === 'undefined') return {};
    return JSON.parse(item);
  } catch (e) {
    return {};
  }
};

const useAuthStore = create((set) => ({
  user: getInitialUser(),
  setUser: (userData) => {
    localStorage.setItem('unmocked_user', JSON.stringify(userData));
    set({ user: userData });
  },
  logout: () => {
    localStorage.removeItem('unmocked_user');
    set({ user: {} });
  }
}));

export default useAuthStore;
