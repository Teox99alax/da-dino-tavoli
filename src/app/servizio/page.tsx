"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/auth";

export default function ServizioPage() {
  const [email, setEmail] = useState("");

  useEffect(() => {
    async function check() {
      const { data } = await supabase.auth.getSession();

      if (!data.session) {
        window.location.href = "/login";
        return;
      }

      setEmail(data.session.user.email || "");
    }

    check();
  }, []);

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Da Dino · Servizio</h1>
            <p className="text-gray-500">Accesso staff: {email}</p>
          </div>

          <button
            onClick={logout}
            className="border rounded-xl px-4 py-2 bg-white"
          >
            Esci
          </button>
        </div>

        <div className="bg-white border rounded-2xl p-6">
          <h2 className="text-xl font-semibold">Schermata servizio</h2>
          <p className="text-gray-500 mt-2">
            Qui inseriremo arrivi, tavoli urgenti da preparare, cambio turno e riepilogo sala.
          </p>
        </div>
      </div>
    </div>
  );
}
