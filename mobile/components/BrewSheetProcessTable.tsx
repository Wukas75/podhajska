import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { BrewSheetProcessStep } from '../types/database.types';
import type { ProcessStepValues } from '../hooks/useBrewSheetProcessSteps';

const CELL_WIDTH = 130;

function rowToValues(row: BrewSheetProcessStep): ProcessStepValues {
  return {
    stepName: row.step_name,
    value2: row.value_2,
    value3: row.value_3,
    value4: row.value_4,
    value5: row.value_5,
    value6: row.value_6,
  };
}

function ProcessStepRow({
  row,
  isFirst,
  isLast,
  onSave,
  onMove,
  onDuplicate,
  onDelete,
}: {
  row: BrewSheetProcessStep;
  isFirst: boolean;
  isLast: boolean;
  onSave: (values: ProcessStepValues) => void;
  onMove: (direction: -1 | 1) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [values, setValues] = useState<ProcessStepValues>(rowToValues(row));

  useEffect(() => {
    setValues(rowToValues(row));
  }, [row.step_name, row.value_2, row.value_3, row.value_4, row.value_5, row.value_6]);

  function updateField(field: keyof ProcessStepValues, text: string) {
    setValues((prev) => ({ ...prev, [field]: text }));
  }

  function commit() {
    onSave(values);
  }

  return (
    <View style={styles.rowContainer}>
      <View style={styles.actionsCol}>
        <View style={styles.actionsRow}>
          <Pressable onPress={() => onMove(-1)} disabled={isFirst} hitSlop={6} accessibilityLabel="Posunúť riadok hore">
            <Ionicons name="chevron-up" size={16} color={isFirst ? '#ccc' : '#333'} />
          </Pressable>
          <Pressable onPress={() => onMove(1)} disabled={isLast} hitSlop={6} accessibilityLabel="Posunúť riadok dole">
            <Ionicons name="chevron-down" size={16} color={isLast ? '#ccc' : '#333'} />
          </Pressable>
        </View>
        <View style={styles.actionsRow}>
          <Pressable onPress={onDuplicate} hitSlop={6} accessibilityLabel="Kopírovať riadok">
            <Ionicons name="copy-outline" size={16} color="#333" />
          </Pressable>
          <Pressable onPress={onDelete} hitSlop={6} accessibilityLabel="Zmazať riadok">
            <Ionicons name="trash-outline" size={16} color="#c62828" />
          </Pressable>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cellsScroll}>
        <TextInput
          style={styles.cell}
          value={values.stepName ?? ''}
          onChangeText={(t) => updateField('stepName', t)}
          onBlur={commit}
          placeholder="napr. Ohrev"
        />
        <TextInput style={styles.cell} value={values.value2 ?? ''} onChangeText={(t) => updateField('value2', t)} onBlur={commit} />
        <TextInput style={styles.cell} value={values.value3 ?? ''} onChangeText={(t) => updateField('value3', t)} onBlur={commit} />
        <TextInput style={styles.cell} value={values.value4 ?? ''} onChangeText={(t) => updateField('value4', t)} onBlur={commit} />
        <TextInput style={styles.cell} value={values.value5 ?? ''} onChangeText={(t) => updateField('value5', t)} onBlur={commit} />
        <TextInput style={styles.cell} value={values.value6 ?? ''} onChangeText={(t) => updateField('value6', t)} onBlur={commit} />
      </ScrollView>
    </View>
  );
}

type Props = {
  rows: BrewSheetProcessStep[];
  onSaveRow: (id: string, values: ProcessStepValues) => void;
  onMoveRow: (row: BrewSheetProcessStep, direction: -1 | 1) => void;
  onDuplicateRow: (row: BrewSheetProcessStep) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: () => void;
};

export function BrewSheetProcessTable({ rows, onSaveRow, onMoveRow, onDuplicateRow, onDeleteRow, onAddRow }: Props) {
  return (
    <View>
      {rows.map((row, index) => (
        <ProcessStepRow
          key={row.id}
          row={row}
          isFirst={index === 0}
          isLast={index === rows.length - 1}
          onSave={(values) => onSaveRow(row.id, values)}
          onMove={(direction) => onMoveRow(row, direction)}
          onDuplicate={() => onDuplicateRow(row)}
          onDelete={() => onDeleteRow(row.id)}
        />
      ))}
      {rows.length === 0 && <Text style={styles.empty}>Zatiaľ žiadne kroky postupu.</Text>}
      <Pressable style={styles.addButton} onPress={onAddRow}>
        <Text style={styles.addButtonText}>+ Pridať riadok</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  actionsCol: { gap: 4, marginRight: 8 },
  actionsRow: { flexDirection: 'row', gap: 8 },
  cellsScroll: { flex: 1 },
  cell: {
    width: CELL_WIDTH,
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginRight: 6,
    fontSize: 14,
  },
  empty: { color: '#999', marginTop: 12, marginBottom: 12, textAlign: 'center' },
  addButton: { paddingVertical: 14, alignItems: 'center' },
  addButtonText: { color: '#1a1a1a', fontWeight: '600' },
});
