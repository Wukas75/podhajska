import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack } from 'expo-router';
import { useBrewSheets } from '../../hooks/useBrewSheets';
import type { BrewSheet } from '../../types/database.types';

export default function BrewSheetsScreen() {
  const { data: sheets, isLoading, error, refetch, isRefetching } = useBrewSheets();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Varné listy', headerShown: true }} />
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Varné listy</Text>
          <Link href="/brew-sheets/new" asChild>
            <Pressable style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Nový</Text>
            </Pressable>
          </Link>
        </View>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={sheets ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }: { item: BrewSheet }) => (
            <Link href={{ pathname: '/brew-sheets/[id]', params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                <Text style={styles.rowSubtitle}>{item.batch_volume_liters} l</Text>
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadne varné listy.</Text> : null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  addButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowSubtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
});
