import OpenAI, { toFile } from "openai";
import { NextRequest } from "next/server";

export type TreatmentKey = "general" | "veneers" | "whitening" | "crowns" | "implants" | "hollywood";

const TREATMENT_PROMPTS: Record<TreatmentKey, string> = {
  general:
    "Subtly enhance this smile photo: gently whiten the teeth and reduce minor staining. Keep the face, lips, skin tone, background, lighting, and camera angle completely unchanged.",
  veneers:
    "Simulate the visual result of porcelain veneers on the visible teeth in this photo: make them uniformly white, straight, and evenly shaped for a natural but flawless smile. Keep everything else in the photo — face, lips, skin, background, lighting, angle — completely unchanged.",
  whitening:
    "Simulate professional teeth whitening on this photo: significantly brighten and whiten the visible teeth while preserving their natural shape and alignment. Keep everything else in the photo completely unchanged.",
  crowns:
    "Simulate the visual result of dental crowns on any damaged or discoloured teeth in this photo: make them look uniform, healthy, and naturally shaped to match the surrounding teeth. Keep everything else in the photo completely unchanged.",
  implants:
    "Simulate the visual result of dental implants filling in any gaps from missing teeth in this photo, matching the colour and shape of the surrounding natural teeth. Keep everything else in the photo completely unchanged.",
  hollywood:
    "Simulate a glamorous 'Hollywood smile' makeover on this photo: bright white, perfectly straight, evenly shaped teeth. Keep everything else in the photo — face, lips, skin, background, lighting, angle — completely unchanged.",
};

function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const match = dataUrl.match(/^data:(image\/\w+);base64,(.+)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], "base64") };
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function POST(req: NextRequest) {
  try {
    const { photo, treatment } = await req.json();
    if (!photo || typeof photo !== "string") {
      return Response.json({ error: "Missing photo" }, { status: 400 });
    }

    const parsed = parseDataUrl(photo);
    if (!parsed) {
      return Response.json({ error: "Invalid photo format" }, { status: 400 });
    }

    const key: TreatmentKey = treatment in TREATMENT_PROMPTS ? treatment : "general";
    const prompt = TREATMENT_PROMPTS[key];
    const ext = EXT_BY_MIME[parsed.mime] ?? "png";

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const file = await toFile(parsed.buffer, `smile.${ext}`, { type: parsed.mime });

    const result = await client.images.edit({
      model: "gpt-image-1",
      image: file,
      prompt,
      size: "1024x1024",
    });

    const b64 = result.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned from edit call");

    return Response.json({ previewUrl: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("Preview error:", err);
    return Response.json({ error: "Preview generation failed" }, { status: 500 });
  }
}
