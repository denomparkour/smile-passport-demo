"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { HERO_IMAGE, HERO_IMAGE_MOBILE, GALLERY_IMAGES, HOW_STEPS } from "@/lib/home-images";

// Fade-up variant — cosmetic only, content visible immediately via whileInView
const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show:   { opacity: 1, y: 0 },
};

function Spinner({ dark = false }: { dark?: boolean }) {
  const stroke = dark ? "rgba(0,0,0,0.25)" : "rgba(255,255,255,0.3)";
  const tip    = dark ? "#333" : "white";
  return (
    <svg className="animate-spin" width="16" height="16" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="6" stroke={stroke} strokeWidth="2" />
      <path d="M8 2a6 6 0 0 1 6 6" stroke={tip} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export default function Home() {
  const router = useRouter();
  const [navLoading, setNavLoading] = useState<string | null>(null);

  const go = (path: string) => {
    setNavLoading(path);
    router.push(path);
  };

  return (
    <main className="bg-[#faf8f4] text-[#1a1714] overflow-x-hidden">

      {/* ── NAV ── */}
      <nav className="fixed top-0 inset-x-0 z-50 bg-white/80 backdrop-blur-md border-b border-[#b8923e]/10">
        <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
          <span className="font-black text-lg shimmer-text">Smile Passport</span>
          <button
            onClick={() => go("/doctor")}
            className="text-sm text-[#8c8479] hover:text-[#1a1714] transition-colors font-medium flex items-center gap-1.5"
          >
            {navLoading === "/doctor" ? <Spinner dark /> : null}
            Doctor Portal →
          </button>
        </div>
      </nav>

      {/* ── HERO ── */}
      <section className="relative pt-16 min-h-screen grid lg:grid-cols-2">

        {/* Left — always visible, no opacity animation */}
        <div className="flex flex-col justify-center px-5 sm:px-10 lg:px-16 py-16 lg:py-24 relative z-10">

          <motion.div
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="w-2 h-2 rounded-full bg-[#b8923e]"
              style={{ animation: "blink 2s ease-in-out infinite" }} />
            <span className="text-xs tracking-[0.3em] uppercase text-[#b8923e] font-semibold">
              Expert Dental Review
            </span>
          </motion.div>

          {/* Heading — visible immediately, motion is bonus */}
          <h1
            className="text-[clamp(2.8rem,6vw,5.5rem)] font-black leading-[1.02] mb-6 text-[#1a1714]"
            style={{ letterSpacing: "-0.03em" }}
          >
            Discover your<br />
            <span className="shimmer-text">smile</span><br />
            in 30 seconds.
          </h1>

          <p className="text-[#8c8479] text-base sm:text-lg leading-relaxed max-w-md mb-10">
            Upload a selfie and receive your{" "}
            <span className="text-[#b8923e] font-semibold">AI Smile Score</span>{" "}
            and a professional orthodontic review.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => go("/scan")}
              className="gold-btn rounded-full px-8 py-4 text-sm tracking-widest glow-gold flex items-center justify-center gap-2"
            >
              {navLoading === "/scan" ? <Spinner /> : null}
              {navLoading === "/scan" ? "Loading..." : "Start My Smile Scan"}
            </button>
            <button
              onClick={() => go("/doctor")}
              className="rounded-full px-7 py-4 text-sm font-semibold text-[#8c8479] hover:text-[#1a1714] border border-[#b8923e]/20 hover:border-[#b8923e]/50 transition-all bg-white flex items-center justify-center gap-2"
            >
              {navLoading === "/doctor" ? <Spinner dark /> : null}
              Doctor Portal →
            </button>
          </div>

          {/* Stats */}
          <div className="flex gap-8 sm:gap-12 mt-14 pt-10 border-t border-[#b8923e]/10">
            {[
              { num: "24h",  label: "Expert Review" },
              { num: "100%", label: "Confidential" },
              { num: "Free", label: "Smile Scan" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-xl sm:text-2xl font-black shimmer-text">{s.num}</p>
                <p className="text-[10px] sm:text-xs tracking-widest uppercase text-[#8c8479] mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right — hero image (plain img, not next/image to avoid tunnel issues) */}
        <div className="relative hidden lg:block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE}
            alt="Beautiful smile"
            className="absolute inset-0 w-full h-full object-cover object-center"
          />
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to right, #faf8f4 0%, #faf8f460 25%, transparent 55%)" }} />
          <div className="absolute inset-0"
            style={{ background: "linear-gradient(to top, #faf8f4 0%, transparent 30%)" }} />

          {/* Floating card */}
          <div className="absolute bottom-14 right-8 bg-white rounded-2xl p-5 max-w-[210px] shadow-xl border border-[#b8923e]/10">
            <p className="text-xl font-black shimmer-text mb-1">Beautiful.</p>
            <p className="text-xs text-[#8c8479] leading-relaxed">
              Your smile tells a story worth hearing.
            </p>
            <div className="mt-3 flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-[#f5ead6] flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M2 5l2.5 2.5L8 2.5" stroke="#b8923e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="text-[10px] tracking-widest uppercase text-[#b8923e]">Expert Verified</span>
            </div>
          </div>
        </div>

        {/* Mobile hero image */}
        <div className="lg:hidden relative h-64 mx-5 mb-10 rounded-3xl overflow-hidden shadow-lg">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={HERO_IMAGE_MOBILE}
            alt="Beautiful smile"
            className="w-full h-full object-cover object-top"
          />
          <div className="absolute inset-0 rounded-3xl"
            style={{ background: "linear-gradient(to top, #faf8f4 0%, transparent 40%)" }} />
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section className="py-20 sm:py-28 px-5 sm:px-10 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs tracking-[0.3em] uppercase text-[#b8923e] font-semibold mb-3">The process</p>
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-black text-[#1a1714]" style={{ letterSpacing: "-0.02em" }}>
              Three steps to your<br />
              <span className="shimmer-text">perfect smile report</span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-3 gap-5 sm:gap-6">
            {HOW_STEPS.map((card, i) => (
              <motion.div
                key={card.step}
                variants={fadeUp}
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.2 }}
                transition={{ delay: i * 0.12 }}
                className="bg-white rounded-2xl sm:rounded-3xl overflow-hidden border border-[#b8923e]/10 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className="relative h-48 sm:h-52 overflow-hidden bg-[#f5ead6]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.img}
                    alt={card.title}
                    className="w-full h-full object-cover object-top group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(255,255,255,0.95) 0%, transparent 50%)" }} />
                  <span className="absolute top-3 left-4 text-5xl font-black text-[#1a1714]/06">{card.step}</span>
                </div>
                <div className="p-5 sm:p-6">
                  <h3 className="text-lg font-bold text-[#1a1714] mb-1.5">{card.title}</h3>
                  <p className="text-[#8c8479] text-sm leading-relaxed">{card.body}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── GALLERY ── */}
      <section className="py-16 sm:py-20 bg-[#faf8f4] overflow-hidden">
        <div className="text-center mb-10 px-5">
          <p className="text-xs tracking-[0.3em] uppercase text-[#b8923e] font-semibold mb-2">Real smiles</p>
          <h2 className="text-2xl sm:text-4xl font-black text-[#1a1714]" style={{ letterSpacing: "-0.02em" }}>
            Every smile has a story
          </h2>
        </div>
        <div className="flex gap-4" style={{ animation: "scroll 25s linear infinite" }}>
          {[...GALLERY_IMAGES, ...GALLERY_IMAGES].map((src, i) => (
            <div key={i} className="relative w-48 sm:w-64 h-64 sm:h-80 shrink-0 rounded-2xl overflow-hidden shadow-md bg-[#f5ead6]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={src} alt="Smile" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ── */}
      <section className="py-20 sm:py-28 px-5 text-center bg-white">
        <div className="max-w-2xl mx-auto">
          <h2
            className="text-3xl sm:text-5xl font-black text-[#1a1714] mb-5"
            style={{ letterSpacing: "-0.03em" }}
          >
            Ready to discover your<br />
            <span className="shimmer-text">smile score?</span>
          </h2>
          <p className="text-[#8c8479] mb-10 text-base sm:text-lg">
            Takes 30 seconds. Free forever.
          </p>
          <button
            onClick={() => go("/scan")}
            className="gold-btn rounded-full px-10 sm:px-14 py-4 sm:py-5 text-sm tracking-widest glow-gold flex items-center justify-center gap-2 mx-auto"
          >
            {navLoading === "/scan" ? <Spinner /> : null}
            {navLoading === "/scan" ? "Loading..." : "Start My Smile Scan"}
          </button>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer className="py-8 px-5 border-t border-[#b8923e]/10 text-center bg-[#faf8f4]">
        <p className="text-xs text-[#8c8479]">
          © 2026 Smile Passport · All scans are confidential · Expert dental review within 24 hours
        </p>
      </footer>
    </main>
  );
}
