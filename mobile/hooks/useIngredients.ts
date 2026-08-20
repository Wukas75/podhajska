import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Ingredient, IngredientCategory } from '../types/database.types';

export type IngredientWithStock = Ingredient & { stock: number };

export function useIngredients() {
  return useQuery({
    queryKey: ['ingredients'],
    queryFn: async (): Promise<IngredientWithStock[]> => {
      const [ingredientsRes, itemsRes] = await Promise.all([
        supabase.from('ingredients').select('*').eq('is_active', true).order('name'),
        supabase.from('stock_receipt_items').select('ingredient_id, quantity'),
      ]);
      if (ingredientsRes.error) throw ingredientsRes.error;
      if (itemsRes.error) throw itemsRes.error;

      const stockByIngredient = new Map<string, number>();
      for (const item of itemsRes.data) {
        stockByIngredient.set(item.ingredient_id, (stockByIngredient.get(item.ingredient_id) ?? 0) + Number(item.quantity));
      }

      return ingredientsRes.data.map((ingredient) => ({
        ...ingredient,
        stock: stockByIngredient.get(ingredient.id) ?? 0,
      }));
    },
  });
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; category: IngredientCategory; unit: string; notes?: string | null }) => {
      const { data, error } = await supabase
        .from('ingredients')
        .insert({ name: input.name, category: input.category, unit: input.unit, notes: input.notes ?? null, is_active: true })
        .select()
        .single();
      if (error) throw error;
      return data as Ingredient;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...patch
    }: {
      id: string;
      name: string;
      category: IngredientCategory;
      unit: string;
      notes?: string | null;
    }) => {
      const { error } = await supabase.from('ingredients').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}

export function useDeactivateIngredient() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ingredientId: string) => {
      const { error } = await supabase.from('ingredients').update({ is_active: false }).eq('id', ingredientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ingredients'] });
    },
  });
}
