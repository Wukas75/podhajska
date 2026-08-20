import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import type { Recipe, RecipeIngredient } from '../types/database.types';

export function useRecipes() {
  return useQuery({
    queryKey: ['recipes'],
    queryFn: async (): Promise<Recipe[]> => {
      const { data, error } = await supabase.from('recipes').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });
}

export type RecipeIngredientWithDetails = RecipeIngredient & {
  ingredient: { name: string; category: string; unit: string } | null;
};

export function useRecipe(recipeId: string | undefined) {
  return useQuery({
    queryKey: ['recipes', recipeId],
    enabled: !!recipeId,
    queryFn: async (): Promise<{ recipe: Recipe; ingredients: RecipeIngredientWithDetails[] }> => {
      const [recipeRes, ingredientsRes] = await Promise.all([
        supabase.from('recipes').select('*').eq('id', recipeId!).single(),
        supabase
          .from('recipe_ingredients')
          .select('*, ingredient:ingredients(name, category, unit)')
          .eq('recipe_id', recipeId!),
      ]);
      if (recipeRes.error) throw recipeRes.error;
      if (ingredientsRes.error) throw ingredientsRes.error;
      return { recipe: recipeRes.data, ingredients: ingredientsRes.data as unknown as RecipeIngredientWithDetails[] };
    },
  });
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; style: string | null; batchVolumeLiters: number; notes: string | null }) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from('recipes')
        .insert({
          name: input.name,
          style: input.style,
          batch_volume_liters: input.batchVolumeLiters,
          notes: input.notes,
          created_by: user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;
      return data as Recipe;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useUpdateRecipe(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { name: string; style: string | null; batchVolumeLiters: number; notes: string | null }) => {
      const { error } = await supabase
        .from('recipes')
        .update({ name: patch.name, style: patch.style, batch_volume_liters: patch.batchVolumeLiters, notes: patch.notes })
        .eq('id', recipeId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] });
      queryClient.invalidateQueries({ queryKey: ['recipes'] });
    },
  });
}

export function useAddRecipeIngredient(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (input: { ingredientId: string; quantity: number; notes?: string | null }) => {
      const { error } = await supabase
        .from('recipe_ingredients')
        .insert({ recipe_id: recipeId, ingredient_id: input.ingredientId, quantity: input.quantity, notes: input.notes ?? null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
  });
}

export function useUpdateRecipeIngredient(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: { id: string; ingredientId: string; quantity: number; notes?: string | null }) => {
      const { error } = await supabase
        .from('recipe_ingredients')
        .update({ ingredient_id: patch.ingredientId, quantity: patch.quantity, notes: patch.notes ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
  });
}

export function useDeleteRecipeIngredient(recipeId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (recipeIngredientId: string) => {
      const { error } = await supabase.from('recipe_ingredients').delete().eq('id', recipeIngredientId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recipes', recipeId] });
    },
  });
}
