import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { format } from 'date-fns';
import type { StepType } from '../types/database.types';
import type { BatchStepPatch } from '../hooks/useBatchSteps';

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'temperature', label: 'Teplota' },
  { value: 'gravity', label: 'Gravity' },
  { value: 'dry_hop', label: 'Dry hop' },
  { value: 'transfer', label: 'Prečerpanie' },
  { value: 'custom', label: 'Iné' },
];

type Props = {
  initial?: Partial<BatchStepPatch>;
  submitLabel: string;
  onSubmit: (patch: BatchStepPatch) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function BatchStepEditor({ initial, submitLabel, onSubmit, onCancel, isSubmitting }: Props) {
  const due = initial?.due_at ? new Date(initial.due_at) : new Date();
  const [dateStr, setDateStr] = useState(format(due, 'yyyy-MM-dd'));
  const [timeStr, setTimeStr] = useState(format(due, 'HH:mm'));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [stepType, setStepType] = useState<StepType>(initial?.step_type ?? 'custom');
  const [targetValue, setTargetValue] = useState(initial?.target_value != null ? String(initial.target_value) : '');
  const [targetUnit, setTargetUnit] = useState(initial?.target_unit ?? '');
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');

  function handleSubmit() {
    if (!title.trim() || !dateStr.trim() || !timeStr.trim()) return;
    const dueAt = new Date(`${dateStr.trim()}T${timeStr.trim()}`);
    if (Number.isNaN(dueAt.getTime())) return;
    onSubmit({
      title: title.trim(),
      due_at: dueAt.toISOString(),
      step_type: stepType,
      target_value: targetValue.trim() ? Number(targetValue) : null,
      target_unit: targetUnit.trim() || null,
      instruction: instruction.trim() || null,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput style={[styles.input, styles.small]} placeholder="Dátum (RRRR-MM-DD)" value={dateStr} onChangeText={setDateStr} />
        <TextInput style={[styles.input, styles.small]} placeholder="Čas (HH:MM)" value={timeStr} onChangeText={setTimeStr} />
      </View>

      <TextInput style={styles.input} placeholder="Názov kroku" value={title} onChangeText={setTitle} />

      <View style={styles.typeRow}>
        {STEP_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.typeChip, stepType === t.value && styles.typeChipActive]}
            onPress={() => setStepType(t.value)}
          >
            <Text style={[styles.typeChipText, stepType === t.value && styles.typeChipTextActive]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.small]}
          placeholder="Cieľová hodnota"
          keyboardType="numeric"
          value={targetValue}
          onChangeText={setTargetValue}
        />
        <TextInput style={[styles.input, styles.small]} placeholder="Jednotka (°C, SG...)" value={targetUnit} onChangeText={setTargetUnit} />
      </View>

      <TextInput
        style={[styles.input, styles.textArea]}
        placeholder="Poznámka / inštrukcia (voliteľné)"
        value={instruction}
        onChangeText={setInstruction}
        multiline
      />

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Zrušiť</Text>
        </Pressable>
        <Pressable
          style={[styles.submitButton, !title.trim() && styles.buttonDisabled]}
          onPress={handleSubmit}
          disabled={!title.trim() || isSubmitting}
        >
          <Text style={styles.submitButtonText}>{isSubmitting ? '...' : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  small: { flex: 1, minWidth: 0 },
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
  textArea: { minHeight: 60, textAlignVertical: 'top' },
  typeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 10 },
  typeChip: { borderWidth: 1, borderColor: '#ddd', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  typeChipActive: { backgroundColor: '#1a1a1a', borderColor: '#1a1a1a' },
  typeChipText: { fontSize: 13, color: '#333' },
  typeChipTextActive: { color: '#fff' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 4 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  submitButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
