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

type BaseTable = {
  id: string;
  label: string;
  area: "SALA" | "SALETTA" | "DEHOR" | "MARCIAPIEDE" | "ESTERNO";
};

const BASE_TABLES: BaseTable[] = [
  { id: "sala-1", label: "1 sala", area: "SALA" },
  { id: "sala-2", label: "2 sala", area: "SALA" },
  { id: "sala-3", label: "3 sala", area: "SALA" },
  { id: "sala-4", label: "4 sala", area: "SALA" },
  { id: "sala-5", label: "5 sala", area: "SALA" },
  { id: "sala-6", label: "6 sala", area: "SALA" },

  { id: "saletta-1", label: "1 saletta", area: "SALETTA" },
  { id: "saletta-2", label: "2 saletta", area: "SALETTA" },
  { id: "saletta-3", label: "3 saletta", area: "SALETTA" },
  { id: "saletta-4", label: "4 saletta", area: "SALETTA" },

  { id: "dehor-1", label: "1 dehor", area: "DEHOR" },
  { id: "dehor-2", label: "2 dehor", area: "DEHOR" },
  { id: "dehor-3", label: "3 dehor", area: "DEHOR" },
  { id: "dehor-4", label: "4 dehor", area: "DEHOR" },
  { id: "dehor-5", label: "5 dehor", area: "DEHOR" },
  { id: "dehor-6", label: "6 dehor", area: "DEHOR" },
  { id: "dehor-7", label: "7 dehor", area: "DEHOR" },
  { id: "dehor-8", label: "8 dehor", area: "DEHOR" },
  { id: "dehor-9", label: "9 dehor", area: "DEHOR" },
  { id: "dehor-10", label: "10 dehor", area: "DEHOR" },

  { id: "marciapiede-11", label: "11 marciapiede", area: "MARCIAPIEDE" },
  { id: "marciapiede-12", label: "12 marciapiede", area: "MARCIAPIEDE" },
  { id: "marciapiede-13", label: "13 marciapiede", area: "MARCIAPIEDE" },
  { id: "marciapiede-14", label: "14 marciapiede", area: "MARCIAPIEDE" },
  { id: "marciapiede-15", label: "15 marciapiede", area: "MARCIAPIEDE" },

  ...Array.from({ length: 15 }, (_, i) => ({
    id: `esterno-${i + 1}`,
    label: `${i + 1} esterno`,
    area: "ESTERNO" as const,
  })),
];

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

function currentTimeLabel() {
  return new Date().toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
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

function tableStatusClass(status: "libero" | "prenotato_dopo" | "occupato") {
  if (status === "occupato") return "bg-red-100 border-red-300 text-red-950";
  if (status === "prenotato_dopo") return "bg-yellow-100 border-yellow-300 text-yellow-950";
  return "bg-green-100 border-green-300 text-green-950";
}

function arrivalClass(mins: number) {
  if (mins <= 3) return "bg-red-100 border-red-300 text-red-950";
  if (mins <= 10) return "bg-yellow-100 border-yellow-300 text-yellow-950";
  return "bg-white border-gray-200";
}

function normalize(value: string) {
  return value.toLowerCase().replace(/\+/g, " ").replace(/-/g, " ");
}

function reservationUsesTable(reservation: Reservation, table: BaseTable) {
  const label = normalize(table.label);
  const tableText = normalize(reservation.table || "");
  const moduleText = normalize((reservation.moduleIds || []).join(" "));

  if (tableText.includes(label)) return true;
  if (moduleText.includes(normalize(table.id))) return true;

  const number = table.label.split(" ")[0];
  const area = table.area.toLowerCase();

  return tableText.includes(number) && tableText.includes(area);
}

export default function ServizioPage() {
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [now, setNow] = useState(currentTimeLabel());

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
    const interval = setInterval(() => {
      setNow(currentTimeLabel());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const todayReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => toMin(a.time) - toMin(b.time));
  }, [reservations, selectedDate, now]);

  const activeReservations = todayReservations.filter(
    (r) => r.status !== "liberato" && r.status !== "no_show"
  );

  const upcoming = activeReservations
    .filter((r) => toMin(r.time) >= nowMin() - 5 && toMin(r.time) <= nowMin() + 10)
    .sort((a, b) => toMin(a.time) - toMin(b.time));

  const tableRows = useMemo(() => {
    return BASE_TABLES.map((table) => {
      const matches = activeReservations
        .filter((r) => reservationUsesTable(r, table))
        .sort((a, b) => toMin(a.time) - toMin(b.time));

      const current = matches.find((r) => toMin(r.time) <= nowMin() + 20);
      const secondTurn = matches.find((r) => toMin(r.time) >= toMin("21:00"));

      let status: "libero" | "prenotato_dopo" | "occupato" = "libero";
      if (current && current.status === "arrivato") status = "occupato";
      else if (current && toMin(current.time) <= nowMin() + 20) status = "occupato";
      else if (secondTurn) status = "prenotato_dopo";

      return {
        table,
        matches,
        current,
        secondTurn,
        status,
      };
    });
  }, [activeReservations, now]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, typeof tableRows> = {
      SALA: [],
      SALETTA: [],
      DEHOR: [],
      MARCIAPIEDE: [],
      ESTERNO: [],
    };

    tableRows.forEach((row) => {
      groups[row.table.area].push(row);
    });

    return groups;
  }, [tableRows]);

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

          <div className="flex gap-2 flex-wrap items-center">
            <div className="bg-black text-white rounded-xl px-4 py-2 text-xl font-bold">
              {now}
            </div>

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
            <div className="text-sm text-gray-500">Arrivi entro 10 minuti</div>
            <div className="text-3xl font-bold">{upcoming.length}</div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Tavoli occupati / prenotati</div>
            <div className="text-3xl font-bold">
              {tableRows.filter((t) => t.status !== "libero").length}
            </div>
          </div>
        </div>

        <section className="bg-white border rounded-2xl p-5">
          <h2 className="text-2xl font-bold mb-4">Arrivi imminenti</h2>

          <div className="space-y-2">
            {upcoming.length === 0 && (
              <div className="text-gray-500">Nessun arrivo entro 10 minuti.</div>
            )}

            {upcoming.map((r) => {
              const mins = toMin(r.time) - nowMin();

              return (
                <div key={r.id} className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3 ${arrivalClass(mins)}`}>
                  <div>
                    <div className="text-xl font-bold">
                      {r.time} · {r.name} x{r.adults} · {r.table}
                    </div>
                    <div className="text-sm font-medium">
                      {turnOf(r.time)} · {minutesLabel(mins)}
                      {r.highchairs ? ` · ${r.highchairs} seggiolone` : ""}
                    </div>
                    {r.notes && <div className="text-xs mt-1">Note: {r.notes}</div>}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => updateStatus(r.id, "arrivato")}
                      className="rounded-xl bg-black text-white px-5 py-3 font-semibold"
                    >
                      Arrivato
                    </button>

                    <button
                      onClick={() => updateStatus(r.id, "liberato")}
                      className="rounded-xl border bg-white px-5 py-3 font-semibold"
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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Tutti i tavoli</h2>
              <p className="text-sm text-gray-500">
                Verde libero · Giallo libero ora ma prenotato più tardi · Rosso occupato / da controllare
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="border rounded-xl px-4 py-2 bg-white"
            >
              Stampa
            </button>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedTables).map(([area, rows]) => (
              <div key={area}>
                <h3 className="text-xl font-bold mb-3">{area}</h3>

                <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {rows.map(({ table, matches, status }) => (
                    <div key={table.id} className={`border rounded-2xl p-4 ${tableStatusClass(status)}`}>
                      <div className="flex justify-between gap-2">
                        <div>
                          <div className="text-xl font-bold">{table.label}</div>
                          <div className="text-sm font-medium">
                            {status === "libero" && "LIBERO"}
                            {status === "prenotato_dopo" && "LIBERO ORA · PRENOTATO DOPO"}
                            {status === "occupato" && "OCCUPATO / DA CONTROLLARE"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 space-y-2">
                        {matches.length === 0 && (
                          <div className="text-sm opacity-80">Nessuna prenotazione su questo tavolo.</div>
                        )}

                        {matches.map((r) => {
                          const mins = toMin(r.time) - nowMin();
                          return (
                            <div key={r.id} className="bg-white/70 rounded-xl p-2 text-sm">
                              <div className="font-semibold">
                                {r.name} x{r.adults} · {r.time} · {turnOf(r.time)}
                              </div>
                              <div>
                                Stato: {r.status} · {minutesLabel(mins)}
                                {r.highchairs ? ` · ${r.highchairs} seggiolone` : ""}
                              </div>
                              {r.notes && <div>Note: {r.notes}</div>}

                              <div className="flex gap-2 mt-2">
                                <button
                                  onClick={() => updateStatus(r.id, "arrivato")}
                                  className="rounded-lg bg-black text-white px-3 py-2"
                                >
                                  Arrivato
                                </button>

                                <button
                                  onClick={() => updateStatus(r.id, "liberato")}
                                  className="rounded-lg border bg-white px-3 py-2"
                                >
                                  Liberato
                                </button>
                              </div>
                            </div>
                          );
                        })}
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

