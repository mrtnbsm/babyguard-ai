import { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { router } from 'expo-router';
import { useMonitorStore } from '@/stores/monitor-store';

const { width } = Dimensions.get('window');

// Precomputed star positions — stable across renders
const STARS = [
  { top: 52,  left: 34,         size: 2, opacity: 0.55 },
  { top: 80,  left: 108,        size: 3, opacity: 0.75 },
  { top: 36,  left: 185,        size: 2, opacity: 0.50 },
  { top: 112, left: width - 88, size: 2, opacity: 0.65 },
  { top: 46,  left: width - 44, size: 3, opacity: 0.60 },
  { top: 122, left: 58,         size: 2, opacity: 0.45 },
  { top: 28,  left: width / 2,  size: 2, opacity: 0.80 },
  { top: 148, left: width - 130,size: 2, opacity: 0.40 },
  { top: 66,  left: width - 170,size: 2, opacity: 0.60 },
  { top: 95,  left: 148,        size: 2, opacity: 0.50 },
];

// Reusable button with spring press animation
function SpringButton({
  style,
  onPress,
  children,
}: {
  style: object;
  onPress: () => void;
  children: React.ReactNode;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = () =>
    Animated.spring(scale, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 60,
      bounciness: 0,
    }).start();

  const onPressOut = () =>
    Animated.spring(scale, {
      toValue: 1,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={style}
        onPress={onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {children}
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HomeScreen() {
  const setRole = useMonitorStore((s) => s.setRole);

  const breathe    = useRef(new Animated.Value(0)).current;
  const fadeIn     = useRef(new Animated.Value(0)).current;
  const slideUp    = useRef(new Animated.Value(28)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeIn,  { toValue: 1, duration: 900, delay: 100, useNativeDriver: true }),
      Animated.timing(slideUp, { toValue: 0, duration: 900, delay: 100, useNativeDriver: true }),
    ]).start();

    // Slow breathing glow
    Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, { toValue: 1, duration: 4500, useNativeDriver: true }),
        Animated.timing(breathe, { toValue: 0, duration: 4500, useNativeDriver: true }),
      ])
    ).start();
  }, []);

  const glowScale   = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.28] });
  const glowOpacity = breathe.interpolate({ inputRange: [0, 1], outputRange: [0.10, 0.25] });

  return (
    <View style={styles.container}>
      {/* Stars */}
      {STARS.map((s, i) => (
        <View
          key={i}
          style={[
            styles.star,
            { top: s.top, left: s.left, width: s.size, height: s.size,
              borderRadius: s.size / 2, opacity: s.opacity },
          ]}
        />
      ))}

      {/* Breathing glow orb */}
      <Animated.View
        style={[styles.glow, { transform: [{ scale: glowScale }], opacity: glowOpacity }]}
      />

      {/* Hero: moon + title */}
      <Animated.View
        style={[styles.hero, { opacity: fadeIn, transform: [{ translateY: slideUp }] }]}
      >
        <View style={styles.moonWrap}>
          <Text style={styles.moonEmoji}>🌙</Text>
        </View>
        <Text style={styles.title}>BabyGuard</Text>
        <Text style={styles.tagline}>Smart monitor for peaceful nights</Text>
      </Animated.View>

      {/* Buttons */}
      <Animated.View style={[styles.buttons, { opacity: fadeIn }]}>
        <SpringButton
          style={styles.btnPrimary}
          onPress={() => { setRole('baby'); router.push('/baby-unit'); }}
        >
          <Text style={styles.btnIcon}>🍼</Text>
          <Text style={styles.btnPrimaryText}>I'm near the baby</Text>
          <Text style={styles.btnArrowDark}>›</Text>
        </SpringButton>

        <SpringButton
          style={styles.btnSecondary}
          onPress={() => { setRole('parent'); router.push('/parent-join'); }}
        >
          <Text style={styles.btnIcon}>👂</Text>
          <Text style={styles.btnSecondaryText}>I'm the parent</Text>
          <Text style={styles.btnArrowLight}>›</Text>
        </SpringButton>
      </Animated.View>

      {/* Bottom hint */}
      <Animated.Text style={[styles.hint, { opacity: fadeIn }]}>
        Place one device near your baby, keep the other with you
      </Animated.Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1426',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },

  // Stars
  star: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
  },

  // Breathing glow
  glow: {
    position: 'absolute',
    top: '12%',
    alignSelf: 'center',
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: '#2D4A8A',
  },

  // Hero section
  hero: {
    alignItems: 'center',
    marginBottom: 52,
  },
  moonWrap: {
    width: 92,
    height: 92,
    borderRadius: 46,
    backgroundColor: 'rgba(245,192,110,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(245,192,110,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  moonEmoji: { fontSize: 44 },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.38)',
    letterSpacing: 0.2,
  },

  // Buttons
  buttons: {
    width: '100%',
    gap: 12,
  },
  btnPrimary: {
    backgroundColor: '#F5C06E',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
  },
  btnSecondary: {
    backgroundColor: '#0D1935',
    borderRadius: 20,
    paddingVertical: 20,
    paddingHorizontal: 22,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.09)',
  },
  btnIcon:          { fontSize: 20, marginRight: 14 },
  btnPrimaryText:   { flex: 1, fontSize: 17, fontWeight: '700', color: '#0B1426' },
  btnSecondaryText: { flex: 1, fontSize: 17, fontWeight: '600', color: '#FFFFFF' },
  btnArrowDark:     { fontSize: 22, fontWeight: '600', color: 'rgba(11,20,38,0.55)' },
  btnArrowLight:    { fontSize: 22, fontWeight: '600', color: 'rgba(255,255,255,0.25)' },

  hint: {
    position: 'absolute',
    bottom: 40,
    fontSize: 12,
    color: 'rgba(255,255,255,0.20)',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
