import { useState } from 'react';
import { View, Text, TextInput, Pressable, FlatList, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCreateTank, useTanks } from '../../hooks/useTanks';
import type { Tank } from '../../types/database.types';

export default function TanksScreen() {
  const { data: tanks, isLoading, error } = useTanks();
  const createTank = useCreateTank();
  const [name, setName] = useState('');
  const [capacity, setCapacity] = useState('');

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
          renderItem={({ item }: { item: Tank }) => (
            <View style={styles.tankRow}>
              <Text style={styles.tankName}>{item.name}</Text>
              {item.capacity_liters ? <Text style={styles.tankCapacity}>{item.capacity_liters} l</Text> : null}
            </View>
          )}
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadne tanky.</Text> : null}
        />
      </View>
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
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  tankName: { fontSize: 16, fontWeight: '500' },
  tankCapacity: { fontSize: 14, color: '#666' },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
});
