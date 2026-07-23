import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendMail } from "@/lib/mail";
import { ownerNotificationEmail } from "@/lib/email-templates";
import { uploadImage } from "@/lib/cloudinary";

export async function POST(req: NextRequest) {
  try {
    const { name, email, phone, photoBase64, photoTeeth, photoSide, smileScore, analysisJson } = await req.json();

    if (!name || !email || !phone || !photoBase64) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const [uploadedPhoto, uploadedTeeth, uploadedSide] = await Promise.all([
      uploadImage(photoBase64),
      photoTeeth ? uploadImage(photoTeeth) : Promise.resolve(null),
      photoSide ? uploadImage(photoSide) : Promise.resolve(null),
    ]);

    const lead = await prisma.lead.create({
      data: {
        name,
        email,
        phone,
        photoBase64: uploadedPhoto,
        photoTeeth: uploadedTeeth,
        photoSide:  uploadedSide,
        smileScore: smileScore ?? null,
        analysisJson: analysisJson ? JSON.stringify(analysisJson) : null,
      },
    });

    if (process.env.OWNER_EMAIL) {
      try {
        const { subject, html } = ownerNotificationEmail(lead);
        await sendMail({ to: process.env.OWNER_EMAIL, subject, html });
      } catch (err) {
        console.error("Failed to send owner notification email:", err);
      }
    }

    return NextResponse.json({ success: true, id: lead.id });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}
