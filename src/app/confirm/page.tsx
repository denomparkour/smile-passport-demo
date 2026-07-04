"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";

interface Analysis {
  overallScore: number;
  celebrityMatch: string;
  categories: Record<string, { score: number; note: string }>;
}

export default function ConfirmPage() {
  const router = useRouter();
  const [photo, setPhoto]           = useState<string | null>(null);
  const [photoTeeth, setPhotoTeeth] = useState<string | null>(null);
  const [photoSide, setPhotoSide]   = useState<string | null>(null);
  const [analysis, setAnalysis]     = useState<Analysis | null>(null);
  const [form, setForm]             = useState({ name: "", email: "", phone: "" });
  const [loading, setLoading]       = useState(false);
  const [submitted, setSubmitted]   = useState(false);
  const [error, setError]           = useState<string | null>(null);

  useEffect(() => {
    const p = sessionStorage.getItem("sp_photo_front");
    const a = sessionStorage.getItem("sp_analysis");
    if (!p || !a) { router.replace("/scan"); return; }
    setPhoto(p);
    setPhotoTeeth(sessionStorage.getItem("sp_photo_teeth"));
    setPhotoSide(sessionStorage.getItem("sp_photo_side"));
    setAnalysis(JSON.parse(a));
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.phone) {
      setError("Please fill in all fields.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          photoBase64:    photo,
          photoTeeth:     photoTeeth ?? null,
          photoSide:      photoSide  ?? null,
          smileScore:     analysis?.overallScore ?? null,
          analysisJson:   analysis ?? null,
          celebrityMatch: analysis?.celebrityMatch ?? null,
        }),
      });
      if (!res.ok) throw new Error("Failed");
      sessionStorage.removeItem("sp_photo");
      sessionStorage.removeItem("sp_analysis");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (!photo || !analysis) return null;
  if (submitted) return <SuccessScreen name={form.name} score={analysis.overallScore} onRestart={() => router.push("/")} />;

  return (
    <main className="min-h-screen bg-[#faf8f4] flex flex-col">
      {/* Nav */}
      <nav className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-[#b8923e]/10">
        <div className="max-w-4xl mx-auto px-5 h-14 flex items-center justify-between">
          <button onClick={() => router.push("/results")} className="text-sm text-[#8c8479] hover:text-[#1a1714] transition-colors">
            ← Results
          </button>
          <span className="font-black text-base shimmer-text">Smile Passport</span>
          <div className="w-12" />
        </div>
      </nav>

      <div className="flex-1 flex items-center justify-center px-5 py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="w-full max-w-3xl"
        >
          <div className="card rounded-2xl sm:rounded-3xl overflow-hidden">
            <div className="grid md:grid-cols-2">

              {/* Left — photo + score summary */}
              <div className="flex flex-col gap-0">
                <div className="relative h-56 sm:h-64 md:h-auto md:flex-1 min-h-[260px]">
                  <img src={photo} alt="Your smile" className="w-full h-full object-cover object-top" />
                  <div className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(255,255,255,1) 0%, transparent 40%)" }} />
                </div>
                <div className="p-5 sm:p-6 flex flex-col gap-3">
                  {/* Score badge */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                      style={{ background: "linear-gradient(135deg, #a07830, #d4a84b)" }}
                    >
                      <span className="text-white font-black text-lg">{analysis.overallScore}</span>
                    </div>
                    <div>
                      <p className="font-black text-[#1a1714]" style={{ letterSpacing: "-0.01em" }}>
                        Smile Score
                      </p>
                      <p className="text-[#8c8479] text-xs">Resembles {analysis.celebrityMatch}</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-3 bg-[#f5ead6]/60 rounded-xl p-3 mt-1">
                    <div className="w-7 h-7 rounded-full bg-[#f5ead6] flex items-center justify-center shrink-0 mt-0.5">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="4.5" stroke="#b8923e" strokeWidth="1.2" />
                        <path d="M6 3.5v3M6 8v.5" stroke="#b8923e" strokeWidth="1.2" strokeLinecap="round" />
                      </svg>
                    </div>
                    <p className="text-[#3d3831] text-xs leading-relaxed">
                      A licensed dentist will personally review your smile and send a detailed PDF report within{" "}
                      <span className="text-[#b8923e] font-semibold">24 hours</span>.
                    </p>
                  </div>
                </div>
              </div>

              {/* Right — form */}
              <div className="p-5 sm:p-8 flex flex-col gap-6 border-t md:border-t-0 md:border-l border-[#b8923e]/08">
                <div>
                  <h2 className="text-xl sm:text-2xl font-black text-[#1a1714]" style={{ letterSpacing: "-0.02em" }}>
                    Where shall we send your report?
                  </h2>
                  <p className="text-[#8c8479] text-sm mt-1">We&apos;ll email your personalised smile PDF directly to you.</p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  {[
                    { key: "name",  label: "Full Name",     placeholder: "Priya Sharma",    type: "text"  },
                    { key: "email", label: "Email Address", placeholder: "priya@email.com", type: "email" },
                    { key: "phone", label: "Phone Number",  placeholder: "+91 98765 43210", type: "tel"   },
                  ].map(({ key, label, placeholder, type }) => (
                    <div key={key} className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold tracking-wide text-[#3d3831]">{label}</label>
                      <input
                        type={type}
                        placeholder={placeholder}
                        value={form[key as keyof typeof form]}
                        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                        className="input-field"
                      />
                    </div>
                  ))}

                  {error && (
                    <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded-xl px-4 py-2">{error}</p>
                  )}

                  <button type="submit" disabled={loading}
                    className="gold-btn rounded-xl py-4 text-sm tracking-widest mt-1 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {loading && (
                      <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="6" stroke="rgba(255,255,255,0.3)" strokeWidth="2" />
                        <path d="M8 2a6 6 0 0 1 6 6" stroke="white" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    )}
                    {loading ? "Submitting..." : "Send My Smile Report →"}
                  </button>

                  <p className="text-center text-[#8c8479] text-xs">
                    Your data is confidential · Used only for your smile report
                  </p>
                </form>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </main>
  );
}

function SuccessScreen({ name, score, onRestart }: { name: string; score: number; onRestart: () => void }) {
  const [seconds, setSeconds] = useState(86400);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, []);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");

  return (
    <main className="min-h-screen bg-[#faf8f4] flex items-center justify-center px-5">
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.7 }}
        className="card rounded-3xl p-8 sm:p-12 max-w-md w-full text-center flex flex-col gap-8 items-center"
      >
        {/* Icon */}
        <div className="relative w-20 h-20 flex items-center justify-center">
          <div className="absolute inset-0 rounded-full pulse-ring border-2 border-[#b8923e]/30" />
          <div className="w-16 h-16 rounded-full bg-[#f5ead6] flex items-center justify-center glow-gold">
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <path d="M5 14l6 6 12-12" stroke="#b8923e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-black text-[#1a1714] mb-2" style={{ letterSpacing: "-0.02em" }}>
            You&apos;re all set, {name.split(" ")[0]}!
          </h2>
          <p className="text-[#8c8479] text-sm leading-relaxed">
            Your smile scored <span className="font-bold text-[#b8923e]">{score}/100</span>. Our dentist will review it and send your personalised report straight to your inbox.
          </p>
        </div>

        {/* Countdown */}
        <div className="w-full bg-[#f5ead6]/50 rounded-2xl p-6 border border-[#b8923e]/10">
          <p className="text-xs tracking-widest uppercase text-[#8c8479] mb-4">Report arrives in</p>
          <div className="flex items-center justify-center gap-2">
            {[
              { val: pad(h), label: "hrs" },
              { val: ":", label: "" },
              { val: pad(m), label: "min" },
              { val: ":", label: "" },
              { val: pad(s), label: "sec" },
            ].map((item, i) =>
              item.label === "" ? (
                <span key={i} className="text-2xl font-black text-[#b8923e]/40 -mt-4">:</span>
              ) : (
                <div key={i} className="flex flex-col items-center gap-1">
                  <span className="text-3xl font-black shimmer-text">{item.val}</span>
                  <span className="text-[10px] tracking-widest uppercase text-[#8c8479]">{item.label}</span>
                </div>
              )
            )}
          </div>
        </div>

        <button onClick={onRestart} className="gold-btn w-full rounded-xl py-4 text-sm tracking-widest">
          Scan Another Smile
        </button>
      </motion.div>
    </main>
  );
}
