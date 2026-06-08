import type { Metadata } from "next";
import { AdminDashboard } from "@/components/admin-dashboard";

export const metadata: Metadata = {
  title: "Admin Dashboard",
  description: "Manage Bougie & Company website product content, photos, and live Epos catalog presentation."
};

export default function AdminPage() {
  return <AdminDashboard />;
}
