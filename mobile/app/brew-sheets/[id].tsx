import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import {
  useBrewSheet,
  useUpdateBrewSheet,
  useAddBrewSheetIngredient,
  useUpdateBrewSheetIngredient,
  useDeleteBrewSheetIngredient,
  type BrewSheetIngredientWithDetails,
} from '../../hooks/useBrewSheets';
import { useIngredients } from '../../hooks/useIngredients';
import { RecipeIngredientEditor } from '../../components/RecipeIngredientEditor';
import type { IngredientCategory } from '../../types/database.types';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  malt: 'Slad',
  hops: 'Chmeľ',
  yeast: 'Kvasinky',
  other: 'Ostatné',
};

export default function BrewSheetDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, isLoading, error } = useBrewSheet(id);
  const { data: ingredients } = useIngredients();
  const updateSheet = useUpdateBrewSheet(id);
  const addIngredient = useAddBrewSheetIngredient(id);
  const updateIngredient = useUpdateBrewSheetIngredient(id);
  const deleteIngredient = useDeleteBrewSheetIngredient(id);

  const [isEditingSheet, setIsEditingSheet] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [volumeDraft, setVolumeDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);

  const sheetIngredients = data?.ingredients ?? [];

  const ingredientOptions = (ingredients ?? []).map((i) => ({
    id: i.id,
    label: i.name,
    sublabel: `${CATEGORY_LABELS[i.category]} · ${i.unit}`,
  }));

  function startEditingSheet() {
    if (!data) return;
    setNameDraft(data.sheet.name);
    setVolumeDraft(String(data.sheet.batch_volume_liters));
    setNotesDraft(data.sheet.notes ?? '');
    setIsEditingSheet(true);
  }

  function saveSheet() {
    const volume = Number(volumeDraft);
    if (!nameDraft.trim() || !volumeDraft.trim() || volume <= 0) return;
    updateSheet.mutate(
      { name: nameDraft.trim(), batchVolumeLiters: volume, notes: notesDraft.trim() || null },
      { onSuccess: () => setIsEditingSheet(false) }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: data?.sheet.name ?? 'Varný list', headerShown: true }} />
      <View style={styles.content}>
        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        {data && (
          <>
            {isEditingSheet ? (
              <View style={styles.sheetEditForm}>
                <TextInput style={styles.input} placeholder="Názov" value={nameDraft} onChangeText={setNameDraft} />
                <Text style={styles.label}>Objem várky (litre)</Text>
                <TextInput style={styles.input} keyboardType="numeric" value={volumeDraft} onChangeText={setVolumeDraft} />
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Poznámka (voliteľné)"
                  value={notesDraft}
                  onChangeText={setNotesDraft}
                  multiline
                />
                {updateSheet.error && <Text style={styles.error}>{(updateSheet.error as Error).message}</Text>}
                <View style={styles.sheetEditActions}>
                  <Pressable style={styles.cancelButton} onPress={() => setIsEditingSheet(false)}>
                    <Text style={styles.cancelButtonText}>Zrušiť</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, !nameDraft.trim() && styles.buttonDisabled]}
                    onPress={saveSheet}
                    disabled={!nameDraft.trim() || updateSheet.isPending}
                  >
                    <Text style={styles.saveButtonText}>{updateSheet.isPending ? 'Ukladám...' : 'Uložiť'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.volume}>Objem várky: {data.sheet.batch_volume_liters} l</Text>
                  {data.sheet.notes ? <Text style={styles.description}>{data.sheet.notes}</Text> : null}
                </View>
                <Pressable onPress={startEditingSheet} hitSlop={8} accessibilityLabel="Upraviť varný list">
                  <Ionicons name="create-outline" size={20} color="#333" />
                </Pressable>
              </View>
            )}

            <FlatList
              style={styles.list}
              data={sheetIngredients}
              keyExtractor={(item) => item.id}
              ListHeaderComponent={<Text style={styles.sectionTitle}>Suroviny</Text>}
              renderItem={({ item }: { item: BrewSheetIngredientWithDetails }) =>
                editingIngredientId === item.id ? (
                  <RecipeIngredientEditor
                    initial={{ ingredientId: item.ingredient_id, quantity: item.quantity }}
                    ingredientOptions={ingredientOptions}
                    submitLabel="Uložiť"
                    isSubmitting={updateIngredient.isPending}
                    onCancel={() => setEditingIngredientId(null)}
                    onSubmit={(input) => {
                      updateIngredient.mutate(
                        { id: item.id, ingredientId: input.ingredientId, quantity: input.quantity },
                        { onSuccess: () => setEditingIngredientId(null) }
                      );
                    }}
                  />
                ) : (
                  <View style={styles.ingredientRow}>
                    <View style={styles.ingredientInfo}>
                      <Text style={styles.ingredientName}>{item.ingredient?.name ?? '—'}</Text>
                      <Text style={styles.ingredientQty}>
                        {item.quantity} {item.ingredient?.unit ?? ''}
                      </Text>
                    </View>
                    <Pressable onPress={() => setEditingIngredientId(item.id)} hitSlop={8} accessibilityLabel="Upraviť surovinu">
                      <Ionicons name="create-outline" size={18} color="#333" />
                    </Pressable>
                    <Pressable onPress={() => deleteIngredient.mutate(item.id)} hitSlop={8} accessibilityLabel="Odstrániť surovinu">
                      <Ionicons name="trash-outline" size={18} color="#c62828" />
                    </Pressable>
                  </View>
                )
              }
              ListEmptyComponent={<Text style={styles.empty}>Zatiaľ žiadne suroviny.</Text>}
              ListFooterComponent={
                isAdding ? (
                  <RecipeIngredientEditor
                    ingredientOptions={ingredientOptions}
                    submitLabel="Pridať surovinu"
                    isSubmitting={addIngredient.isPending}
                    onCancel={() => setIsAdding(false)}
                    onSubmit={(input) => {
                      addIngredient.mutate(input, { onSuccess: () => setIsAdding(false) });
                    }}
                  />
                ) : (
                  <Pressable style={styles.addButton} onPress={() => setIsAdding(true)}>
                    <Text style={styles.addButtonText}>+ Pridať surovinu</Text>
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
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 8 },
  volume: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  description: { fontSize: 14, color: '#888' },
  sheetEditForm: { marginBottom: 16 },
  sheetEditActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  saveButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    fontSize: 15,
  },
  textArea: { minHeight: 70, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12, marginTop: 8 },
  list: { flex: 1 },
  error: { color: '#c62828', marginTop: 8 },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  ingredientInfo: { flex: 1 },
  ingredientName: { fontSize: 16, fontWeight: '500' },
  ingredientQty: { fontSize: 13, color: '#666', marginTop: 2 },
  empty: { color: '#999', marginTop: 12, marginBottom: 12, textAlign: 'center' },
  addButton: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#1a1a1a', fontWeight: '600' },
});
