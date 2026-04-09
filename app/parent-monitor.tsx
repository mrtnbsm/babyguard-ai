import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useConnectionStore } from '@/stores/connection-store';
import { WebRTCSession, SessionStatus } from '@/lib/webrtc';

export default function ParentMonitorScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setStatus = useConnectionStore((s) => s.setStatus);
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('connecting');
  const sessionRef = useRef<WebRTCSession | null>(null);

  useEffect(() => {
    if (!code) return;
    const session = new WebRTCSession('parent', code, {
      onStatus: (s) => {
        setSessionStatus(s);
        setStatus(
          s === 'connected' ? 'connected'
          : s === 'connecting' ? 'connecting'
          : 'disconnected',
        );
      },
      onError: (msg) => Alert.alert('Connection error', msg),
    });
    sessionRef.current = session;
    session.start();
    return () => { session.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDisconnect() {
    sessionRef.current?.stop();
    router.back();
  }

  const isConnected = sessionStatus === 'connected';

  return (
    <View style={styles.container}>
      {/* Status card */}
      <View style={styles.statusCard}>
        <View style={[styles.statusIndicator, { backgroundColor: isConnected ? '#7DD3A0' : '#F5C06E' }]}>
          {isConnected
            ? <Text style={styles.statusIcon}>🎙️</Text>
            : <Text style={styles.statusIcon}>⏳</Text>
          }
        </View>
        <Text style={styles.statusTitle}>
          {isConnected ? 'Listening' : STATUS_LABEL[sessionStatus]}
        </Text>
        <Text style={styles.statusSub}>
          {isConnected
            ? "Audio streaming from baby\u2019s room"
            : 'Establishing connection…'}
        </Text>
      </View>

      {/* Room code */}
      <View style={styles.infoRow}>
        <Text style={styles.infoLabel}>ROOM</Text>
        <Text style={styles.infoValue}>{code}</Text>
      </View>

      {/* Audio wave (decorative when connected) */}
      {isConnected && (
        <View style={styles.waveRow}>
          {[6, 14, 20, 28, 20, 14, 10, 20, 28, 16, 8, 18, 24].map((h, i) => (
            <View key={i} style={[styles.waveBar, { height: h }]} />
          ))}
        </View>
      )}

      {/* Volume hint */}
      <Text style={styles.volumeHint}>
        {isConnected ? '🔊  Make sure your volume is turned up' : ''}
      </Text>

      <View style={styles.spacer} />

      {/* Disconnect */}
      <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect}>
        <Text style={styles.disconnectText}>Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}

const STATUS_LABEL: Partial<Record<SessionStatus, string>> = {
  connecting: 'Connecting…',
  disconnected: 'Disconnected',
  error: 'Connection failed',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1426',
    paddingHorizontal: 28,
    paddingTop: 72,
    paddingBottom: 40,
    alignItems: 'center',
  },
  statusCard: {
    width: '100%',
    backgroundColor: '#132040',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    gap: 12,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  statusIndicator: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  statusIcon: { fontSize: 32 },
  statusTitle: { color: '#FFF', fontSize: 22, fontWeight: 'bold' },
  statusSub: { color: 'rgba(255,255,255,0.45)', fontSize: 14, textAlign: 'center' },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 32,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
  },
  infoValue: {
    color: '#F5C06E',
    fontSize: 20,
    fontWeight: 'bold',
    letterSpacing: 4,
  },

  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 36,
    marginBottom: 12,
  },
  waveBar: {
    width: 4,
    backgroundColor: '#7DD3A0',
    borderRadius: 2,
    opacity: 0.8,
  },

  volumeHint: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 13,
    textAlign: 'center',
  },
  spacer: { flex: 1 },

  disconnectBtn: {
    width: '100%',
    backgroundColor: 'rgba(232,83,74,0.15)',
    borderRadius: 16,
    paddingVertical: 18,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232,83,74,0.35)',
  },
  disconnectText: { color: '#E8534A', fontSize: 16, fontWeight: '600' },
});
