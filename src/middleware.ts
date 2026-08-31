export { default } from "next-auth/middleware";

export const config = {
  // Protect everything except auth API routes, login/register pages, and static assets.
  matcher: [
    "/((?!api/auth|login|register|_next/static|_next/image|favicon.ico).*)",
  ],
};
