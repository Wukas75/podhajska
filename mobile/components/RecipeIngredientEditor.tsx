import { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet } from 'react-native';
import { SelectField, type SelectOption } from './SelectField';

type Props = {
  initial?: { ingredientId: string; quantity: number };
  ingredientOptions: SelectOption[];
  submitLabel: string;
  onSubmit: (input: { ingredientId: string; quantity: number }) => void;
  onCancel: () => void;
  isSubmitting?: boolean;
};

export function RecipeIngredientEditor({ initial, ingredientOptions, submitLabel, onSubmit, onCancel, isSubmitting }: Props) {
  const [ingredientId, setIngredientId] = useState<string | null>(initial?.ingredientId ?? null);
  const [quantity, setQuantity] = useState(initial?.quantity != null ? String(initial.quantity) : '');

  const canSubmit = ingredientId && quantity.trim() && Number(quantity) > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    onSubmit({ ingredientId, quantity: Number(quantity) });
  }

  return (
    <View style={styles.container}>
      <SelectField
        label="Surovina"
        placeholder="Vyberte surovinu"
        emptyHint="Najprv pridajte surovinu v zázložke Sklad."
        options={ingredientOptions}
        selectedId={ingredientId}
        onSelect={setIngredientId}
      />
      <Text style={styles.label}>Množstvo</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={quantity} onChangeText={setQuantity} placeholder="0" />

      <View style={styles.actions}>
        <Pressable style={styles.cancelButton} onPress={onCancel}>
          <Text style={styles.cancelButtonText}>Zrušiť</Text>
        </Pressable>
        <Pressable style={[styles.submitButton, !canSubmit && styles.buttonDisabled]} onPress={handleSubmit} disabled={!canSubmit || isSubmitting}>
          <Text style={styles.submitButtonText}>{isSubmitting ? '...' : submitLabel}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 14, marginBottom: 12 },
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#fff',
    fontSize: 15,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 12 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  submitButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  buttonDisabled: { opacity: 0.5 },
  submitButtonText: { color: '#fff', fontWeight: '600' },
});
