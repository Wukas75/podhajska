import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format, parseISO } from 'date-fns';
import {
  useBrewSheet,
  useUpdateBrewSheet,
  useUpdateBrewSheetResults,
  useScaleBrewSheetIngredients,
  useAddBrewSheetIngredient,
  useUpdateBrewSheetIngredient,
  useDeleteBrewSheetIngredient,
  type BrewSheetIngredientWithDetails,
} from '../../hooks/useBrewSheets';
import { useIngredients } from '../../hooks/useIngredients';
import { BrewSheetIngredientEditor } from '../../components/BrewSheetIngredientEditor';
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
  const updateResults = useUpdateBrewSheetResults(id);
  const scaleIngredients = useScaleBrewSheetIngredients(id);
  const addIngredient = useAddBrewSheetIngredient(id);
  const updateIngredient = useUpdateBrewSheetIngredient(id);
  const deleteIngredient = useDeleteBrewSheetIngredient(id);

  const [isEditingSheet, setIsEditingSheet] = useState(false);
  const [nameDraft, setNameDraft] = useState('');
  const [volumeDraft, setVolumeDraft] = useState('');
  const [batchNumberDraft, setBatchNumberDraft] = useState('');
  const [brewDateDraft, setBrewDateDraft] = useState('');
  const [notesDraft, setNotesDraft] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);

  const [isEditingResults, setIsEditingResults] = useState(false);
  const [finalVolumeDraft, setFinalVolumeDraft] = useState('');
  const [ogDraft, setOgDraft] = useState('');
  const [sgDraft, setSgDraft] = useState('');
  const [abvDraft, setAbvDraft] = useState('');

  const sheetIngredients = data?.ingredients ?? [];
  const totalPriceSum = sheetIngredients.reduce((sum, it) => sum + (it.total_price ?? 0), 0);

  const ingredientOptions = (ingredients ?? []).map((i) => ({
    id: i.id,
    label: i.name,
    sublabel: `${CATEGORY_LABELS[i.category]} · ${i.unit}`,
  }));

  function startEditingSheet() {
    if (!data) return;
    setNameDraft(data.sheet.name);
    setVolumeDraft(String(data.sheet.batch_volume_liters));
    setBatchNumberDraft(String(data.sheet.batch_number));
    setBrewDateDraft(data.sheet.brew_date);
    setNotesDraft(data.sheet.notes ?? '');
    setIsEditingSheet(true);
  }

  function saveSheet() {
    if (!data) return;
    const volume = Number(volumeDraft);
    const batchNumber = Number(batchNumberDraft);
    if (!nameDraft.trim() || !volumeDraft.trim() || volume <= 0) return;
    if (!batchNumberDraft.trim() || batchNumber <= 0 || !brewDateDraft.trim()) return;

    const previousVolume = data.sheet.batch_volume_liters;
    const scale = volume / previousVolume;

    function saveRest() {
      updateSheet.mutate(
        {
          name: nameDraft.trim(),
          batchVolumeLiters: volume,
          batchNumber,
          brewDate: brewDateDraft.trim(),
          notes: notesDraft.trim() || null,
        },
        { onSuccess: () => setIsEditingSheet(false) }
      );
    }

    if (scale !== 1 && sheetIngredients.length > 0) {
      scaleIngredients.mutate(
        sheetIngredients.map((si) => ({ id: si.id, quantity: Math.round(si.quantity * scale * 1000) / 1000 })),
        { onSuccess: saveRest }
      );
    } else {
      saveRest();
    }
  }

  function startEditingResults() {
    if (!data) return;
    setFinalVolumeDraft(data.sheet.final_volume_liters != null ? String(data.sheet.final_volume_liters) : '');
    setOgDraft(data.sheet.og != null ? String(data.sheet.og) : '');
    setSgDraft(data.sheet.sg != null ? String(data.sheet.sg) : '');
    setAbvDraft(data.sheet.abv_percent != null ? String(data.sheet.abv_percent) : '');
    setIsEditingResults(true);
  }

  function saveResults() {
    updateResults.mutate(
      {
        finalVolumeLiters: finalVolumeDraft.trim() ? Number(finalVolumeDraft) : null,
        og: ogDraft.trim() ? Number(ogDraft) : null,
        sg: sgDraft.trim() ? Number(sgDraft) : null,
        abvPercent: abvDraft.trim() ? Number(abvDraft) : null,
      },
      { onSuccess: () => setIsEditingResults(false) }
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

                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Poradové číslo várky</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={batchNumberDraft} onChangeText={setBatchNumberDraft} />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Dátum várky</Text>
                    <TextInput style={styles.input} value={brewDateDraft} onChangeText={setBrewDateDraft} placeholder="RRRR-MM-DD" />
                  </View>
                </View>

                <Text style={styles.label}>Objem várky (litre)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={volumeDraft}
                  onChangeText={setVolumeDraft}
                  placeholder="1000"
                />
                {sheetIngredients.length > 0 && Number(volumeDraft) !== data.sheet.batch_volume_liters && (
                  <Text style={styles.hint}>Množstvo surovín sa prepočíta pomerne k novému objemu.</Text>
                )}
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Poznámka (voliteľné)"
                  value={notesDraft}
                  onChangeText={setNotesDraft}
                  multiline
                />
                {(updateSheet.error || scaleIngredients.error) && (
                  <Text style={styles.error}>{((updateSheet.error ?? scaleIngredients.error) as Error).message}</Text>
                )}
                <View style={styles.sheetEditActions}>
                  <Pressable style={styles.cancelButton} onPress={() => setIsEditingSheet(false)}>
                    <Text style={styles.cancelButtonText}>Zrušiť</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.saveButton, !nameDraft.trim() && styles.buttonDisabled]}
                    onPress={saveSheet}
                    disabled={!nameDraft.trim() || updateSheet.isPending || scaleIngredients.isPending}
                  >
                    <Text style={styles.saveButtonText}>
                      {updateSheet.isPending || scaleIngredients.isPending ? 'Ukladám...' : 'Uložiť'}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.sheetHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.batchNumber}>Várka #{data.sheet.batch_number}</Text>
                  <Text style={styles.volume}>
                    {format(parseISO(data.sheet.brew_date), 'd.M.yyyy')} · {data.sheet.batch_volume_liters} l
                  </Text>
                  {data.sheet.notes ? <Text style={styles.description}>{data.sheet.notes}</Text> : null}
                </View>
                <Pressable onPress={startEditingSheet} hitSlop={8} accessibilityLabel="Upraviť varný list">
                  <Ionicons name="create-outline" size={20} color="#333" />
                </Pressable>
              </View>
            )}

            {isEditingResults ? (
              <View style={styles.resultsEditForm}>
                <Text style={styles.sectionTitle}>Výsledky várky</Text>
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>Finálny objem (l)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={finalVolumeDraft} onChangeText={setFinalVolumeDraft} />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>OG</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={ogDraft} onChangeText={setOgDraft} />
                  </View>
                </View>
                <View style={styles.row}>
                  <View style={styles.col}>
                    <Text style={styles.label}>SG</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={sgDraft} onChangeText={setSgDraft} />
                  </View>
                  <View style={styles.col}>
                    <Text style={styles.label}>Alkohol (%)</Text>
                    <TextInput style={styles.input} keyboardType="numeric" value={abvDraft} onChangeText={setAbvDraft} />
                  </View>
                </View>
                {updateResults.error && <Text style={styles.error}>{(updateResults.error as Error).message}</Text>}
                <View style={styles.sheetEditActions}>
                  <Pressable style={styles.cancelButton} onPress={() => setIsEditingResults(false)}>
                    <Text style={styles.cancelButtonText}>Zrušiť</Text>
                  </Pressable>
                  <Pressable style={styles.saveButton} onPress={saveResults} disabled={updateResults.isPending}>
                    <Text style={styles.saveButtonText}>{updateResults.isPending ? 'Ukladám...' : 'Uložiť'}</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <View style={styles.resultsHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sectionTitle}>Výsledky várky</Text>
                  {data.sheet.final_volume_liters == null &&
                  data.sheet.og == null &&
                  data.sheet.sg == null &&
                  data.sheet.abv_percent == null ? (
                    <Text style={styles.empty}>Zatiaľ nezadané.</Text>
                  ) : (
                    <View style={styles.resultsGrid}>
                      {data.sheet.final_volume_liters != null && (
                        <Text style={styles.resultItem}>Finálny objem: {data.sheet.final_volume_liters} l</Text>
                      )}
                      {data.sheet.og != null && <Text style={styles.resultItem}>OG: {data.sheet.og}</Text>}
                      {data.sheet.sg != null && <Text style={styles.resultItem}>SG: {data.sheet.sg}</Text>}
                      {data.sheet.abv_percent != null && <Text style={styles.resultItem}>Alkohol: {data.sheet.abv_percent} %</Text>}
                    </View>
                  )}
                </View>
                <Pressable onPress={startEditingResults} hitSlop={8} accessibilityLabel="Upraviť výsledky várky">
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
                  <BrewSheetIngredientEditor
                    initial={{ ingredientId: item.ingredient_id, quantity: item.quantity, totalPrice: item.total_price }}
                    ingredientOptions={ingredientOptions}
                    submitLabel="Uložiť"
                    isSubmitting={updateIngredient.isPending}
                    onCancel={() => setEditingIngredientId(null)}
                    onSubmit={(input) => {
                      updateIngredient.mutate(
                        { id: item.id, ingredientId: input.ingredientId, quantity: input.quantity, totalPrice: input.totalPrice },
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
                        {item.total_price != null ? ` · ${item.total_price.toFixed(2)} €` : ''}
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
                <>
                  {totalPriceSum > 0 && <Text style={styles.totalSum}>Spolu za suroviny: {totalPriceSum.toFixed(2)} €</Text>}
                  {isAdding ? (
                    <BrewSheetIngredientEditor
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
                  )}
                </>
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
  batchNumber: { fontSize: 18, fontWeight: '700', marginBottom: 2 },
  volume: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 4 },
  description: { fontSize: 14, color: '#888' },
  sheetEditForm: { marginBottom: 16 },
  resultsHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8, marginBottom: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  resultsEditForm: { marginTop: 8, marginBottom: 16, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#eee' },
  resultsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  resultItem: { fontSize: 14, color: '#333' },
  sheetEditActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  saveButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
  hint: { color: '#999', fontSize: 13, fontStyle: 'italic', marginTop: -6, marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  col: { flex: 1, minWidth: 0 },
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
  totalSum: { fontSize: 15, fontWeight: '700', textAlign: 'right', marginTop: 12, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#eee' },
  addButton: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#1a1a1a', fontWeight: '600' },
});
