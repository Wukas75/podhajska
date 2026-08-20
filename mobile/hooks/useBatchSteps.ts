import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BatchStep } from '../types/database.types';

export function useBatchSteps(batchId: string | undefined) {
  return useQuery({
    queryKey: ['batchSteps', batchId],
    enabled: !!batchId,
    queryFn: async (): Promise<BatchStep[]> => {
      const { data, error } = await supabase
        .from('batch_steps')
        .select('*')
        .eq('batch_id', batchId!)
        .order('due_at');
      if (error) throw error;
      return data;
    },
  });
}

export type DashboardStep = BatchStep & {
  batch: { name: string; tank: { name: string } | null } | null;
};

export function useDashboardSteps() {
  return useQuery({
    queryKey: ['batchSteps', 'dashboard'],
    queryFn: async (): Promise<DashboardStep[]> => {
      const { data, error } = await supabase
        .from('batch_steps')
        .select('*, batch:batches(name, tank:tanks(name))')
        .eq('status', 'pending')
        .order('due_at')
        .limit(50);
      if (error) throw error;
      return data as unknown as DashboardStep[];
    },
  });
}

export function useMarkStepDone(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { stepId: string; actual_value: number | null; actual_unit: string | null; notes: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { error } = await supabase
        .from('batch_steps')
        .update({
          status: 'done',
          actual_value: input.actual_value,
          actual_unit: input.actual_unit,
          notes: input.notes,
          completed_by: user?.id ?? null,
          completed_at: new Date().toISOString(),
        })
        .eq('id', input.stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchSteps', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batchSteps', 'dashboard'] });
    },
  });
}

export function useSkipStep(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('batch_steps').update({ status: 'skipped' }).eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchSteps', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batchSteps', 'dashboard'] });
    },
  });
}

export type BatchStepPatch = {
  title: string;
  due_at: string;
  step_type: BatchStep['step_type'];
  target_value: number | null;
  target_unit: string | null;
  instruction: string | null;
};

export function useAddBatchStep(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: BatchStepPatch) => {
      const { error } = await supabase.from('batch_steps').insert({
        ...input,
        batch_id: batchId,
        status: 'pending',
        day_offset: 0,
        template_step_id: null,
        actual_value: null,
        actual_unit: null,
        notes: null,
        completed_by: null,
        completed_at: null,
        notified_at: null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchSteps', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batchSteps', 'dashboard'] });
    },
  });
}

export function useUpdateBatchStep(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<BatchStepPatch> & { id: string }) => {
      const { error } = await supabase.from('batch_steps').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchSteps', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batchSteps', 'dashboard'] });
    },
  });
}

export function useDeleteBatchStep(batchId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('batch_steps').delete().eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['batchSteps', batchId] });
      queryClient.invalidateQueries({ queryKey: ['batchSteps', 'dashboard'] });
    },
  });
}
