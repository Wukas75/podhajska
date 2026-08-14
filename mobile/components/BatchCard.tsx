import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Link } from 'expo-router';
import { format } from 'date-fns';
import type { BatchWithTank } from '../hooks/useBatches';

export function BatchCard({ batch }: { batch: BatchWithTank }) {
  return (
    <Link href={{ pathname: '/batches/[id]', params: { id: batch.id } }} asChild>
      <Pressable style={styles.container}>
        <View>
          <Text style={styles.name}>{batch.name}</Text>
          <Text style={styles.meta}>
            {batch.tank?.name ?? 'Bez tanku'} · od {format(new Date(batch.start_date), 'd.M.yyyy')}
          </Text>
        </View>
        <Text style={styles.status}>{batch.status}</Text>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  name: { fontSize: 16, fontWeight: '500' },
  meta: { fontSize: 13, color: '#666', marginTop: 2 },
  status: { fontSize: 12, color: '#999', textTransform: 'uppercase' },
});
