import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { BatchStep } from '../types/database.types';

type Props = {
  step: BatchStep;
  onSubmit: (values: { actual_value: number | null; actual_unit: string | null; notes: string | null }) => void;
  onSkip: () => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function RecordValueModal({ step, onSubmit, onSkip, onCancel, isSubmitting }: Props) {
  const [actualValue, setActualValue] = useState(step.target_value != null ? String(step.target_value) : '');
  const [actualUnit, setActualUnit] = useState(step.target_unit ?? '');
  const [notes, setNotes] = useState('');

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{step.title}</Text>
      {step.instruction ? <Text style={styles.instruction}>{step.instruction}</Text> : null}

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.small]}
          placeholder="Nameraná hodnota"
          keyboardType="numeric"
          value={actualValue}
          onChangeText={setActualValue}
        />
        <TextInput style={[styles.input, styles.small]} placeholder="Jednotka" value={actualUnit} onChangeText={setActualUnit} />
      </View>

      <TextInput style={[styles.input, styles.textArea]} placeholder="Poznámka (voliteľné)" value={notes} onChangeText={setNotes} multiline />

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Zrušiť</Text>
        </Pressable>
        <Pressable style={styles.skipButton} onPress={onSkip}>
          <Text style={styles.skipButtonText}>Preskočiť</Text>
        </Pressable>
        <Pressable
          style={styles.submitButton}
          disabled={isSubmitting}
          onPress={() =>
            onSubmit({
              actual_value: actualValue.trim() ? Number(actualValue) : null,
              actual_unit: actualUnit.trim() || null,
              notes: notes.trim() || null,
            })
          }
        >
          <Text style={styles.submitButtonText}>{isSubmitting ? '...' : 'Označiť hotové'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 14, marginVertical: 6 },
  title: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  instruction: { fontSize: 13, color: '#666', marginBottom: 10 },
  row: { flexDirection: 'row', gap: 8 },
  small: { flex: 1 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  textArea: { minHeight: 50, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, flexWrap: 'wrap' },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 12 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  skipButton: { paddingVertical: 10, paddingHorizontal: 12 },
  skipButtonText: { color: '#c62828', fontWeight: '500' },
  submitButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
