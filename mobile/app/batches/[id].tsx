import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useBatch, useUpdateBatch } from '../../hooks/useBatches';
import { useBatchSteps, useMarkStepDone, useSkipStep, useUpdateBatchStep, useDeleteBatchStep } from '../../hooks/useBatchSteps';
import { useTanks } from '../../hooks/useTanks';
import { useRealtimeBatchSteps } from '../../hooks/useRealtimeBatchSteps';
import { StepCard } from '../../components/StepCard';
import { RecordValueModal } from '../../components/RecordValueModal';
import { BatchStepEditor } from '../../components/BatchStepEditor';
import { SelectField } from '../../components/SelectField';
import type { BatchStatus } from '../../types/database.types';

const STATUS_OPTIONS: { id: BatchStatus; label: string }[] = [
  { id: 'planned', label: 'Plánovaná' },
  { id: 'active', label: 'Aktívna' },
  { id: 'completed', label: 'Dokončená' },
  { id: 'cancelled', label: 'Zrušená' },
];

export default function BatchDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: batch, isLoading: isBatchLoading, refetch: refetchBatch } = useBatch(id);
  const { data: steps, isLoading: isStepsLoading, error, refetch: refetchSteps, isRefetching } = useBatchSteps(id);
  const { data: tanks } = useTanks();
  const updateBatch = useUpdateBatch(id);
  const markDone = useMarkStepDone(id);
  const skipStep = useSkipStep(id);
  const updateStep = useUpdateBatchStep(id);
  const deleteStep = useDeleteBatchStep(id);
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const [isEditingBatch, setIsEditingBatch] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [tankIdDraft, setTankIdDraft] = useState<string | null>(null);
  const [startDateDraft, setStartDateDraft] = useState('');
  const [statusDraft, setStatusDraft] = useState<BatchStatus>('active');

  useRealtimeBatchSteps();

  const isLoading = isBatchLoading || isStepsLoading;

  function startEditingBatch() {
    if (!batch) return;
    setNameDraft(batch.name);
    setTankIdDraft(batch.tank_id);
    setStartDateDraft(batch.start_date);
    setStatusDraft(batch.status);
    setIsEditingBatch(true);
  }

  function saveBatch() {
    if (!nameDraft.trim() || !startDateDraft.trim()) return;
    updateBatch.mutate(
      { name: nameDraft.trim(), tank_id: tankIdDraft, start_date: startDateDraft.trim(), status: statusDraft },
      { onSuccess: () => setIsEditingBatch(false) }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: batch?.name ?? 'Šarža', headerShown: true }} />
      <View style={styles.content}>
        {batch && !isEditingBatch && (
          <View style={styles.header}>
            <View>
              <Text style={styles.tank}>{batch.tank?.name ?? 'Bez tanku'}</Text>
              <Text style={styles.status}>{batch.status}</Text>
            </View>
            <Pressable onPress={startEditingBatch} hitSlop={8} accessibilityLabel="Upraviť šaržu">
              <Ionicons name="create-outline" size={20} color="#333" />
            </Pressable>
          </View>
        )}

        {batch && isEditingBatch && (
          <View style={styles.batchEditForm}>
            <Text style={styles.label}>Názov</Text>
            <TextInput style={styles.input} value={nameDraft} onChangeText={setNameDraft} />

            <SelectField
              label="Tank"
              placeholder="Vyberte tank"
              emptyHint="Žiadne tanky"
              options={(tanks ?? []).map((t) => ({
                id: t.id,
                label: t.name,
                sublabel: t.capacity_liters ? `${t.capacity_liters} l` : null,
              }))}
              selectedId={tankIdDraft}
              onSelect={setTankIdDraft}
            />

            <Text style={styles.label}>Dátum začiatku (RRRR-MM-DD)</Text>
            <TextInput style={styles.input} value={startDateDraft} onChangeText={setStartDateDraft} />

            <SelectField
              label="Stav"
              placeholder="Vyberte stav"
              options={STATUS_OPTIONS.map((s) => ({ id: s.id, label: s.label }))}
              selectedId={statusDraft}
              onSelect={(v) => setStatusDraft(v as BatchStatus)}
            />

            {updateBatch.error && <Text style={styles.error}>{(updateBatch.error as Error).message}</Text>}

            <View style={styles.batchEditActions}>
              <Pressable style={styles.cancelButton} onPress={() => setIsEditingBatch(false)}>
                <Text style={styles.cancelButtonText}>Zrušiť</Text>
              </Pressable>
              <Pressable
                style={[styles.saveButton, !nameDraft.trim() && styles.buttonDisabled]}
                onPress={saveBatch}
                disabled={!nameDraft.trim() || updateBatch.isPending}
              >
                <Text style={styles.saveButtonText}>{updateBatch.isPending ? 'Ukladám...' : 'Uložiť'}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={steps ?? []}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching}
              onRefresh={() => {
                refetchBatch();
                refetchSteps();
              }}
            />
          }
          renderItem={({ item }) => {
            if (activeStepId === item.id) {
              return (
                <RecordValueModal
                  step={item}
                  isSubmitting={markDone.isPending}
                  onCancel={() => setActiveStepId(null)}
                  onSkip={() => skipStep.mutate(item.id, { onSuccess: () => setActiveStepId(null) })}
                  onSubmit={(values) => markDone.mutate({ stepId: item.id, ...values }, { onSuccess: () => setActiveStepId(null) })}
                />
              );
            }
            if (editingStepId === item.id) {
              return (
                <BatchStepEditor
                  step={item}
                  submitLabel="Uložiť"
                  isSubmitting={updateStep.isPending}
                  onCancel={() => setEditingStepId(null)}
                  onSubmit={(patch) => {
                    updateStep.mutate({ id: item.id, ...patch }, { onSuccess: () => setEditingStepId(null) });
                  }}
                />
              );
            }
            return (
              <StepCard
                step={item}
                onPress={item.status === 'pending' ? () => setActiveStepId(item.id) : undefined}
                onEdit={() => setEditingStepId(item.id)}
                onDelete={() => deleteStep.mutate(item.id)}
              />
            );
          }}
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Táto šarža zatiaľ nemá žiadne kroky.</Text> : null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
  tank: { fontSize: 15, color: '#666' },
  status: { fontSize: 13, color: '#999', textTransform: 'uppercase' },
  error: { color: '#c62828', marginTop: 8 },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
  batchEditForm: { marginBottom: 16 },
  batchEditActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  saveButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
});
