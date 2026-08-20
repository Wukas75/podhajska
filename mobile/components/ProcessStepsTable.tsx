import { useState, useEffect } from 'react';
import { View, Text, TextInput, Pressable, ScrollView, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProcessStepValues, ProcessStepRowShape } from '../hooks/useBrewSheetProcessSteps';

const CELL_WIDTH = 130;
const ROW_HEIGHT = 48;

export type ProcessStepRow = ProcessStepRowShape & { id: string };

const COLUMN_LABELS = ['Proces', 'Čas od', 'Čas do', 'Teplota', 'Kotol', 'Poznámka'];
const COLUMN_PLACEHOLDERS = ['napr. Ohrev', 'napr. 08:00', 'napr. 09:00', 'napr. 65°C', 'napr. Varná panva', ''];

function rowToValues(row: ProcessStepRow): ProcessStepValues {
  return {
    stepName: row.step_name,
    value2: row.value_2,
    value3: row.value_3,
    value4: row.value_4,
    value5: row.value_5,
    value6: row.value_6,
  };
}

function ProcessStepDataRow({ row, onSave }: { row: ProcessStepRow; onSave: (values: ProcessStepValues) => void }) {
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

  const fields: (keyof ProcessStepValues)[] = ['stepName', 'value2', 'value3', 'value4', 'value5', 'value6'];

  return (
    <View style={styles.dataRow}>
      {fields.map((field, i) => (
        <TextInput
          key={field}
          style={styles.cell}
          value={values[field] ?? ''}
          onChangeText={(t) => updateField(field, t)}
          onBlur={commit}
          placeholder={COLUMN_PLACEHOLDERS[i]}
        />
      ))}
    </View>
  );
}

type Props = {
  rows: ProcessStepRow[];
  onSaveRow: (id: string, values: ProcessStepValues) => void;
  onMoveRow: (row: ProcessStepRow, direction: -1 | 1) => void;
  onDuplicateRow: (row: ProcessStepRow) => void;
  onDeleteRow: (id: string) => void;
  onAddRow: () => void;
};

export function ProcessStepsTable({ rows, onSaveRow, onMoveRow, onDuplicateRow, onDeleteRow, onAddRow }: Props) {
  return (
    <View>
      <View style={styles.tableBody}>
        <View style={styles.actionsCol}>
          <View style={styles.headerSpacer} />
          {rows.map((row, index) => (
            <View key={row.id} style={styles.actionsCell}>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => onMoveRow(row, -1)} disabled={index === 0} hitSlop={6} accessibilityLabel="Posunúť riadok hore">
                  <Ionicons name="chevron-up" size={16} color={index === 0 ? '#ccc' : '#333'} />
                </Pressable>
                <Pressable
                  onPress={() => onMoveRow(row, 1)}
                  disabled={index === rows.length - 1}
                  hitSlop={6}
                  accessibilityLabel="Posunúť riadok dole"
                >
                  <Ionicons name="chevron-down" size={16} color={index === rows.length - 1 ? '#ccc' : '#333'} />
                </Pressable>
              </View>
              <View style={styles.actionsRow}>
                <Pressable onPress={() => onDuplicateRow(row)} hitSlop={6} accessibilityLabel="Kopírovať riadok">
                  <Ionicons name="copy-outline" size={16} color="#333" />
                </Pressable>
                <Pressable onPress={() => onDeleteRow(row.id)} hitSlop={6} accessibilityLabel="Zmazať riadok">
                  <Ionicons name="trash-outline" size={16} color="#c62828" />
                </Pressable>
              </View>
            </View>
          ))}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.cellsScroll}>
          <View>
            <View style={styles.headerRow}>
              {COLUMN_LABELS.map((label) => (
                <Text key={label} style={styles.headerCell}>
                  {label}
                </Text>
              ))}
            </View>
            {rows.map((row) => (
              <ProcessStepDataRow key={row.id} row={row} onSave={(values) => onSaveRow(row.id, values)} />
            ))}
          </View>
        </ScrollView>
      </View>

      {rows.length === 0 && <Text style={styles.empty}>Zatiaľ žiadne kroky postupu.</Text>}
      <Pressable style={styles.addButton} onPress={onAddRow}>
        <Text style={styles.addButtonText}>+ Pridať riadok</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  tableBody: { flexDirection: 'row' },
  actionsCol: { width: 56 },
  headerSpacer: { height: ROW_HEIGHT },
  actionsCell: { height: ROW_HEIGHT, justifyContent: 'center', gap: 4, borderTopWidth: 1, borderTopColor: '#eee' },
  actionsRow: { flexDirection: 'row', gap: 8 },
  cellsScroll: { flex: 1 },
  headerRow: { flexDirection: 'row', height: ROW_HEIGHT, alignItems: 'center' },
  headerCell: {
    width: CELL_WIDTH,
    marginRight: 6,
    fontSize: 12,
    fontWeight: '700',
    color: '#666',
    textTransform: 'uppercase',
  },
  dataRow: { flexDirection: 'row', height: ROW_HEIGHT, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#eee' },
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
