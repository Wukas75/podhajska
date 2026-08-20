import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { ProcessStepTemplate } from '../types/database.types';
import type { ProcessStepValues, ProcessStepRowShape } from './useBrewSheetProcessSteps';

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

export function useProcessStepTemplates() {
  return useQuery({
    queryKey: ['processStepTemplates'],
    queryFn: async (): Promise<ProcessStepTemplate[]> => {
      const { data, error } = await supabase.from('process_step_templates').select('*').order('sort_order');
      if (error) throw error;
      return data;
    },
  });
}

export function useAddProcessStepTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { values: ProcessStepValues; sortOrder: number }) => {
      const { error } = await supabase.from('process_step_templates').insert({ sort_order: input.sortOrder, ...toRow(input.values) });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processStepTemplates'] });
    },
  });
}

export function useUpdateProcessStepTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, values }: { id: string; values: ProcessStepValues }) => {
      const { error } = await supabase.from('process_step_templates').update(toRow(values)).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processStepTemplates'] });
    },
  });
}

export function useReorderProcessStepTemplates() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; sortOrder: number }[]) => {
      const results = await Promise.all(
        items.map((item) => supabase.from('process_step_templates').update({ sort_order: item.sortOrder }).eq('id', item.id))
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processStepTemplates'] });
    },
  });
}

export function useDuplicateProcessStepTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (source: ProcessStepRowShape) => {
      const { error } = await supabase.from('process_step_templates').insert({
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
        .from('process_step_templates')
        .select('id, sort_order, created_at')
        .order('sort_order')
        .order('created_at');
      if (fetchError) throw fetchError;

      const results = await Promise.all(
        rows.map((row, index) =>
          row.sort_order === index
            ? Promise.resolve({ error: null })
            : supabase.from('process_step_templates').update({ sort_order: index }).eq('id', row.id)
        )
      );
      const failed = results.find((r) => r.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processStepTemplates'] });
    },
  });
}

export function useDeleteProcessStepTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('process_step_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['processStepTemplates'] });
    },
  });
}

export function useCopyProcessStepTemplatesToBrewSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brewSheetId: string) => {
      const { error } = await supabase.rpc('copy_process_steps_to_brew_sheet', { p_brew_sheet_id: brewSheetId });
      if (error) throw error;
    },
    onSuccess: (_data, brewSheetId) => {
      queryClient.invalidateQueries({ queryKey: ['brewSheetProcessSteps', brewSheetId] });
    },
  });
}
