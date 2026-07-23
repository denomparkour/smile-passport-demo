"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const res = await fetch("/api/doctor/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setLoading(false);

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Login failed. Please try again.");
      return;
    }

    const next = searchParams.get("next") || "/doctor";
    router.push(next);
    router.refresh();
  };

  return (
    <main className="min-h-screen bg-[#faf8f4] text-[#1a1714] flex items-center justify-center px-5">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-3xl shadow-xl border border-[#b8923e]/10 w-full max-w-sm p-8 flex flex-col gap-5"
      >
        <div>
          <h1 className="font-black text-2xl shimmer-text">Doctor Login</h1>
          <p className="text-sm text-[#8c8479] mt-1">Sign in to access the patient CRM.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] tracking-widest uppercase text-[#8c8479]">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-field text-sm"
            placeholder="doctor@example.com"
            autoComplete="username"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] tracking-widest uppercase text-[#8c8479]">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-field text-sm"
            placeholder="••••••••"
            autoComplete="current-password"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="gold-btn rounded-xl py-3 text-sm tracking-widest disabled:opacity-50"
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </main>
  );
}

export default function DoctorLoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
