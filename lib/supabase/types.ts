/**
 * Supabase database types.
 *
 * Hand-maintained to match supabase/migrations until the project is live, then
 * regenerate to keep in sync after every schema change:
 *   npx supabase gen types typescript --linked > lib/supabase/types.ts
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type UserRole = "owner" | "manager" | "pharmacist" | "cashier";
export type MembershipStatus = "active" | "suspended";

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string;
          name: string;
          slug: string;
          plan: string;
          status: string;
          settings: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          plan?: string;
          status?: string;
          settings?: Json;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          plan?: string;
          status?: string;
          settings?: Json;
          created_at?: string;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          id: string;
          organization_id: string;
          name: string;
          address: string | null;
          phone: string | null;
          is_active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          name: string;
          address?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          name?: string;
          address?: string | null;
          phone?: string | null;
          is_active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          full_name: string;
          phone: string | null;
          avatar_url: string | null;
          created_at: string;
        };
        Insert: {
          id: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          phone?: string | null;
          avatar_url?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      memberships: {
        Row: {
          id: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          default_branch_id: string | null;
          status: MembershipStatus;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          user_id: string;
          role: UserRole;
          default_branch_id?: string | null;
          status?: MembershipStatus;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          user_id?: string;
          role?: UserRole;
          default_branch_id?: string | null;
          status?: MembershipStatus;
          created_at?: string;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          id: string;
          organization_id: string;
          email: string;
          role: UserRole;
          token: string;
          expires_at: string;
          accepted_at: string | null;
          invited_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          organization_id: string;
          email: string;
          role: UserRole;
          token: string;
          expires_at: string;
          accepted_at?: string | null;
          invited_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          organization_id?: string;
          email?: string;
          role?: UserRole;
          token?: string;
          expires_at?: string;
          accepted_at?: string | null;
          invited_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      accept_invitation: {
        Args: { invite_token: string };
        Returns: string;
      };
      auth_org_id: { Args: Record<string, never>; Returns: string };
      auth_role: { Args: Record<string, never>; Returns: UserRole };
      invitation_details: {
        Args: { invite_token: string };
        Returns: {
          email: string;
          role: UserRole;
          organization_name: string;
        }[];
      };
    };
    Enums: {
      user_role: UserRole;
      membership_status: MembershipStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
