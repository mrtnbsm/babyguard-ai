import { useEffect, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, Animated,
} from 'react-native';
import { router } from 'expo-router';
import { checkRoomExists } from '@/lib/webrtc';

const KEYS = ['1','2','3','4','5','6','7','8','9','','0','⌫'];

export default function ParentJoinScreen() {
  const [code,     setCode]     = useState('');
  const [checking, setChecking] = useState(false);
  const [error,    setError]    = useState<string | null>(null);

  const fadeIn  = useRef(new Animated.Value(0)).current;
  const slideUp = useRef(new Animated.Value(20)).current;
  // Shake animation for wrong code
  const shake = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 500, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 500, useNativeDriver: true }),
    ]).start();
  }, []);

  function triggerShake() {
    Animated.sequence([
      Animated.timing(shake, { toValue:  8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -8, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue:  6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue: -6, duration: 60, useNativeDriver: true }),
      Animated.timing(shake, { toValue:  0, duration: 60, useNativeDriver: true }),
    ]).start();
  }

  function pressKey(key: string) {
    setError(null);
    if (key === '⌫') {
      setCode((c) => c.slice(0, -1));
    } else if (code.length < 6) {
      setCode((c) => c + key);
    }
  }

  async function handleConnect() {
    if (code.length < 6) return;
    setChecking(true);
    setError(null);
    try {
      const exists = await checkRoomExists(code);
      if (!exists) {
        setError('Room not found — is the baby device running?');
        setCode('');
        triggerShake();
        return;
      }
      router.push({ pathname: '/parent-monitor', params: { code } });
    } catch {
      setError('Could not reach server. Check your connection.');
      triggerShake();
    } finally {
      setChecking(false);
    }
  }

  const slots = Array.from({ length: 6 }, (_, i) => code[i] ?? '');
  const canConnect = code.length === 6 && !checking;

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.inner, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}>

        {/* Back */}
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} activeOpacity={0.7}>
          <Text style={styles.backText}>‹  Back</Text>
        </TouchableOpacity>

        <Text style={styles.title}>Enter Room Code</Text>
        <Text style={styles.subtitle}>
          Type the 6-digit code shown on the baby's device.
        </Text>

        {/* Digit slots with shake on error */}
        <Animated.View style={[styles.slots, { transform: [{ translateX: shake }] }]}>
          {slots.map((digit, i) => (
            <View key={i} style={[styles.slot, digit ? styles.slotFilled : null]}>
              <Text style={styles.slotText}>{digit || ' '}</Text>
            </View>
          ))}
        </Animated.View>

        {/* Error message */}
        <View style={styles.errorWrap}>
          {error && <Text style={styles.errorText}>{error}</Text>}
        </View>

        {/* Number pad */}
        <View style={styles.pad}>
          {KEYS.map((key, i) => {
            if (key === '') return <View key={i} style={styles.keyEmpty} />;
            const isDel = key === '⌫';
            return (
              <TouchableOpacity
                key={i}
                style={[styles.key, isDel && styles.keyDel]}
                onPress={() => pressKey(key)}
                activeOpacity={0.55}
              >
                <Text style={[styles.keyText, isDel && styles.keyDelText]}>{key}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Connect button */}
        <TouchableOpacity
          style={[styles.connectBtn, !canConnect && styles.connectBtnDisabled]}
          disabled={!canConnect}
          onPress={handleConnect}
          activeOpacity={0.85}
        >
          {checking
            ? <ActivityIndicator color="#0B1426" />
            : <Text style={styles.connectText}>Connect</Text>
          }
        </TouchableOpacity>

      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1426',
  },
  inner: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 36,
  },

  backBtn:  { marginBottom: 28 },
  backText: { color: '#F5C06E', fontSize: 16, fontWeight: '500' },

  title: {
    color: '#FFFFFF',
    fontSize: 30,
    fontWeight: 'bold',
    letterSpacing: -0.4,
    marginBottom: 8,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.40)',
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 36,
  },

  // Digit slots
  slots: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
    marginBottom: 12,
  },
  slot: {
    width: 48,
    height: 60,
    borderRadius: 14,
    backgroundColor: '#0D1935',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.09)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotFilled: {
    borderColor: '#F5C06E',
    backgroundColor: 'rgba(245,192,110,0.07)',
  },
  slotText: {
    color: '#F5C06E',
    fontSize: 26,
    fontWeight: 'bold',
  },

  errorWrap: { height: 22, alignItems: 'center', marginBottom: 16 },
  errorText: { color: '#E8534A', fontSize: 13 },

  // Keypad
  pad: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 28,
  },
  key: {
    width: 82,
    height: 66,
    borderRadius: 18,
    backgroundColor: '#0D1935',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)',
  },
  keyEmpty: { width: 82, height: 66 },
  keyDel: {
    backgroundColor: 'rgba(232,83,74,0.12)',
    borderColor: 'rgba(232,83,74,0.22)',
  },
  keyText:    { color: '#FFFFFF', fontSize: 24, fontWeight: '500' },
  keyDelText: { color: '#E8534A' },

  // Connect
  connectBtn: {
    backgroundColor: '#F5C06E',
    borderRadius: 18,
    paddingVertical: 18,
    alignItems: 'center',
    marginTop: 'auto',
  },
  connectBtnDisabled: { opacity: 0.30 },
  connectText: { color: '#0B1426', fontSize: 17, fontWeight: '700' },
});
