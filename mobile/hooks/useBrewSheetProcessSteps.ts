import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BrewSheetProcessStep } from '../types/database.types';

export type ProcessStepValues = {
  stepName: string | null;
  value2: string | null;
  value3: string | null;
  value4: string | null;
  value5: string | null;
  value6: string | null;
};

function toRow(values: ProcessStepValues) {
  return {
    step_name: values.stepName,
    value_2: values.value2,
    value_3: values.value3,
    value_4: values.value4,
    value_5: values.value5,
    value_6: values.value6,
  };
}

export function useBrewSheetProcessSteps(brewSheetId: string | undefined) {
  return useQuery({
    queryKey: ['brewSheetProcessSteps', brewSheetId],
    enabled: !!brewSheetId,
    queryFn: async (): Promise<BrewSheetProcessStep[]> => {
      const { data, error } = await supabase
        .from('brew_sheet_process_steps')
        .select('*')
        .eq('brew_sheet_id', brewSheetId!)
        .order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useAddBrewSheetProcessStep(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { values: ProcessStepValues; sortOrder: number }) => {
      const { error } = await supabase
        .from('brew_sheet_process_steps')
        .insert({ brew_sheet_id: brewSheetId, sort_order: input.sortOrder, ...toRow(input.values) });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheetProcessSteps', brewSheetId] });
    },
  });
}

export function useUpdateBrewSheetProcessStep(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ProcessStepValues }) => {
      const { error } = await supabase.from('brew_sheet_process_steps').update(toRow(values)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheetProcessSteps', brewSheetId] });
    },
  });
}

export function useReorderBrewSheetProcessSteps(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      const results = await Promise.all(
        items.map((item) => supabase.from('brew_sheet_process_steps').update({ sort_order: item.sortOrder }).eq('id', item.id))
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheetProcessSteps', brewSheetId] });
    },
  });
}

export function useDuplicateBrewSheetProcessStep(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: BrewSheetProcessStep) => {
      const { error } = await supabase.from('brew_sheet_process_steps').insert({
        brew_sheet_id: brewSheetId,
        sort_order: source.sort_order + 1,
        step_name: source.step_name,
        value_2: source.value_2,
        value_3: source.value_3,
        value_4: source.value_4,
        value_5: source.value_5,
        value_6: source.value_6,
      });
      if (error) throw error;

      const { data: rows, error: fetchError } = await supabase
        .from('brew_sheet_process_steps')
        .select('id, sort_order, created_at')
        .eq('brew_sheet_id', brewSheetId)
        .order('sort_order')
        .order('created_at');
      if (fetchError) throw fetchError;

      const results = await Promise.all(
        rows.map((row, index) =>
          row.sort_order === index
            ? Promise.resolve({ error: null })
            : supabase.from('brew_sheet_process_steps').update({ sort_order: index }).eq('id', row.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheetProcessSteps', brewSheetId] });
    },
  });
}

export function useDeleteBrewSheetProcessStep(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('brew_sheet_process_steps').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheetProcessSteps', brewSheetId] });
    },
  });
}
