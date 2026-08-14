import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, router } from 'expo-router';
import { useBatches } from '../../hooks/useBatches';
import { useDashboardSteps } from '../../hooks/useBatchSteps';
import { useRealtimeBatchSteps } from '../../hooks/useRealtimeBatchSteps';
import { BatchCard } from '../../components/BatchCard';
import { StepCard } from '../../components/StepCard';

export default function DashboardScreen() {
  const { data: batches, isLoading: isBatchesLoading } = useBatches();
  const { data: steps, isLoading: isStepsLoading } = useDashboardSteps();
  useRealtimeBatchSteps();

  const isLoading = isBatchesLoading || isStepsLoading;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Prehľad</Text>
        <Link href="/batches/new" asChild>
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Nová šarža</Text>
          </Pressable>
        </Link>
      </View>

      {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}

      <FlatList
        contentContainerStyle={styles.list}
        data={steps ?? []}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <>
            <Text style={styles.sectionTitle}>Aktívne šarže</Text>
            {(batches ?? []).length === 0 && !isLoading && <Text style={styles.empty}>Zatiaľ žiadne aktívne šarže.</Text>}
            {(batches ?? []).map((b) => (
              <BatchCard key={b.id} batch={b} />
            ))}

            <Text style={[styles.sectionTitle, { marginTop: 24 }]}>Nadchádzajúce a omeškané kroky</Text>
          </>
        }
        renderItem={({ item }) => (
          <StepCard
            step={item}
            batchLabel={item.batch ? `${item.batch.name} · ${item.batch.tank?.name ?? ''}` : undefined}
            onPress={() => router.push({ pathname: '/batches/[id]', params: { id: item.batch_id } })}
          />
        )}
        ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Žiadne nadchádzajúce kroky.</Text> : null}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  title: { fontSize: 24, fontWeight: '700' },
  addButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: '#666', textTransform: 'uppercase', marginBottom: 8, marginTop: 16 },
  empty: { color: '#999', marginTop: 8, marginBottom: 8 },
});
