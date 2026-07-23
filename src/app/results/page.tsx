"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

type Severity = "mild" | "moderate" | "severe";

interface SmileIssue {
  id: string;
  issue: string;
  description: string;
  severity: Severity;
  confidence: number;
  affectedArea: string;
  affectedTeeth: number[];
  suggestedTreatments: string[];
}

interface Analysis {
  photoType: "intraoral" | "selfie" | "unclear";
  smileScore: number;
  overallImpression: string;
  confidenceLevel: "high" | "medium" | "low";
  positives: string[];
  issues: SmileIssue[];
}

const LOADING_STEPS = [
  "Zooming into your smile...",
  "Scanning teeth alignment & colour...",
  "Detecting dental issues...",
  "Compiling your report...",
];

const TREATMENTS: { key: string; label: string }[] = [
  { key: "general",   label: "General" },
  { key: "veneers",   label: "Veneers" },
  { key: "whitening", label: "Whitening" },
  { key: "crowns",    label: "Crowns" },
  { key: "implants",  label: "Implants" },
  { key: "hollywood", label: "Hollywood" },
];

const SEVERITY_STYLE: Record<Severity, { bg: string; text: string; label: string }> = {
  mild:     { bg: "#fef3c7", text: "#92400e", label: "Mild" },
  moderate: { bg: "#fed7aa", text: "#9a3412", label: "Moderate" },
  severe:   { bg: "#fecaca", text: "#991b1b", label: "Severe" },
};

function scoreLabel(score: number): { label: string; colour: string } {
  if (score >= 85) return { label: "Excellent", colour: "#34d399" };
  if (score >= 80) return { label: "Good", colour: "#b8923e" };
  if (score >= 60) return { label: "Fair — Could Improve", colour: "#d4a84b" };
  return { label: "Needs Attention", colour: "#e8a040" };
}

function ScoreCircle({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const { colour } = scoreLabel(score);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#f0ece3" strokeWidth="8" fill="none" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          stroke={colour} strokeWidth="8" fill="none"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.4, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <motion.span
          className="text-4xl font-black shimmer-text"
          style={{ letterSpacing: "-0.03em" }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
        >
          {score}
        </motion.span>
        <span className="text-[10px] tracking-widest uppercase text-[#8c8479]">/100</span>
      </div>
    </div>
  );
}

function IssueCard({ issue, delay }: { issue: SmileIssue; delay: number }) {
  const sev = SEVERITY_STYLE[issue.severity];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="rounded-xl border border-[#b8923e]/15 bg-white p-4 flex flex-col gap-2"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-[#1a1714] text-sm">{issue.issue}</p>
        <span
          className="text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0"
          style={{ background: sev.bg, color: sev.text }}
        >
          {sev.label}
        </span>
      </div>
      <p className="text-[#3d3831] text-xs leading-relaxed">{issue.description}</p>
      {issue.affectedArea && (
        <p className="text-[#8c8479] text-[11px]">Affected area: {issue.affectedArea}</p>
      )}
      {issue.affectedTeeth.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-0.5">
          {issue.affectedTeeth.map((t) => (
            <span key={t} className="text-[10px] font-semibold text-[#8c8479] bg-[#f0ece3] rounded-full px-2 py-0.5">
              #{t}
            </span>
          ))}
        </div>
      )}
      {issue.suggestedTreatments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {issue.suggestedTreatments.map((t) => (
            <span key={t} className="text-[10px] font-semibold text-[#b8923e] bg-[#f5ead6] rounded-full px-2 py-0.5">
              {t}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [photo, setPhoto]           = useState<string | null>(null);
  const [analysis, setAnalysis]     = useState<Analysis | null>(null);
  const [loadStep, setLoadStep]     = useState(0);
  const [error, setError]           = useState<string | null>(null);

  const [selectedTreatment, setSelectedTreatment] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl]     = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError]     = useState<string | null>(null);

  useEffect(() => {
    const front = sessionStorage.getItem("sp_photo_front");
    const teeth = sessionStorage.getItem("sp_photo_teeth");
    if (!front) { router.replace("/scan"); return; }
    setPhoto(teeth ?? front);

    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < LOADING_STEPS.length) setLoadStep(step);
    }, 2200);

    const MIN_DISPLAY_MS = 6000;
    const start = Date.now();

    const photos = [front, teeth].filter(Boolean) as string[];

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos }),
    })
      .then((r) => r.json())
      .then((data) => {
        clearInterval(interval);
        if (data.error) throw new Error(data.error);
        setLoadStep(LOADING_STEPS.length);
        const elapsed = Date.now() - start;
        const wait = Math.max(0, MIN_DISPLAY_MS - elapsed);
        setTimeout(() => setAnalysis(data), wait + 400);
      })
      .catch(() => {
        clearInterval(interval);
        setError("Analysis failed. Please try again.");
      });

    return () => clearInterval(interval);
  }, [router]);

  const proceed = () => {
    if (!analysis) return;
    sessionStorage.setItem("sp_analysis", JSON.stringify(analysis));
    router.push("/confirm");
  };

  const pickTreatment = async (key: string) => {
    if (!photo) return;
    setSelectedTreatment(key);
    setPreviewUrl(null);
    setPreviewError(null);
    setPreviewLoading(true);
    try {
      const res = await fetch("/api/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photo, treatment: key }),
      });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Preview failed");
      setPreviewUrl(data.previewUrl);
    } catch {
      setPreviewError("Couldn't generate an AI preview right now. Please try another treatment or try again.");
    } finally {
      setPreviewLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#faf8f4] flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-[#b8923e]/10">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => router.push("/scan")} className="text-sm text-[#8c8479] hover:text-[#1a1714] transition-colors">
            ← Retake
          </button>
          <span className="font-black text-base shimmer-text">Smile Passport</span>
          <div className="w-12" />
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <AnimatePresence mode="wait">

          {/* ── LOADING ── */}
          {!analysis && !error && (
            <motion.div
              key="loading"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center gap-8 text-center max-w-xs w-full"
            >
              {photo && (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-lg">
                  <img src={photo} alt="Your smile" className="w-full h-full object-cover object-top" />
                  <div className="absolute inset-0 bg-[#b8923e]/10" />
                </div>
              )}

              <div className="relative w-20 h-20 flex items-center justify-center">
                <svg className="animate-spin absolute" width="80" height="80" viewBox="0 0 80 80" fill="none">
                  <circle cx="40" cy="40" r="36" stroke="#f0ece3" strokeWidth="4" />
                  <path d="M40 4a36 36 0 0 1 36 36" stroke="#b8923e" strokeWidth="4" strokeLinecap="round" />
                </svg>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <path d="M5 14c2.5 4 6 6 9 6s6.5-2 9-6" stroke="#b8923e" strokeWidth="1.8" strokeLinecap="round"/>
                  <circle cx="10" cy="10" r="1.5" fill="#b8923e"/>
                  <circle cx="18" cy="10" r="1.5" fill="#b8923e"/>
                </svg>
              </div>

              <div>
                <h2 className="text-xl font-black text-[#1a1714] mb-1" style={{ letterSpacing: "-0.02em" }}>
                  Analysing your smile
                </h2>
                <p className="text-[#8c8479] text-sm">Step {Math.min(loadStep + 1, LOADING_STEPS.length)} of {LOADING_STEPS.length} — usually takes under 10 seconds</p>
              </div>

              <div className="w-full flex flex-col gap-3">
                {LOADING_STEPS.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0.3 }}
                    animate={{ opacity: loadStep >= i ? 1 : 0.3 }}
                    className="flex items-center gap-3"
                  >
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
                      loadStep > i ? "bg-[#b8923e]" : loadStep === i ? "border-2 border-[#b8923e]" : "border-2 border-[#e8e0d4]"
                    }`}>
                      {loadStep > i && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <span className={`text-sm ${loadStep >= i ? "text-[#1a1714] font-medium" : "text-[#8c8479]"}`}>{step}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ── ERROR ── */}
          {error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-6 text-center max-w-xs"
            >
              <div className="w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                  <circle cx="14" cy="14" r="12" stroke="#ef4444" strokeWidth="1.5"/>
                  <path d="M14 8v6M14 18v1" stroke="#ef4444" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-black text-[#1a1714] mb-1">Something went wrong</h2>
                <p className="text-[#8c8479] text-sm">{error}</p>
              </div>
              <button onClick={() => router.push("/scan")} className="gold-btn rounded-full px-8 py-3 text-sm tracking-widest">
                Try Again
              </button>
            </motion.div>
          )}

          {/* ── RESULTS ── */}
          {analysis && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="w-full max-w-2xl flex flex-col gap-6"
            >
              {/* Score card */}
              <div className="card rounded-2xl sm:rounded-3xl overflow-hidden">
                <div
                  className="p-6 sm:p-8 flex items-center gap-6"
                  style={{ background: "linear-gradient(135deg, #1a1714, #2a251f)" }}
                >
                  <ScoreCircle score={analysis.smileScore} size={110} />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] tracking-widest uppercase text-white/50 mb-1">Smile Report</p>
                    <p className="text-lg font-black text-white" style={{ letterSpacing: "-0.02em" }}>
                      {scoreLabel(analysis.smileScore).label}
                    </p>
                    <p className="text-white/60 text-xs mt-1">
                      {analysis.issues.length} area{analysis.issues.length === 1 ? "" : "s"} detected · {analysis.confidenceLevel} confidence
                    </p>
                  </div>
                </div>

                <div className="p-6 sm:p-8 flex flex-col gap-6">
                  <p className="text-[#3d3831] text-sm leading-relaxed">{analysis.overallImpression}</p>

                  {/* What we found */}
                  <div>
                    <p className="text-[10px] tracking-widest uppercase text-[#8c8479] mb-3">What We Found</p>
                    {analysis.positives.length > 0 && (
                      <div className="flex flex-col gap-2 mb-4">
                        {analysis.positives.map((p, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="mt-0.5 shrink-0">
                              <circle cx="7" cy="7" r="6" stroke="#34d399" strokeWidth="1.3"/>
                              <path d="M4.5 7l1.8 1.8L9.5 5" stroke="#34d399" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            <p className="text-[#3d3831] text-xs leading-relaxed">{p}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {analysis.issues.length > 0 ? (
                      <div className="flex flex-col gap-3">
                        {analysis.issues.map((issue, i) => (
                          <IssueCard key={issue.id} issue={issue} delay={i * 0.08} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[#8c8479] text-xs italic">No specific issues detected from this photo.</p>
                    )}
                  </div>

                  {/* Treatment preview picker */}
                  {photo && (
                    <div className="rounded-2xl border border-[#b8923e]/15 overflow-hidden">
                      <div className="relative aspect-[4/3] bg-[#f0ece3]">
                        <img
                          src={previewUrl ?? photo}
                          alt="Smile preview"
                          className="w-full h-full object-contain"
                        />
                        {previewLoading && (
                          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                            <div className="flex flex-col items-center gap-2 text-white">
                              <svg className="animate-spin" width="28" height="28" viewBox="0 0 28 28" fill="none">
                                <circle cx="14" cy="14" r="11" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
                                <path d="M14 3a11 11 0 0 1 11 11" stroke="white" strokeWidth="3" strokeLinecap="round" />
                              </svg>
                              <span className="text-xs">Generating AI preview...</span>
                            </div>
                          </div>
                        )}
                        {previewUrl && !previewLoading && (
                          <span className="absolute top-2 right-2 text-[10px] font-bold bg-black/60 text-white px-2 py-1 rounded-full">
                            AI Preview
                          </span>
                        )}
                      </div>
                      <div className="p-4 flex flex-col gap-3">
                        <p className="text-xs font-semibold text-[#1a1714]">What treatment interests you?</p>
                        {previewError && <p className="text-red-500 text-xs">{previewError}</p>}
                        <div className="flex flex-wrap gap-2">
                          {TREATMENTS.map((t) => (
                            <button
                              key={t.key}
                              onClick={() => pickTreatment(t.key)}
                              disabled={previewLoading}
                              className={`text-xs font-semibold rounded-full px-3.5 py-2 transition-all disabled:opacity-60 ${
                                selectedTreatment === t.key
                                  ? "bg-[#1a1714] text-white"
                                  : "bg-[#f0ece3] text-[#3d3831] hover:bg-[#e8e0d4]"
                              }`}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Disclaimer */}
                  <p className="text-[11px] text-[#8c8479]/70 leading-relaxed italic">
                    This is an AI-generated screening and not a medical diagnosis. A licensed dentist will personally review your smile before any clinical recommendations are made.
                  </p>

                  {/* CTA */}
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    onClick={proceed}
                    className="gold-btn rounded-xl py-4 text-sm tracking-widest glow-gold"
                  >
                    Get My Professional Report →
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
