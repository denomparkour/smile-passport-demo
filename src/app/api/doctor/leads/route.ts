import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") || undefined;
  const page = parseInt(searchParams.get("page") || "1");
  const limit = 12;

  const where = status ? { status: status as "PENDING" | "REVIEWED" | "PDF_SENT" } : {};

  const [leads, total] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        quoteShown: true,
        status: true,
        doctorNotes: true,
        reviewedAt: true,
        createdAt: true,
        photoBase64: true,
        photoTeeth:  true,
        photoSide:   true,
        smileScore:  true,
        celebrityMatch: true,
      },
    }),
    prisma.lead.count({ where }),
  ]);

  return NextResponse.json({ leads, total, pages: Math.ceil(total / limit) });
}
