import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signDoctorToken, DOCTOR_SESSION_COOKIE } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required." }, { status: 400 });
  }

  const doctor = await prisma.doctor.findUnique({ where: { email } });
  const valid = doctor ? await bcrypt.compare(password, doctor.passwordHash) : false;

  if (!doctor || !valid) {
    return NextResponse.json({ error: "Invalid email or password." }, { status: 401 });
  }

  const token = await signDoctorToken({ doctorId: doctor.id, email: doctor.email, name: doctor.name });

  const res = NextResponse.json({ id: doctor.id, name: doctor.name, email: doctor.email });
  res.cookies.set(DOCTOR_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
  return res;
}
