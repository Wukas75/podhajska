import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import type { StepType } from '../types/database.types';
import type { TemplateStepInput } from '../hooks/useTemplates';

const STEP_TYPES: { value: StepType; label: string }[] = [
  { value: 'temperature', label: 'Teplota' },
  { value: 'gravity', label: 'Gravity' },
  { value: 'dry_hop', label: 'Dry hop' },
  { value: 'transfer', label: 'Prečerpanie' },
  { value: 'custom', label: 'Iné' },
];

type Props = {
  initial?: Partial<TemplateStepInput>;
  submitLabel: string;
  onSubmit: (input: TemplateStepInput) => void;
  onCancel?: () => void;
  isSubmitting?: boolean;
};

export function TemplateStepEditor({ initial, submitLabel, onSubmit, onCancel, isSubmitting }: Props) {
  const [dayOffset, setDayOffset] = useState(String(initial?.day_offset ?? 0));
  const [timeOfDay, setTimeOfDay] = useState(initial?.time_of_day ?? '09:00');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [stepType, setStepType] = useState<StepType>(initial?.step_type ?? 'temperature');
  const [targetValue, setTargetValue] = useState(initial?.target_value != null ? String(initial.target_value) : '');
  const [targetUnit, setTargetUnit] = useState(initial?.target_unit ?? '');
  const [instruction, setInstruction] = useState(initial?.instruction ?? '');

  function handleSubmit() {
    if (!title.trim()) return;
    onSubmit({
      day_offset: Number(dayOffset) || 0,
      time_of_day: timeOfDay.trim() || '09:00',
      title: title.trim(),
      step_type: stepType,
      target_value: targetValue.trim() ? Number(targetValue) : null,
      target_unit: targetUnit.trim() || null,
      instruction: instruction.trim() || null,
      sort_order: initial?.sort_order ?? 0,
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.row}>
        <TextInput
          style={[styles.input, styles.small]}
          placeholder="Deň"
          keyboardType="numeric"
          value={dayOffset}
          onChangeText={setDayOffset}
        />
        <TextInput
          style={[styles.input, styles.small]}
          placeholder="Čas (HH:MM)"
          value={timeOfDay}
          onChangeText={setTimeOfDay}
        />
      </View>

      <TextInput style={styles.input} placeholder="Názov kroku (napr. Zvýš teplotu)" value={title} onChangeText={setTitle} />

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
        {onCancel && (
          <Pressable style={styles.cancelButton} onPress={onCancel}>
            <Text style={styles.cancelButtonText}>Zrušiť</Text>
          </Pressable>
        )}
        <Pressable style={[styles.submitButton, !title.trim() && styles.buttonDisabled]} onPress={handleSubmit} disabled={!title.trim() || isSubmitting}>
          <Text style={styles.submitButtonText}>{isSubmitting ? '...' : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 16 },
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
