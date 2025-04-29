// app/dashboard/page.tsx
import { redirect } from "next/navigation";

export default function DashboardRootPage() {
  // This page will immediately redirect to the match page
  redirect("/dashboard/match");

  // Return null or an empty fragment as the redirect happens server-side
  return null;
}
