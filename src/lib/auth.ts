import { SignJWT, jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.NEXTAUTH_SECRET);

export const DOCTOR_SESSION_COOKIE = "doctor_session";

export interface DoctorTokenPayload {
  doctorId: string;
  email: string;
  name: string;
}

export async function signDoctorToken(payload: DoctorTokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(secret);
}

export async function verifyDoctorToken(token: string): Promise<DoctorTokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    if (typeof payload.doctorId !== "string" || typeof payload.email !== "string" || typeof payload.name !== "string") {
      return null;
    }
    return { doctorId: payload.doctorId, email: payload.email, name: payload.name };
  } catch {
    return null;
  }
}
