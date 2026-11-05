import {
  Activity,
  Banknote,
  Building2,
  ChartNoAxesCombined,
  ClipboardList,
  Clock3,
  Contact,
  FileText,
  FileWarning,
  GitCompareArrows,
  History,
  Home,
  LayoutGrid,
  type LucideIcon,
  Package,
  PackageCheck,
  PackageSearch,
  Percent,
  PhilippinePeso,
  Ruler,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Tags,
  TriangleAlert,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { Role } from "@/types/user";

export interface NavItem {
  key: string;
  label: string;
  icon: LucideIcon;
  to?: string;
  badgeKey?: string;
  children?: NavItem[];
}

const ITEMS_NAV_GROUP: NavItem = {
  key: "items",
  label: "Items",
  icon: Package,
  children: [
    { key: "items-all", label: "All Items", icon: Package, to: "/items" },
    { key: "items-categories", label: "Categories", icon: Tags, to: "/items/categories" },
    { key: "items-units", label: "Units of Measure", icon: Ruler, to: "/items/units" },
    {
      key: "items-expiring",
      label: "Near-Expiry Items",
      icon: Clock3,
      to: "/inventory/expiring",
    },
    { key: "items-low-stock", label: "Low Stock", icon: TriangleAlert, to: "/inventory/low-stock" },
  ],
};

export const NAVIGATION: Record<Role, NavItem[]> = {
  super_admin: [
    { key: "home", label: "Home", icon: Home, to: "/" },
    {
      key: "staff-management",
      label: "Staff Management",
      icon: Users,
      children: [
        { key: "staff-all", label: "All Staff", icon: Users, to: "/admin/staff" },
        {
          key: "roles-access",
          label: "Roles & Access",
          icon: ShieldCheck,
          to: "/super-admin/role-assignment",
        },
      ],
    },
    {
      key: "client-management",
      label: "Client Management",
      icon: Contact,
      children: [
        { key: "clients-all", label: "All Clients", icon: Contact, to: "/super-admin/clients" },
        {
          key: "company-analytics",
          label: "Company Analytics",
          icon: ChartNoAxesCombined,
          to: "/super-admin/company-analytics",
        },
      ],
    },
    {
      key: "branch-management",
      label: "Branch Management",
      icon: Building2,
      children: [
        {
          key: "branch-management-all",
          label: "All Branches",
          icon: Building2,
          to: "/super-admin/branches",
        },
        {
          key: "branch-dashboards",
          label: "Branch Dashboards",
          icon: LayoutGrid,
          to: "/super-admin/branch-dashboards",
        },
        {
          key: "compare-branches",
          label: "Compare Branches",
          icon: GitCompareArrows,
          to: "/super-admin/compare-branches",
        },
      ],
    },
    ITEMS_NAV_GROUP,
    {
      key: "sales-overview",
      label: "Sales Overview",
      icon: ChartNoAxesCombined,
      to: "/super-admin/sales-overview",
    },
    {
      key: "purchases-overview",
      label: "Purchases Overview",
      icon: ShoppingCart,
      to: "/super-admin/purchases-overview",
    },
  ],

  admin: [
    { key: "home", label: "Home", icon: Home, to: "/" },
    { key: "activity-log", label: "Activity Log", icon: Activity, to: "/admin/activity-log" },
    {
      key: "staff",
      label: "Staff",
      icon: Users,
      children: [
        { key: "staff-all", label: "All Staff", icon: Users, to: "/admin/staff" },
        {
          key: "role-permissions",
          label: "Roles & Permissions",
          icon: ShieldCheck,
          to: "/admin/role-permissions",
        },
      ],
    },
    ITEMS_NAV_GROUP,
    { key: "branches", label: "Branches", icon: Building2, to: "/admin/branches" },
    { key: "suppliers", label: "Suppliers", icon: Truck, to: "/admin/suppliers" },
    {
      key: "clients",
      label: "Clients",
      icon: Contact,
      children: [
        { key: "clients-all", label: "All Clients", icon: Contact, to: "/admin/clients" },
        {
          key: "client-accounts",
          label: "Portal Accounts",
          icon: Users,
          to: "/admin/client-accounts",
        },
      ],
    },
    { key: "settings", label: "System Settings", icon: Settings, to: "/admin/settings" },
  ],

  sales: [
    { key: "home", label: "Home", icon: Home, to: "/" },
    {
      key: "orders",
      label: "Orders",
      icon: ShoppingCart,
      children: [
        {
          key: "intake",
          label: "Purchase Orders",
          icon: PackageSearch,
          to: "/sales/intake",
          badgeKey: "intakePending",
        },
        { key: "cofs", label: "Client Order Forms", icon: FileText, to: "/sales/cofs" },
      ],
    },
    {
      key: "items",
      label: "Items",
      icon: Package,
      children: [
        { key: "items-all", label: "All Items", icon: Package, to: "/sales/items" },
        { key: "items-expiry", label: "Near-Expiry Items", icon: Clock3, to: "/sales/items-expiry" },
      ],
    },
    {
      key: "clients",
      label: "Clients",
      icon: Contact,
      children: [
        { key: "clients-all", label: "All Clients", icon: Contact, to: "/sales/clients" },
        { key: "discounts", label: "Discounts", icon: Percent, to: "/sales/discounts" },
        {
          key: "clients-analytics",
          label: "Analytics",
          icon: ChartNoAxesCombined,
          to: "/sales/clients-analytics",
        },
      ],
    },
    {
      key: "dispatch",
      label: "Dispatch",
      icon: Send,
      children: [
        { key: "dispatch-queue", label: "Dispatch Queue", icon: Send, to: "/sales/dispatch" },
      ],
    },
  ],

  accounting: [
    { key: "home", label: "Home", icon: Home, to: "/" },
    {
      key: "pricing",
      label: "Pricing",
      icon: PhilippinePeso,
      children: [
        { key: "items-ref", label: "Items", icon: Package, to: "/accounting/items" },
        {
          key: "pending-pricing",
          label: "Pending Pricing Requests",
          icon: Clock3,
          to: "/accounting/pending-pricing",
        },
        {
          key: "client-pricing",
          label: "Client Item Pricing",
          icon: Contact,
          to: "/accounting/client-pricing",
        },
      ],
    },
    {
      key: "payments",
      label: "Payments",
      icon: Banknote,
      children: [
        {
          key: "pending-payments",
          label: "Pending Payments",
          icon: Clock3,
          to: "/accounting/pending-payments",
        },
        {
          key: "payment-history",
          label: "Payment History",
          icon: History,
          to: "/accounting/payment-history",
        },
      ],
    },
  ],

  logistics: [
    { key: "home", label: "Home", icon: Home, to: "/" },
    {
      key: "deliveries",
      label: "Deliveries",
      icon: Truck,
      children: [
        {
          key: "incoming-orders",
          label: "Incoming Orders",
          icon: PackageSearch,
          to: "/logistics/incoming-orders",
        },
        {
          key: "ready-to-deliver",
          label: "Ready to Deliver",
          icon: PackageCheck,
          to: "/logistics/ready-to-deliver",
        },
        {
          key: "delivery-history",
          label: "Delivery History",
          icon: History,
          to: "/logistics/delivery-history",
        },
      ],
    },
  ],

  purchasing: [
    { key: "home", label: "Home", icon: Home, to: "/" },
    ITEMS_NAV_GROUP,
    {
      key: "purchase-orders",
      label: "Purchase Orders",
      icon: ClipboardList,
      to: "/purchasing/purchase-orders",
    },
    {
      key: "stock-receiving",
      label: "Stock Receiving",
      icon: Warehouse,
      to: "/purchasing/stock-receiving",
    },
    { key: "discrepancies", label: "Discrepancies", icon: FileWarning, to: "/purchasing/discrepancies" },
    { key: "suppliers", label: "Suppliers", icon: Truck, to: "/purchasing/suppliers" },
  ],
};

export interface ActiveNavKeys {
  parentKey?: string;
  childKey?: string;
}

function matchedPrefixLength(to: string | undefined, pathname: string): number {
  if (!to) {
    return -1;
  }
  if (to === pathname) {
    return to.length;
  }
  return to !== "/" && pathname.startsWith(`${to}/`) ? to.length : -1;
}

export function findActiveKeys(items: NavItem[], pathname: string): ActiveNavKeys {
  let longest = -1;
  let active: ActiveNavKeys = {};

  for (const item of items) {
    const length = matchedPrefixLength(item.to, pathname);
    if (length > longest) {
      longest = length;
      active = { parentKey: item.key };
    }

    for (const child of item.children ?? []) {
      const childLength = matchedPrefixLength(child.to, pathname);
      if (childLength > longest) {
        longest = childLength;
        active = { parentKey: item.key, childKey: child.key };
      }
    }
  }

  return active;
}
