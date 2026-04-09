import { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useMonitorStore } from '@/stores/monitor-store';
import { useConnectionStore } from '@/stores/connection-store';
import { WebRTCSession, SessionStatus } from '@/lib/webrtc';

export default function BabyUnitScreen() {
  useKeepAwake();

  const roomId = useMonitorStore((s) => s.roomId);
  const setStatus = useConnectionStore((s) => s.setStatus);
  const [camPermission, requestCamPermission] = useCameraPermissions();
  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('connecting');
  const sessionRef = useRef<WebRTCSession | null>(null);

  // Request camera permission once
  useEffect(() => {
    if (camPermission && !camPermission.granted) requestCamPermission();
  }, [camPermission?.granted]);

  // Start WebRTC session (baby role = register room + wait for parent)
  useEffect(() => {
    const session = new WebRTCSession('baby', roomId, {
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

  function handleStop() {
    sessionRef.current?.stop();
    router.back();
  }

  const cameraReady = camPermission?.granted ?? false;
  const statusLabel = STATUS_LABEL[sessionStatus] ?? 'Waiting…';
  const statusColor = sessionStatus === 'connected' ? '#7DD3A0' : '#F5C06E';

  return (
    <View style={styles.container}>
      {/* Camera or dark fallback */}
      {cameraReady
        ? <CameraView style={StyleSheet.absoluteFill} facing="front" />
        : <View style={[StyleSheet.absoluteFill, styles.camFallback]} />
      }

      {/* Overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* Top status pill */}
      <View style={styles.topBar}>
        <View style={[styles.statusPill, { borderColor: statusColor + '44' }]}>
          <View style={[styles.dot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      {/* Centre: room code card */}
      <View style={styles.centre}>
        <Text style={styles.codeHeading}>ROOM CODE</Text>
        <Text style={styles.codeValue}>{roomId}</Text>
        <Text style={styles.codeHint}>Share this with the parent device</Text>
      </View>

      {/* Stop button */}
      <TouchableOpacity style={styles.stopBtn} onPress={handleStop}>
        <Text style={styles.stopText}>Stop Monitoring</Text>
      </TouchableOpacity>
    </View>
  );
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  connecting: 'Waiting for parent…',
  connected:  'Parent connected ✓',
  disconnected: 'Disconnected',
  error: 'Connection error',
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  camFallback: { backgroundColor: '#050D1A' },
  overlay: { backgroundColor: 'rgba(5,13,26,0.6)' },

  topBar: {
    position: 'absolute',
    top: 56,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '500' },

  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 10,
  },
  codeHeading: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  codeValue: {
    color: '#F5C06E',
    fontSize: 58,
    fontWeight: 'bold',
    letterSpacing: 12,
  },
  codeHint: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },

  stopBtn: {
    marginHorizontal: 32,
    marginBottom: 48,
    backgroundColor: 'rgba(232,83,74,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(232,83,74,0.4)',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  stopText: { color: '#E8534A', fontSize: 16, fontWeight: '600' },
});
