import { useState } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { format } from 'date-fns';
import { useTemplates } from '../../hooks/useTemplates';
import { useTanks } from '../../hooks/useTanks';
import { useBrewSheets } from '../../hooks/useBrewSheets';
import { useCreateBatchFromTemplate } from '../../hooks/useBatches';
import { SelectField } from '../../components/SelectField';

export default function NewBatchScreen() {
  const { data: templates } = useTemplates();
  const { data: tanks } = useTanks();
  const { data: brewSheets } = useBrewSheets();
  const createBatch = useCreateBatchFromTemplate();

  const [templateId, setTemplateId] = useState<string | null>(null);
  const [tankId, setTankId] = useState<string | null>(null);
  const [brewSheetId, setBrewSheetId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [name, setName] = useState('');
  const [volume, setVolume] = useState('');

  const selectedTemplate = templates?.find((t) => t.id === templateId);
  const selectedTank = tanks?.find((t) => t.id === tankId);
  const effectiveName = name.trim() || (selectedTemplate ? `${selectedTemplate.name} — ${startDate}` : '');

  function selectBrewSheet(id: string) {
    setBrewSheetId(id);
    const sheet = brewSheets?.find((s) => s.id === id);
    if (sheet) {
      setName(sheet.name);
      setVolume(sheet.final_volume_liters != null ? String(sheet.final_volume_liters) : '');
    }
  }

  function handleCreate() {
    if (!templateId || !tankId || !effectiveName) return;
    createBatch.mutate(
      { templateId, tankId, startDate, name: effectiveName, volumeLiters: volume.trim() ? Number(volume) : null },
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

        <SelectField
          label="Varný list (voliteľné)"
          placeholder="Bez varného listu"
          options={(brewSheets ?? []).map((s) => ({
            id: s.id,
            label: s.name,
            sublabel: `Várka #${s.batch_number}${s.final_volume_liters != null ? ` · ${s.final_volume_liters} l` : ''}`,
          }))}
          selectedId={brewSheetId}
          onSelect={selectBrewSheet}
        />
        {brewSheetId && <Text style={styles.hint}>Názov a finálny objem sa prevzali z varného listu.</Text>}

        <SelectField
          label="Šablóna"
          placeholder="Vyberte šablónu"
          emptyHint="Najprv vytvorte šablónu v záložke Šablóny."
          options={(templates ?? []).map((t) => ({ id: t.id, label: t.name, sublabel: t.style }))}
          selectedId={templateId}
          onSelect={setTemplateId}
        />

        <SelectField
          label="Tank"
          placeholder="Vyberte tank"
          emptyHint="Najprv pridajte tank v záložke Tanky."
          options={(tanks ?? []).map((t) => ({
            id: t.id,
            label: t.name,
            sublabel: t.capacity_liters ? `${t.capacity_liters} l` : null,
          }))}
          selectedId={tankId}
          onSelect={setTankId}
        />

        <Text style={styles.label}>Dátum začiatku (RRRR-MM-DD)</Text>
        <TextInput style={styles.input} value={startDate} onChangeText={setStartDate} placeholder="2026-08-14" />

        <Text style={styles.label}>Názov šarže (voliteľné)</Text>
        <TextInput style={styles.input} value={name} onChangeText={setName} placeholder={effectiveName || 'Automaticky odvodené'} />

        <Text style={styles.label}>Objem (litre, voliteľné)</Text>
        <TextInput style={styles.input} keyboardType="numeric" value={volume} onChangeText={setVolume} />

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
  hint: { color: '#999', fontSize: 13, fontStyle: 'italic', marginTop: -6 },
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
