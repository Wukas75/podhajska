import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useCreateTank, useTanks, useUpdateTank, useDeactivateTank } from '../../hooks/useTanks';
import { ConfirmModal } from '../../components/ConfirmModal';
import type { Tank } from '../../types/database.types';

function TankEditRow({ tank, onCancel }: { tank: Tank; onCancel: () => void }) {
  const updateTank = useUpdateTank();
  const [name, setName] = useState(tank.name);
  const [capacity, setCapacity] = useState(tank.capacity_liters != null ? String(tank.capacity_liters) : '');

  function handleSave() {
    if (!name.trim()) return;
    updateTank.mutate(
      { id: tank.id, name: name.trim(), capacity_liters: capacity.trim() ? Number(capacity) : null },
      { onSuccess: onCancel }
    );
  }

  return (
    <View style={styles.editRow}>
      <View style={styles.form}>
        <TextInput style={styles.input} placeholder="Názov tanku" value={name} onChangeText={setName} />
        <TextInput
          style={[styles.input, styles.inputSmall]}
          placeholder="Litre"
          keyboardType="numeric"
          value={capacity}
          onChangeText={setCapacity}
        />
      </View>
      {updateTank.error && <Text style={styles.error}>{(updateTank.error as Error).message}</Text>}
      <View style={styles.editActions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Zrušiť</Text>
        </Pressable>
        <Pressable
          style={[styles.saveButton, !name.trim() && styles.buttonDisabled]}
          onPress={handleSave}
          disabled={!name.trim() || updateTank.isPending}
        >
          <Text style={styles.saveButtonText}>{updateTank.isPending ? 'Ukladám...' : 'Uložiť'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function TanksScreen() {
  const { data: tanks, isLoading, error, refetch, isRefetching } = useTanks();
  const createTank = useCreateTank();
  const deactivateTank = useDeactivateTank();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');
  const [editingTankId, setEditingTankId] = useState<string | null>(null);
  const [deletingTank, setDeletingTank] = useState<Tank | null>(null);

  function handleAdd() {
    if (!name.trim()) return;
    const capacityLiters = capacity.trim() ? Number(capacity) : null;
    createTank.mutate(
      { name: name.trim(), capacity_liters: capacityLiters },
      { onSuccess: () => { setName(''); setCapacity(''); } }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Tanky</Text>

        <View style={styles.form}>
          <TextInput style={styles.input} placeholder="Názov tanku" value={name} onChangeText={setName} />
          <TextInput
            style={[styles.input, styles.inputSmall]}
            placeholder="Litre"
            keyboardType="numeric"
            value={capacity}
            onChangeText={setCapacity}
          />
          <Pressable style={styles.addButton} onPress={handleAdd} disabled={createTank.isPending || !name.trim()}>
            <Text style={styles.addButtonText}>{createTank.isPending ? '...' : 'Pridať'}</Text>
          </Pressable>
        </View>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={tanks ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }: { item: Tank }) =>
            editingTankId === item.id ? (
              <TankEditRow tank={item} onCancel={() => setEditingTankId(null)} />
            ) : (
              <View style={styles.tankRow}>
                <View>
                  <Text style={styles.tankName}>{item.name}</Text>
                  {item.capacity_liters ? <Text style={styles.tankCapacity}>{item.capacity_liters} l</Text> : null}
                </View>
                <View style={styles.actions}>
                  <Pressable onPress={() => setEditingTankId(item.id)} hitSlop={8} accessibilityLabel="Upraviť tank">
                    <Ionicons name="create-outline" size={18} color="#333" />
                  </Pressable>
                  <Pressable onPress={() => setDeletingTank(item)} hitSlop={8} accessibilityLabel="Zmazať tank">
                    <Ionicons name="trash-outline" size={18} color="#c62828" />
                  </Pressable>
                </View>
              </View>
            )
          }
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadne tanky.</Text> : null}
        />
      </View>

      {deletingTank && (
        <ConfirmModal
          title="Zmazať tank"
          message={`Naozaj chcete zmazať tank „${deletingTank.name}"?`}
          onCancel={() => setDeletingTank(null)}
          onConfirm={() => {
            deactivateTank.mutate(deletingTank.id);
            setDeletingTank(null);
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
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
  addButton: {
    backgroundColor: '#1a1a1a',
    borderRadius: 8,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  addButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
  tankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tankName: { fontSize: 16, fontWeight: '500' },
  tankCapacity: { fontSize: 14, color: '#666' },
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
