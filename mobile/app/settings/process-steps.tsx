import { View, Text, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import {
  useProcessStepTemplates,
  useAddProcessStepTemplate,
  useUpdateProcessStepTemplate,
  useReorderProcessStepTemplates,
  useDuplicateProcessStepTemplate,
  useDeleteProcessStepTemplate,
} from '../../hooks/useProcessStepTemplates';
import { ProcessStepsTable } from '../../components/ProcessStepsTable';

export default function ProcessStepsSettingsScreen() {
  const { data: templates, isLoading, error } = useProcessStepTemplates();
  const addStep = useAddProcessStepTemplate();
  const updateStep = useUpdateProcessStepTemplate();
  const reorderSteps = useReorderProcessStepTemplates();
  const duplicateStep = useDuplicateProcessStepTemplate();
  const deleteStep = useDeleteProcessStepTemplate();

  const rows = templates ?? [];

  function moveRow(row: { id: string; sort_order: number }, direction: -1 | 1) {
    const index = rows.findIndex((r) => r.id === row.id);
    const swapWith = rows[index + direction];
    if (!swapWith) return;
    reorderSteps.mutate([
      { id: row.id, sortOrder: swapWith.sort_order },
      { id: swapWith.id, sortOrder: row.sort_order },
    ]);
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Postup varenia', headerShown: true }} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.hint}>
          Táto šablóna sa dá vložiť do ľubovoľného varného listu (tlačidlo „Vložiť z nastavení“), aby ste ju nemuseli
          vytvárať nanovo pre každú várku.
        </Text>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <ProcessStepsTable
          rows={rows}
          onSaveRow={(rowId, values) => updateStep.mutate({ id: rowId, values })}
          onMoveRow={moveRow}
          onDuplicateRow={(row) => duplicateStep.mutate(row)}
          onDeleteRow={(rowId) => deleteStep.mutate(rowId)}
          onAddRow={() =>
            addStep.mutate({
              values: { stepName: null, value2: null, value3: null, value4: null, value5: null, value6: null },
              sortOrder: rows.length,
            })
          }
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  hint: { color: '#666', fontSize: 14, marginBottom: 16, lineHeight: 20 },
  error: { color: '#c62828', marginTop: 8 },
});
