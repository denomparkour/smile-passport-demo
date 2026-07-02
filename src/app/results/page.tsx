"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface CategoryScore {
  score: number;
  note: string;
}

interface Analysis {
  overallScore: number;
  categories: {
    symmetry:  CategoryScore;
    alignment: CategoryScore;
    crowding:  CategoryScore;
    spacing:   CategoryScore;
    harmony:   CategoryScore;
  };
  celebrityMatch: string;
  celebrityNote: string;
}

const CATEGORY_LABELS: Record<keyof Analysis["categories"], string> = {
  symmetry:  "Smile Symmetry",
  alignment: "Tooth Alignment",
  crowding:  "Crowding",
  spacing:   "Spacing",
  harmony:   "Facial Harmony",
};

const LOADING_STEPS = [
  "Detecting facial landmarks...",
  "Calculating smile metrics...",
  "Matching celebrity profile...",
];

function ScoreCircle({ score, size = 140 }: { score: number; size?: number }) {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const colour = score >= 80 ? "#b8923e" : score >= 60 ? "#d4a84b" : "#e8a040";

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

function CategoryBar({ label, score, note, delay }: { label: string; score: number; note: string; delay: number }) {
  const colour = score >= 80 ? "#34d399" : score >= 60 ? "#b8923e" : "#f59e0b";
  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex flex-col gap-1"
    >
      <div className="flex justify-between items-baseline">
        <span className="text-xs font-semibold text-[#1a1714]">{label}</span>
        <span className="text-xs font-bold" style={{ color: colour }}>{score}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-[#f0ece3] overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: colour }}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ delay: delay + 0.1, duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <p className="text-[11px] text-[#8c8479] leading-snug">{note}</p>
    </motion.div>
  );
}

export default function ResultsPage() {
  const router = useRouter();
  const [photo, setPhoto]           = useState<string | null>(null);
  const [analysis, setAnalysis]     = useState<Analysis | null>(null);
  const [loadStep, setLoadStep]     = useState(0);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const front = sessionStorage.getItem("sp_photo_front");
    const teeth = sessionStorage.getItem("sp_photo_teeth");
    if (!front) { router.replace("/scan"); return; }
    setPhoto(front);

    // Step through loading labels every ~1.6s
    let step = 0;
    const interval = setInterval(() => {
      step += 1;
      if (step < LOADING_STEPS.length) setLoadStep(step);
    }, 1600);

    const MIN_DISPLAY_MS = 5000;
    const start = Date.now();

    const photos  = [front, teeth].filter(Boolean) as string[];
    const rawMetrics = sessionStorage.getItem("sp_metrics");
    const metrics = rawMetrics ? JSON.parse(rawMetrics) : null;

    fetch("/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos, metrics }),
    })
      .then((r) => r.json())
      .then((data) => {
        clearInterval(interval);
        if (data.error) throw new Error(data.error);
        setLoadStep(LOADING_STEPS.length);
        // Enforce minimum display time so it feels like real analysis
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

  const scoreLabel = (s: number) =>
    s >= 85 ? "Excellent" : s >= 70 ? "Great" : s >= 55 ? "Good" : "Needs attention";

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
              {/* Photo preview */}
              {photo && (
                <div className="relative w-28 h-28 rounded-2xl overflow-hidden shadow-lg">
                  <img src={photo} alt="Your smile" className="w-full h-full object-cover object-top" />
                  <div className="absolute inset-0 bg-[#b8923e]/10" />
                </div>
              )}

              {/* Spinner ring */}
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
                <p className="text-[#8c8479] text-sm">Our AI is reviewing your photo</p>
              </div>

              {/* Steps */}
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
              className="w-full max-w-2xl"
            >
              <div className="card rounded-2xl sm:rounded-3xl overflow-hidden">
                <div className="grid md:grid-cols-2">

                  {/* Left — photo + score */}
                  <div className="relative">
                    {photo && (
                      <div className="relative h-52 md:h-auto md:min-h-[480px]">
                        <img src={photo} alt="Your smile" className="w-full h-full object-cover object-top" />
                        <div className="absolute inset-0"
                          style={{ background: "linear-gradient(to top, rgba(250,248,244,1) 0%, transparent 50%)" }} />
                      </div>
                    )}

                    {/* Score overlay */}
                    <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center gap-2">
                      <ScoreCircle score={analysis.overallScore} />
                      <div className="text-center">
                        <p className="font-black text-lg text-[#1a1714]" style={{ letterSpacing: "-0.02em" }}>
                          {scoreLabel(analysis.overallScore)}
                        </p>
                        <p className="text-[#8c8479] text-xs">Overall Smile Score</p>
                      </div>
                    </div>
                  </div>

                  {/* Right — breakdown + celebrity */}
                  <div className="p-6 sm:p-8 flex flex-col gap-6">

                    {/* Category breakdown */}
                    <div>
                      <p className="text-[10px] tracking-widest uppercase text-[#8c8479] mb-4">Score Breakdown</p>
                      <div className="flex flex-col gap-4">
                        {(Object.entries(analysis.categories) as [keyof Analysis["categories"], CategoryScore][]).map(([key, cat], i) => (
                          <CategoryBar
                            key={key}
                            label={CATEGORY_LABELS[key]}
                            score={cat.score}
                            note={cat.note}
                            delay={i * 0.08}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Celebrity match */}
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.5 }}
                      className="rounded-2xl overflow-hidden border border-[#b8923e]/15"
                      style={{ background: "linear-gradient(135deg, #fef9ef, #faf3e0)" }}
                    >
                      <div className="px-5 py-4">
                        <p className="text-[10px] tracking-widest uppercase text-[#8c8479] mb-2">Your Smile Resembles</p>
                        <p className="text-xl font-black shimmer-text" style={{ letterSpacing: "-0.02em" }}>
                          {analysis.celebrityMatch}
                        </p>
                        <p className="text-[#3d3831] text-xs leading-relaxed mt-1.5">{analysis.celebrityNote}</p>
                      </div>
                      <div className="px-5 py-2.5 bg-[#b8923e]/08 border-t border-[#b8923e]/10">
                        <p className="text-[10px] text-[#8c8479]">
                          ✨ AI-generated comparison based on smile characteristics only
                        </p>
                      </div>
                    </motion.div>

                    {/* Disclaimer */}
                    <p className="text-[11px] text-[#8c8479]/70 leading-relaxed italic">
                      This is an AI-generated screening and not a medical diagnosis. A licensed dentist will personally review your smile before any clinical recommendations are made.
                    </p>

                    {/* CTA */}
                    <motion.button
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.7 }}
                      onClick={proceed}
                      className="gold-btn rounded-xl py-4 text-sm tracking-widest glow-gold"
                    >
                      Get My Professional Report →
                    </motion.button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}
