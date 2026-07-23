import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { patientReportEmail } from "@/lib/email-templates";
import { generateReportPdf } from "@/lib/generate-report-pdf";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { status, doctorNotes } = await req.json();

  const previous = await prisma.lead.findUnique({ where: { id } });

  const lead = await prisma.lead.update({
    where: { id },
    data: {
      status,
      doctorNotes,
      reviewedAt: status === "REVIEWED" || status === "PDF_SENT" ? new Date() : undefined,
    },
  });

  if (status === "PDF_SENT" && previous?.status !== "PDF_SENT") {
    try {
      const pdfBuffer = await generateReportPdf(lead);
      const { subject, html } = patientReportEmail(lead);
      await sendMail({
        to: lead.email,
        subject,
        html,
        attachments: [
          {
            filename: `Smile-Passport-Report-${lead.name.replace(/[^a-z0-9]+/gi, "-")}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf",
          },
        ],
      });
    } catch (err) {
      console.error("Failed to generate/send patient report PDF:", err);
    }
  }

  return NextResponse.json({ success: true, lead });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(lead);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.lead.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
