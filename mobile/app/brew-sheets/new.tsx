import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useRecipes } from '../../hooks/useRecipes';
import { useCreateBrewSheet, useCreateBrewSheetFromRecipe } from '../../hooks/useBrewSheets';
import { SelectField } from '../../components/SelectField';

export default function NewBrewSheetScreen() {
  const { data: recipes } = useRecipes();
  const createBrewSheet = useCreateBrewSheet();
  const createFromRecipe = useCreateBrewSheetFromRecipe();

  const [name, setName] = useState('');
  const [recipeId, setRecipeId] = useState<string | null>(null);
  const [batchVolume, setBatchVolume] = useState('');
  const [notes, setNotes] = useState('');

  const selectedRecipe = recipes?.find((r) => r.id === recipeId);
  const volumeNumber = Number(batchVolume);
  const canSubmit = name.trim() && batchVolume.trim() && volumeNumber > 0;
  const isSubmitting = createBrewSheet.isPending || createFromRecipe.isPending;
  const submitError = createBrewSheet.error ?? createFromRecipe.error;

  function selectRecipe(id: string) {
    setRecipeId(id);
    const recipe = recipes?.find((r) => r.id === id);
    if (recipe) {
      if (!batchVolume.trim()) setBatchVolume(String(recipe.batch_volume_liters));
      if (!name.trim()) setName(recipe.name);
    }
  }

  function handleCreate() {
    if (!canSubmit) return;
    if (recipeId) {
      createFromRecipe.mutate(
        { name: name.trim(), recipeId, batchVolumeLiters: volumeNumber },
        {
          onSuccess: (sheetId) => {
            router.replace({ pathname: '/brew-sheets/[id]', params: { id: sheetId } });
          },
        }
      );
    } else {
      createBrewSheet.mutate(
        { name: name.trim(), batchVolumeLiters: volumeNumber, notes: notes.trim() || null },
        {
          onSuccess: (sheet) => {
            router.replace({ pathname: '/brew-sheets/[id]', params: { id: sheet.id } });
          },
        }
      );
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Nový varný list</Text>

        <SelectField
          label="Načítať z receptúry (voliteľné)"
          placeholder="Bez receptúry — prázdny varný list"
          options={(recipes ?? []).map((r) => ({ id: r.id, label: r.name, sublabel: `${r.batch_volume_liters} l` }))}
          selectedId={recipeId}
          onSelect={selectRecipe}
        />
        {selectedRecipe && <Text style={styles.hint}>Suroviny z receptúry sa skopírujú a budú ďalej upraviteľné.</Text>}

        <TextInput style={styles.input} placeholder="Názov varného listu" value={name} onChangeText={setName} />

        <Text style={styles.label}>Objem várky (litre)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={batchVolume} onChangeText={setBatchVolume} placeholder="1000" />

        {!recipeId && (
          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Poznámka (voliteľné)"
            value={notes}
            onChangeText={setNotes}
            multiline
          />
        )}

        {submitError && <Text style={styles.error}>{(submitError as Error).message}</Text>}

        <Pressable style={[styles.button, !canSubmit && styles.buttonDisabled]} onPress={handleCreate} disabled={!canSubmit || isSubmitting}>
          <Text style={styles.buttonText}>{isSubmitting ? 'Vytváram...' : 'Vytvoriť varný list'}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { padding: 20 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 16 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  hint: { color: '#999', fontSize: 13, fontStyle: 'italic', marginTop: -8, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 12,
    fontSize: 16,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  error: { color: '#c62828', marginTop: 12 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
