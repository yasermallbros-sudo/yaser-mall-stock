import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

const COOKIE = process.env.AUTH_COOKIE_NAME ?? "yaser_mall_session";

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return null;
  const jar = await cookies();
  jar.set(COOKIE, user.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 12 });
  return user;
}

export async function logout() { (await cookies()).delete(COOKIE); }
export async function getCurrentUser() {
  const id = (await cookies()).get(COOKIE)?.value;
  if (!id) return null;
  return prisma.user.findUnique({ where: { id }, select: { id: true, name: true, email: true, role: true } });
}
export async function requireUser() { const user = await getCurrentUser(); if (!user) redirect("/"); return user; }
export function canManage(role: string) { return role === "ADMIN" || role === "SUPERVISOR"; }
