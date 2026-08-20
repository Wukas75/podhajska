import { useState } from 'react';
import { View, Text, Pressable, Modal, FlatList, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type SelectOption = { id: string; label: string; sublabel?: string | null };

type Props = {
  label: string;
  placeholder: string;
  emptyHint?: string;
  options: SelectOption[];
  selectedId: string | null;
  onSelect: (id: string) => void;
};

export function SelectField({ label, placeholder, emptyHint, options, selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();
  const selected = options.find((o) => o.id === selectedId);

  return (
    <>
      <Text style={styles.label}>{label}</Text>
      <Pressable style={styles.selectField} onPress={() => options.length > 0 && setOpen(true)} disabled={options.length === 0}>
        <Text style={selected ? styles.selectValue : styles.selectPlaceholder}>
          {selected ? selected.label : options.length === 0 ? emptyHint ?? placeholder : placeholder}
        </Text>
        {options.length > 0 && <Text style={styles.selectChevron}>▾</Text>}
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={[styles.modalSheet, { paddingBottom: insets.bottom + 12 }]}>
            <Text style={styles.modalTitle}>{label}</Text>
            <FlatList
              data={options}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  style={[styles.modalOption, item.id === selectedId && styles.modalOptionActive]}
                  onPress={() => {
                    onSelect(item.id);
                    setOpen(false);
                  }}
                >
                  <Text style={[styles.modalOptionText, item.id === selectedId && styles.modalOptionTextActive]}>{item.label}</Text>
                  {item.sublabel ? <Text style={styles.modalOptionSubtext}>{item.sublabel}</Text> : null}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 13, fontWeight: '600', color: '#666', marginBottom: 8, marginTop: 12, textTransform: 'uppercase' },
  selectField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  selectValue: { fontSize: 15, color: '#000' },
  selectPlaceholder: { fontSize: 15, color: '#999' },
  selectChevron: { fontSize: 14, color: '#999' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: '#fff', borderTopLeftRadius: 16, borderTopRightRadius: 16, maxHeight: '70%' },
  modalTitle: { fontSize: 16, fontWeight: '700', padding: 16, borderBottomWidth: 1, borderBottomColor: '#eee' },
  modalOption: { paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#f2f2f2' },
  modalOptionActive: { backgroundColor: '#f7f7f7' },
  modalOptionText: { fontSize: 16 },
  modalOptionTextActive: { fontWeight: '700' },
  modalOptionSubtext: { fontSize: 13, color: '#666', marginTop: 2 },
});
