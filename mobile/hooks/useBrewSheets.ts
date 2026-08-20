import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { BrewSheet, BrewSheetIngredient } from '../types/database.types';

export function useBrewSheets() {
  return useQuery({
    queryKey: ['brewSheets'],
    queryFn: async (): Promise<BrewSheet[]> => {
      const { data, error } = await supabase.from('brew_sheets').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type BrewSheetIngredientWithDetails = BrewSheetIngredient & {
  ingredient: { name: string; category: string; unit: string } | null;
};

export function useBrewSheet(brewSheetId: string | undefined) {
  return useQuery({
    queryKey: ['brewSheets', brewSheetId],
    enabled: !!brewSheetId,
    queryFn: async (): Promise<{ sheet: BrewSheet; ingredients: BrewSheetIngredientWithDetails[] }> => {
      const [sheetRes, ingredientsRes] = await Promise.all([
        supabase.from('brew_sheets').select('*').eq('id', brewSheetId!).single(),
        supabase
          .from('brew_sheet_ingredients')
          .select('*, ingredient:ingredients(name, category, unit)')
          .eq('brew_sheet_id', brewSheetId!),
      ]);
      if (sheetRes.error) throw sheetRes.error;
      if (ingredientsRes.error) throw ingredientsRes.error;
      return { sheet: sheetRes.data, ingredients: ingredientsRes.data as unknown as BrewSheetIngredientWithDetails[] };
    },
  });
}

export function useCreateBrewSheet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; batchVolumeLiters: number; notes: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('brew_sheets')
        .insert({
          name: input.name,
          recipe_id: null,
          batch_volume_liters: input.batchVolumeLiters,
          notes: input.notes,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as BrewSheet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheets'] });
    },
  });
}

export function useCreateBrewSheetFromRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; recipeId: string; batchVolumeLiters: number }) => {
      const { data, error } = await supabase.rpc('create_brew_sheet_from_recipe', {
        p_name: input.name,
        p_recipe_id: input.recipeId,
        p_batch_volume_liters: input.batchVolumeLiters,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheets'] });
    },
  });
}

export function useUpdateBrewSheet(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name: string; batchVolumeLiters: number; notes: string | null }) => {
      const { error } = await supabase
        .from('brew_sheets')
        .update({ name: patch.name, batch_volume_liters: patch.batchVolumeLiters, notes: patch.notes })
        .eq('id', brewSheetId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheets', brewSheetId] });
      queryClient.invalidateQueries({ queryKey: ['brewSheets'] });
    },
  });
}

export function useAddBrewSheetIngredient(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ingredientId: string; quantity: number; notes?: string | null }) => {
      const { error } = await supabase
        .from('brew_sheet_ingredients')
        .insert({ brew_sheet_id: brewSheetId, ingredient_id: input.ingredientId, quantity: input.quantity, notes: input.notes ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheets', brewSheetId] });
    },
  });
}

export function useUpdateBrewSheetIngredient(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; ingredientId: string; quantity: number; notes?: string | null }) => {
      const { error } = await supabase
        .from('brew_sheet_ingredients')
        .update({ ingredient_id: patch.ingredientId, quantity: patch.quantity, notes: patch.notes ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheets', brewSheetId] });
    },
  });
}

export function useDeleteBrewSheetIngredient(brewSheetId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (brewSheetIngredientId: string) => {
      const { error } = await supabase.from('brew_sheet_ingredients').delete().eq('id', brewSheetIngredientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['brewSheets', brewSheetId] });
    },
  });
}
