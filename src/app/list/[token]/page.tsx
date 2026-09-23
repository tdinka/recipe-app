import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { householdFromToken } from "@/lib/list-auth";
import { GroceryList } from "@/components/GroceryList";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { token: string } }): Promise<Metadata> {
  return {
    title: "Grocery List",
    robots: { index: false, follow: false },
    manifest: `/list/${params.token}/manifest.webmanifest`,
    icons: { icon: "/app-icon/list/192", apple: "/app-icon/list/180" },
    appleWebApp: { capable: true, title: "Groceries", statusBarStyle: "default" },
  };
}

export default async function ListPage({ params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) notFound();
  return <GroceryList token={params.token} householdName={household.name} />;
}
