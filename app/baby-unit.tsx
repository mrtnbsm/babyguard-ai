import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { Audio } from 'expo-av';
import { useKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import { useMonitorStore } from '@/stores/monitor-store';
import { useConnectionStore } from '@/stores/connection-store';
import { WebRTCSession, SessionStatus } from '@/lib/webrtc';

const NUM_BARS = 7;
const BAR_DURATIONS = [420, 510, 380, 600, 450, 530, 400];

export default function BabyUnitScreen() {
  useKeepAwake();

  const roomId    = useMonitorStore((s) => s.roomId);
  const setStatus = useConnectionStore((s) => s.setStatus);

  const [camPermission,   requestCamPermission]   = useCameraPermissions();
  const [audioPermission, requestAudioPermission] = Audio.usePermissions();
  const [sessionStatus,   setSessionStatus]       = useState<SessionStatus>('connecting');
  const [facing,          setFacing]              = useState<'back' | 'front'>('back');
  const sessionRef = useRef<WebRTCSession | null>(null);

  // ─── Animations ─────────────────────────────────────────────────────────────

  const rippleScale   = useRef(new Animated.Value(1)).current;
  const rippleOpacity = useRef(new Animated.Value(0.6)).current;

  const waveAnims = useRef(
    Array.from({ length: NUM_BARS }, (_, i) => new Animated.Value(i % 2 === 0 ? 0.1 : 0.5))
  ).current;

  const fadeIn   = useRef(new Animated.Value(0)).current;
  const slideUp  = useRef(new Animated.Value(20)).current;

  // Card fades out after connection is established
  const cardOpacity = useRef(new Animated.Value(1)).current;
  const cardFaded   = useRef(false);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 600, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 600, useNativeDriver: true }),
    ]).start();

    // Ripple pulse — always running, visible only when connected
    Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(rippleScale,   { toValue: 2.6, duration: 1400, useNativeDriver: true }),
          Animated.timing(rippleScale,   { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(rippleOpacity, { toValue: 0,   duration: 1400, useNativeDriver: true }),
          Animated.timing(rippleOpacity, { toValue: 0.6, duration: 0,    useNativeDriver: true }),
        ]),
      ])
    ).start();
  }, []);

  // Wave bars — only animate when connected
  useEffect(() => {
    const isConnected = sessionStatus === 'connected';

    if (!isConnected) {
      waveAnims.forEach((a) =>
        Animated.timing(a, { toValue: 0.1, duration: 300, useNativeDriver: false }).start()
      );
      return;
    }

    // Fade out the code card 5 s after connecting (only once)
    if (!cardFaded.current) {
      cardFaded.current = true;
      setTimeout(() => {
        Animated.timing(cardOpacity, { toValue: 0, duration: 800, useNativeDriver: true }).start();
      }, 5000);
    }

    const anims = waveAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1,   duration: BAR_DURATIONS[i], useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.1, duration: BAR_DURATIONS[i], useNativeDriver: false }),
        ])
      )
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [sessionStatus]);

  // ─── Permissions & session ───────────────────────────────────────────────────

  useEffect(() => {
    if (camPermission   && !camPermission.granted)   requestCamPermission();
  }, [camPermission?.granted]);

  useEffect(() => {
    if (audioPermission && !audioPermission.granted) requestAudioPermission();
  }, [audioPermission?.granted]);

  useEffect(() => {
    const session = new WebRTCSession('baby', roomId, {
      onStatus: (s) => {
        setSessionStatus(s);
        setStatus(s === 'connected' ? 'connected' : s === 'connecting' ? 'connecting' : 'disconnected');
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
  const isConnected = sessionStatus === 'connected';
  const statusColor = isConnected ? '#7DD3A0' : '#F5C06E';
  const statusLabel = STATUS_LABEL[sessionStatus] ?? 'Waiting\u2026';

  return (
    <View style={styles.container}>
      {/* Camera feed — back-facing by default */}
      {cameraReady
        ? <CameraView key={facing} style={StyleSheet.absoluteFill} facing={facing} />
        : <View style={[StyleSheet.absoluteFill, styles.camFallback]} />
      }

      {/* Dark overlay */}
      <View style={[StyleSheet.absoluteFill, styles.overlay]} />

      {/* ── Top bar: status pill (left) + flip button (right) ── */}
      <Animated.View style={[styles.topBar, { opacity: fadeIn }]}>
        {/* Status pill */}
        <View style={[styles.statusPill, { borderColor: statusColor + '40' }]}>
          <View style={styles.dotWrap}>
            <Animated.View
              style={[
                styles.dotRipple,
                { backgroundColor: statusColor,
                  transform: [{ scale: rippleScale }],
                  opacity: isConnected ? rippleOpacity : 0 },
              ]}
            />
            <View style={[styles.dot, { backgroundColor: statusColor }]} />
          </View>
          <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
        </View>

        {/* Camera flip button */}
        <TouchableOpacity
          style={styles.flipBtn}
          onPress={() => setFacing((f) => (f === 'back' ? 'front' : 'back'))}
          activeOpacity={0.7}
        >
          <Text style={styles.flipIcon}>🔄</Text>
        </TouchableOpacity>
      </Animated.View>

      {/* ── Room code card — sits near top, fades out after connection ── */}
      <Animated.View
        style={[styles.cardWrap, { opacity: Animated.multiply(fadeIn, cardOpacity) }]}
        pointerEvents="none"
      >
        <View style={styles.card}>
          <Text style={styles.cardLabel}>ROOM CODE</Text>
          <Text style={styles.codeValue}>{roomId}</Text>
          <Text style={styles.cardHint}>Show this to the parent device</Text>

          {/* Wave bars */}
          <View style={styles.waveRow}>
            {waveAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height:  anim.interpolate({ inputRange: [0, 1], outputRange: [5, 24] }),
                    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
                    backgroundColor: isConnected ? '#7DD3A0' : 'rgba(255,255,255,0.25)',
                  },
                ]}
              />
            ))}
          </View>
          <Text style={styles.waveLabel}>
            {isConnected ? 'Streaming audio  \u25cf' : 'Waiting for parent\u2026'}
          </Text>
        </View>
      </Animated.View>

      {/* ── Stop button ── */}
      <Animated.View style={[styles.stopWrap, { opacity: fadeIn }]}>
        <TouchableOpacity style={styles.stopBtn} onPress={handleStop} activeOpacity={0.75}>
          <Text style={styles.stopText}>Stop Monitoring</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const STATUS_LABEL: Record<SessionStatus, string> = {
  connecting:   'Waiting for parent\u2026',
  connected:    'Parent connected',
  disconnected: 'Disconnected',
  error:        'Connection error',
};

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#000' },
  camFallback: { backgroundColor: '#050D1A' },
  overlay:     { backgroundColor: 'rgba(5,13,26,0.50)' },

  // Top bar — row with pill on left, flip on right
  topBar: {
    position: 'absolute',
    top: 56,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,0,0,0.50)',
    borderWidth: 1,
    borderRadius: 100,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  dotWrap:    { width: 10, height: 10, alignItems: 'center', justifyContent: 'center' },
  dot:        { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
  dotRipple:  { width: 8, height: 8, borderRadius: 4, position: 'absolute' },
  statusText: { fontSize: 13, fontWeight: '600' },

  flipBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.50)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  flipIcon: { fontSize: 18 },

  // Code card — anchored near top, compact
  cardWrap: {
    position: 'absolute',
    top: 120,
    left: 24,
    right: 24,
  },
  card: {
    backgroundColor: 'rgba(11,20,38,0.78)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 20,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  cardLabel: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 3,
  },
  codeValue: {
    color: '#F5C06E',
    fontSize: 44,
    fontWeight: 'bold',
    letterSpacing: 10,
  },
  cardHint: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 6,
  },

  // Wave
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 28,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  waveLabel: {
    color: 'rgba(255,255,255,0.28)',
    fontSize: 11,
    letterSpacing: 0.3,
  },

  // Stop button
  stopWrap: {
    position: 'absolute',
    bottom: 44,
    left: 24,
    right: 24,
  },
  stopBtn: {
    backgroundColor: 'rgba(232,83,74,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(232,83,74,0.35)',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
  },
  stopText: { color: '#E8534A', fontSize: 16, fontWeight: '600' },
});
