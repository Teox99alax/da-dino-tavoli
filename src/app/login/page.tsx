"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/auth";
import { loadReservations, saveReservations } from "@/lib/storage";

type Status = "confermata" | "arrivato" | "seduto" | "in_uscita" | "pagato" | "liberato" | "no_show";

type Reservation = {
  id: number;
  date: string;
  name: string;
  phone: string;
  time: string;
  adults: number;
  highchairs: number;
  table: string;
  moduleIds: string[];
  status: Status;
  notes?: string;
  mode?: string;
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function nowMin() {
  const d = new Date();
  return d.getHours() * 60 + d.getMinutes();
}

function turnOf(time: string) {
  return toMin(time) >= toMin("21:00") ? "2° turno" : "1° turno";
}

function minutesLabel(mins: number) {
  if (mins < -10) return `in ritardo di ${Math.abs(mins)} min`;
  if (mins < 0) return "arrivato ora";
  if (mins === 0) return "ora";
  return `tra ${mins} min`;
}

function urgencyClass(mins: number) {
  if (mins <= 10) return "bg-red-100 border-red-300 text-red-950";
  if (mins <= 25) return "bg-yellow-100 border-yellow-300 text-yellow-950";
  return "bg-white border-gray-200";
}

function areaFromTable(table: string) {
  const t = table.toLowerCase();
  if (t.includes("saletta")) return "SALETTA";
  if (t.includes("dehor")) return "DEHOR";
  if (t.includes("marciapiede")) return "MARCIAPIEDE";
  if (t.includes("esterno")) return "ESTERNO";
  return "SALA";
}

export default function ServizioPage() {
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [tick, setTick] = useState(0);

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

  useEffect(() => {
    async function load() {
      const data = await loadReservations();
      setReservations(data || []);
    }

    load();
  }, []);

  useEffect(() => {
    const interval = setInterval(() => setTick((x) => x + 1), 60000);
    return () => clearInterval(interval);
  }, []);

  const todayReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => toMin(a.time) - toMin(b.time));
  }, [reservations, selectedDate, tick]);

  const activeReservations = todayReservations.filter(
    (r) => r.status !== "liberato" && r.status !== "no_show"
  );

  const upcoming = activeReservations
    .filter((r) => toMin(r.time) >= nowMin() - 20 && toMin(r.time) <= nowMin() + 90)
    .sort((a, b) => toMin(a.time) - toMin(b.time));

  const urgentPrep = activeReservations
    .filter((r) => toMin(r.time) >= nowMin() && toMin(r.time) <= nowMin() + 45)
    .sort((a, b) => toMin(a.time) - toMin(b.time));

  const groupedByArea = useMemo(() => {
    const groups: Record<string, Reservation[]> = {
      SALA: [],
      SALETTA: [],
      DEHOR: [],
      MARCIAPIEDE: [],
      ESTERNO: [],
    };

    todayReservations.forEach((r) => {
      groups[areaFromTable(r.table)].push(r);
    });

    return groups;
  }, [todayReservations]);

  async function updateStatus(id: number, status: Status) {
    const updated = reservations.map((r) =>
      r.id === id ? { ...r, status } : r
    );

    setReservations(updated);
    await saveReservations(updated);
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Da Dino · Servizio</h1>
            <p className="text-gray-500">Accesso staff: {email}</p>
          </div>

          <div className="flex gap-2">
            <input
              type="date"
              className="border rounded-xl px-3 py-2 bg-white"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />

            <button
              onClick={() => window.location.href = "/dashboard"}
              className="border rounded-xl px-4 py-2 bg-white"
            >
              Dashboard
            </button>

            <button
              onClick={logout}
              className="border rounded-xl px-4 py-2 bg-white"
            >
              Esci
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Prenotazioni attive</div>
            <div className="text-3xl font-bold">{activeReservations.length}</div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Arrivi prossimi</div>
            <div className="text-3xl font-bold">{upcoming.length}</div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Da preparare ora</div>
            <div className="text-3xl font-bold">{urgentPrep.length}</div>
          </div>
        </div>

        <section className="bg-white border rounded-2xl p-5">
          <h2 className="text-2xl font-bold mb-4">Da preparare / controllare subito</h2>

          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {urgentPrep.length === 0 && (
              <div className="text-gray-500">Nessuna urgenza nei prossimi 45 minuti.</div>
            )}

            {urgentPrep.map((r) => {
              const mins = toMin(r.time) - nowMin();

              return (
                <div key={r.id} className={`border rounded-2xl p-4 ${urgencyClass(mins)}`}>
                  <div className="flex justify-between gap-2">
                    <div>
                      <div className="text-xl font-bold">{r.table}</div>
                      <div className="text-sm">
                        {r.name} · x{r.adults}
                        {r.highchairs ? ` + ${r.highchairs} seggiolone` : ""}
                      </div>
                      <div className="text-sm font-medium">
                        {r.time} · {turnOf(r.time)} · {minutesLabel(mins)}
                      </div>
                      {r.notes && <div className="text-xs mt-2">Note: {r.notes}</div>}
                    </div>

                    <div className="text-sm font-semibold">
                      {r.status}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={() => updateStatus(r.id, "arrivato")}
                      className="flex-1 rounded-xl bg-black text-white py-2"
                    >
                      Arrivato
                    </button>

                    <button
                      onClick={() => updateStatus(r.id, "liberato")}
                      className="flex-1 rounded-xl border bg-white py-2"
                    >
                      Liberato
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border rounded-2xl p-5">
          <h2 className="text-2xl font-bold mb-4">Arrivi imminenti</h2>

          <div className="space-y-2">
            {upcoming.length === 0 && (
              <div className="text-gray-500">Nessun arrivo imminente.</div>
            )}

            {upcoming.map((r) => {
              const mins = toMin(r.time) - nowMin();

              return (
                <div key={r.id} className={`border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-2 ${urgencyClass(mins)}`}>
                  <div>
                    <b>{r.time}</b> · {r.name} x{r.adults} · {r.table}
                    <div className="text-sm text-gray-600">
                      {turnOf(r.time)} · {minutesLabel(mins)}
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(r.id, "arrivato")}
                      className="rounded-xl bg-black text-white px-4 py-2"
                    >
                      Arrivato
                    </button>

                    <button
                      onClick={() => updateStatus(r.id, "liberato")}
                      className="rounded-xl border bg-white px-4 py-2"
                    >
                      Liberato
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="bg-white border rounded-2xl p-5">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Riepilogo disposizione serata</h2>

            <button
              onClick={() => window.print()}
              className="border rounded-xl px-4 py-2 bg-white"
            >
              Stampa
            </button>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedByArea).map(([area, rows]) => (
              <div key={area}>
                <h3 className="text-xl font-bold mb-2">{area}</h3>

                {rows.length === 0 && (
                  <div className="text-gray-500 text-sm">Nessuna prenotazione</div>
                )}

                <div className="space-y-2">
                  {rows.map((r) => (
                    <div key={r.id} className="border rounded-xl p-3 flex flex-col md:flex-row justify-between gap-2">
                      <div>
                        <b>{r.table}</b> → {r.name} x{r.adults} ore {r.time} · {turnOf(r.time)}
                        <div className="text-sm text-gray-600">
                          Stato: {r.status}
                          {r.notes ? ` · Note: ${r.notes}` : ""}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => updateStatus(r.id, "arrivato")}
                          className="rounded-xl bg-black text-white px-4 py-2"
                        >
                          Arrivato
                        </button>

                        <button
                          onClick={() => updateStatus(r.id, "liberato")}
                          className="rounded-xl border bg-white px-4 py-2"
                        >
                          Liberato
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
