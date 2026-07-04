import OpenAI from "openai";
import { NextRequest } from "next/server";

export interface SmileMetrics {
  smileWidthRatio: number;
  mouthOpenness: number;
  symmetryScore: number;
  smileCurve: number;
  facialHarmony: number;
}

const CELEB_POOL_MALE = [
  // Bollywood
  "Hrithik Roshan", "Ranveer Singh", "Ranbir Kapoor", "Vicky Kaushal",
  "Kartik Aaryan", "Ayushmann Khurrana", "Rajkummar Rao", "Sidharth Malhotra",
  "Shahid Kapoor", "Aditya Roy Kapur", "Tiger Shroff", "Arjun Kapoor",
  // Telugu
  "Allu Arjun", "Prabhas", "Ram Charan", "Jr NTR", "Vijay Deverakonda",
  "Nani", "Adivi Sesh", "Akhil Akkineni", "Bellamkonda Srinivas",
  // Tamil
  "Dhanush", "Sivakarthikeyan", "Vijay Sethupathi", "Jiiva", "Silambarasan",
  "Vikram Prabhu", "Atharvaa", "Harish Kalyan",
  // Malayalam
  "Dulquer Salmaan", "Tovino Thomas", "Fahadh Faasil", "Nivin Pauly",
  "Asif Ali", "Shane Nigam",
  // Kannada
  "Rakshit Shetty", "Rishab Shetty", "Darshan",
  // Sports
  "Virat Kohli", "MS Dhoni", "Rohit Sharma", "Hardik Pandya", "KL Rahul",
  "Shubman Gill", "Suryakumar Yadav", "Neeraj Chopra",
];

const CELEB_POOL_FEMALE = [
  // Bollywood
  "Alia Bhatt", "Anushka Sharma", "Kareena Kapoor", "Katrina Kaif",
  "Kiara Advani", "Shraddha Kapoor", "Kriti Sanon", "Taapsee Pannu",
  "Mrunal Thakur", "Sara Ali Khan", "Janhvi Kapoor", "Bhumi Pednekar",
  "Sobhita Dhulipala", "Radhika Apte", "Konkona Sen Sharma",
  // Telugu
  "Rashmika Mandanna", "Pooja Hegde", "Samantha Ruth Prabhu", "Kajal Aggarwal",
  "Tamannaah Bhatia", "Sreeleela", "Krithi Shetty", "Anupama Parameswaran",
  // Tamil
  "Nayanthara", "Trisha Krishnan", "Keerthy Suresh", "Priya Varrier",
  "Aishwarya Rajesh", "Aditi Balan", "Ritika Singh",
  // Malayalam
  "Nazriya Nazim", "Parvathy Thiruvothu", "Anna Ben", "Darshana Rajendran",
  // Kannada
  "Rachita Ram", "Srinidhi Shetty",
  // Sports & others
  "PV Sindhu", "Smriti Mandhana", "Mirabai Chanu", "Dipa Karmakar",
];

const FALLBACK_MALE   = CELEB_POOL_MALE.slice(0, 8);
const FALLBACK_FEMALE = CELEB_POOL_FEMALE.slice(0, 8);

function pickCelebPool(gender: "male" | "female" | "unknown", seed: number): string[] {
  const pool = gender === "female" ? CELEB_POOL_FEMALE
             : gender === "male"   ? CELEB_POOL_MALE
             : [...CELEB_POOL_MALE, ...CELEB_POOL_FEMALE];
  const shuffled = [...pool].sort(() => seeded(seed, pool.length) - 0.5);
  return shuffled.slice(0, 12);
}

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

async function fetchCelebImage(name: string): Promise<string | null> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(name)}`,
      { headers: { "User-Agent": "SmilePassport/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return (data.thumbnail?.source as string) ?? null;
  } catch {
    return null;
  }
}

function buildFallback(
  scores: ReturnType<typeof randomScores>,
  gender: "male" | "female" | "unknown",
  seed = 0
) {
  const pool  = gender === "male" ? FALLBACK_MALE : gender === "female" ? FALLBACK_FEMALE : [...FALLBACK_MALE, ...FALLBACK_FEMALE];
  const celeb = pool[Math.floor(seeded(seed, 99) * pool.length)];
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
    celebrityMatch:    celeb,
    celebrityNote:     `Like ${celeb}, your smile radiates warmth and effortless confidence.`,
    celebrityImageUrl: null,
    gender,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body    = await req.json();
    const photos: string[] = body.photos ?? (body.photoBase64 ? [body.photoBase64] : []);
    const metrics: SmileMetrics | null = body.metrics ?? null;

    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    type Scores = { symmetry: number; alignment: number; crowding: number; spacing: number; harmony: number };
    const scores: Scores = metrics ? metricsToScores(metrics) : randomScores(photos);
    const overall = Math.round((scores.symmetry + scores.alignment + scores.crowding + scores.spacing + scores.harmony) / 5);

    // Build image content blocks from whichever photos we have (up to 3)
    const imageBlocks: OpenAI.Chat.ChatCompletionContentPart[] = photos
      .filter(Boolean)
      .slice(0, 3)
      .map(p => ({ type: "image_url", image_url: { url: p, detail: "low" } } as const));

    // Also include landmark scores as supplementary data if available
    const supplementary = metrics
      ? `\nSupplementary landmark measurements: symmetry ${scores.symmetry}/100, alignment ${scores.alignment}/100, openness ${scores.crowding}/100, width ${scores.spacing}/100, harmony ${scores.harmony}/100.`
      : "";


    const hasPhotos = imageBlocks.length > 0;

    const poolSeed = photos.join("").slice(0, 100).split("").reduce((a, c) => a + c.charCodeAt(0), overall);
    const celebPool = pickCelebPool("unknown", poolSeed);
    const celebPoolLine = `Celebrity pool (pick ONE from this list only): ${celebPool.join(", ")}`;

    let raw = "";

    if (hasPhotos) {
      const response = await client.chat.completions.create({
        model: "gpt-4o",
        temperature: 1.1,
        messages: [{
          role: "system",
          content: `You are SmileQuizAI.

Your job is to analyze ONLY the visible smile in an image for a lighthearted dental smile quiz.

Rules:
- Focus ONLY on smile-related features: smile width, smile openness, smile symmetry, corner lift, visible teeth, overall smile harmony.
- Ignore identity, attractiveness, age, ethnicity, hairstyle, glasses, skin tone, clothing, face shape and every other facial characteristic.
- Never identify the person.
- Never guess who the person is.
- Never compare the person's overall appearance to a celebrity.
- If a celebrity is requested, interpret it ONLY as a comparison of SMILE STYLE, never facial resemblance or identity.

Celebrity selection rules:
- You will be given a list of Indian celebrities. Pick the ONE whose smile style best matches the smile you analyzed.
- Base your choice ONLY on smile characteristics — width, openness, symmetry, corner lift, energy.
- Do NOT pick based on fame. Pick based on closest smile match.
- Do NOT imply the person looks like the celebrity.
- Explain the similarity is limited to smile style only.

If no smile is visible or the teeth cannot be evaluated:
- Do not invent observations.
- Explain which smile features cannot be assessed.
- Set celebrityMatch to "Unknown".

Always return valid JSON. Output ONLY valid JSON. No markdown. No explanations. No code fences. No extra keys. Never hallucinate visible teeth. If uncertain, explicitly say the feature cannot be determined.`,
        }, {
          role: "user",
          content: [
            ...imageBlocks,
            {
              type: "text",
              text: `Analyze the smile in this dental quiz photo.${supplementary}

${celebPoolLine}

Return this exact JSON schema:
{
  "gender": "male" | "female" | "unknown",
  "notes": {
    "symmetry": "...",
    "alignment": "...",
    "crowding": "...",
    "spacing": "...",
    "harmony": "..."
  },
  "celebrityMatch": "Full name from the pool" | "Unknown",
  "celebrityNote": "one warm sentence about smile style similarity only"
}`,
            },
          ],
        }],
        max_tokens: 500,
      });
      raw = response.choices[0]?.message?.content ?? "";
    }

    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      if (raw) console.warn("Analyze: GPT returned unparseable JSON, falling back. Raw:", raw.slice(0, 200));
      return Response.json({ ...buildFallback(scores, "unknown", overall), source: hasPhotos ? "fallback" : "no-photo-fallback" });
    }

    const gpt = JSON.parse(jsonMatch[0]);
    const gender: "male" | "female" | "unknown" =
      gpt.gender === "female" ? "female" : gpt.gender === "male" ? "male" : "unknown";
    const celebName: string = gpt.celebrityMatch ?? (gender === "male" ? FALLBACK_MALE[0] : FALLBACK_FEMALE[0]);

    const celebrityImageUrl = await fetchCelebImage(celebName);

    return Response.json({
      source: "gpt",
      overallScore: overall,
      categories: {
        symmetry:  { score: scores.symmetry,  note: gpt.notes?.symmetry  ?? "Beautiful smile symmetry." },
        alignment: { score: scores.alignment, note: gpt.notes?.alignment ?? "Great alignment." },
        crowding:  { score: scores.crowding,  note: gpt.notes?.crowding  ?? "Nice open smile." },
        spacing:   { score: scores.spacing,   note: gpt.notes?.spacing   ?? "Natural spacing." },
        harmony:   { score: scores.harmony,   note: gpt.notes?.harmony   ?? "Wonderful harmony." },
      },
      celebrityMatch:    celebName,
      celebrityNote:     gpt.celebrityNote ?? "Your smile radiates warmth and confidence.",
      celebrityImageUrl,
      gender,
    });

  } catch (err) {
    console.error("Analyze error:", err);
    return Response.json({ ...buildFallback(randomScores([]), "unknown", 0), source: "error-fallback" });
  }
}
