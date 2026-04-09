import { create } from 'zustand';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

type ConnectionStore = {
  status: ConnectionStatus;
  roomId: string | null;
  lastPingAt: number | null;
  setStatus: (status: ConnectionStatus) => void;
  setRoomId: (roomId: string) => void;
  updatePing: () => void;
  reset: () => void;
};

export const useConnectionStore = create<ConnectionStore>((set) => ({
  status: 'disconnected',
  roomId: null,
  lastPingAt: null,
  setStatus: (status) => set({ status }),
  setRoomId: (roomId) => set({ roomId }),
  updatePing: () => set({ lastPingAt: Date.now() }),
  reset: () => set({ status: 'disconnected', roomId: null, lastPingAt: null }),
}));
