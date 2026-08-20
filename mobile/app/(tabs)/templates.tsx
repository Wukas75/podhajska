import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTemplates } from '../../hooks/useTemplates';
import type { RecipeTemplate } from '../../types/database.types';

export default function TemplatesScreen() {
  const { data: templates, isLoading, error, refetch, isRefetching } = useTemplates();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Šablóny receptov</Text>
          <Link href="/templates/new" asChild>
            <Pressable style={styles.addButton}>
              <Text style={styles.addButtonText}>+ Nová</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.subLinksRow}>
          <Link href={'/recipes' as never} asChild>
            <Pressable style={styles.subLink}>
              <Text style={styles.subLinkText}>Receptúry</Text>
              <Ionicons name="chevron-forward" size={14} color="#1a1a1a" />
            </Pressable>
          </Link>
          <Link href={'/brew-sheets' as never} asChild>
            <Pressable style={styles.subLink}>
              <Text style={styles.subLinkText}>Varné listy</Text>
              <Ionicons name="chevron-forward" size={14} color="#1a1a1a" />
            </Pressable>
          </Link>
        </View>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={templates ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }: { item: RecipeTemplate }) => (
            <Link href={{ pathname: '/templates/[id]', params: { id: item.id } }} asChild>
              <Pressable style={styles.row}>
                <Text style={styles.rowTitle}>{item.name}</Text>
                {item.style ? <Text style={styles.rowSubtitle}>{item.style}</Text> : null}
              </Pressable>
            </Link>
          )}
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadne šablóny.</Text> : null}
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
  subLinksRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  subLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  subLinkText: { color: '#1a1a1a', fontWeight: '600', fontSize: 14 },
  error: { color: '#c62828', marginTop: 8 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  rowTitle: { fontSize: 16, fontWeight: '500' },
  rowSubtitle: { fontSize: 14, color: '#666', marginTop: 2 },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
});
