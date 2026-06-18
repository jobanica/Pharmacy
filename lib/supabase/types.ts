/**
 * Supabase generated types placeholder.
 *
 * Once migrations land (Milestone 2+), regenerate with:
 *   npx supabase gen types typescript --local > lib/supabase/types.ts
 *
 * Until then we use a permissive schema so the typed clients compile. This is
 * the single intentional `any`-equivalent seam in the codebase and is replaced
 * by real generated types as tables are introduced.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  public: {
    Tables: Record<string, never>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
