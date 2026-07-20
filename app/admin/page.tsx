import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";
import { isDropshippingEnabled } from "@/lib/dropshipping/config";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage Bougie & Company website product content, photos, and live Epos catalog presentation."
};

export default function AdminPage() {
  return <AdminDashboard dropshippingEnabled={isDropshippingEnabled()} />;
}
