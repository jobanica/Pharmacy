/**
 * App shell navigation. Each item declares the capability required to see it;
 * the sidebar filters by the current member's role.
 */
import {
  LayoutDashboard,
  ShoppingCart,
  ShoppingBag,
  Package,
  Truck,
  ClipboardList,
  BellRing,
  Clock,
  Star,
  Settings,
  FileText,
  BookOpen,
  Pill,
  Timer,
  ArrowLeftRight,
  ClipboardCheck,
  Printer,
  type LucideIcon,
} from "lucide-react";

import type { Capability } from "@/lib/auth/roles";

export type NavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Capability required to view; undefined = visible to all members. */
  requires?: Capability;
  /** Minimum plan required; "starter" means Starter or Pro. */
  requiresPlan?: "starter" | "pro";
};

export const NAV_ITEMS: NavItem[] = [
  { label: "Point of Sale", href: "/pos", icon: ShoppingCart, requires: "create_sale" },
  { label: "Cashier Shift", href: "/pos/shift", icon: Timer, requires: "create_sale" },
  { label: "Register Reading", href: "/pos/reading", icon: FileText, requires: "manage_members" },
  { label: "SC/PWD Logbook", href: "/pos/logbook", icon: BookOpen, requires: "manage_members" },
  { label: "Online Orders", href: "/orders", icon: ShoppingBag, requires: "create_sale" },
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard, requires: "view_reports" },
  { label: "Inventory", href: "/inventory", icon: Package, requires: "manage_catalog", requiresPlan: "starter" },
  { label: "Stock Transfers", href: "/inventory/transfers", icon: ArrowLeftRight, requires: "manage_catalog", requiresPlan: "starter" },
  { label: "Stocktake", href: "/inventory/stocktake", icon: ClipboardCheck, requires: "manage_catalog", requiresPlan: "starter" },
  { label: "Alerts", href: "/alerts", icon: BellRing, requires: "manage_catalog", requiresPlan: "starter" },
  { label: "Prescriptions", href: "/prescriptions", icon: Pill, requires: "create_sale" },
  { label: "Customers", href: "/customers", icon: Star, requires: "create_sale" },
  { label: "Suppliers", href: "/suppliers", icon: Truck, requires: "manage_catalog", requiresPlan: "starter" },
  { label: "Purchase Orders", href: "/purchase-orders", icon: ClipboardList, requires: "use_purchase_orders", requiresPlan: "starter" },
  { label: "HR & Payroll", href: "/hris", icon: Clock, requires: "manage_members" },
  { label: "Printer", href: "/printer", icon: Printer, requires: "create_sale" },
  { label: "Settings", href: "/settings", icon: Settings, requires: "manage_members" },
];
