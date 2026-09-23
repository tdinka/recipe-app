import { notFound } from "next/navigation";
import { householdFromToken } from "@/lib/list-auth";
import { GroceryList } from "@/components/GroceryList";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Grocery List",
  robots: { index: false, follow: false },
};

export default async function ListPage({ params }: { params: { token: string } }) {
  const household = await householdFromToken(params.token);
  if (!household) notFound();
  return <GroceryList token={params.token} householdName={household.name} />;
}
