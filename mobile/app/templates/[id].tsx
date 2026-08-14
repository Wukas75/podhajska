import { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useTemplate,
  useAddTemplateStep,
  useUpdateTemplateStep,
  useDeleteTemplateStep,
} from '../../hooks/useTemplates';
import { TemplateStepEditor } from '../../components/TemplateStepEditor';
import type { RecipeTemplateStep } from '../../types/database.types';

export default function TemplateDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useTemplate(id);
  const addStep = useAddTemplateStep(id);
  const updateStep = useUpdateTemplateStep(id);
  const deleteStep = useDeleteTemplateStep(id);
  const [isAdding, setIsAdding] = useState(false);
  const [editingStepId, setEditingStepId] = useState<string | null>(null);

  const steps = data?.steps ?? [];

  function moveStep(step: RecipeTemplateStep, direction: -1 | 1) {
    const index = steps.findIndex((s) => s.id === step.id);
    const swapWith = steps[index + direction];
    if (!swapWith) return;
    updateStep.mutate({ id: step.id, sort_order: swapWith.sort_order });
    updateStep.mutate({ id: swapWith.id, sort_order: step.sort_order });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: data?.template.name ?? 'Šablóna', headerShown: true }} />
      <View style={styles.content}>
        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        {data && (
          <>
            {data.template.style ? <Text style={styles.subtitle}>{data.template.style}</Text> : null}
            {data.template.description ? <Text style={styles.description}>{data.template.description}</Text> : null}

            <FlatList
              style={styles.list}
              data={steps}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={<Text style={styles.sectionTitle}>Kroky</Text>}
              renderItem={({ item, index }) =>
                editingStepId === item.id ? (
                  <TemplateStepEditor
                    initial={item}
                    submitLabel="Uložiť"
                    isSubmitting={updateStep.isPending}
                    onCancel={() => setEditingStepId(null)}
                    onSubmit={(input) => {
                      updateStep.mutate({ id: item.id, ...input }, { onSuccess: () => setEditingStepId(null) });
                    }}
                  />
                ) : (
                  <View style={styles.stepRow}>
                    <View style={styles.stepReorder}>
                      <Pressable onPress={() => moveStep(item, -1)} disabled={index === 0}>
                        <Ionicons name="chevron-up" size={18} color={index === 0 ? '#ccc' : '#333'} />
                      </Pressable>
                      <Pressable onPress={() => moveStep(item, 1)} disabled={index === steps.length - 1}>
                        <Ionicons name="chevron-down" size={18} color={index === steps.length - 1 ? '#ccc' : '#333'} />
                      </Pressable>
                    </View>
                    <Pressable style={styles.stepInfo} onPress={() => setEditingStepId(item.id)}>
                      <Text style={styles.stepDay}>Deň {item.day_offset}</Text>
                      <Text style={styles.stepTitle}>{item.title}</Text>
                      {item.target_value != null && (
                        <Text style={styles.stepValue}>
                          {item.target_value} {item.target_unit}
                        </Text>
                      )}
                    </Pressable>
                    <Pressable onPress={() => deleteStep.mutate(item.id)}>
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
                    </Pressable>
                  </View>
                )
              }
              ListEmptyComponent={<Text style={styles.empty}>Zatiaľ žiadne kroky.</Text>}
              ListFooterComponent={
                isAdding ? (
                  <TemplateStepEditor
                    submitLabel="Pridať krok"
                    isSubmitting={addStep.isPending}
                    onCancel={() => setIsAdding(false)}
                    onSubmit={(input) => {
                      addStep.mutate(
                        { ...input, sort_order: steps.length },
                        { onSuccess: () => setIsAdding(false) }
                      );
                    }}
                  />
                ) : (
                  <Pressable style={styles.addButton} onPress={() => setIsAdding(true)}>
                    <Text style={styles.addButtonText}>+ Pridať krok</Text>
                  </Pressable>
                )
              }
            />
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 4 },
  description: { fontSize: 14, color: '#888', marginBottom: 16 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  list: { flex: 1 },
  error: { color: '#c62828', marginTop: 8 },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  stepReorder: { justifyContent: 'center', gap: 2 },
  stepInfo: { flex: 1 },
  stepDay: { fontSize: 12, color: '#999', textTransform: 'uppercase' },
  stepTitle: { fontSize: 16, fontWeight: '500' },
  stepValue: { fontSize: 13, color: '#666', marginTop: 2 },
  empty: { color: '#999', marginTop: 12, marginBottom: 12, textAlign: 'center' },
  addButton: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#1a1a1a', fontWeight: '600' },
});
