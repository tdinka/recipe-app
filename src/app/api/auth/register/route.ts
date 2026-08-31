import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(80),
  email: z.string().email(),
  password: z.string().min(8, "Password must be at least 8 characters"),
  mode: z.enum(["create", "join"]),
  householdName: z.string().max(80).optional(),
  inviteCode: z.string().optional(),
});

function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input" }, { status: 400 });
  }
  const { name, email, password, mode, householdName, inviteCode } = parsed.data;
  const normalizedEmail = email.toLowerCase().trim();

  const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
  if (existing) {
    return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
  }

  const passwordHash = await bcrypt.hash(password, 10);

  try {
    if (mode === "create") {
      if (!householdName) {
        return NextResponse.json({ error: "Household name is required." }, { status: 400 });
      }
      let code = generateInviteCode();
      // Extremely unlikely to collide, but guard anyway.
      for (let i = 0; i < 5 && (await db.household.findUnique({ where: { inviteCode: code } })); i++) {
        code = generateInviteCode();
      }

      const household = await db.household.create({
        data: {
          name: householdName,
          inviteCode: code,
          users: {
            create: { name, email: normalizedEmail, passwordHash },
          },
        },
      });
      return NextResponse.json({ ok: true, inviteCode: household.inviteCode });
    }

    // mode === "join"
    if (!inviteCode) {
      return NextResponse.json({ error: "Invite code is required." }, { status: 400 });
    }
    const household = await db.household.findUnique({ where: { inviteCode: inviteCode.toUpperCase().trim() } });
    if (!household) {
      return NextResponse.json({ error: "That invite code wasn't found." }, { status: 404 });
    }
    await db.user.create({
      data: { name, email: normalizedEmail, passwordHash, householdId: household.id },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Something went wrong creating the account." }, { status: 500 });
  }
}
