import { db } from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function SharedRecipeBox({
  params,
}: {
  params: { token: string };
}) {
  const household = await db.household.findUnique({
    where: { shareToken: params.token },
    include: { recipes: { orderBy: { title: "asc" } } },
  });

  if (!household || !household.shareEnabled) notFound();

  return (
    <div className="max-w-3xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-1">{household.name}'s Recipes</h1>
      <p className="text-sm text-gray-500 mb-6">Shared read-only collection</p>
      <div className="grid gap-4 sm:grid-cols-2">
        {household.recipes.map((r) => (
          <Link
            key={r.id}
            href={`/share/${params.token}/${r.id}`}
            className="border rounded-lg p-4 hover:shadow-sm transition"
          >
            {r.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={r.imageUrl} alt={r.title} className="rounded mb-2 w-full h-32 object-cover" />
            )}
            <h2 className="font-semibold">{r.title}</h2>
          </Link>
        ))}
      </div>
    </div>
  );
}
