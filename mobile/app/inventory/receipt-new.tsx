import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format } from 'date-fns';
import { useIngredients } from '../../hooks/useIngredients';
import { useCreateStockReceipt } from '../../hooks/useStockReceipts';
import { useSuppliers } from '../../hooks/useSuppliers';
import { SelectField } from '../../components/SelectField';
import type { IngredientCategory } from '../../types/database.types';

const CATEGORY_LABELS: Record<IngredientCategory, string> = {
  malt: 'Slad',
  hops: 'Chmeľ',
  yeast: 'Kvasinky',
  other: 'Ostatné',
};

const CATEGORY_FILTERS: { value: IngredientCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Všetko' },
  { value: 'malt', label: 'Slad' },
  { value: 'hops', label: 'Chmeľ' },
  { value: 'yeast', label: 'Kvasinky' },
  { value: 'other', label: 'Ostatné' },
];

let localIdCounter = 0;

type DraftItem = {
  localId: number;
  ingredientId: string | null;
  quantity: string;
  totalPrice: string;
  categoryFilter: IngredientCategory | 'all';
};

export default function NewStockReceiptScreen() {
  const { data: ingredients } = useIngredients();
  const { data: suppliers } = useSuppliers();
  const createReceipt = useCreateStockReceipt();

  const [receiptDate, setReceiptDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [supplierId, setSupplierId] = useState<string | null>(null);
  const [documentNumber, setDocumentNumber] = useState('');
  const [items, setItems] = useState<DraftItem[]>([
    { localId: ++localIdCounter, ingredientId: null, quantity: '', totalPrice: '', categoryFilter: 'all' },
  ]);

  function ingredientOptionsFor(categoryFilter: IngredientCategory | 'all') {
    return (ingredients ?? [])
      .filter((i) => categoryFilter === 'all' || i.category === categoryFilter)
      .map((i) => ({ id: i.id, label: i.name, sublabel: `${CATEGORY_LABELS[i.category]} · ${i.unit}` }));
  }

  function updateItem(localId: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it) => (it.localId === localId ? { ...it, ...patch } : it)));
  }

  function setItemCategoryFilter(localId: number, categoryFilter: IngredientCategory | 'all') {
    setItems((prev) =>
      prev.map((it) => {
        if (it.localId !== localId) return it;
        const stillValid = categoryFilter === 'all' || ingredients?.find((i) => i.id === it.ingredientId)?.category === categoryFilter;
        return { ...it, categoryFilter, ingredientId: stillValid ? it.ingredientId : null };
      })
    );
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { localId: ++localIdCounter, ingredientId: null, quantity: '', totalPrice: '', categoryFilter: 'all' },
    ]);
  }

  function removeItem(localId: number) {
    setItems((prev) => prev.filter((it) => it.localId !== localId));
  }

  const validItems = items.filter((it) => it.ingredientId && it.quantity.trim() && Number(it.quantity) > 0);
  const canSubmit = supplierId && receiptDate.trim() && validItems.length > 0;
  const totalSum = items.reduce((sum, it) => sum + (it.totalPrice.trim() ? Number(it.totalPrice) : 0), 0);

  function handleSubmit() {
    if (!canSubmit) return;
    createReceipt.mutate(
      {
        receiptDate: receiptDate.trim(),
        supplierId,
        documentNumber: documentNumber.trim() || null,
        items: validItems.map((it) => ({
          ingredient_id: it.ingredientId!,
          quantity: Number(it.quantity),
          total_price: it.totalPrice.trim() ? Number(it.totalPrice) : null,
        })),
      },
      { onSuccess: () => router.back() }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nová príjemka</Text>

        <Text style={styles.label}>Dátum (RRRR-MM-DD)</Text>
        <TextInput style={styles.input} value={receiptDate} onChangeText={setReceiptDate} />

        <SelectField
          label="Dodávateľ"
          placeholder="Vyberte dodávateľa"
          emptyHint="Najprv pridajte dodávateľa (Sklad → Spravovať dodávateľov)."
          options={(suppliers ?? []).map((s) => ({ id: s.id, label: s.name }))}
          selectedId={supplierId}
          onSelect={setSupplierId}
        />

        <Text style={styles.label}>Číslo dokladu (voliteľné)</Text>
        <TextInput style={styles.input} value={documentNumber} onChangeText={setDocumentNumber} placeholder="napr. FA-2026-001" />

        <Text style={[styles.label, { marginTop: 20 }]}>Položky</Text>
        {items.map((item, index) => (
          <View key={item.localId} style={styles.itemRow}>
            <View style={styles.itemHeader}>
              <Text style={styles.itemIndex}>Položka {index + 1}</Text>
              {items.length > 1 && (
                <Pressable onPress={() => removeItem(item.localId)} hitSlop={8} accessibilityLabel="Odstrániť položku">
                  <Ionicons name="trash-outline" size={18} color="#c62828" />
                </Pressable>
              )}
            </View>
            <Text style={styles.label}>Kategória</Text>
            <View style={styles.categoryFilterRow}>
              {CATEGORY_FILTERS.map((c) => (
                <Pressable
                  key={c.value}
                  style={[styles.categoryChip, item.categoryFilter === c.value && styles.categoryChipActive]}
                  onPress={() => setItemCategoryFilter(item.localId, c.value)}
                  accessibilityLabel={`Filter kategórie: ${c.label}`}
                >
                  <Text style={[styles.categoryChipText, item.categoryFilter === c.value && styles.categoryChipTextActive]}>
                    {c.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <SelectField
              label="Surovina"
              placeholder="Vyberte surovinu"
              emptyHint="Žiadna surovina v tejto kategórii."
              options={ingredientOptionsFor(item.categoryFilter)}
              selectedId={item.ingredientId}
              onSelect={(id) => updateItem(item.localId, { ingredientId: id })}
            />
            <View style={styles.quantityPriceRow}>
              <View style={styles.quantityPriceCol}>
                <Text style={styles.label}>Množstvo</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={item.quantity}
                  onChangeText={(v) => updateItem(item.localId, { quantity: v })}
                  placeholder="0"
                />
              </View>
              <View style={styles.quantityPriceCol}>
                <Text style={styles.label}>Cena (voliteľné)</Text>
                <TextInput
                  style={styles.input}
                  keyboardType="numeric"
                  value={item.totalPrice}
                  onChangeText={(v) => updateItem(item.localId, { totalPrice: v })}
                  placeholder="0"
                />
              </View>
            </View>
          </View>
        ))}

        <Pressable style={styles.addItemButton} onPress={addItem}>
          <Text style={styles.addItemButtonText}>+ Pridať položku</Text>
        </Pressable>

        {totalSum > 0 && <Text style={styles.totalSum}>Celková suma: {totalSum.toFixed(2)} €</Text>}

        {createReceipt.error && <Text style={styles.error}>{(createReceipt.error as Error).message}</Text>}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!canSubmit || createReceipt.isPending}
        >
          <Text style={styles.buttonText}>{createReceipt.isPending ? 'Ukladám...' : 'Uložiť príjemku'}</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  itemRow: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 14, marginTop: 12 },
  categoryFilterRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  categoryChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: '#fff' },
  categoryChipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  categoryChipText: { fontSize: 13, color: '#333' },
  categoryChipTextActive: { color: '#fff' },
  itemHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemIndex: { fontSize: 13, fontWeight: '600', color: '#666' },
  quantityPriceRow: { flexDirection: 'row', gap: 8 },
  quantityPriceCol: { flex: 1, minWidth: 0 },
  addItemButton: { paddingVertical: 14, alignItems: 'center' },
  addItemButtonText: { color: '#1a1a1a', fontWeight: '600' },
  totalSum: { fontSize: 16, fontWeight: '700', textAlign: 'right', marginTop: 4 },
  error: { color: '#c62828', marginTop: 12 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 12 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
