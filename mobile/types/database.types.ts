// Hand-written to match supabase/migrations/0001_init.sql.
// Once the real Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <project-ref> > types/database.types.ts

export type StepType = 'temperature' | 'gravity' | 'dry_hop' | 'transfer' | 'custom';
export type BatchStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type BatchStepStatus = 'pending' | 'done' | 'skipped';
export type IngredientCategory = 'malt' | 'hops' | 'yeast' | 'other';

export type Profile = {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
};

export type Tank = {
  id: string;
  name: string;
  capacity_liters: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type RecipeTemplate = {
  id: string;
  name: string;
  style: string | null;
  description: string | null;
  created_by: string | null;
  created_at: string;
};

export type RecipeTemplateStep = {
  id: string;
  template_id: string;
  day_offset: number;
  time_of_day: string;
  title: string;
  instruction: string | null;
  step_type: StepType;
  target_value: number | null;
  target_unit: string | null;
  sort_order: number;
};

export type Batch = {
  id: string;
  name: string;
  tank_id: string | null;
  template_id: string | null;
  start_date: string;
  status: BatchStatus;
  created_by: string | null;
  created_at: string;
};

export type BatchStep = {
  id: string;
  batch_id: string;
  template_step_id: string | null;
  day_offset: number;
  due_at: string;
  title: string;
  instruction: string | null;
  step_type: StepType;
  target_value: number | null;
  target_unit: string | null;
  status: BatchStepStatus;
  actual_value: number | null;
  actual_unit: string | null;
  notes: string | null;
  completed_by: string | null;
  completed_at: string | null;
  notified_at: string | null;
  created_at: string;
};

export type Ingredient = {
  id: string;
  name: string;
  category: IngredientCategory;
  unit: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type Supplier = {
  id: string;
  name: string;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type StockReceipt = {
  id: string;
  receipt_date: string;
  supplier_id: string;
  document_number: string | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type StockReceiptItem = {
  id: string;
  receipt_id: string;
  ingredient_id: string;
  quantity: number;
  total_price: number | null;
  notes: string | null;
};

export type Recipe = {
  id: string;
  name: string;
  style: string | null;
  batch_volume_liters: number;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type RecipeIngredient = {
  id: string;
  recipe_id: string;
  ingredient_id: string;
  quantity: number;
  notes: string | null;
};

export type BrewSheet = {
  id: string;
  name: string;
  recipe_id: string | null;
  batch_volume_liters: number;
  batch_number: number;
  brew_date: string;
  final_volume_liters: number | null;
  og: number | null;
  sg: number | null;
  abv_percent: number | null;
  notes: string | null;
  created_by: string | null;
  created_at: string;
};

export type BrewSheetIngredient = {
  id: string;
  brew_sheet_id: string;
  ingredient_id: string;
  quantity: number;
  total_price: number | null;
  notes: string | null;
};

export type BrewSheetProcessStep = {
  id: string;
  brew_sheet_id: string;
  sort_order: number;
  step_name: string | null;
  value_2: string | null;
  value_3: string | null;
  value_4: string | null;
  value_5: string | null;
  value_6: string | null;
  created_at: string;
};

export type PushToken = {
  id: string;
  user_id: string;
  expo_push_token: string;
  device_id: string | null;
  created_at: string;
  updated_at: string;
};

type TableDef<Row, Insert, Update> = { Row: Row; Insert: Insert; Update: Update; Relationships: [] };
type NoViews = Record<string, never>;

export type Database = {
  public: {
    Tables: {
      profiles: TableDef<Profile, never, Partial<Pick<Profile, 'full_name'>>>;
      tanks: TableDef<Tank, Omit<Tank, 'id' | 'created_at'>, Partial<Omit<Tank, 'id' | 'created_at'>>>;
      recipe_templates: TableDef<
        RecipeTemplate,
        Omit<RecipeTemplate, 'id' | 'created_at'>,
        Partial<Omit<RecipeTemplate, 'id' | 'created_at'>>
      >;
      recipe_template_steps: TableDef<
        RecipeTemplateStep,
        Omit<RecipeTemplateStep, 'id'>,
        Partial<Omit<RecipeTemplateStep, 'id'>>
      >;
      batches: TableDef<Batch, Omit<Batch, 'id' | 'created_at'>, Partial<Omit<Batch, 'id' | 'created_at'>>>;
      batch_steps: TableDef<BatchStep, Omit<BatchStep, 'id' | 'created_at'>, Partial<Omit<BatchStep, 'id' | 'created_at'>>>;
      push_tokens: TableDef<
        PushToken,
        Omit<PushToken, 'id' | 'created_at' | 'updated_at'>,
        Partial<Omit<PushToken, 'id' | 'created_at' | 'updated_at'>>
      >;
      ingredients: TableDef<Ingredient, Omit<Ingredient, 'id' | 'created_at'>, Partial<Omit<Ingredient, 'id' | 'created_at'>>>;
      stock_receipts: TableDef<
        StockReceipt,
        Omit<StockReceipt, 'id' | 'created_at'>,
        Partial<Omit<StockReceipt, 'id' | 'created_at'>>
      >;
      stock_receipt_items: TableDef<StockReceiptItem, Omit<StockReceiptItem, 'id'>, Partial<Omit<StockReceiptItem, 'id'>>>;
      suppliers: TableDef<Supplier, Omit<Supplier, 'id' | 'created_at'>, Partial<Omit<Supplier, 'id' | 'created_at'>>>;
      recipes: TableDef<Recipe, Omit<Recipe, 'id' | 'created_at'>, Partial<Omit<Recipe, 'id' | 'created_at'>>>;
      recipe_ingredients: TableDef<RecipeIngredient, Omit<RecipeIngredient, 'id'>, Partial<Omit<RecipeIngredient, 'id'>>>;
      brew_sheets: TableDef<BrewSheet, Omit<BrewSheet, 'id' | 'created_at'>, Partial<Omit<BrewSheet, 'id' | 'created_at'>>>;
      brew_sheet_ingredients: TableDef<
        BrewSheetIngredient,
        Omit<BrewSheetIngredient, 'id'>,
        Partial<Omit<BrewSheetIngredient, 'id'>>
      >;
      brew_sheet_process_steps: TableDef<
        BrewSheetProcessStep,
        Omit<BrewSheetProcessStep, 'id' | 'created_at'>,
        Partial<Omit<BrewSheetProcessStep, 'id' | 'created_at'>>
      >;
    };
    Views: NoViews;
    Functions: {
      create_batch_from_template: {
        Args: { p_template_id: string; p_tank_id: string; p_start_date: string; p_name: string };
        Returns: string;
      };
      create_stock_receipt: {
        Args: { p_receipt_date: string; p_supplier_id: string; p_document_number: string | null; p_items: unknown };
        Returns: string;
      };
      create_brew_sheet_from_recipe: {
        Args: {
          p_name: string;
          p_recipe_id: string;
          p_batch_volume_liters: number;
          p_batch_number: number;
          p_brew_date: string;
        };
        Returns: string;
      };
    };
  };
};
