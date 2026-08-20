import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { RecipeTemplate, RecipeTemplateStep, StepType } from '../types/database.types';

export function useTemplates() {
  return useQuery({
    queryKey: ['templates'],
    queryFn: async (): Promise<RecipeTemplate[]> => {
      const { data, error } = await supabase
        .from('recipe_templates')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export function useTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: ['templates', templateId],
    enabled: !!templateId,
    queryFn: async (): Promise<{ template: RecipeTemplate; steps: RecipeTemplateStep[] }> => {
      const [templateRes, stepsRes] = await Promise.all([
        supabase.from('recipe_templates').select('*').eq('id', templateId!).single(),
        supabase.from('recipe_template_steps').select('*').eq('template_id', templateId!).order('sort_order'),
      ]);
      if (templateRes.error) throw templateRes.error;
      if (stepsRes.error) throw stepsRes.error;
      return { template: templateRes.data, steps: stepsRes.data };
    },
  });
}

export function useCreateTemplate() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; style?: string | null; description?: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('recipe_templates')
        .insert({
          name: input.name,
          style: input.style ?? null,
          description: input.description ?? null,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as RecipeTemplate;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export function useUpdateTemplate(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name: string; style?: string | null; description?: string | null }) => {
      const { error } = await supabase.from('recipe_templates').update(patch).eq('id', templateId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
      queryClient.invalidateQueries({ queryKey: ['templates'] });
    },
  });
}

export type TemplateStepInput = {
  day_offset: number;
  time_of_day: string;
  title: string;
  instruction: string | null;
  step_type: StepType;
  target_value: number | null;
  target_unit: string | null;
  sort_order: number;
};

export function useAddTemplateStep(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: TemplateStepInput) => {
      const { error } = await supabase.from('recipe_template_steps').insert({ ...input, template_id: templateId });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useUpdateTemplateStep(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TemplateStepInput> & { id: string }) => {
      const { error } = await supabase.from('recipe_template_steps').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}

export function useDeleteTemplateStep(templateId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (stepId: string) => {
      const { error } = await supabase.from('recipe_template_steps').delete().eq('id', stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates', templateId] });
    },
  });
}
