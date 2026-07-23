import { NextRequest, NextResponse } from "next/server";
import { verifyDoctorToken, DOCTOR_SESSION_COOKIE } from "@/lib/auth";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get(DOCTOR_SESSION_COOKIE)?.value;
  const session = token ? await verifyDoctorToken(token) : null;

  if (pathname.startsWith("/api/doctor/login")) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/doctor")) {
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/doctor/login")) {
    if (session) {
      return NextResponse.redirect(new URL("/doctor", req.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/doctor")) {
    if (!session) {
      const loginUrl = new URL("/doctor/login", req.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/doctor/:path*", "/api/doctor/:path*"],
};
