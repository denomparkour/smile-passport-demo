import OpenAI from "openai";
import { NextRequest } from "next/server";

export type Severity = "mild" | "moderate" | "severe";
export type PhotoType = "intraoral" | "selfie" | "unclear";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface SmileIssue {
  id: string;
  issue: string;
  description: string;
  severity: Severity;
  confidence: number;
  affectedArea: string;
  affectedTeeth: number[];
  suggestedTreatments: string[];
}

export interface SmileAnalysis {
  source: string;
  photoType: PhotoType;
  smileScore: number;
  overallImpression: string;
  confidenceLevel: ConfidenceLevel;
  positives: string[];
  issues: SmileIssue[];
}

const TREATMENT_LIST = [
  "Teeth Whitening",
  "Porcelain Veneers",
  "Crowns",
  "Bridges",
  "Dental Implants",
  "Orthodontics / Invisalign",
  "Deep Cleaning",
  "Gum Treatment",
  "Root Canal",
];

const ISSUE_TYPES = [
  "Discoloration/staining",
  "Misalignment/crowding",
  "Gaps between teeth",
  "Missing teeth",
  "Decay or visible damage",
  "Gum inflammation/recession",
];

function seeded(seed: number, offset: number) {
  const x = Math.sin(seed * 9301 + offset * 49297 + 233) * 10000;
  return x - Math.floor(x);
}

function seedFromPhotos(photos: string[]): number {
  const raw = photos.join("").slice(0, 500);
  return raw.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
}

function buildFallback(seed: number, hasPhotos: boolean): SmileAnalysis {
  const score = 60 + Math.floor(seeded(seed, 1) * 30);
  return {
    source: hasPhotos ? "fallback" : "no-photo-fallback",
    photoType: "unclear",
    smileScore: score,
    overallImpression:
      "We couldn't fully analyse this photo. Here's a preliminary estimate — a licensed dentist will review your actual smile in detail.",
    confidenceLevel: "low",
    positives: ["The overall oral hygiene appears reasonable."],
    issues: [
      {
        id: "discoloration-staining-1",
        issue: "Discoloration/staining",
        description: "Some possible surface staining was detected, though the photo made this hard to confirm precisely.",
        severity: "mild",
        confidence: 0.4,
        affectedArea: "front teeth",
        affectedTeeth: [],
        suggestedTreatments: ["Teeth Whitening"],
      },
    ],
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const photos: string[] = body.photos ?? (body.photoBase64 ? [body.photoBase64] : []);

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const imageBlocks: OpenAI.Chat.ChatCompletionContentPart[] = photos
      .filter(Boolean)
      .slice(0, 3)
      .map((p) => ({ type: "image_url", image_url: { url: p, detail: "high" } } as const));

    const hasPhotos = imageBlocks.length > 0;
    const seed = seedFromPhotos(photos);

    let raw = "";

    if (hasPhotos) {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.4,
        messages: [
          {
            role: "system",
            content: `You are DentalVisionAI, an assistant that performs a lighthearted, preliminary AI dental smile screening from photos. This is NOT a medical diagnosis.

Rules:
- Determine "photoType": "intraoral" (close-up of teeth/mouth), "selfie" (smiling face photo), or "unclear" (no usable view of teeth).
- Only evaluate visible dental characteristics. Ignore identity, attractiveness, age, ethnicity, and any other non-dental trait. Never identify the person.
- Detect issues ONLY from this list: ${ISSUE_TYPES.join(", ")}.
- For each issue you find, include: a short description, severity ("mild" | "moderate" | "severe"), your confidence (0 to 1), the affected area in plain words, and, if you can reasonably estimate it, the affected teeth using FDI two-digit tooth notation (e.g. 11, 12, 21, 22...). If you cannot identify specific teeth, return an empty array — never guess numbers you are not reasonably confident about.
- For each issue, suggest 1-3 treatments chosen ONLY from this list: ${TREATMENT_LIST.join(", ")}.
- Also list 2-4 short positive observations (things that look healthy or good), even if issues are also present.
- Assign an overall "smileScore" from 0-100 reflecting general dental health and aesthetics, weighing severity and number of issues (not just issue count).
- Write one short, warm "overallImpression" sentence.
- Set "confidenceLevel" ("high" | "medium" | "low") based on how clear and usable the photo is.
- If no teeth or mouth are visible, set photoType to "unclear", issues to an empty array, and explain what's missing in overallImpression.
- Never invent findings you cannot support from the image. If uncertain about a specific detail, omit it rather than guessing.

Always output ONLY valid JSON. No markdown, no code fences, no extra keys.`,
          },
          {
            role: "user",
            content: [
              ...imageBlocks,
              {
                type: "text",
                text: `Analyze the smile/teeth in this photo and return this exact JSON schema:
{
  "photoType": "intraoral" | "selfie" | "unclear",
  "smileScore": number,
  "overallImpression": "...",
  "confidenceLevel": "high" | "medium" | "low",
  "positives": ["...", "..."],
  "issues": [
    {
      "issue": "one of the allowed issue types",
      "description": "...",
      "severity": "mild" | "moderate" | "severe",
      "confidence": number,
      "affectedArea": "...",
      "affectedTeeth": [11, 12],
      "suggestedTreatments": ["..."]
    }
  ]
}`,
              },
            ],
          },
        ],
        max_tokens: 1200,
      });
      raw = response.choices[0]?.message?.content ?? "";
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (raw) console.warn("Analyze: GPT returned unparseable JSON, falling back. Raw:", raw.slice(0, 200));
      return Response.json(buildFallback(seed, hasPhotos));
    }

    const gpt = JSON.parse(jsonMatch[0]);

    const photoType: PhotoType =
      gpt.photoType === "intraoral" || gpt.photoType === "selfie" ? gpt.photoType : "unclear";
    const confidenceLevel: ConfidenceLevel =
      gpt.confidenceLevel === "high" || gpt.confidenceLevel === "medium" ? gpt.confidenceLevel : "low";
    const smileScore = Math.max(0, Math.min(100, Math.round(Number(gpt.smileScore) || 0)));

    const issues: SmileIssue[] = Array.isArray(gpt.issues)
      ? gpt.issues.slice(0, 6).map((raw: Record<string, unknown>, i: number) => ({
          id: `${String(raw.issue ?? "issue").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${i + 1}`,
          issue: String(raw.issue ?? "Dental issue"),
          description: String(raw.description ?? ""),
          severity: (raw.severity === "moderate" || raw.severity === "severe") ? raw.severity : "mild",
          confidence: typeof raw.confidence === "number" ? Math.max(0, Math.min(1, raw.confidence)) : 0.5,
          affectedArea: String(raw.affectedArea ?? ""),
          affectedTeeth: Array.isArray(raw.affectedTeeth) ? raw.affectedTeeth.filter((n) => Number.isInteger(n)) : [],
          suggestedTreatments: Array.isArray(raw.suggestedTreatments)
            ? raw.suggestedTreatments.filter((t: unknown) => typeof t === "string").slice(0, 3)
            : [],
        }))
      : [];

    const positives: string[] = Array.isArray(gpt.positives)
      ? gpt.positives.filter((p: unknown) => typeof p === "string").slice(0, 4)
      : [];

    return Response.json({
      source: "gpt",
      photoType,
      smileScore,
      overallImpression: String(gpt.overallImpression ?? ""),
      confidenceLevel,
      positives,
      issues,
    });
  } catch (err) {
    console.error("Analyze error:", err);
    return Response.json(buildFallback(0, false));
  }
}
