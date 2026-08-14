import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useTemplates } from '../../hooks/useTemplates';
import { useTanks } from '../../hooks/useTanks';
import { useCreateBatchFromTemplate } from '../../hooks/useBatches';

export default function NewBatchScreen() {
  const { data: templates } = useTemplates();
  const { data: tanks } = useTanks();
  const createBatch = useCreateBatchFromTemplate();

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [tankId, setTankId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [name, setName] = useState('');

  const selectedTemplate = templates?.find((t) => t.id === templateId);
  const selectedTank = tanks?.find((t) => t.id === tankId);
  const effectiveName = name.trim() || (selectedTemplate ? `${selectedTemplate.name} — ${startDate}` : '');

  function handleCreate() {
    if (!templateId || !tankId || !effectiveName) return;
    createBatch.mutate(
      { templateId, tankId, startDate, name: effectiveName },
      {
        onSuccess: (batchId) => {
          router.replace({ pathname: '/batches/[id]', params: { id: batchId } });
        },
      }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Nová šarža</Text>

        <Text style={styles.label}>Šablóna</Text>
        <View style={styles.optionList}>
          {(templates ?? []).map((t) => (
            <Pressable
              key={t.id}
              style={[styles.option, templateId === t.id && styles.optionActive]}
              onPress={() => setTemplateId(t.id)}
            >
              <Text style={[styles.optionText, templateId === t.id && styles.optionTextActive]}>{t.name}</Text>
            </Pressable>
          ))}
          {(templates ?? []).length === 0 && <Text style={styles.hint}>Najprv vytvorte šablónu v záložke Šablóny.</Text>}
        </View>

        <Text style={styles.label}>Tank</Text>
        <View style={styles.optionList}>
          {(tanks ?? []).map((t) => (
            <Pressable
              key={t.id}
              style={[styles.option, tankId === t.id && styles.optionActive]}
              onPress={() => setTankId(t.id)}
            >
              <Text style={[styles.optionText, tankId === t.id && styles.optionTextActive]}>{t.name}</Text>
            </Pressable>
          ))}
          {(tanks ?? []).length === 0 && <Text style={styles.hint}>Najprv pridajte tank v záložke Tanky.</Text>}
        </View>

        <Text style={styles.label}>Dátum začiatku (RRRR-MM-DD)</Text>
        <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-08-14" />

        <Text style={styles.label}>Názov šarže (voliteľné)</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={effectiveName || 'Automaticky odvodené'} />

        {selectedTemplate && selectedTank && (
          <Text style={styles.summary}>
            Vytvorí sa šarža „{effectiveName}" v tanku {selectedTank.name} podľa šablóny {selectedTemplate.name}.
          </Text>
        )}

        {createBatch.error && <Text style={styles.error}>{(createBatch.error as Error).message}</Text>}

        <Pressable
          style={[styles.button, (!templateId || !tankId || createBatch.isPending) && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={!templateId || !tankId || createBatch.isPending}
        >
          <Text style={styles.buttonText}>{createBatch.isPending ? 'Vytváram...' : 'Založiť šaržu'}</Text>
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
  optionList: { gap: 8 },
  option: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12 },
  optionActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  optionText: { fontSize: 15 },
  optionTextActive: { color: '#fff' },
  hint: { color: '#999', fontSize: 13, fontStyle: 'italic' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  summary: { fontSize: 14, color: '#666', marginTop: 16, lineHeight: 20 },
  error: { color: '#c62828', marginTop: 12 },
  button: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 14, alignItems: 'center', marginTop: 24 },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
