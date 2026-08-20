import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useCreateRecipe } from '../../hooks/useRecipes';

export default function NewRecipeScreen() {
  const [name, setName] = useState('');
  const [style, setStyle] = useState('');
  const [batchVolume, setBatchVolume] = useState('1000');
  const [notes, setNotes] = useState('');
  const createRecipe = useCreateRecipe();

  const volumeNumber = Number(batchVolume);
  const canSubmit = name.trim() && batchVolume.trim() && volumeNumber > 0;

  function handleCreate() {
    if (!canSubmit) return;
    createRecipe.mutate(
      { name: name.trim(), style: style.trim() || null, batchVolumeLiters: volumeNumber, notes: notes.trim() || null },
      {
        onSuccess: (recipe) => {
          router.replace({ pathname: '/recipes/[id]', params: { id: recipe.id } });
        },
      }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nová receptúra</Text>

        <TextInput style={styles.input} placeholder="Názov (napr. Svetlý ležiak 12°)" value={name} onChangeText={setName} />
        <TextInput style={styles.input} placeholder="Štýl (napr. Pilsner)" value={style} onChangeText={setStyle} />

        <Text style={styles.label}>Objem várky (litre)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={batchVolume} onChangeText={setBatchVolume} placeholder="1000" />

        <TextInput
          style={[styles.input, styles.textArea]}
          placeholder="Poznámka (voliteľné)"
          value={notes}
          onChangeText={setNotes}
          multiline
        />

        {createRecipe.error && <Text style={styles.error}>{(createRecipe.error as Error).message}</Text>}

        <Pressable
          style={[styles.button, !canSubmit && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!canSubmit || createRecipe.isPending}
        >
          <Text style={styles.buttonText}>{createRecipe.isPending ? 'Vytváram...' : 'Vytvoriť a pridať suroviny'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 4, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#c62828', marginBottom: 12 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 14, alignItems: 'center' },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
