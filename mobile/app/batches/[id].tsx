import { useState } from 'react';
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import { useBatch } from '../../hooks/useBatches';
import { useBatchSteps, useMarkStepDone, useSkipStep } from '../../hooks/useBatchSteps';
import { useRealtimeBatchSteps } from '../../hooks/useRealtimeBatchSteps';
import { StepCard } from '../../components/StepCard';
import { RecordValueModal } from '../../components/RecordValueModal';

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: batch, isLoading: isBatchLoading } = useBatch(id);
  const { data: steps, isLoading: isStepsLoading, error } = useBatchSteps(id);
  const markDone = useMarkStepDone(id);
  const skipStep = useSkipStep(id);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);

  useRealtimeBatchSteps();

  const isLoading = isBatchLoading || isStepsLoading;

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: batch?.name ?? 'Šarža', headerShown: true }} />
      <View style={styles.content}>
        {batch && (
          <View style={styles.header}>
            <Text style={styles.tank}>{batch.tank?.name ?? 'Bez tanku'}</Text>
            <Text style={styles.status}>{batch.status}</Text>
          </View>
        )}

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={steps ?? []}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) =>
            activeStepId === item.id ? (
              <RecordValueModal
                step={item}
                isSubmitting={markDone.isPending}
                onCancel={() => setActiveStepId(null)}
                onSkip={() => skipStep.mutate(item.id, { onSuccess: () => setActiveStepId(null) })}
                onSubmit={(values) => markDone.mutate({ stepId: item.id, ...values }, { onSuccess: () => setActiveStepId(null) })}
              />
            ) : (
              <StepCard step={item} onPress={item.status === 'pending' ? () => setActiveStepId(item.id) : undefined} />
            )
          }
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Táto šarža zatiaľ nemá žiadne kroky.</Text> : null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  tank: { fontSize: 15, color: '#666' },
  status: { fontSize: 13, color: '#999', textTransform: 'uppercase' },
  error: { color: '#c62828', marginTop: 8 },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
});
