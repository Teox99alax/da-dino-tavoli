"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LoginPage() {
  const [email, setEmail] = useState("matteo@dadino.local");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  async function login() {
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      return;
    }

    window.location.href = "/dashboard";
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="bg-white border rounded-2xl shadow-sm p-6 w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-2xl font-bold">Da Dino</h1>
          <p className="text-sm text-gray-500">Accesso staff</p>
        </div>

        <input
          className="border rounded-xl p-3 w-full"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
        />

        <input
          className="border rounded-xl p-3 w-full"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />

        {error && <div className="text-sm text-red-600">{error}</div>}

        <button
          onClick={login}
          className="w-full bg-black text-white rounded-xl p-3 font-medium"
        >
          Entra
        </button>
      </div>
    </div>
  );
}
