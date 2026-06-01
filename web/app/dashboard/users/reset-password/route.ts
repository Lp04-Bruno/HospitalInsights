import bcrypt from "bcrypt";
import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { requireApiAdmin } from "@/lib/access";
import { generateTemporaryPassword } from "@/lib/passwordPolicy";

export async function POST(req: Request) {
  const access = await requireApiAdmin();
  if (!access.ok) return access.response;
  const { session } = access;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body === "object" && body && "userId" in body ? String((body as { userId?: unknown }).userId ?? "") : "";
  if (!userId) return NextResponse.json({ error: "Missing userId" }, { status: 400 });

  if (userId === session.user.id) {
    return NextResponse.json({ error: "Cannot reset own password here" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const tempPassword = generateTemporaryPassword();
  const hash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({ where: { id: userId }, data: { password: hash } });

  return NextResponse.json({ email: user.email, tempPassword });
}
