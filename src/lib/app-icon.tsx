// Draws the home-screen icons in code (no image files needed).
import { ImageResponse } from "next/og";

const BRICK = "#A6402B";
const FOREST = "#445940";
const CARD = "#FAF8F2";
const HOLE = "#E3DBC7";
const LINE = "#D3C7A9";

export type IconVariant = "box" | "list";

export function renderAppIcon(variant: IconVariant, size: number) {
  const u = size / 100; // 1u = 1% of the icon

  const card =
    variant === "box" ? (
      // Recipe Box: a landscape index card with a punch hole and writing lines
      <div
        style={{
          width: 64 * u,
          height: 46 * u,
          background: CARD,
          borderRadius: 4 * u,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: `0 ${9 * u}px`,
          position: "relative",
        }}
      >
        <div style={{ position: "absolute", top: 5 * u, left: 5 * u, width: 4 * u, height: 4 * u, borderRadius: 999, background: HOLE }} />
        <div style={{ height: 3.4 * u, width: "65%", background: BRICK, borderRadius: 2 * u, marginBottom: 5 * u }} />
        <div style={{ height: 2.4 * u, width: "100%", background: LINE, borderRadius: 2 * u, marginBottom: 4 * u }} />
        <div style={{ height: 2.4 * u, width: "80%", background: LINE, borderRadius: 2 * u }} />
      </div>
    ) : (
      // Groceries: a portrait list card with checkboxes, the first one ticked
      <div
        style={{
          width: 52 * u,
          height: 62 * u,
          background: CARD,
          borderRadius: 4 * u,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: `0 ${8 * u}px`,
        }}
      >
        {[70, 90, 60].map((width, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", marginTop: i === 0 ? 0 : 6 * u }}>
            <div
              style={{
                width: 7 * u,
                height: 7 * u,
                borderRadius: 1.5 * u,
                border: `${1.2 * u}px solid ${FOREST}`,
                background: i === 0 ? FOREST : CARD,
                marginRight: 4 * u,
                flexShrink: 0,
              }}
            />
            <div style={{ height: 2.6 * u, width: `${width}%`, background: i === 0 ? HOLE : LINE, borderRadius: 2 * u }} />
          </div>
        ))}
      </div>
    );

  return new ImageResponse(
    (
      <div
        style={{
          width: size,
          height: size,
          background: variant === "box" ? BRICK : FOREST,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {card}
      </div>
    ),
    { width: size, height: size }
  );
}
