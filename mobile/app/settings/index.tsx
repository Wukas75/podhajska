import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function SettingsScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Nastavenia', headerShown: true }} />
      <View style={styles.content}>
        <Link href="/settings/process-steps" asChild>
          <Pressable style={styles.row}>
            <Text style={styles.rowTitle}>Postup varenia</Text>
            <Ionicons name="chevron-forward" size={18} color="#999" />
          </Pressable>
        </Link>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowTitle: { fontSize: 16, fontWeight: '500' },
});
