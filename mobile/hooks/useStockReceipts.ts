import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { StockReceipt } from '../types/database.types';

export type StockReceiptItemInput = {
  ingredient_id: string;
  quantity: number;
  unit_price?: number | null;
  notes?: string | null;
};

export type StockReceiptWithItems = StockReceipt & {
  supplier: { name: string } | null;
  items: { id: string; quantity: number; unit_price: number | null; ingredient: { name: string; unit: string } | null }[];
};

export function useStockReceipts() {
  return useQuery({
    queryKey: ['stockReceipts'],
    queryFn: async (): Promise<StockReceiptWithItems[]> => {
      const { data, error } = await supabase
        .from('stock_receipts')
        .select('*, supplier:suppliers(name), items:stock_receipt_items(id, quantity, unit_price, ingredient:ingredients(name, unit))')
        .order('receipt_date', { ascending: false });
      if (error) throw error;
      return data as unknown as StockReceiptWithItems[];
    },
  });
}

export function useCreateStockReceipt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      receiptDate: string;
      supplierId: string;
      documentNumber: string | null;
      items: StockReceiptItemInput[];
    }) => {
      const { data, error } = await supabase.rpc('create_stock_receipt', {
        p_receipt_date: input.receiptDate,
        p_supplier_id: input.supplierId,
        p_document_number: input.documentNumber,
        p_items: input.items,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stockReceipts'] });
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}
