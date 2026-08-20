import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Tank } from '../types/database.types';

export function useTanks() {
  return useQuery({
    queryKey: ['tanks'],
    queryFn: async (): Promise<Tank[]> => {
      const { data, error } = await supabase
        .from('tanks')
        .select('*')
        .eq('is_active', true)
        .order('name');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; capacity_liters?: number | null; notes?: string | null }) => {
      const { data, error } = await supabase
        .from('tanks')
        .insert({ name: input.name, capacity_liters: input.capacity_liters ?? null, notes: input.notes ?? null, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as Tank;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

export function useUpdateTank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: { id: string; name: string; capacity_liters: number | null; notes?: string | null }) => {
      const { error } = await supabase.from('tanks').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}

export function useDeactivateTank() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (tankId: string) => {
      const { error } = await supabase.from('tanks').update({ is_active: false }).eq('id', tankId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tanks'] });
    },
  });
}
