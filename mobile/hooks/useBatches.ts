import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Batch, BatchStatus } from '../types/database.types';

export type BatchWithTank = Batch & { tank: { name: string } | null };

export function useBatches() {
  return useQuery({
    queryKey: ['batches'],
    queryFn: async (): Promise<BatchWithTank[]> => {
      const { data, error } = await supabase
        .from('batches')
        .select('*, tank:tanks(name)')
        .in('status', ['planned', 'active'] satisfies BatchStatus[])
        .order('start_date', { ascending: false });
      if (error) throw error;
      return data as unknown as BatchWithTank[];
    },
  });
}

export function useBatch(batchId: string | undefined) {
  return useQuery({
    queryKey: ['batches', batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<BatchWithTank> => {
      const { data, error } = await supabase
        .from('batches')
        .select('*, tank:tanks(name)')
        .eq('id', batchId!)
        .single();
      if (error) throw error;
      return data as unknown as BatchWithTank;
    },
  });
}

export function useUpdateBatch(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name?: string; tank_id?: string | null; start_date?: string; status?: BatchStatus }) => {
      const { error } = await supabase.from('batches').update(patch).eq('id', batchId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}

export function useCreateBatchFromTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { templateId: string; tankId: string; startDate: string; name: string }) => {
      const { data, error } = await supabase.rpc('create_batch_from_template', {
        p_template_id: input.templateId,
        p_tank_id: input.tankId,
        p_start_date: input.startDate,
        p_name: input.name,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batches'] });
    },
  });
}
