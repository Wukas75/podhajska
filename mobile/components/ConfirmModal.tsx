import { View, Text, Pressable, Modal, StyleSheet } from 'react-native';

type Props = {
  title: string;
  message: string;
  confirmLabel?: string;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ConfirmModal({ title, message, confirmLabel = 'Zmazať', onCancel, onConfirm }: Props) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.backdrop} onPress={onCancel}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          <View style={styles.actions}>
            <Pressable style={styles.cancelButton} onPress={onCancel}>
              <Text style={styles.cancelButtonText}>Zrušiť</Text>
            </Pressable>
            <Pressable style={styles.confirmButton} onPress={onConfirm}>
              <Text style={styles.confirmButtonText}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  sheet: { backgroundColor: '#fff', borderRadius: 12, padding: 20, width: '100%', maxWidth: 360 },
  title: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  message: { fontSize: 14, color: '#444', marginBottom: 20 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  cancelButton: { paddingVertical: 10, paddingHorizontal: 14 },
  cancelButtonText: { color: '#666', fontWeight: '500' },
  confirmButton: { backgroundColor: '#c62828', borderRadius: 8, paddingVertical: 10, paddingHorizontal: 16 },
  confirmButtonText: { color: '#fff', fontWeight: '600' },
});
