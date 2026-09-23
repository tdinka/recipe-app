// Home-screen app details for the family grocery list link.
// Starts on this household's list, so family members never see a login screen.
export function GET(_req: Request, { params }: { params: { token: string } }) {
  const start = `/list/${params.token}`;
  return Response.json(
    {
      name: "Family Grocery List",
      short_name: "Groceries",
      start_url: start,
      scope: start,
      display: "standalone",
      background_color: "#FAF8F2",
      theme_color: "#FAF8F2",
      icons: [
        { src: "/app-icon/list/192", sizes: "192x192", type: "image/png" },
        { src: "/app-icon/list/512", sizes: "512x512", type: "image/png" },
        { src: "/app-icon/list/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
