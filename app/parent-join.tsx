import { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { checkRoomExists } from '@/lib/webrtc';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'];

export default function ParentJoinScreen() {
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        return;
      }
      router.push({ pathname: '/parent-monitor', params: { code } });
    } catch {
      setError('Could not reach Supabase. Check your connection.');
    } finally {
      setChecking(false);
    }
  }

  const slots = Array.from({ length: 6 }, (_, i) => code[i] ?? '');
  const canConnect = code.length === 6 && !checking;

  return (
    <View style={styles.container}>
      <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
        <Text style={styles.backText}>← Back</Text>
      </TouchableOpacity>

      <Text style={styles.title}>Enter Room Code</Text>
      <Text style={styles.subtitle}>Type the 6-digit code shown on the baby's device.</Text>

      {/* Digit slots */}
      <View style={styles.slots}>
        {slots.map((digit, i) => (
          <View key={i} style={[styles.slot, digit ? styles.slotFilled : null]}>
            <Text style={styles.slotText}>{digit}</Text>
          </View>
        ))}
      </View>

      {error && <Text style={styles.errorText}>{error}</Text>}

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
              activeOpacity={0.6}
            >
              <Text style={[styles.keyText, isDel && styles.keyDelText]}>{key}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Connect */}
      <TouchableOpacity
        style={[styles.connectBtn, !canConnect && styles.connectBtnDisabled]}
        disabled={!canConnect}
        onPress={handleConnect}
      >
        {checking
          ? <ActivityIndicator color="#0B1426" />
          : <Text style={styles.connectText}>Connect</Text>
        }
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1426',
    paddingHorizontal: 28,
    paddingTop: 64,
    paddingBottom: 32,
  },
  backBtn: { marginBottom: 32 },
  backText: { color: '#F5C06E', fontSize: 15 },
  title: { color: '#FFF', fontSize: 30, fontWeight: 'bold', marginBottom: 8 },
  subtitle: { color: 'rgba(255,255,255,0.45)', fontSize: 15, marginBottom: 36, lineHeight: 22 },
  errorText: { color: '#E8534A', fontSize: 13, textAlign: 'center', marginTop: -16, marginBottom: 8 },

  slots: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 28 },
  slot: {
    width: 46, height: 58, borderRadius: 12,
    backgroundColor: '#132040',
    borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  slotFilled: { borderColor: '#F5C06E', backgroundColor: 'rgba(245,192,110,0.08)' },
  slotText: { color: '#F5C06E', fontSize: 24, fontWeight: 'bold' },

  pad: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 14, marginBottom: 28 },
  key: {
    width: 80, height: 64, borderRadius: 16,
    backgroundColor: '#132040',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  keyEmpty: { width: 80, height: 64 },
  keyDel: { backgroundColor: 'rgba(232,83,74,0.15)', borderColor: 'rgba(232,83,74,0.25)' },
  keyText: { color: '#FFF', fontSize: 24, fontWeight: '500' },
  keyDelText: { color: '#E8534A' },

  connectBtn: {
    backgroundColor: '#F5C06E', borderRadius: 16,
    paddingVertical: 18, alignItems: 'center', marginTop: 'auto',
  },
  connectBtnDisabled: { opacity: 0.35 },
  connectText: { color: '#0B1426', fontSize: 17, fontWeight: '700' },
});
