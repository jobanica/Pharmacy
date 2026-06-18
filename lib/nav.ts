/**
 * App shell navigation. Each item declares the capability required to see it;
 * the sidebar filters by the current member's role.
 */
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Truck,
  ClipboardList,
  BellRing,
  Settings,
  type LucideIcon,
} from "lucide-react";

import type { Capability } from "@/lib/auth/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Capability required to view; undefined = visible to all members. */
  requires?: Capability;
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Point of Sale", href: "/pos", icon: ShoppingCart, requires: "create_sale" },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requires: "view_reports" },
  { label: "Inventory", href: "/inventory", icon: Package, requires: "manage_catalog" },
  { label: "Alerts", href: "/alerts", icon: BellRing, requires: "manage_catalog" },
  { label: "Suppliers", href: "/suppliers", icon: Truck, requires: "manage_catalog" },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList, requires: "manage_catalog" },
  { label: "Settings", href: "/settings", icon: Settings, requires: "manage_org" },
];
