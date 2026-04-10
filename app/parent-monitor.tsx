import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import { useConnectionStore } from '@/stores/connection-store';
import { WebRTCSession, SessionStatus } from '@/lib/webrtc';

const NUM_BARS = 13;
// Deterministic durations — each bar feels independent
const BAR_DURATIONS = [520, 680, 440, 600, 480, 740, 400, 660, 500, 580, 620, 460, 700];

export default function ParentMonitorScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setStatus = useConnectionStore((s) => s.setStatus);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('connecting');
  const [audioActive, setAudioActive] = useState(false);
  const sessionRef = useRef<WebRTCSession | null>(null);

  const isConnected = sessionStatus === 'connected';

  // ─── Animations ─────────────────────────────────────────────────────────────

  // Wave bars
  const waveAnims = useRef(
    Array.from({ length: NUM_BARS }, (_, i) => new Animated.Value(i % 3 === 0 ? 0.6 : 0.15))
  ).current;

  // Connection dot ripple
  const dotRippleScale   = useRef(new Animated.Value(1)).current;
  const dotRippleOpacity = useRef(new Animated.Value(0.6)).current;

  // Entrance
  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(24)).current;

  // Status banner slide
  const bannerY = useRef(new Animated.Value(16)).current;
  const bannerOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  // Wave animation — starts when connected
  useEffect(() => {
    if (!isConnected) {
      waveAnims.forEach((a) =>
        Animated.timing(a, { toValue: 0.1, duration: 500, useNativeDriver: false }).start()
      );
      return;
    }

    const anims = waveAnims.map((anim, i) => {
      const dur = BAR_DURATIONS[i];
      return Animated.loop(
        Animated.sequence([
          Animated.timing(anim, { toValue: 1,   duration: dur, useNativeDriver: false }),
          Animated.timing(anim, { toValue: 0.1, duration: dur, useNativeDriver: false }),
        ])
      );
    });
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [isConnected]);

  // Ripple pulse on connection dot
  useEffect(() => {
    if (!isConnected) return;

    const anim = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(dotRippleScale,   { toValue: 3,   duration: 1600, useNativeDriver: true }),
          Animated.timing(dotRippleScale,   { toValue: 1,   duration: 0,    useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(dotRippleOpacity, { toValue: 0,   duration: 1600, useNativeDriver: true }),
          Animated.timing(dotRippleOpacity, { toValue: 0.5, duration: 0,    useNativeDriver: true }),
        ]),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [isConnected]);

  // Banner entrance when connected
  useEffect(() => {
    if (!isConnected) return;
    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(bannerY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [isConnected]);

  // Simulated audio activity — toggles when connected (placeholder until AI classification)
  useEffect(() => {
    if (!isConnected) { setAudioActive(false); return; }

    let timeoutId: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timeoutId = setTimeout(() => {
        setAudioActive(Math.random() > 0.62); // ~38% chance of "sound detected"
        schedule();
      }, 2200 + Math.floor(Math.random() * 2800));
    };
    schedule();
    return () => clearTimeout(timeoutId);
  }, [isConnected]);

  // ─── Session ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!code) return;
    const session = new WebRTCSession('parent', code, {
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

  function handleDisconnect() {
    sessionRef.current?.stop();
    router.back();
  }

  const dotColor   = isConnected ? '#7DD3A0' : '#F5C06E';
  const bannerColor = audioActive ? 'rgba(245,192,110,0.12)' : 'rgba(125,211,160,0.12)';
  const bannerBorder = audioActive ? 'rgba(245,192,110,0.30)' : 'rgba(125,211,160,0.25)';
  const bannerTextColor = audioActive ? '#F5C06E' : '#7DD3A0';
  const bannerLabel = audioActive ? '🔊  Sound detected' : '😴  Baby is sleeping';

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {/* ── Status card ── */}
        <View style={styles.statusCard}>
          {/* Connection dot with ripple */}
          <View style={styles.dotWrap}>
            <Animated.View
              style={[
                styles.dotRipple,
                { backgroundColor: dotColor,
                  transform: [{ scale: dotRippleScale }],
                  opacity: isConnected ? dotRippleOpacity : 0 },
              ]}
            />
            <View style={[styles.dot, { backgroundColor: dotColor }]} />
          </View>

          <Text style={styles.statusTitle}>
            {isConnected ? 'Listening' : STATUS_LABEL[sessionStatus]}
          </Text>
          <Text style={styles.statusSub}>
            {isConnected ? 'Audio streaming from baby\u2019s room' : 'Establishing connection\u2026'}
          </Text>

          {/* Wave visualizer */}
          <View style={styles.waveRow}>
            {waveAnims.map((anim, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.waveBar,
                  {
                    height:  anim.interpolate({ inputRange: [0, 1], outputRange: [4, 36] }),
                    opacity: anim.interpolate({ inputRange: [0, 1], outputRange: [0.25, 1] }),
                    backgroundColor: isConnected ? '#7DD3A0' : 'rgba(255,255,255,0.15)',
                  },
                ]}
              />
            ))}
          </View>
        </View>

        {/* ── Audio status banner ── */}
        <Animated.View
          style={[
            styles.banner,
            { backgroundColor: bannerColor, borderColor: bannerBorder,
              opacity: bannerOpacity, transform: [{ translateY: bannerY }] },
          ]}
        >
          <Text style={[styles.bannerText, { color: bannerTextColor }]}>{bannerLabel}</Text>
          {isConnected && (
            <Text style={[styles.bannerSub, { color: bannerTextColor }]}>
              {audioActive ? 'Activity detected in room' : 'All quiet — resting peacefully'}
            </Text>
          )}
        </Animated.View>

        {/* ── Room info row ── */}
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>ROOM</Text>
          <View style={styles.infoCodeWrap}>
            <Text style={styles.infoCode}>{code}</Text>
          </View>
        </View>

        <View style={styles.volumeRow}>
          <Text style={styles.volumeHint}>
            {isConnected ? '🔊  Raise your volume to hear clearly' : ''}
          </Text>
        </View>

      </Animated.View>

      {/* ── Disconnect button ── */}
      <Animated.View style={[styles.disconnectWrap, { opacity: fadeIn }]}>
        <TouchableOpacity style={styles.disconnectBtn} onPress={handleDisconnect} activeOpacity={0.75}>
          <Text style={styles.disconnectText}>Disconnect</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
}

const STATUS_LABEL: Partial<Record<SessionStatus, string>> = {
  connecting:   'Connecting…',
  disconnected: 'Disconnected',
  error:        'Connection failed',
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1426',
    paddingTop: 64,
    paddingHorizontal: 24,
    paddingBottom: 36,
  },
  content: {
    flex: 1,
    gap: 14,
  },

  // Status card
  statusCard: {
    backgroundColor: '#0D1935',
    borderRadius: 28,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  dotWrap: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
  },
  dotRipple: {
    width: 12,
    height: 12,
    borderRadius: 6,
    position: 'absolute',
  },
  statusTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: 'bold',
    letterSpacing: -0.3,
  },
  statusSub: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 8,
  },

  // Wave
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 44,
    marginTop: 4,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },

  // Status banner
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 4,
  },
  bannerText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bannerSub: {
    fontSize: 13,
    opacity: 0.7,
  },

  // Room info
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 4,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.30)',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2.5,
  },
  infoCodeWrap: {
    backgroundColor: 'rgba(245,192,110,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,192,110,0.18)',
  },
  infoCode: {
    color: '#F5C06E',
    fontSize: 18,
    fontWeight: 'bold',
    letterSpacing: 4,
  },

  volumeRow: {
    paddingHorizontal: 4,
  },
  volumeHint: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 13,
  },

  // Disconnect
  disconnectWrap: {
    paddingTop: 8,
  },
  disconnectBtn: {
    backgroundColor: 'rgba(232,83,74,0.12)',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232,83,74,0.30)',
  },
  disconnectText: {
    color: '#E8534A',
    fontSize: 16,
    fontWeight: '600',
  },
});
