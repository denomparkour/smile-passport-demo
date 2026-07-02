import OpenAI from "openai";
import { NextRequest } from "next/server";

export interface SmileMetrics {
  smileWidthRatio: number;   // mouth width / face width
  mouthOpenness: number;     // vertical opening / face height
  symmetryScore: number;     // 0–1
  smileCurve: number;        // upturned corner amount (positive = cheerful)
  facialHarmony: number;     // 0–1
}

const FALLBACK_CELEBS = [
  "Shah Rukh Khan", "Hrithik Roshan", "Deepika Padukone", "Priyanka Chopra",
  "Ranveer Singh", "Alia Bhatt", "Allu Arjun", "Rashmika Mandanna",
];

// Clamp a value into a score range
function norm(v: number, min: number, max: number, lo = 55, hi = 95): number {
  return Math.round(lo + (Math.max(min, Math.min(max, v)) - min) / (max - min) * (hi - lo));
}

function metricsToScores(m: SmileMetrics): { symmetry: number; alignment: number; crowding: number; spacing: number; harmony: number } {
  return {
    symmetry:  norm(m.symmetryScore,    0.70, 1.00),
    alignment: norm(m.smileCurve,      -0.02, 0.08),
    crowding:  norm(m.mouthOpenness,    0.005, 0.07),
    spacing:   norm(m.smileWidthRatio,  0.35, 0.58),
    harmony:   norm(m.facialHarmony,    0.50, 1.00),
  };
}

function metricsToDescription(m: SmileMetrics): string {
  const width      = m.smileWidthRatio > 0.50 ? "wide" : m.smileWidthRatio > 0.44 ? "medium-width" : "narrower";
  const openness   = m.mouthOpenness   > 0.04 ? "very open — teeth prominently visible"
                   : m.mouthOpenness   > 0.015 ? "open — teeth visible"
                   : "closed or barely open";
  const sym        = m.symmetryScore   > 0.93 ? "highly symmetric"
                   : m.symmetryScore   > 0.85 ? "mostly symmetric"
                   : "slightly asymmetric";
  const curve      = m.smileCurve      > 0.045 ? "strongly upturned corners — very cheerful and expressive"
                   : m.smileCurve      > 0.015 ? "upturned corners — warm and inviting"
                   : m.smileCurve      > 0     ? "gently curved — calm and natural"
                   : "relatively flat corners";
  const harmony    = m.facialHarmony   > 0.80 ? "excellent" : m.facialHarmony > 0.65 ? "good" : "moderate";

  return `Smile geometry (measured from facial landmark analysis):
- Width: ${width} smile (ratio ${m.smileWidthRatio.toFixed(3)}, scale 0.35–0.60)
- Openness: ${openness}
- Symmetry: ${sym} (score ${m.symmetryScore.toFixed(3)})
- Corner lift: ${curve}
- Facial harmony: ${harmony} (${(m.facialHarmony * 100).toFixed(0)}%)`;
}

// Seeded fallback when no metrics and no GPT
function seeded(seed: number, offset: number) {
  const x = Math.sin(seed * 9301 + offset * 49297 + 233) * 10000;
  return x - Math.floor(x);
}
function randomScores(photos: string[]): { symmetry: number; alignment: number; crowding: number; spacing: number; harmony: number } {
  const raw  = photos.join("").slice(0, 500);
  const seed = raw.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const base = 65 + Math.floor(seeded(seed, 1) * 24);
  const v    = (o: number) => Math.max(56, Math.min(96, base + Math.floor(seeded(seed, o) * 22) - 11));
  return { symmetry: v(2), alignment: v(3), crowding: v(4), spacing: v(5), harmony: v(6) };
}

function buildFallback(scores: ReturnType<typeof randomScores>, seed = 0) {
  const celeb = FALLBACK_CELEBS[Math.floor(seeded(seed, 99) * FALLBACK_CELEBS.length)];
  const overall = Math.round((scores.symmetry + scores.alignment + scores.crowding + scores.spacing + scores.harmony) / 5);
  return {
    overallScore: overall,
    categories: {
      symmetry:  { score: scores.symmetry,  note: "Your smile has a beautifully natural, balanced look." },
      alignment: { score: scores.alignment, note: "Great visual flow — your smile sits comfortably in your face." },
      crowding:  { score: scores.crowding,  note: "Teeth are well-defined and clear in expression." },
      spacing:   { score: scores.spacing,   note: "Pleasant spacing that gives your smile real personality." },
      harmony:   { score: scores.harmony,   note: "Your smile blends warmly with your overall expression." },
    },
    celebrityMatch: celeb,
    celebrityNote:  `Like ${celeb}, your smile radiates warmth and effortless confidence.`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body   = await req.json();
    const photos: string[] = body.photos ?? (body.photoBase64 ? [body.photoBase64] : []);
    const metrics: SmileMetrics | null = body.metrics ?? null;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    type Scores = { symmetry: number; alignment: number; crowding: number; spacing: number; harmony: number };
    let scores: Scores;
    let smileDescription: string;

    if (metrics) {
      scores = metricsToScores(metrics);
      smileDescription = metricsToDescription(metrics);
    } else {
      scores = randomScores(photos);
      smileDescription = `Smile scores — symmetry: ${scores.symmetry}, alignment: ${scores.alignment}, crowding: ${scores.crowding}, spacing: ${scores.spacing}, harmony: ${scores.harmony}`;
    }

    const overall = Math.round((scores.symmetry + scores.alignment + scores.crowding + scores.spacing + scores.harmony) / 5);

    const response = await client.chat.completions.create({
      model: "gpt-4o",
      messages: [{
        role: "user",
        content: `You're writing results for a smile personality quiz app.

Here is the smile data from facial landmark geometry:
${smileDescription}

Tasks:
1. Write one short, upbeat sentence per category describing that smile quality (symmetry, alignment, crowding, spacing, harmony).
2. Pick ONE well-known Indian celebrity (Bollywood, Tollywood, cricket, any field) whose smile energy and personality best matches this smile geometry. Choose freely — think about their known smile width, expressiveness, and warmth.

Return ONLY this JSON — no markdown, no extra text:
{
  "notes": {
    "symmetry": "...",
    "alignment": "...",
    "crowding": "...",
    "spacing": "...",
    "harmony": "..."
  },
  "celebrityMatch": "Full name",
  "celebrityNote": "one warm sentence about why their smile energy matches"
}`,
      }],
      max_tokens: 400,
    });

    const raw       = response.choices[0]?.message?.content ?? "";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return Response.json(buildFallback(scores, overall));

    const gpt = JSON.parse(jsonMatch[0]);

    return Response.json({
      overallScore: overall,
      categories: {
        symmetry:  { score: scores.symmetry,  note: gpt.notes?.symmetry  ?? "Beautiful smile symmetry." },
        alignment: { score: scores.alignment, note: gpt.notes?.alignment ?? "Great alignment." },
        crowding:  { score: scores.crowding,  note: gpt.notes?.crowding  ?? "Nice open smile." },
        spacing:   { score: scores.spacing,   note: gpt.notes?.spacing   ?? "Natural spacing." },
        harmony:   { score: scores.harmony,   note: gpt.notes?.harmony   ?? "Wonderful harmony." },
      },
      celebrityMatch: gpt.celebrityMatch ?? FALLBACK_CELEBS[0],
      celebrityNote:  gpt.celebrityNote  ?? "Your smile radiates warmth and confidence.",
    });

  } catch (err) {
    console.error("Analyze error:", err);
    return Response.json(buildFallback(randomScores([]), 0));
  }
}
