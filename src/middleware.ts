export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except auth API routes, login/register pages,
  // public share links, and static assets.
  matcher: [
    "/((?!api/auth|login|register|share|_next/static|_next/image|favicon.ico).*)",
  ],
};
