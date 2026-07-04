"use client";

import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";

type Status = "PENDING" | "REVIEWED" | "PDF_SENT";

interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  quoteShown: string;
  smileScore: number | null;
  celebrityMatch: string | null;
  status: Status;
  doctorNotes: string | null;
  reviewedAt: string | null;
  createdAt: string;
  photoBase64: string;
  photoTeeth: string | null;
  photoSide: string | null;
}

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; border: string }> = {
  PENDING:  { label: "Pending",  color: "#92400e", bg: "#fef3c7", border: "#fbbf24" },
  REVIEWED: { label: "Reviewed", color: "#065f46", bg: "#d1fae5", border: "#34d399" },
  PDF_SENT: { label: "PDF Sent", color: "#1e3a8a", bg: "#dbeafe", border: "#60a5fa" },
};

export default function DoctorDashboard() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<Status | "ALL">("ALL");
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Lead | null>(null);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const router = useRouter();

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page) });
    if (filter !== "ALL") params.set("status", filter);
    const res = await fetch(`/api/doctor/leads?${params}`);
    const data = await res.json();
    setLeads(data.leads);
    setTotal(data.total);
    setPages(data.pages);
    setLoading(false);
  }, [page, filter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setLightbox(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const openLead = (lead: Lead) => { setSelected(lead); setNotes(lead.doctorNotes ?? ""); };

  const updateLead = async (status: Status) => {
    if (!selected) return;
    setSaving(true);
    await fetch(`/api/doctor/leads/${selected.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, doctorNotes: notes }),
    });
    setSaving(false);
    setSelected(null);
    fetchLeads();
  };

  const pendingCount = leads.filter((l) => l.status === "PENDING").length;

  return (
    <main className="min-h-screen bg-[#faf8f4] text-[#1a1714]">

      {/* Lightbox */}
      <AnimatePresence>
        {lightbox && (
          <motion.div
            key="lightbox"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
            onClick={() => setLightbox(null)}
          >
            <motion.img
              src={lightbox}
              alt="Enlarged photo"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.85, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 28 }}
              className="max-h-[90vh] max-w-[90vw] rounded-2xl object-contain shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button
              className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors text-xl leading-none"
              onClick={() => setLightbox(null)}
            >
              ×
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-[#b8923e]/10">
        <div className="max-w-7xl mx-auto px-5 sm:px-8 py-0 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => router.push("/")}
              className="text-sm text-[#8c8479] hover:text-[#1a1714] transition-colors shrink-0">
              ← Home
            </button>
            <span className="text-[#b8923e]/30 shrink-0">|</span>
            <span className="font-black shimmer-text text-base truncate">Doctor CRM</span>
          </div>
          <span className="text-sm text-[#8c8479] shrink-0">{total} total</span>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-5 sm:px-8 py-8">
        {/* Filter tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-1 -mx-1 px-1">
          {(["ALL", "PENDING", "REVIEWED", "PDF_SENT"] as const).map((s) => (
            <button
              key={s}
              onClick={() => { setFilter(s); setPage(1); }}
              className={`shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-all duration-200 border ${
                filter === s
                  ? "text-white border-transparent"
                  : "bg-white border-[#b8923e]/15 text-[#8c8479] hover:text-[#1a1714] hover:border-[#b8923e]/30"
              }`}
              style={filter === s ? { background: "linear-gradient(135deg, #a07830, #d4a84b)", boxShadow: "0 2px 12px rgba(184,146,62,0.3)" } : {}}
            >
              {s === "ALL" ? "All Submissions" : STATUS_CONFIG[s].label}
              {s === "PENDING" && pendingCount > 0 && (
                <span className="ml-2 bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full">{pendingCount}</span>
              )}
            </button>
          ))}
        </div>

        {/* Grid */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl h-64 animate-pulse border border-[#b8923e]/08" />
            ))}
          </div>
        ) : leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-[#8c8479]">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none" className="mb-4 opacity-30">
              <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="1.5" />
              <path d="M16 28s3-4 8-4 8 4 8 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              <circle cx="17" cy="20" r="2" fill="currentColor" />
              <circle cx="31" cy="20" r="2" fill="currentColor" />
            </svg>
            <p className="text-sm">No submissions yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {leads.map((lead, i) => (
              <motion.div
                key={lead.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                onClick={() => openLead(lead)}
                className="card rounded-2xl overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group"
              >
                <div className="relative h-44 overflow-hidden bg-[#f0ece3]">
                  <img
                    src={lead.photoBase64}
                    alt={lead.name}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 cursor-zoom-in"
                    onClick={(e) => { e.stopPropagation(); setLightbox(lead.photoBase64); }}
                  />
                  <div className="absolute inset-0"
                    style={{ background: "linear-gradient(to top, rgba(255,255,255,0.9), transparent)" }} />
                  <span
                    className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={{
                      color: STATUS_CONFIG[lead.status].color,
                      background: STATUS_CONFIG[lead.status].bg,
                      border: `1px solid ${STATUS_CONFIG[lead.status].border}`,
                    }}
                  >
                    {STATUS_CONFIG[lead.status].label}
                  </span>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-[#1a1714] truncate">{lead.name}</p>
                    {lead.smileScore != null && (
                      <span
                        className="shrink-0 text-xs font-black px-2 py-0.5 rounded-full text-white"
                        style={{ background: "linear-gradient(135deg, #a07830, #d4a84b)" }}
                      >
                        {lead.smileScore}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-[#8c8479] truncate">{lead.email}</p>
                  {lead.celebrityMatch ? (
                    <p className="text-xs text-[#b8923e] mt-1.5 italic truncate">Resembles {lead.celebrityMatch}</p>
                  ) : lead.quoteShown ? (
                    <p className="text-xs text-[#b8923e] mt-1.5 italic truncate">&ldquo;{lead.quoteShown}&rdquo;</p>
                  ) : null}
                  <p className="text-xs text-[#8c8479]/60 mt-2">
                    {new Date(lead.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-10">
            <button disabled={page === 1} onClick={() => setPage(page - 1)}
              className="bg-white border border-[#b8923e]/15 px-4 py-2 rounded-full text-sm font-medium disabled:opacity-40 hover:border-[#b8923e]/40 transition-all">
              ← Prev
            </button>
            <span className="text-[#8c8479] text-sm">Page {page} of {pages}</span>
            <button disabled={page === pages} onClick={() => setPage(page + 1)}
              className="bg-white border border-[#b8923e]/15 px-4 py-2 rounded-full text-sm font-medium disabled:opacity-40 hover:border-[#b8923e]/40 transition-all">
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Lead modal */}
      <AnimatePresence>
        {selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
            style={{ background: "rgba(26,23,20,0.5)", backdropFilter: "blur(6px)" }}
            onClick={(e) => e.target === e.currentTarget && setSelected(null)}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto shadow-2xl"
            >
              <div className="grid md:grid-cols-2">
                {/* Photos */}
                <div className="flex flex-col">
                  {/* Primary photo */}
                  <div
                    className="relative h-56 md:flex-1 md:min-h-[260px] cursor-zoom-in"
                    onClick={() => setLightbox(selected.photoBase64)}
                  >
                    <img src={selected.photoBase64} alt={selected.name} className="w-full h-full object-cover object-top" />
                    <div className="absolute inset-0"
                      style={{ background: "linear-gradient(to top, rgba(255,255,255,1) 0%, transparent 50%)" }} />
                    <div className="absolute bottom-3 left-4">
                      <p className="text-xl font-black text-[#1a1714]">{selected.name}</p>
                      {selected.quoteShown && (
                        <p className="text-[#b8923e] italic text-xs mt-0.5">&ldquo;{selected.quoteShown}&rdquo;</p>
                      )}
                    </div>
                    <div className="absolute top-3 left-3 bg-white/80 backdrop-blur rounded-lg px-2 py-0.5 flex items-center gap-1.5">
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><circle cx="4" cy="4" r="3" stroke="#8c8479" strokeWidth="1"/><path d="M6.5 6.5l2 2" stroke="#8c8479" strokeWidth="1" strokeLinecap="round"/></svg>
                      <p className="text-[10px] tracking-widest uppercase text-[#8c8479]">Front Smile</p>
                    </div>
                  </div>

                  {/* Teeth + side thumbnails */}
                  <div className="grid grid-cols-2 gap-0.5">
                    {selected.photoTeeth ? (
                      <div
                        className="relative h-28 bg-[#f0ece3] cursor-zoom-in"
                        onClick={() => setLightbox(selected.photoTeeth!)}
                      >
                        <img src={selected.photoTeeth} alt="Teeth" className="w-full h-full object-cover object-top" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/30 py-1 text-center">
                          <p className="text-[10px] tracking-widest uppercase text-white">Teeth</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-[#f0ece3] flex flex-col items-center justify-center gap-1 opacity-50">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="2" stroke="#8c8479" strokeWidth="1.2"/><circle cx="9" cy="9" r="2.5" stroke="#8c8479" strokeWidth="1.2"/></svg>
                        <p className="text-[10px] text-[#8c8479]">No teeth photo</p>
                      </div>
                    )}
                    {selected.photoSide ? (
                      <div
                        className="relative h-28 bg-[#f0ece3] cursor-zoom-in"
                        onClick={() => setLightbox(selected.photoSide!)}
                      >
                        <img src={selected.photoSide} alt="Side profile" className="w-full h-full object-cover object-top" />
                        <div className="absolute bottom-0 inset-x-0 bg-black/30 py-1 text-center">
                          <p className="text-[10px] tracking-widest uppercase text-white">Side Profile</p>
                        </div>
                      </div>
                    ) : (
                      <div className="h-28 bg-[#f0ece3] flex flex-col items-center justify-center gap-1 opacity-50">
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="2" y="4" width="14" height="10" rx="2" stroke="#8c8479" strokeWidth="1.2"/><circle cx="9" cy="9" r="2.5" stroke="#8c8479" strokeWidth="1.2"/></svg>
                        <p className="text-[10px] text-[#8c8479]">No side photo</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Details */}
                <div className="p-6 sm:p-8 flex flex-col gap-5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-lg">Patient Details</h3>
                    <button onClick={() => setSelected(null)}
                      className="w-8 h-8 rounded-full bg-[#f0ece3] flex items-center justify-center text-[#8c8479] hover:bg-[#e8e0d4] transition-colors text-lg leading-none">
                      ×
                    </button>
                  </div>

                  <div className="flex flex-col gap-3">
                    {([
                      { label: "Email",          val: selected.email },
                      { label: "Phone",          val: selected.phone },
                      selected.smileScore != null ? { label: "Smile Score",    val: `${selected.smileScore}/100` } : null,
                      selected.celebrityMatch    ? { label: "Celebrity Match", val: selected.celebrityMatch }     : null,
                      { label: "Submitted",      val: new Date(selected.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) },
                      { label: "Status",         val: STATUS_CONFIG[selected.status].label },
                    ] as ({ label: string; val: string } | null)[]).filter((x): x is { label: string; val: string } => x !== null).map(({ label, val }) => (
                      <div key={label}>
                        <p className="text-[10px] tracking-widest uppercase text-[#8c8479] mb-0.5">{label}</p>
                        <p className="text-sm font-medium text-[#1a1714] break-all">{val}</p>
                      </div>
                    ))}
                  </div>

                  <div>
                    <label className="text-[10px] tracking-widest uppercase text-[#8c8479] block mb-1.5">Doctor Notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Add your clinical observations..."
                      rows={4}
                      className="input-field resize-none text-sm"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    {selected.status === "PENDING" && (
                      <button onClick={() => updateLead("REVIEWED")} disabled={saving}
                        className="gold-btn rounded-xl py-3 text-sm tracking-widest disabled:opacity-50">
                        {saving ? "Saving..." : "Mark as Reviewed"}
                      </button>
                    )}
                    {selected.status === "REVIEWED" && (
                      <button onClick={() => updateLead("PDF_SENT")} disabled={saving}
                        className="gold-btn rounded-xl py-3 text-sm tracking-widest disabled:opacity-50">
                        {saving ? "Saving..." : "Mark PDF as Sent"}
                      </button>
                    )}
                    <button
                      onClick={() => updateLead(selected.status)}
                      disabled={saving}
                      className="bg-[#f0ece3] rounded-xl py-3 text-sm font-semibold text-[#3d3831] hover:bg-[#e8e0d4] transition-colors disabled:opacity-50"
                    >
                      Save Notes
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
