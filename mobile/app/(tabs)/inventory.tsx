import { useState } from 'react';
import { View, Text, TextInput, Pressable, SectionList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useIngredients, useCreateIngredient, useUpdateIngredient, useDeactivateIngredient, type IngredientWithStock } from '../../hooks/useIngredients';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { Ingredient, IngredientCategory } from '../../types/database.types';

const CATEGORIES: { value: IngredientCategory; label: string }[] = [
  { value: 'malt', label: 'Slad' },
  { value: 'hops', label: 'Chmeľ' },
  { value: 'yeast', label: 'Kvasinky' },
  { value: 'other', label: 'Ostatné' },
];

function categoryLabel(value: IngredientCategory) {
  return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

function CategoryChips({ value, onChange }: { value: IngredientCategory; onChange: (v: IngredientCategory) => void }) {
  return (
    <View style={styles.chipRow}>
      {CATEGORIES.map((c) => (
        <Pressable key={c.value} style={[styles.chip, value === c.value && styles.chipActive]} onPress={() => onChange(c.value)}>
          <Text style={[styles.chipText, value === c.value && styles.chipTextActive]}>{c.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function IngredientEditRow({ ingredient, onCancel }: { ingredient: Ingredient; onCancel: () => void }) {
  const updateIngredient = useUpdateIngredient();
  const [name, setName] = useState(ingredient.name);
  const [category, setCategory] = useState<IngredientCategory>(ingredient.category);
  const [unit, setUnit] = useState(ingredient.unit);

  function handleSave() {
    if (!name.trim() || !unit.trim()) return;
    updateIngredient.mutate(
      { id: ingredient.id, name: name.trim(), category, unit: unit.trim() },
      { onSuccess: onCancel }
    );
  }

  return (
    <View style={styles.editRow}>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Názov suroviny" value={name} onChangeText={setName} />
        <TextInput style={[styles.input, styles.inputSmall]} placeholder="Jednotka" value={unit} onChangeText={setUnit} />
      </View>
      <CategoryChips value={category} onChange={setCategory} />
      {updateIngredient.error && <Text style={styles.error}>{(updateIngredient.error as Error).message}</Text>}
      <View style={styles.editActions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Zrušiť</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, (!name.trim() || !unit.trim()) && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || !unit.trim() || updateIngredient.isPending}
        >
          <Text style={styles.saveButtonText}>{updateIngredient.isPending ? 'Ukladám...' : 'Uložiť'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function InventoryScreen() {
  const { data: ingredients, isLoading, error, refetch, isRefetching } = useIngredients();
  const createIngredient = useCreateIngredient();
  const deactivateIngredient = useDeactivateIngredient();

  const [name, setName] = useState('');
  const [unit, setUnit] = useState('kg');
  const [category, setCategory] = useState<IngredientCategory>('malt');
  const [editingIngredientId, setEditingIngredientId] = useState<string | null>(null);
  const [deletingIngredient, setDeletingIngredient] = useState<Ingredient | null>(null);

  function handleAdd() {
    if (!name.trim() || !unit.trim()) return;
    createIngredient.mutate(
      { name: name.trim(), category, unit: unit.trim() },
      { onSuccess: () => setName('') }
    );
  }

  const sections = CATEGORIES.map((c) => ({
    title: c.label,
    data: (ingredients ?? []).filter((i) => i.category === c.value),
  })).filter((s) => s.data.length > 0);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Sklad</Text>
          <Link href="/inventory/receipt-new" asChild>
            <Pressable style={styles.receiptButton}>
              <Text style={styles.receiptButtonText}>+ Nová príjemka</Text>
            </Pressable>
          </Link>
        </View>

        <View style={styles.subLinksRow}>
          <Link href="/inventory/receipts" asChild>
            <Pressable style={styles.suppliersLink}>
              <Text style={styles.suppliersLinkText}>Príjemky</Text>
              <Ionicons name="chevron-forward" size={14} color="#1a1a1a" />
            </Pressable>
          </Link>
          <Link href="/inventory/suppliers" asChild>
            <Pressable style={styles.suppliersLink}>
              <Text style={styles.suppliersLinkText}>Spravovať dodávateľov</Text>
              <Ionicons name="chevron-forward" size={14} color="#1a1a1a" />
            </Pressable>
          </Link>
        </View>

        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Názov suroviny" value={name} onChangeText={setName} />
          <TextInput style={[styles.input, styles.inputSmall]} placeholder="Jednotka" value={unit} onChangeText={setUnit} />
        </View>
        <CategoryChips value={category} onChange={setCategory} />
        <Pressable style={styles.addButton} onPress={handleAdd} disabled={createIngredient.isPending || !name.trim()}>
          <Text style={styles.addButtonText}>{createIngredient.isPending ? '...' : '+ Pridať surovinu'}</Text>
        </Pressable>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <SectionList
          style={styles.list}
          sections={sections}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
          renderItem={({ item }: { item: IngredientWithStock }) =>
            editingIngredientId === item.id ? (
              <IngredientEditRow ingredient={item} onCancel={() => setEditingIngredientId(null)} />
            ) : (
              <View style={styles.row}>
                <View>
                  <Text style={styles.rowName}>{item.name}</Text>
                  <Text style={styles.rowStock}>
                    {item.stock} {item.unit}
                  </Text>
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => setEditingIngredientId(item.id)} hitSlop={8} accessibilityLabel="Upraviť surovinu">
                    <Ionicons name="create-outline" size={18} color="#333" />
                  </Pressable>
                  <Pressable onPress={() => setDeletingIngredient(item)} hitSlop={8} accessibilityLabel="Zmazať surovinu">
                    <Ionicons name="trash-outline" size={18} color="#c62828" />
                  </Pressable>
                </View>
              </View>
            )
          }
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadne suroviny.</Text> : null}
        />
      </View>

      {deletingIngredient && (
        <ConfirmModal
          title="Zmazať surovinu"
          message={`Naozaj chcete zmazať surovinu „${deletingIngredient.name}" (${categoryLabel(deletingIngredient.category)})?`}
          onCancel={() => setDeletingIngredient(null)}
          onConfirm={() => {
            deactivateIngredient.mutate(deletingIngredient.id);
            setDeletingIngredient(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '700' },
  receiptButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8 },
  receiptButtonText: { color: '#fff', fontWeight: '600' },
  subLinksRow: { flexDirection: 'row', gap: 20, marginBottom: 16 },
  suppliersLink: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  suppliersLinkText: { color: '#1a1a1a', fontWeight: '600', fontSize: 14 },
  form: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  inputSmall: { flex: 0.5 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  chip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6 },
  chipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  chipText: { fontSize: 13, color: '#333' },
  chipTextActive: { color: '#fff' },
  addButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
  list: { flex: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
    marginTop: 16,
    marginBottom: 4,
    backgroundColor: '#fff',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowName: { fontSize: 16, fontWeight: '500' },
  rowStock: { fontSize: 14, color: '#666' },
  actions: { flexDirection: 'row', gap: 16 },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
  editRow: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#eee' },
  editActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  saveButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  saveButtonText: { color: '#fff', fontWeight: '600' },
  buttonDisabled: { opacity: 0.5 },
});
