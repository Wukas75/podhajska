import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { supabase } from '../../lib/supabase';
import { useSession } from '../../hooks/useSession';

export default function ProfileScreen() {
  const { session } = useSession();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Profil</Text>
        <Text style={styles.email}>{session?.user.email}</Text>

        <Link href={'/settings' as never} asChild>
          <Pressable style={styles.settingsRow}>
            <Text style={styles.settingsRowText}>Nastavenia</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
        </Link>

        <Pressable style={styles.button} onPress={() => supabase.auth.signOut()}>
          <Text style={styles.buttonText}>Odhlásiť sa</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  email: { fontSize: 15, color: '#666', marginBottom: 24 },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#eee',
    marginBottom: 24,
  },
  settingsRowText: { fontSize: 16, fontWeight: '500' },
  button: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
