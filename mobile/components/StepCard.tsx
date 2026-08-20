import { View, Text, Pressable, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { format, isPast } from 'date-fns';
import type { BatchStep } from '../types/database.types';

type Props = {
  step: BatchStep;
  batchLabel?: string;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export function StepCard({ step, batchLabel, onPress, onEdit, onDelete }: Props) {
  const isDone = step.status === 'done';
  const isSkipped = step.status === 'skipped';
  const isOverdue = step.status === 'pending' && isPast(new Date(step.due_at));

  return (
    <View style={styles.container}>
      <Pressable style={styles.pressableArea} onPress={onPress} disabled={!onPress}>
        <View style={styles.iconWrap}>
          {isDone ? (
            <Ionicons name="checkmark-circle" size={22} color="#2e7d32" />
          ) : isSkipped ? (
            <Ionicons name="close-circle-outline" size={22} color="#999" />
          ) : isOverdue ? (
            <Ionicons name="alert-circle" size={22} color="#c62828" />
          ) : (
            <Ionicons name="ellipse-outline" size={22} color="#999" />
          )}
        </View>
        <View style={styles.info}>
          {batchLabel ? <Text style={styles.batchLabel}>{batchLabel}</Text> : null}
          <Text style={[styles.title, isDone && styles.titleDone]}>{step.title}</Text>
          <Text style={[styles.due, isOverdue && styles.dueOverdue]}>
            {format(new Date(step.due_at), 'd.M. HH:mm')}
            {step.target_value != null ? ` · ciel ${step.target_value} ${step.target_unit ?? ''}` : ''}
            {isDone && step.actual_value != null ? ` · namerané ${step.actual_value} ${step.actual_unit ?? ''}` : ''}
          </Text>
        </View>
      </Pressable>
      {(onEdit || onDelete) && (
        <View style={styles.actions}>
          {onEdit && (
            <Pressable onPress={onEdit} hitSlop={8} accessibilityLabel="Upraviť krok">
              <Ionicons name="create-outline" size={18} color="#333" />
            </Pressable>
          )}
          {onDelete && (
            <Pressable onPress={onDelete} hitSlop={8} accessibilityLabel="Zmazať krok">
              <Ionicons name="trash-outline" size={18} color="#c62828" />
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  pressableArea: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingLeft: 8 },
  iconWrap: { width: 24, alignItems: 'center' },
  info: { flex: 1 },
  batchLabel: { fontSize: 12, color: '#999', textTransform: 'uppercase' },
  title: { fontSize: 16, fontWeight: '500' },
  titleDone: { color: '#999', textDecorationLine: 'line-through' },
  due: { fontSize: 13, color: '#666', marginTop: 2 },
  dueOverdue: { color: '#c62828', fontWeight: '600' },
});
