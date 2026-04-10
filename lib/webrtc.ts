// Audio streaming via Supabase Realtime broadcast — no native modules required,
// works in Expo Go. Baby records 300 ms chunks and broadcasts them as base64;
// parent receives each chunk, writes a temp file, and plays it sequentially.

import { Audio, AVPlaybackStatus } from 'expo-av';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from './supabase';

// ─── Constants ─────────────────────────────────────────────────────────────────

const CHUNK_MS = 300;
const MAX_QUEUE = 5;

// Derive from the HIGH_QUALITY preset so iOS produces .m4a (MPEG4AAC) instead
// of .caf (LinearPCM). Both platforms then produce files the other can play.
// We dial down sample rate / bitrate to keep chunk sizes small (~6 KB base64).
const RECORDING_OPTIONS: Audio.RecordingOptions = {
  isMeteringEnabled: false,
  android: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.android,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  ios: {
    ...Audio.RecordingOptionsPresets.HIGH_QUALITY.ios,
    sampleRate: 16000,
    numberOfChannels: 1,
    bitRate: 32000,
  },
  web: {
    mimeType: 'audio/webm',
    bitsPerSecond: 32000,
  },
};

// ─── Types ─────────────────────────────────────────────────────────────────────

export type SessionStatus = 'connecting' | 'connected' | 'disconnected' | 'error';

type Callbacks = {
  onStatus: (s: SessionStatus) => void;
  onError: (msg: string) => void;
};

// ─── Singleton ─────────────────────────────────────────────────────────────────

let _active: WebRTCSession | null = null;
export const getActiveSession = () => _active;

// ─── Session ───────────────────────────────────────────────────────────────────

export class WebRTCSession {
  private channel: ReturnType<typeof supabase.channel> | null = null;
  private active = false;
  private queue: string[] = [];
  private draining = false;

  constructor(
    private readonly role: 'baby' | 'parent',
    private readonly roomCode: string,
    private readonly cb: Callbacks,
  ) {}

  // ─── Public ──────────────────────────────────────────────────────────────────

  async start() {
    _active = this;
    this.active = true;
    this.cb.onStatus('connecting');
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: this.role === 'baby',
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: false,
      });
      await this.joinChannel();
    } catch (err: any) {
      console.error('[BabyGuard] start() failed:', err?.message ?? err);
      this.cb.onError(err?.message ?? 'Failed to start session');
      this.cb.onStatus('error');
    }
  }

  async stop() {
    this.active = false;
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }
    if (_active === this) _active = null;
  }

  // ─── Channel ─────────────────────────────────────────────────────────────────

  private async joinChannel() {
    const MAX_ATTEMPTS = 2;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        await this.attemptSubscribe();
        return; // success — exit the retry loop
      } catch (err: any) {
        console.error(`[BabyGuard] channel attempt ${attempt}/${MAX_ATTEMPTS} failed:`, err?.message ?? err);
        if (attempt === MAX_ATTEMPTS) throw err;
        console.log('[BabyGuard] Retrying channel in 2 s…');
        await sleep(2000);
      }
    }
  }

  private async attemptSubscribe() {
    // Clean up any previous channel before creating a new one
    if (this.channel) {
      await supabase.removeChannel(this.channel);
      this.channel = null;
    }

    const ch = supabase.channel(`room:${this.roomCode}`, {
      config: {
        broadcast: { self: false, ack: false },
        presence: { key: this.role },
      },
    });
    this.channel = ch;

    ch.on('presence', { event: 'sync' }, () => {
      const state = ch.presenceState<{ role: string }>();
      const peer = this.role === 'baby' ? 'parent' : 'baby';
      const peerOnline = Object.values(state).flat().some((p: any) => p.role === peer);
      this.cb.onStatus(peerOnline ? 'connected' : 'connecting');
    });

    if (this.role === 'parent') {
      ch.on('broadcast', { event: 'audio_chunk' }, ({ payload }: any) => {
        if (payload?.data) {
          console.log(`[BabyGuard] parent received chunk, b64 len=${payload.data.length}, queue=${this.queue.length}`);
          this.enqueue(payload.data as string);
        }
      });
    }

    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('Channel connection timed out')), 15_000);
      ch.subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          clearTimeout(t);
          await ch.track({ role: this.role, at: Date.now() });
          console.log(`[BabyGuard] channel subscribed as ${this.role} in room ${this.roomCode}`);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          clearTimeout(t);
          reject(new Error(`Channel ${status}`));
        }
      });
    });

    if (this.role === 'baby') {
      this.recordLoop();
    }
  }

  // ─── Baby: record → base64 → broadcast ───────────────────────────────────────

  private async recordLoop() {
    const { granted } = await Audio.requestPermissionsAsync();
    if (!granted) {
      console.error('[BabyGuard] Microphone permission denied');
      this.cb.onError('Microphone permission denied');
      this.cb.onStatus('error');
      return;
    }

    console.log('[BabyGuard] Recording loop started');
    let chunkIndex = 0;

    while (this.active) {
      try {
        const rec = new Audio.Recording();
        await rec.prepareToRecordAsync(RECORDING_OPTIONS);
        await rec.startAsync();
        await sleep(CHUNK_MS);
        await rec.stopAndUnloadAsync();

        if (!this.active || !this.channel) break;

        const uri = rec.getURI();
        if (!uri) {
          console.warn('[BabyGuard] getURI() returned null, skipping chunk');
          continue;
        }

        const b64 = await FileSystem.readAsStringAsync(uri, {
          encoding: 'base64',
        });
        FileSystem.deleteAsync(uri, { idempotent: true }); // fire-and-forget

        chunkIndex++;
        console.log(`[BabyGuard] chunk ${chunkIndex}: ${b64.length} base64 chars, broadcasting…`);

        this.channel.send({
          type: 'broadcast',
          event: 'audio_chunk',
          payload: { data: b64 },
        });
      } catch (err: any) {
        console.error('[BabyGuard] recording error:', err?.message ?? err);
        await sleep(200); // brief pause before retrying
      }
    }

    console.log('[BabyGuard] Recording loop stopped');
  }

  // ─── Parent: queue → play sequentially ───────────────────────────────────────

  private enqueue(b64: string) {
    if (this.queue.length >= MAX_QUEUE) {
      console.warn('[BabyGuard] queue full, dropping oldest chunk');
      this.queue.shift();
    }
    this.queue.push(b64);
    if (!this.draining) this.drainQueue();
  }

  private async drainQueue() {
    this.draining = true;
    while (this.queue.length > 0 && this.active) {
      const b64 = this.queue.shift()!;
      const uri = `${FileSystem.cacheDirectory ?? ''}bg_${Date.now()}.m4a`;
      try {
        await FileSystem.writeAsStringAsync(uri, b64, {
          encoding: 'base64',
        });
        const { sound } = await Audio.Sound.createAsync(
          { uri },
          { shouldPlay: true }, // start playing immediately on load
        );
        console.log('[BabyGuard] playing chunk…');
        await new Promise<void>((resolve) => {
          // Fallback timeout — never let a bad chunk stall the queue
          const timeout = setTimeout(() => {
            sound.unloadAsync().catch(() => {});
            FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
            resolve();
          }, CHUNK_MS + 500);

          sound.setOnPlaybackStatusUpdate((s: AVPlaybackStatus) => {
            if (s.isLoaded && s.didJustFinish) {
              clearTimeout(timeout);
              sound.unloadAsync().catch(() => {});
              FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
              resolve();
            }
          });
        });
      } catch (err: any) {
        console.error('[BabyGuard] playback error:', err?.message ?? err);
        FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
      }
    }
    this.draining = false;
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function sleep(ms: number) {
  return new Promise<void>((r) => setTimeout(r, ms));
}

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
      const babyOnline = Object.values(state).flat().some((p: any) => p.role === 'baby');
      clearTimeout(timeout);
      supabase.removeChannel(ch);
      resolve(babyOnline);
    });
    ch.subscribe();
  });
}
