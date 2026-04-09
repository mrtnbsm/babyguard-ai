import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { router } from 'expo-router';
import { useMonitorStore } from '@/stores/monitor-store';

export default function HomeScreen() {
  const setRole = useMonitorStore((s) => s.setRole);

  function goToBaby() {
    setRole('baby');
    router.push('/baby-unit');
  }

  function goToParent() {
    setRole('parent');
    router.push('/parent-join');
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>BabyGuard AI</Text>
      <TouchableOpacity style={styles.btnPrimary} onPress={goToBaby}>
        <Text style={styles.btnPrimaryText}>🍼  I'm near the baby</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.btnSecondary} onPress={goToParent}>
        <Text style={styles.btnSecondaryText}>👶  I'm the parent</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1426',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    gap: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 48,
    textAlign: 'center',
  },
  btnPrimary: {
    width: '100%',
    backgroundColor: '#F5C06E',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
  },
  btnPrimaryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0B1426',
  },
  btnSecondary: {
    width: '100%',
    backgroundColor: '#132040',
    borderRadius: 16,
    paddingVertical: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  btnSecondaryText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
