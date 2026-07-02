import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, doctorNotes } = await req.json();

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      status,
      doctorNotes,
      reviewedAt: status === "REVIEWED" || status === "PDF_SENT" ? new Date() : undefined,
    },
  });

  return NextResponse.json({ success: true, lead });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}
