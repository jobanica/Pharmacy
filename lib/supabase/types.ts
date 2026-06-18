export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      batches: {
        Row: {
          batch_number: string | null
          branch_id: string
          cost_centavos: number
          created_at: string
          expiry_date: string | null
          id: string
          organization_id: string
          product_id: string
          quantity: number
          received_at: string
          supplier_id: string | null
        }
        Insert: {
          batch_number?: string | null
          branch_id: string
          cost_centavos?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity?: number
          received_at?: string
          supplier_id?: string | null
        }
        Update: {
          batch_number?: string | null
          branch_id?: string
          cost_centavos?: number
          created_at?: string
          expiry_date?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity?: number
          received_at?: string
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "batches_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
          organization_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          organization_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          organization_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          organization_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      inventory_movements: {
        Row: {
          batch_id: string | null
          branch_id: string
          created_at: string
          created_by: string | null
          id: string
          organization_id: string
          product_id: string
          quantity_delta: number
          reason: string | null
          reference_id: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Insert: {
          batch_id?: string | null
          branch_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id: string
          product_id: string
          quantity_delta: number
          reason?: string | null
          reference_id?: string | null
          type: Database["public"]["Enums"]["movement_type"]
        }
        Update: {
          batch_id?: string | null
          branch_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          organization_id?: string
          product_id?: string
          quantity_delta?: number
          reason?: string | null
          reference_id?: string | null
          type?: Database["public"]["Enums"]["movement_type"]
        }
        Relationships: [
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "inventory_movements_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "inventory_movements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Insert: {
          accepted_at?: string | null
          created_at?: string
          email: string
          expires_at: string
          id?: string
          invited_by?: string | null
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          token: string
        }
        Update: {
          accepted_at?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          token?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          default_branch_id: string | null
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          default_branch_id?: string | null
          id?: string
          organization_id: string
          role: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          default_branch_id?: string | null
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["user_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_default_branch_id_fkey"
            columns: ["default_branch_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "memberships_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          settings: Json
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          settings?: Json
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          settings?: Json
          slug?: string
          status?: string
        }
        Relationships: []
      }
      products: {
        Row: {
          barcode: string | null
          category_id: string | null
          created_at: string
          default_price_centavos: number
          generic_name: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          reorder_point: number
          requires_prescription: boolean
          sku: string | null
          unit: string
        }
        Insert: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          default_price_centavos?: number
          generic_name?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          reorder_point?: number
          requires_prescription?: boolean
          sku?: string | null
          unit?: string
        }
        Update: {
          barcode?: string | null
          category_id?: string | null
          created_at?: string
          default_price_centavos?: number
          generic_name?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          reorder_point?: number
          requires_prescription?: boolean
          sku?: string | null
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string
          id: string
          phone: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id: string
          phone?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string
          id?: string
          phone?: string | null
        }
        Relationships: []
      }
      sale_items: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          line_total_centavos: number
          organization_id: string
          product_id: string
          quantity: number
          sale_id: string
          unit_cost_centavos: number
          unit_price_centavos: number
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          line_total_centavos: number
          organization_id: string
          product_id: string
          quantity: number
          sale_id: string
          unit_cost_centavos?: number
          unit_price_centavos: number
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          line_total_centavos?: number
          organization_id?: string
          product_id?: string
          quantity?: number
          sale_id?: string
          unit_cost_centavos?: number
          unit_price_centavos?: number
        }
        Relationships: [
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "v_expiring_batches"
            referencedColumns: ["batch_id"]
          },
          {
            foreignKeyName: "sale_items_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sale_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id"]
          },
          {
            foreignKeyName: "sale_items_sale_id_fkey"
            columns: ["sale_id"]
            isOneToOne: false
            referencedRelation: "sales"
            referencedColumns: ["id"]
          },
        ]
      }
      sales: {
        Row: {
          amount_tendered_centavos: number
          branch_id: string
          cashier_id: string | null
          change_centavos: number
          created_at: string
          discount_centavos: number
          id: string
          organization_id: string
          payment_method: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
          status: Database["public"]["Enums"]["sale_status"]
          subtotal_centavos: number
          total_centavos: number
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          amount_tendered_centavos?: number
          branch_id: string
          cashier_id?: string | null
          change_centavos?: number
          created_at?: string
          discount_centavos?: number
          id?: string
          organization_id: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_centavos?: number
          total_centavos?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          amount_tendered_centavos?: number
          branch_id?: string
          cashier_id?: string | null
          change_centavos?: number
          created_at?: string
          discount_centavos?: number
          id?: string
          organization_id?: string
          payment_method?: Database["public"]["Enums"]["payment_method"]
          receipt_number?: string
          status?: Database["public"]["Enums"]["sale_status"]
          subtotal_centavos?: number
          total_centavos?: number
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sales_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "sales_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      suppliers: {
        Row: {
          address: string | null
          contact_person: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          organization_id: string
          phone: string | null
        }
        Insert: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
        }
        Update: {
          address?: string | null
          contact_person?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      v_expiring_batches: {
        Row: {
          batch_id: string | null
          batch_number: string | null
          branch_id: string | null
          branch_name: string | null
          days_until: number | null
          expiry_date: string | null
          organization_id: string | null
          product_id: string | null
          product_name: string | null
          quantity: number | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
      v_low_stock: {
        Row: {
          branch_id: string | null
          branch_name: string | null
          deficit: number | null
          on_hand: number | null
          organization_id: string | null
          product_id: string | null
          product_name: string | null
          reorder_point: number | null
          unit: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      v_product_on_hand: {
        Row: {
          branch_id: string | null
          on_hand: number | null
          organization_id: string | null
          product_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["branch_id"]
          },
          {
            foreignKeyName: "batches_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "batches_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "v_low_stock"
            referencedColumns: ["product_id"]
          },
        ]
      }
    }
    Functions: {
      accept_invitation: { Args: { invite_token: string }; Returns: string }
      adjust_batch: {
        Args: { p_batch: string; p_new_quantity: number; p_reason?: string }
        Returns: undefined
      }
      auth_org_id: { Args: never; Returns: string }
      auth_role: {
        Args: never
        Returns: Database["public"]["Enums"]["user_role"]
      }
      complete_sale: {
        Args: {
          p_amount_tendered_centavos?: number
          p_branch: string
          p_discount_centavos?: number
          p_items: Json
          p_payment_method?: Database["public"]["Enums"]["payment_method"]
        }
        Returns: string
      }
      fefo_deduct: {
        Args: {
          p_branch: string
          p_product: string
          p_quantity: number
          p_reason?: string
          p_reference?: string
          p_type: Database["public"]["Enums"]["movement_type"]
        }
        Returns: undefined
      }
      has_org_role: {
        Args: { roles: Database["public"]["Enums"]["user_role"][] }
        Returns: boolean
      }
      invitation_details: {
        Args: { invite_token: string }
        Returns: {
          email: string
          organization_name: string
          role: Database["public"]["Enums"]["user_role"]
        }[]
      }
      receive_stock: {
        Args: {
          p_batch_number?: string
          p_branch: string
          p_cost_centavos: number
          p_expiry?: string
          p_product: string
          p_quantity: number
          p_supplier?: string
        }
        Returns: string
      }
      shares_org_with: { Args: { target: string }; Returns: boolean }
      slugify: { Args: { txt: string }; Returns: string }
      void_sale: { Args: { p_sale: string }; Returns: undefined }
      write_off_batch: {
        Args: { p_batch: string; p_reason?: string }
        Returns: undefined
      }
    }
    Enums: {
      membership_status: "active" | "suspended"
      movement_type:
        | "receive"
        | "sale"
        | "adjustment"
        | "void"
        | "transfer"
        | "expiry_writeoff"
      payment_method: "cash"
      sale_status: "completed" | "voided"
      user_role: "owner" | "manager" | "pharmacist" | "cashier"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      membership_status: ["active", "suspended"],
      movement_type: [
        "receive",
        "sale",
        "adjustment",
        "void",
        "transfer",
        "expiry_writeoff",
      ],
      payment_method: ["cash"],
      sale_status: ["completed", "voided"],
      user_role: ["owner", "manager", "pharmacist", "cashier"],
    },
  },
} as const

// Convenience aliases used across the app (stable across regenerations).
export type UserRole = Database["public"]["Enums"]["user_role"];
export type MembershipStatus = Database["public"]["Enums"]["membership_status"];
export type MovementType = Database["public"]["Enums"]["movement_type"];
export type SaleStatus = Database["public"]["Enums"]["sale_status"];
export type PaymentMethod = Database["public"]["Enums"]["payment_method"];
