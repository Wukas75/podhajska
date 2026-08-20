import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSuppliers, useCreateSupplier, useUpdateSupplier, useDeactivateSupplier } from '../../hooks/useSuppliers';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { Supplier } from '../../types/database.types';

function SupplierEditRow({ supplier, onCancel }: { supplier: Supplier; onCancel: () => void }) {
  const updateSupplier = useUpdateSupplier();
  const [name, setName] = useState(supplier.name);

  function handleSave() {
    if (!name.trim()) return;
    updateSupplier.mutate({ id: supplier.id, name: name.trim() }, { onSuccess: onCancel });
  }

  return (
    <View style={styles.editRow}>
      <TextInput style={styles.input} placeholder="Názov dodávateľa" value={name} onChangeText={setName} />
      {updateSupplier.error && <Text style={styles.error}>{(updateSupplier.error as Error).message}</Text>}
      <View style={styles.editActions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Zrušiť</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, !name.trim() && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || updateSupplier.isPending}
        >
          <Text style={styles.saveButtonText}>{updateSupplier.isPending ? 'Ukladám...' : 'Uložiť'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function SuppliersScreen() {
  const { data: suppliers, isLoading, error, refetch, isRefetching } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const deactivateSupplier = useDeactivateSupplier();

  const [name, setName] = useState('');
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [deletingSupplier, setDeletingSupplier] = useState<Supplier | null>(null);

  function handleAdd() {
    if (!name.trim()) return;
    createSupplier.mutate({ name: name.trim() }, { onSuccess: () => setName('') });
  }

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Dodávatelia', headerShown: true }} />
      <View style={styles.content}>
        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Názov dodávateľa" value={name} onChangeText={setName} />
          <Pressable style={styles.addButton} onPress={handleAdd} disabled={createSupplier.isPending || !name.trim()}>
            <Text style={styles.addButtonText}>{createSupplier.isPending ? '...' : 'Pridať'}</Text>
          </Pressable>
        </View>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={suppliers ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }: { item: Supplier }) =>
            editingSupplierId === item.id ? (
              <SupplierEditRow supplier={item} onCancel={() => setEditingSupplierId(null)} />
            ) : (
              <View style={styles.row}>
                <Text style={styles.rowName}>{item.name}</Text>
                <View style={styles.actions}>
                  <Pressable onPress={() => setEditingSupplierId(item.id)} hitSlop={8} accessibilityLabel="Upraviť dodávateľa">
                    <Ionicons name="create-outline" size={18} color="#333" />
                  </Pressable>
                  <Pressable onPress={() => setDeletingSupplier(item)} hitSlop={8} accessibilityLabel="Zmazať dodávateľa">
                    <Ionicons name="trash-outline" size={18} color="#c62828" />
                  </Pressable>
                </View>
              </View>
            )
          }
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadni dodávatelia.</Text> : null}
        />
      </View>

      {deletingSupplier && (
        <ConfirmModal
          title="Zmazať dodávateľa"
          message={`Naozaj chcete zmazať dodávateľa „${deletingSupplier.name}"?`}
          onCancel={() => setDeletingSupplier(null)}
          onConfirm={() => {
            deactivateSupplier.mutate(deletingSupplier.id);
            setDeletingSupplier(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
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
  addButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  rowName: { fontSize: 16, fontWeight: '500' },
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
