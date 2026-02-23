import bcrypt from "bcrypt";
import { NextResponse } from "next/server";
import crypto from "crypto";

import { prisma } from "@/lib/prisma";
import { getServerAuthSession } from "@/lib/auth";

export async function POST(req: Request) {
  const session = await getServerAuthSession();
  if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (session.user.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

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

  const tempPassword = crypto.randomBytes(9).toString("base64url");
  const hash = await bcrypt.hash(tempPassword, 12);

  await prisma.user.update({ where: { id: userId }, data: { password: hash } });

  return NextResponse.json({ email: user.email, tempPassword });
}
