// Hand-written to match supabase/migrations/0001_init.sql.
// Once the real Supabase project exists, regenerate with:
//   npx supabase gen types typescript --project-id <project-ref> > types/database.types.ts

export type StepType = 'temperature' | 'gravity' | 'dry_hop' | 'transfer' | 'custom';
export type BatchStatus = 'planned' | 'active' | 'completed' | 'cancelled';
export type BatchStepStatus = 'pending' | 'done' | 'skipped';

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
    };
    Views: NoViews;
    Functions: {
      create_batch_from_template: {
        Args: { p_template_id: string; p_tank_id: string; p_start_date: string; p_name: string };
        Returns: string;
      };
    };
  };
};
