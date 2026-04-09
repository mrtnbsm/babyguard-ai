import {
  RTCPeerConnection,
  RTCSessionDescription,
  RTCIceCandidate,
  mediaDevices,
} from 'react-native-webrtc';
import { supabase } from './supabase';

// Public Google STUN servers — enough for same-network testing.
// Add a TURN server here for cross-network reliability in production.
const ICE_CONFIG = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type Callbacks = {
  onStatus: (s: SessionStatus) => void;
  onError: (msg: string) => void;
};

// Module-level singleton so the session survives navigation between screens.
let _active: WebRTCSession | null = null;
export const getActiveSession = () => _active;

export class WebRTCSession {
  private pc: RTCPeerConnection | null = null;
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private localStream: any = null;
  private joinRetry: ReturnType<typeof setInterval> | null = null;

  constructor(
    private readonly role: 'baby' | 'parent',
    private readonly roomCode: string,
    private readonly cb: Callbacks,
  ) {}

  // ─── Public API ────────────────────────────────────────────────

  async start() {
    _active = this;
    this.cb.onStatus('connecting');
    try {
      this.pc = new RTCPeerConnection(ICE_CONFIG);
      this.wirePCEvents();
      await this.subscribeToSignaling();
      if (this.role === 'baby') {
        await this.acquireMic();
        // Baby registers the room by setting presence; waits for parent's 'join'
      } else {
        // Parent announces it has joined — baby will respond with an offer
        this.sendJoin();
        this.joinRetry = setInterval(() => this.sendJoin(), 3000);
      }
    } catch (err: any) {
      this.cb.onError(err?.message ?? 'Failed to start session');
      this.cb.onStatus('error');
    }
  }

  async stop() {
    this.clearJoinRetry();
    this.localStream?.getTracks().forEach((t: any) => t.stop());
    this.localStream = null;
    this.pc?.close();
    this.pc = null;
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (_active === this) _active = null;
  }

  // ─── PC events ─────────────────────────────────────────────────

  private wirePCEvents() {
    const pc = this.pc!;

    pc.onicecandidate = ({ candidate }: any) => {
      if (candidate) this.send('ice', { candidate: candidate.toJSON() });
    };

    pc.onconnectionstatechange = () => {
      const s = (pc as any).connectionState as string;
      if (s === 'connected') {
        this.clearJoinRetry();
        this.cb.onStatus('connected');
      } else if (s === 'failed' || s === 'closed' || s === 'disconnected') {
        this.cb.onStatus('disconnected');
      }
    };

    // Remote audio plays automatically when the track arrives — no extra wiring needed.
  }

  // ─── Signaling via Supabase Realtime ───────────────────────────

  private async subscribeToSignaling() {
    const ch = supabase.channel(`room:${this.roomCode}`, {
      config: {
        broadcast: { self: false },
        presence: { key: this.role },
      },
    });
    this.channel = ch;

    // Listen for WebRTC signals
    ch.on('broadcast', { event: 'signal' }, ({ payload }: any) =>
      this.handleSignal(payload),
    );

    // Baby: trigger offer when parent announces it has joined
    if (this.role === 'baby') {
      ch.on('broadcast', { event: 'join' }, () => this.sendOffer());
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Supabase channel timeout')), 10_000);
      ch.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(t);
          // Publish presence so the other device can detect this room is active
          await ch.track({ role: this.role, at: Date.now() });
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(t);
          reject(new Error(`Channel ${status}`));
        }
      });
    });
  }

  // ─── Baby-side: send offer ──────────────────────────────────────

  private async sendOffer() {
    if (this.role !== 'baby' || !this.pc) return;
    // Guard against duplicate offers if parent retries join
    if ((this.pc as any).signalingState !== 'stable') return;

    try {
      const offer = await this.pc.createOffer({});
      await this.pc.setLocalDescription(offer);
      this.send('signal', { kind: 'offer', sdp: (offer as any).sdp });
    } catch (err: any) {
      console.error('[WebRTC] createOffer error', err?.message);
    }
  }

  // ─── Shared: handle incoming signals ───────────────────────────

  private async handleSignal(payload: any) {
    const pc = this.pc;
    if (!pc) return;
    try {
      if (payload.kind === 'offer') {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }),
        );
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.send('signal', { kind: 'answer', sdp: (answer as any).sdp });
      } else if (payload.kind === 'answer') {
        await pc.setRemoteDescription(
          new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }),
        );
      } else if (payload.kind === 'ice') {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      }
    } catch (err: any) {
      console.error('[WebRTC] handleSignal error', err?.message);
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────

  private async acquireMic() {
    this.localStream = await (mediaDevices as any).getUserMedia({
      audio: true,
      video: false,
    });
    this.localStream.getTracks().forEach((track: any) =>
      this.pc!.addTrack(track, this.localStream),
    );
  }

  private send(event: string, payload: object) {
    this.channel?.send({ type: 'broadcast', event, payload });
  }

  private sendJoin() {
    this.send('join', {});
  }

  private clearJoinRetry() {
    if (this.joinRetry) {
      clearInterval(this.joinRetry);
      this.joinRetry = null;
    }
  }
}

// Convenience: check if a room is live (baby is in presence state).
// Called by parent-join before navigating to parent-monitor.
export async function checkRoomExists(code: string): Promise<boolean> {
  return new Promise((resolve) => {
    const ch = supabase.channel(`room:${code}`, {
      config: { presence: { key: `checker-${Date.now()}` } },
    });

    const timeout = setTimeout(() => {
      supabase.removeChannel(ch);
      resolve(false);
    }, 6000);

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState();
      const babyOnline = Object.values(state)
        .flat()
        .some((p: any) => p.role === 'baby');
      clearTimeout(timeout);
      supabase.removeChannel(ch);
      resolve(babyOnline);
    });

    ch.subscribe();
  });
}
