// Home-screen app details for the main Recipe Box.
export function GET() {
  return Response.json(
    {
      name: "Family Recipe Box",
      short_name: "Recipe Box",
      start_url: "/recipes",
      scope: "/",
      display: "standalone",
      background_color: "#FAF8F2",
      theme_color: "#FAF8F2",
      icons: [
        { src: "/app-icon/box/192", sizes: "192x192", type: "image/png" },
        { src: "/app-icon/box/512", sizes: "512x512", type: "image/png" },
        { src: "/app-icon/box/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      ],
    },
    { headers: { "Content-Type": "application/manifest+json" } }
  );
}
