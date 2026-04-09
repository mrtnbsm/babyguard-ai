import { create } from 'zustand';

export type DeviceRole = 'baby' | 'parent';

export type Alert = {
  type: 'cry' | 'noise' | 'disconnect' | 'info';
  message: string;
};

type MonitorStore = {
  role: DeviceRole | null;
  roomId: string;
  soundLabel: string;
  soundVolume: number;
  activeAlert: Alert | null;
  sensitivityThreshold: number;
  setRole: (role: DeviceRole) => void;
  setRoomId: (roomId: string) => void;
  setSoundLabel: (label: string) => void;
  setSoundVolume: (volume: number) => void;
  setActiveAlert: (alert: Alert | null) => void;
  setSensitivity: (threshold: number) => void;
};

function generateRoomId(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export const useMonitorStore = create<MonitorStore>((set) => ({
  role: null,
  roomId: generateRoomId(),
  soundLabel: 'Quiet 🤫',
  soundVolume: 0,
  activeAlert: null,
  sensitivityThreshold: 0.6,
  setRole: (role) => set({ role }),
  setRoomId: (roomId) => set({ roomId }),
  setSoundLabel: (soundLabel) => set({ soundLabel }),
  setSoundVolume: (soundVolume) => set({ soundVolume }),
  setActiveAlert: (activeAlert) => set({ activeAlert }),
  setSensitivity: (sensitivityThreshold) => set({ sensitivityThreshold }),
}));
