import { View, Text, FlatList, Pressable, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, Stack } from 'expo-router';
import { format, parseISO } from 'date-fns';
import { useStockReceipts, type StockReceiptWithItems } from '../../hooks/useStockReceipts';

export default function StockReceiptsScreen() {
  const { data: receipts, isLoading, error, refetch, isRefetching } = useStockReceipts();

  return (
    <SafeAreaView style={styles.container}>
      <Stack.Screen options={{ title: 'Príjemky', headerShown: true }} />
      <View style={styles.content}>
        <Link href="/inventory/receipt-new" asChild>
          <Pressable style={styles.addButton}>
            <Text style={styles.addButtonText}>+ Nová príjemka</Text>
          </Pressable>
        </Link>

        {isLoading && <ActivityIndicator style={{ marginTop: 20 }} />}
        {error && <Text style={styles.error}>{(error as Error).message}</Text>}

        <FlatList
          data={receipts ?? []}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ paddingTop: 8 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
          renderItem={({ item }: { item: StockReceiptWithItems }) => (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardDate}>{format(parseISO(item.receipt_date), 'd.M.yyyy')}</Text>
                {item.document_number ? <Text style={styles.cardDoc}>{item.document_number}</Text> : null}
              </View>
              <Text style={styles.cardSupplier}>{item.supplier?.name ?? 'Neznámy dodávateľ'}</Text>
              {item.items.map((it) => (
                <View key={it.id} style={styles.itemRow}>
                  <Text style={styles.itemName}>{it.ingredient?.name ?? '—'}</Text>
                  <Text style={styles.itemQty}>
                    {it.quantity} {it.ingredient?.unit ?? ''}
                  </Text>
                </View>
              ))}
            </View>
          )}
          ListEmptyComponent={!isLoading ? <Text style={styles.empty}>Zatiaľ žiadne príjemky.</Text> : null}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  content: { flex: 1, padding: 20 },
  addButton: { backgroundColor: '#1a1a1a', borderRadius: 8, paddingVertical: 10, alignItems: 'center', marginBottom: 8 },
  addButtonText: { color: '#fff', fontWeight: '600' },
  error: { color: '#c62828', marginTop: 8 },
  card: { backgroundColor: '#f7f7f7', borderRadius: 10, padding: 14, marginTop: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardDate: { fontSize: 13, fontWeight: '600', color: '#666' },
  cardDoc: { fontSize: 13, color: '#999' },
  cardSupplier: { fontSize: 16, fontWeight: '700', marginTop: 4, marginBottom: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  itemName: { fontSize: 14, color: '#333' },
  itemQty: { fontSize: 14, color: '#666' },
  empty: { color: '#999', marginTop: 24, textAlign: 'center' },
});
