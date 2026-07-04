import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, photoBase64, photoTeeth, photoSide, smileScore, analysisJson, celebrityMatch } = await req.json();

    if (!name || !email || !phone || !photoBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone,
        photoBase64,
        photoTeeth: photoTeeth || null,
        photoSide:  photoSide  || null,
        quoteShown: celebrityMatch ?? "",
        smileScore: smileScore ?? null,
        analysisJson: analysisJson ? JSON.stringify(analysisJson) : null,
        celebrityMatch: celebrityMatch ?? null,
      },
    });

    return NextResponse.json({ success: true, id: lead.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
