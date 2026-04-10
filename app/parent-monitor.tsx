import { useEffect, useRef, useState, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  Alert, Animated, PanResponder,
} from 'react-native';
import { useLocalSearchParams, router } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useConnectionStore } from '@/stores/connection-store';
import { WebRTCSession, SessionStatus } from '@/lib/webrtc';

const NUM_BARS = 13;
const BAR_DURATIONS = [520, 680, 440, 600, 480, 740, 400, 660, 500, 580, 620, 460, 700];

// ─── Sensitivity Slider ───────────────────────────────────────────────────────

const SLIDER_MIN  = 0.2;
const SLIDER_MAX  = 1.0;
const THUMB_SIZE  = 24;

function SensitivitySlider({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const trackWidthRef = useRef(0);
  const [thumbLeft, setThumbLeft] = useState(0);

  function positionFromValue(v: number, trackW: number): number {
    const usable = Math.max(0, trackW - THUMB_SIZE);
    return ((v - SLIDER_MIN) / (SLIDER_MAX - SLIDER_MIN)) * usable;
  }

  useEffect(() => {
    if (trackWidthRef.current > 0) {
      setThumbLeft(positionFromValue(value, trackWidthRef.current));
    }
  }, [value]);

  function handleMove(x: number) {
    const trackW = trackWidthRef.current;
    const usable = Math.max(1, trackW - THUMB_SIZE);
    const clamped = Math.max(0, Math.min(x - THUMB_SIZE / 2, usable));
    setThumbLeft(clamped);
    const v = SLIDER_MIN + (clamped / usable) * (SLIDER_MAX - SLIDER_MIN);
    onChange(Math.round(v * 20) / 20); // snap to 0.05 steps
  }

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder:  () => true,
      onPanResponderGrant: (e) => handleMove(e.nativeEvent.locationX),
      onPanResponderMove:  (e) => handleMove(e.nativeEvent.locationX),
    })
  ).current;

  const fillWidth = Math.max(0, thumbLeft + THUMB_SIZE / 2);

  return (
    <View
      style={sliderStyles.container}
      onLayout={(e) => {
        trackWidthRef.current = e.nativeEvent.layout.width;
        setThumbLeft(positionFromValue(value, e.nativeEvent.layout.width));
      }}
      {...panResponder.panHandlers}
    >
      <View style={sliderStyles.trackBg} />
      <View style={[sliderStyles.trackFill, { width: fillWidth }]} />
      <View style={[sliderStyles.thumb, { left: thumbLeft }]} />
    </View>
  );
}

const sliderStyles = StyleSheet.create({
  container: {
    height: THUMB_SIZE,
    justifyContent: 'center',
    position: 'relative',
  },
  trackBg: {
    position: 'absolute',
    left: 0, right: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  trackFill: {
    position: 'absolute',
    left: 0,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#F5C06E',
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: '#F5C06E',
    borderWidth: 3,
    borderColor: '#0B1426',
    shadowColor: '#F5C06E',
    shadowOpacity: 0.4,
    shadowRadius: 4,
    elevation: 4,
  },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function ParentMonitorScreen() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const setStatus = useConnectionStore((s) => s.setStatus);

  const [sessionStatus, setSessionStatus] = useState<SessionStatus>('connecting');
  const [alertActive, setAlertActive]     = useState(false);
  const [threshold,   setThreshold]       = useState(0.6);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const sessionRef = useRef<WebRTCSession | null>(null);

  const isConnected = sessionStatus === 'connected';

  // ─── Volume tracking (all ref-based to avoid stale closures) ────────────────

  const thresholdRef        = useRef(0.6);
  const aboveThresholdSince = useRef<number | null>(null);
  const belowThresholdSince = useRef<number | null>(null);
  const alertActiveRef      = useRef(false);

  useEffect(() => { thresholdRef.current = threshold; }, [threshold]);

  // Reset alert state on disconnect
  useEffect(() => {
    if (sessionStatus !== 'connected') {
      alertActiveRef.current = false;
      setAlertActive(false);
      aboveThresholdSince.current = null;
      belowThresholdSince.current = null;
    }
  }, [sessionStatus]);

  const processVolume = useCallback((vol: number) => {
    const now    = Date.now();
    const thresh = thresholdRef.current;

    if (vol >= thresh) {
      belowThresholdSince.current = null;
      if (aboveThresholdSince.current === null) {
        aboveThresholdSince.current = now;
      } else if (!alertActiveRef.current && now - aboveThresholdSince.current >= 2000) {
        alertActiveRef.current = true;
        setAlertActive(true);
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      }
    } else {
      aboveThresholdSince.current = null;
      if (!alertActiveRef.current) {
        belowThresholdSince.current = null;
        return;
      }
      if (belowThresholdSince.current === null) {
        belowThresholdSince.current = now;
      } else if (now - belowThresholdSince.current >= 3000) {
        alertActiveRef.current      = false;
        belowThresholdSince.current = null;
        setAlertActive(false);
      }
    }
  }, []); // stable — only uses refs

  // ─── Animations ─────────────────────────────────────────────────────────────

  const waveAnims = useRef(
    Array.from({ length: NUM_BARS }, (_, i) => new Animated.Value(i % 3 === 0 ? 0.6 : 0.15))
  ).current;

  const dotRippleScale   = useRef(new Animated.Value(1)).current;
  const dotRippleOpacity = useRef(new Animated.Value(0.6)).current;
  const fadeIn           = useRef(new Animated.Value(0)).current;
  const slideUp          = useRef(new Animated.Value(24)).current;
  const bannerY          = useRef(new Animated.Value(16)).current;
  const bannerOpacity    = useRef(new Animated.Value(0)).current;
  const pulseScale       = useRef(new Animated.Value(1)).current;
  const settingsOpacity  = useRef(new Animated.Value(0)).current;
  const settingsY        = useRef(new Animated.Value(-8)).current;

  // Entrance
  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 700, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 700, useNativeDriver: true }),
    ]).start();
  }, []);

  // Wave bars
  useEffect(() => {
    if (!isConnected) {
      waveAnims.forEach((a) =>
        Animated.timing(a, { toValue: 0.1, duration: 500, useNativeDriver: false }).start()
      );
      return;
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
  }, [isConnected]);

  // Dot ripple
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

  // Banner entrance
  useEffect(() => {
    if (!isConnected) return;
    Animated.parallel([
      Animated.timing(bannerOpacity, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(bannerY,       { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();
  }, [isConnected]);

  // Alert pulse
  useEffect(() => {
    if (!alertActive) {
      pulseScale.stopAnimation();
      Animated.timing(pulseScale, { toValue: 1, duration: 200, useNativeDriver: true }).start();
      return;
    }
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseScale, { toValue: 1.025, duration: 500, useNativeDriver: true }),
        Animated.timing(pulseScale, { toValue: 1,     duration: 500, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [alertActive]);

  // Settings panel slide-in
  useEffect(() => {
    Animated.parallel([
      Animated.timing(settingsOpacity, {
        toValue: settingsVisible ? 1 : 0, duration: 220, useNativeDriver: true,
      }),
      Animated.timing(settingsY, {
        toValue: settingsVisible ? 0 : -8, duration: 220, useNativeDriver: true,
      }),
    ]).start();
  }, [settingsVisible]);

  // ─── Session ─────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!code) return;
    const session = new WebRTCSession('parent', code, {
      onStatus: (s) => {
        setSessionStatus(s);
        setStatus(s === 'connected' ? 'connected' : s === 'connecting' ? 'connecting' : 'disconnected');
      },
      onError:  (msg) => Alert.alert('Connection error', msg),
      onVolume: processVolume,
    });
    sessionRef.current = session;
    session.start();
    return () => { session.stop(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleDisconnect() {
    sessionRef.current?.stop();
    router.back();
  }

  // ─── Derived display values ───────────────────────────────────────────────────

  const dotColor        = isConnected ? '#7DD3A0' : '#F5C06E';
  const bannerBg        = alertActive ? 'rgba(245,192,110,0.14)' : 'rgba(125,211,160,0.12)';
  const bannerBorder    = alertActive ? 'rgba(245,192,110,0.35)' : 'rgba(125,211,160,0.25)';
  const bannerTextColor = alertActive ? '#F5C06E' : '#7DD3A0';
  const bannerLabel     = alertActive ? '\uD83D\uDD0A  Sound detected!' : '\uD83D\uDE34  Baby is sleeping';
  const bannerSub       = alertActive ? 'Activity detected in room' : 'All quiet \u2014 resting peacefully';

  const sensitivityLabel =
    threshold <= 0.35 ? 'Very sensitive' :
    threshold <= 0.55 ? 'Sensitive'      :
    threshold <= 0.70 ? 'Moderate'       :
    threshold <= 0.85 ? 'Low'            : 'Minimal';

  return (
    <View style={styles.container}>

      {/* ── Gear button (top-right) ── */}
      <Animated.View style={[styles.gearWrap, { opacity: fadeIn }]}>
        <TouchableOpacity
          style={[styles.gearBtn, settingsVisible && styles.gearBtnActive]}
          onPress={() => setSettingsVisible((v) => !v)}
          activeOpacity={0.7}
        >
          <Text style={styles.gearIcon}>⚙️</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.View style={[styles.content, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {/* ── Status card ── */}
        <View style={styles.statusCard}>
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

        {/* ── Sensitivity settings panel ── */}
        <Animated.View
          style={[
            styles.settingsPanel,
            { opacity: settingsOpacity, transform: [{ translateY: settingsY }] },
          ]}
          pointerEvents={settingsVisible ? 'auto' : 'none'}
        >
          <View style={styles.settingsRow}>
            <Text style={styles.settingsTitle}>Alert Sensitivity</Text>
            <Text style={styles.settingsValue}>{sensitivityLabel}</Text>
          </View>
          <SensitivitySlider value={threshold} onChange={setThreshold} />
          <View style={styles.settingsHints}>
            <Text style={styles.settingsHint}>Less</Text>
            <Text style={styles.settingsHint}>More</Text>
          </View>
          <Text style={styles.settingsSub}>
            Alerts trigger after 2 s of continuous sound above threshold
          </Text>
        </Animated.View>

        {/* ── Audio status banner ── */}
        <Animated.View
          style={[
            styles.banner,
            {
              backgroundColor: bannerBg,
              borderColor: bannerBorder,
              opacity: bannerOpacity,
              transform: [{ translateY: bannerY }, { scale: pulseScale }],
            },
          ]}
        >
          <Text style={[styles.bannerText, { color: bannerTextColor }]}>{bannerLabel}</Text>
          {isConnected && (
            <Text style={[styles.bannerSub, { color: bannerTextColor }]}>{bannerSub}</Text>
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
            {isConnected ? '\uD83D\uDD0A  Raise your volume to hear clearly' : ''}
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
  connecting:   'Connecting\u2026',
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

  // Gear button
  gearWrap: {
    position: 'absolute',
    top: 56,
    right: 24,
    zIndex: 10,
  },
  gearBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  gearBtnActive: {
    backgroundColor: 'rgba(245,192,110,0.15)',
    borderColor: 'rgba(245,192,110,0.35)',
  },
  gearIcon: { fontSize: 18 },

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
    width: 16, height: 16,
    alignItems: 'center', justifyContent: 'center',
    marginBottom: 4,
  },
  dot:       { width: 12, height: 12, borderRadius: 6, position: 'absolute' },
  dotRipple: { width: 12, height: 12, borderRadius: 6, position: 'absolute' },
  statusTitle: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', letterSpacing: -0.3 },
  statusSub:   { color: 'rgba(255,255,255,0.40)', fontSize: 14, textAlign: 'center', marginBottom: 8 },
  waveRow:     { flexDirection: 'row', alignItems: 'center', gap: 4, height: 44, marginTop: 4 },
  waveBar:     { width: 4, borderRadius: 2 },

  // Settings panel
  settingsPanel: {
    backgroundColor: '#0D1935',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
    paddingVertical: 18,
    paddingHorizontal: 20,
    gap: 12,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsTitle: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  settingsValue: { color: '#F5C06E', fontSize: 13, fontWeight: '600' },
  settingsHints: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -4 },
  settingsHint:  { color: 'rgba(255,255,255,0.30)', fontSize: 11 },
  settingsSub: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 11,
    lineHeight: 16,
  },

  // Status banner
  banner: {
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 4,
  },
  bannerText: { fontSize: 16, fontWeight: '600' },
  bannerSub:  { fontSize: 13, opacity: 0.7 },

  // Room info
  infoRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 4 },
  infoLabel:     { color: 'rgba(255,255,255,0.30)', fontSize: 11, fontWeight: '700', letterSpacing: 2.5 },
  infoCodeWrap:  {
    backgroundColor: 'rgba(245,192,110,0.08)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(245,192,110,0.18)',
  },
  infoCode:      { color: '#F5C06E', fontSize: 18, fontWeight: 'bold', letterSpacing: 4 },
  volumeRow:     { paddingHorizontal: 4 },
  volumeHint:    { color: 'rgba(255,255,255,0.25)', fontSize: 13 },

  // Disconnect
  disconnectWrap: { paddingTop: 8 },
  disconnectBtn: {
    backgroundColor: 'rgba(232,83,74,0.12)',
    borderRadius: 18,
    paddingVertical: 17,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(232,83,74,0.30)',
  },
  disconnectText: { color: '#E8534A', fontSize: 16, fontWeight: '600' },
});
