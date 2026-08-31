import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

// Temporary diagnostic: prints straight to server logs on every boot,
// to check what this exact running process actually sees — remove once resolved.
console.log(
  "[diagnostic] NEXTAUTH_SECRET present:",
  Boolean(process.env.NEXTAUTH_SECRET),
  "| length:",
  process.env.NEXTAUTH_SECRET?.length ?? 0,
  "| all env keys containing AUTH:",
  Object.keys(process.env).filter((k) => k.includes("AUTH"))
);

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };