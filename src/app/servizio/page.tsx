"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/auth";
import { loadReservations, saveReservations } from "@/lib/storage";

type Status = "confermata" | "arrivato" | "seduto" | "in_uscita" | "pagato" | "liberato" | "no_show";
type Consumption = "pinsa" | "cucina" | "misto" | "non_so";
type Category = "normale" | "affezionato" | "molto_importante";
type TableFilter = "tutti" | "liberi" | "liberi_ora" | "occupati";
type AreaFilter = "TUTTE" | "SALA" | "SALETTA" | "DEHOR" | "MARCIAPIEDE" | "ESTERNO";

type Reservation = {
  id: number;
  date: string;
  name: string;
  phone: string;
  time: string;
  adults: number;
  highchairs: number;
  category?: Category;
  areaPreference?: string;
  table: string;
  optionId?: string;
  moduleIds: string[];
  status: Status;
  consumption?: Consumption;
  notes?: string;
  mode?: string;
  seatedAt?: number;
};

type BaseTable = {
  id: string;
  label: string;
  area: "SALA" | "SALETTA" | "DEHOR" | "MARCIAPIEDE" | "ESTERNO";
};

type TableVisualStatus = "libero" | "prenotato_dopo" | "occupato";

type ChangeSuggestion = {
  table: BaseTable;
  kind: "free" | "swap" | "director";
  message: string;
  swapReservation?: Reservation;
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

function fromMin(v: number) {
  return `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(v % 60).padStart(2, "0")}`;
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

function tableStatusClass(status: TableVisualStatus) {
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

function getBaseModuleIds(table: BaseTable) {
  if (table.id === "sala-1") return ["sala-1a", "sala-1b"];
  if (table.id === "sala-5") return ["sala-5a", "sala-5b"];
  if (table.id === "sala-6") return ["sala-6a", "sala-6b", "sala-6c"];

  if (table.id === "saletta-1") return ["saletta-1a", "saletta-1b"];
  if (table.id === "saletta-2") return ["saletta-2a", "saletta-2b"];
  if (table.id === "saletta-3") return ["saletta-3a", "saletta-3b"];
  if (table.id === "saletta-4") return ["saletta-4a", "saletta-4b"];

  if (table.id === "dehor-4") return ["dehor-4a", "dehor-4b"];
  if (table.id === "dehor-5") return ["dehor-5a", "dehor-5b"];
  if (table.id === "dehor-6") return ["dehor-6a", "dehor-6b"];
  if (table.id === "dehor-7") return ["dehor-7a", "dehor-7b"];
  if (table.id === "dehor-8") return ["dehor-8a", "dehor-8b"];

  return [table.id];
}

function reservationUsesTable(reservation: Reservation, table: BaseTable) {
  const tableModules = getBaseModuleIds(table);
  const reservationModules = reservation.moduleIds || [];

  if (tableModules.some((moduleId) => reservationModules.includes(moduleId))) return true;

  const label = normalize(table.label);
  const tableText = normalize(reservation.table || "");
  const moduleText = normalize(reservationModules.join(" "));

  if (tableText.includes(label)) return true;
  if (moduleText.includes(normalize(table.id))) return true;

  const number = table.label.split(" ")[0];
  const area = table.area.toLowerCase();

  return tableText.includes(number) && tableText.includes(area);
}

function isActiveReservation(r: Reservation) {
  return r.status !== "liberato" && r.status !== "no_show";
}

function isOccupiedStatus(status: Status) {
  return ["arrivato", "seduto", "in_uscita", "pagato"].includes(status);
}

function getEstimatedReleaseTime(r: Reservation) {
  const start = toMin(r.time);
  const duration = r.consumption === "cucina" ? 105 : r.consumption === "pinsa" ? 75 : 90;
  return fromMin(start + duration + 10);
}

function getEstimatedReleaseMin(r: Reservation) {
  const start = toMin(r.time);
  const duration = r.consumption === "cucina" ? 105 : r.consumption === "pinsa" ? 75 : 90;
  return start + duration + 10;
}

function getTableCapacity(table: BaseTable) {
  if (table.id === "sala-6") return 6;
  if (["sala-1", "sala-5"].includes(table.id)) return 4;
  if (table.area === "SALETTA") return 4;
  if (["dehor-4", "dehor-5", "dehor-6", "dehor-7", "dehor-8"].includes(table.id)) return 4;
  return 2;
}

function overlap(aStart: number, aEnd: number, bStart: number, bEnd: number) {
  return aStart < bEnd && bStart < aEnd;
}

function hasStrongPreference(r: Reservation) {
  return !!r.areaPreference && r.areaPreference !== "nessuna";
}

function playArrivalSound() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContextClass();

    const playTone = (frequency: number, delay: number, duration: number) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();

      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      gain.gain.value = 0.0001;

      oscillator.connect(gain);
      gain.connect(audioContext.destination);

      const start = audioContext.currentTime + delay;
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

      oscillator.start(start);
      oscillator.stop(start + duration + 0.03);
    };

    playTone(880, 0, 0.18);
    playTone(1175, 0.22, 0.22);
  } catch (error) {
    console.error("Audio non disponibile", error);
  }
}

export default function ServizioPage() {
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [now, setNow] = useState(currentTimeLabel());
  const [searchName, setSearchName] = useState("");
  const [changeRequestId, setChangeRequestId] = useState<number | null>(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [lastSoundMessage, setLastSoundMessage] = useState("");
  const [tableFilter, setTableFilter] = useState<TableFilter>("tutti");
  const [areaFilter, setAreaFilter] = useState<AreaFilter>("TUTTE");
  const notifiedArrivalIds = useRef<Set<number>>(new Set());

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
    const interval = setInterval(async () => {
      setNow(currentTimeLabel());
      const data = await loadReservations();
      setReservations(data || []);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const todayReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => toMin(a.time) - toMin(b.time));
  }, [reservations, selectedDate, now]);

  const activeReservations = todayReservations.filter(isActiveReservation);

  const searchedReservations = useMemo(() => {
    const q = searchName.trim().toLowerCase();
    if (!q) return [];

    return activeReservations.filter((r) =>
      (r.name || "").toLowerCase().includes(q) ||
      (r.phone || "").toLowerCase().includes(q) ||
      (r.table || "").toLowerCase().includes(q)
    );
  }, [activeReservations, searchName]);

  const upcoming = activeReservations
    .filter((r) => !isOccupiedStatus(r.status))
    .filter((r) => toMin(r.time) >= nowMin() - 5 && toMin(r.time) <= nowMin() + 10)
    .sort((a, b) => toMin(a.time) - toMin(b.time));

  useEffect(() => {
    if (!soundEnabled) return;

    const newArrival = upcoming.find((r) => !notifiedArrivalIds.current.has(r.id));
    if (!newArrival) return;

    notifiedArrivalIds.current.add(newArrival.id);
    playArrivalSound();

    if (navigator.vibrate) navigator.vibrate([200, 80, 200]);

    setLastSoundMessage(`${newArrival.time} - ${newArrival.name} x${newArrival.adults} in arrivo`);
  }, [upcoming, soundEnabled]);

  const tableRows = useMemo(() => {
    return BASE_TABLES.map((table) => {
      const matches = activeReservations
        .filter((r) => reservationUsesTable(r, table))
        .sort((a, b) => toMin(a.time) - toMin(b.time));

      const occupied = matches.find((r) => isOccupiedStatus(r.status));
      const booked = matches.find((r) => r.status === "confermata");

      let status: TableVisualStatus = "libero";
      if (occupied) status = "occupato";
      else if (booked) status = "prenotato_dopo";

      return {
        table,
        matches,
        occupied,
        booked,
        status,
        capacity: getTableCapacity(table),
      };
    }).sort((a, b) => a.capacity - b.capacity || a.table.label.localeCompare(b.table.label));
  }, [activeReservations, now]);

  const freeAllNightCount = tableRows.filter((t) => t.status === "libero").length;
  const freeNowCount = tableRows.filter((t) => t.status === "prenotato_dopo").length;
  const occupiedCount = tableRows.filter((t) => t.status === "occupato").length;
  const unavailableCount = tableRows.filter((t) => t.status !== "libero").length;

  const visibleTableRows = useMemo(() => {
    return tableRows.filter((row) => {
      if (areaFilter !== "TUTTE" && row.table.area !== areaFilter) return false;
      if (tableFilter === "liberi") return row.status === "libero";
      if (tableFilter === "liberi_ora") return row.status === "libero" || row.status === "prenotato_dopo";
      if (tableFilter === "occupati") return row.status === "occupato";
      return true;
    });
  }, [tableRows, tableFilter, areaFilter]);

  const groupedTables = useMemo(() => {
    const groups: Record<string, typeof visibleTableRows> = {
      SALA: [],
      SALETTA: [],
      DEHOR: [],
      MARCIAPIEDE: [],
      ESTERNO: [],
    };

    visibleTableRows.forEach((row) => {
      groups[row.table.area].push(row);
    });

    return groups;
  }, [visibleTableRows]);

  const bestPassageTables = useMemo(() => {
    return tableRows
      .filter((row) => row.status === "libero" || row.status === "prenotato_dopo")
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === "libero" ? -1 : 1;
        return a.capacity - b.capacity;
      })
      .slice(0, 8);
  }, [tableRows]);

  function findCurrentBaseTable(r: Reservation) {
    return BASE_TABLES.find((table) => reservationUsesTable(r, table)) || null;
  }

  function conflictsForTable(table: BaseTable, target: Reservation) {
    const start = toMin(target.time);
    const end = getEstimatedReleaseMin(target);

    return activeReservations.filter((r) => {
      if (r.id === target.id) return false;
      if (!reservationUsesTable(r, table)) return false;
      return overlap(start, end, toMin(r.time), getEstimatedReleaseMin(r));
    });
  }

  function canMoveOtherReservationToOldTable(other: Reservation, oldTable: BaseTable, target: Reservation) {
    const start = toMin(other.time);
    const end = getEstimatedReleaseMin(other);

    return activeReservations.every((r) => {
      if (r.id === other.id || r.id === target.id) return true;
      if (!reservationUsesTable(r, oldTable)) return true;
      return !overlap(start, end, toMin(r.time), getEstimatedReleaseMin(r));
    });
  }

  function getChangeSuggestions(target: Reservation): ChangeSuggestion[] {
    const totalPeople = Number(target.adults || 0) + Number(target.highchairs || 0);
    const currentTable = findCurrentBaseTable(target);
    const currentCapacity = currentTable ? getTableCapacity(currentTable) : totalPeople;

    const similarTables = BASE_TABLES
      .filter((table) => table.id !== currentTable?.id)
      .filter((table) => getTableCapacity(table) >= totalPeople)
      .filter((table) => getTableCapacity(table) <= Math.max(currentCapacity + 2, totalPeople + 2))
      .sort((a, b) => {
        const sameAreaA = currentTable && a.area === currentTable.area ? 0 : 1;
        const sameAreaB = currentTable && b.area === currentTable.area ? 0 : 1;
        const capacityA = Math.abs(getTableCapacity(a) - currentCapacity);
        const capacityB = Math.abs(getTableCapacity(b) - currentCapacity);
        return sameAreaA - sameAreaB || capacityA - capacityB;
      });

    const suggestions: ChangeSuggestion[] = [];

    for (const table of similarTables) {
      const conflicts = conflictsForTable(table, target);

      if (conflicts.length === 0) {
        suggestions.push({
          table,
          kind: "free",
          message: `Spostamento autorizzato: ${table.label} è libero nella fascia di ${target.name}.`,
        });
        continue;
      }

      const movableConflict = conflicts.length === 1 ? conflicts[0] : null;
      if (
        movableConflict &&
        currentTable &&
        movableConflict.status === "confermata" &&
        !hasStrongPreference(movableConflict) &&
        canMoveOtherReservationToOldTable(movableConflict, currentTable, target)
      ) {
        suggestions.push({
          table,
          kind: "swap",
          swapReservation: movableConflict,
          message: `Spostamento possibile con scambio: ${target.name} va a ${table.label}, ${movableConflict.name} viene spostato a ${currentTable.label}.`,
        });
      }
    }

    if (suggestions.length === 0) {
      return [{
        table: currentTable || BASE_TABLES[0],
        kind: "director",
        message: "Il sistema non autorizza uno spostamento sicuro: chiedere al direttore di sala.",
      }];
    }

    return suggestions.slice(0, 4);
  }

  async function applyChangeSuggestion(target: Reservation, suggestion: ChangeSuggestion) {
    if (suggestion.kind === "director") return;

    const currentTable = findCurrentBaseTable(target);
    const newTargetModules = getBaseModuleIds(suggestion.table);
    const oldTargetModules = currentTable ? getBaseModuleIds(currentTable) : target.moduleIds;

    const updated = reservations.map((r) => {
      if (r.id === target.id) {
        return {
          ...r,
          table: suggestion.table.label,
          optionId: suggestion.table.id,
          moduleIds: newTargetModules,
          notes: `${r.notes || ""}${r.notes ? " · " : ""}Spostato da accoglienza a ${suggestion.table.label}`,
        };
      }

      if (suggestion.kind === "swap" && suggestion.swapReservation && r.id === suggestion.swapReservation.id && currentTable) {
        return {
          ...r,
          table: currentTable.label,
          optionId: currentTable.id,
          moduleIds: oldTargetModules,
          notes: `${r.notes || ""}${r.notes ? " · " : ""}Spostato automaticamente per cambio posto di ${target.name}`,
        };
      }

      return r;
    });

    setReservations(updated);
    await saveReservations(updated);
    setChangeRequestId(null);
  }

  async function updateStatus(id: number, status: Status) {
    const updated = reservations.map((r) =>
      r.id === id ? { ...r, status, seatedAt: status === "seduto" ? Date.now() : r.seatedAt } : r
    );

    setReservations(updated);
    await saveReservations(updated);
  }

  async function occupyTableNow(table: BaseTable) {
    const time = currentTimeLabel();
    const newReservation: Reservation = {
      id: Date.now(),
      date: selectedDate,
      name: "Passaggio",
      phone: "",
      time,
      adults: 2,
      highchairs: 0,
      category: "normale",
      areaPreference: "nessuna",
      table: table.label,
      optionId: table.id,
      moduleIds: getBaseModuleIds(table),
      status: "seduto",
      consumption: "non_so",
      notes: "Inserito dalla modalità servizio",
      mode: "passaggio",
      seatedAt: Date.now(),
    };

    const updated = [newReservation, ...reservations];
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

        <section className="bg-white border rounded-2xl p-5 border-blue-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div>
              <h2 className="text-2xl font-bold">Cerca prenotazione</h2>
              <p className="text-sm text-gray-500">Prima cosa da usare quando arriva un cliente: nome, telefono o tavolo.</p>
            </div>
            <button
              onClick={() => setTableFilter("liberi_ora")}
              className="rounded-xl bg-green-700 text-white px-5 py-3 font-semibold"
            >
              Vedi tavoli liberi per passaggio
            </button>
          </div>

          <div className="flex flex-col md:flex-row gap-3">
            <input
              className="border rounded-xl px-4 py-3 text-lg flex-1"
              placeholder="Cerca nome, telefono o tavolo..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
            />
            {searchName && (
              <button
                onClick={() => {
                  setSearchName("");
                  setChangeRequestId(null);
                }}
                className="border rounded-xl px-4 py-3 bg-white font-semibold"
              >
                Pulisci
              </button>
            )}
          </div>

          {searchName.trim() && (
            <div className="mt-4 space-y-3">
              {searchedReservations.length === 0 && (
                <div className="text-gray-500">Nessuna prenotazione trovata.</div>
              )}

              {searchedReservations.map((r) => {
                const suggestions = changeRequestId === r.id ? getChangeSuggestions(r) : [];

                return (
                  <div key={r.id} className="border rounded-2xl p-4 bg-yellow-50 border-yellow-300">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                      <div>
                        <div className="text-2xl font-bold">{r.name} x{r.adults} · {r.time}</div>
                        <div className="text-xl font-semibold">Accompagnare a: {r.table}</div>
                        <div className="text-sm mt-1">
                          Stato: {r.status} · {turnOf(r.time)}
                          {r.highchairs ? ` · ${r.highchairs} seggiolone` : ""}
                        </div>
                        {r.notes && <div className="text-sm mt-1">Note: {r.notes}</div>}
                      </div>

                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => updateStatus(r.id, "arrivato")}
                          className="rounded-xl bg-black text-white px-5 py-3 font-semibold"
                        >
                          Arrivato
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, "seduto")}
                          className="rounded-xl border bg-white px-5 py-3 font-semibold"
                        >
                          Seduto
                        </button>
                        <button
                          onClick={() => setChangeRequestId(changeRequestId === r.id ? null : r.id)}
                          className="rounded-xl border bg-white px-5 py-3 font-semibold"
                        >
                          Vuole cambiare posto
                        </button>
                      </div>
                    </div>

                    {changeRequestId === r.id && (
                      <div className="mt-4 rounded-xl bg-white/80 border p-3 space-y-2">
                        <div className="font-bold">Soluzioni cambio posto</div>
                        {suggestions.map((suggestion, index) => (
                          <div key={`${suggestion.table.id}-${index}`} className="border rounded-xl p-3 flex flex-col md:flex-row md:items-center justify-between gap-3">
                            <div>
                              <div className="font-semibold">
                                {suggestion.kind === "director" ? "Chiedere al direttore di sala" : suggestion.table.label}
                              </div>
                              <div className="text-sm">{suggestion.message}</div>
                            </div>

                            {suggestion.kind !== "director" ? (
                              <button
                                onClick={() => applyChangeSuggestion(r, suggestion)}
                                className="rounded-xl bg-black text-white px-4 py-2 font-semibold"
                              >
                                Registra spostamento
                              </button>
                            ) : (
                              <div className="rounded-xl bg-red-100 text-red-900 px-4 py-2 font-semibold text-sm">
                                Decisione manuale
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <div className="grid md:grid-cols-4 gap-4">
          <button onClick={() => setTableFilter("liberi")} className={`text-left border rounded-2xl p-5 ${tableFilter === "liberi" ? "bg-green-700 text-white border-green-700" : "bg-white"}`}>
            <div className="text-sm opacity-80">Liberi tutta la sera</div>
            <div className="text-3xl font-bold">{freeAllNightCount}</div>
          </button>

          <button onClick={() => setTableFilter("liberi_ora")} className={`text-left border rounded-2xl p-5 ${tableFilter === "liberi_ora" ? "bg-yellow-500 text-white border-yellow-500" : "bg-white"}`}>
            <div className="text-sm opacity-80">Liberi ora per passaggio</div>
            <div className="text-3xl font-bold">{freeAllNightCount + freeNowCount}</div>
          </button>

          <button onClick={() => setTableFilter("occupati")} className={`text-left border rounded-2xl p-5 ${tableFilter === "occupati" ? "bg-red-700 text-white border-red-700" : "bg-white"}`}>
            <div className="text-sm opacity-80">Occupati</div>
            <div className="text-3xl font-bold">{occupiedCount}</div>
          </button>

          <button onClick={() => setTableFilter("tutti")} className={`text-left border rounded-2xl p-5 ${tableFilter === "tutti" ? "bg-black text-white border-black" : "bg-white"}`}>
            <div className="text-sm opacity-80">Tutti i tavoli</div>
            <div className="text-3xl font-bold">{BASE_TABLES.length}</div>
          </button>
        </div>

        <section className="bg-white border rounded-2xl p-5 border-green-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Passaggio veloce</h2>
              <p className="text-sm text-gray-500">I migliori tavoli disponibili ora, ordinati per non sprecare tavoli grandi.</p>
            </div>
            <div className="text-sm font-semibold text-green-800">
              {freeAllNightCount + freeNowCount} tavoli utilizzabili ora
            </div>
          </div>

          <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-3">
            {bestPassageTables.length === 0 && <div className="text-gray-500">Nessun tavolo disponibile ora.</div>}
            {bestPassageTables.map(({ table, status, booked, capacity }) => (
              <div key={table.id} className={`border rounded-2xl p-4 ${tableStatusClass(status)}`}>
                <div className="flex justify-between gap-2">
                  <div>
                    <div className="text-xl font-bold">{table.label}</div>
                    <div className="text-sm font-semibold">{capacity} posti · {table.area}</div>
                  </div>
                </div>
                <div className="text-sm mt-2">
                  {status === "libero" && "Libero tutta la sera"}
                  {status === "prenotato_dopo" && booked && `Libero ora · prenotato alle ${booked.time} da ${booked.name}`}
                </div>
                <button
                  onClick={() => occupyTableNow(table)}
                  className="mt-3 w-full rounded-xl bg-black text-white px-4 py-3 font-semibold"
                >
                  Occupa ora · passaggio
                </button>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white border rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Tavoli</h2>
              <p className="text-sm text-gray-500">
                Verde libero tutta la sera · Giallo libero ora ma prenotato più tardi · Rosso occupato
              </p>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select className="border rounded-xl px-3 py-2 bg-white" value={areaFilter} onChange={(e) => setAreaFilter(e.target.value as AreaFilter)}>
                <option value="TUTTE">Tutte le aree</option>
                <option value="SALA">Sala</option>
                <option value="SALETTA">Saletta</option>
                <option value="DEHOR">Dehor</option>
                <option value="MARCIAPIEDE">Marciapiede</option>
                <option value="ESTERNO">Esterno</option>
              </select>
              <button onClick={() => setTableFilter("tutti")} className={`border rounded-xl px-4 py-2 ${tableFilter === "tutti" ? "bg-black text-white" : "bg-white"}`}>Tutti</button>
              <button onClick={() => setTableFilter("liberi")} className={`border rounded-xl px-4 py-2 ${tableFilter === "liberi" ? "bg-green-700 text-white" : "bg-white"}`}>Solo liberi</button>
              <button onClick={() => setTableFilter("liberi_ora")} className={`border rounded-xl px-4 py-2 ${tableFilter === "liberi_ora" ? "bg-yellow-500 text-white" : "bg-white"}`}>Liberi ora</button>
              <button onClick={() => setTableFilter("occupati")} className={`border rounded-xl px-4 py-2 ${tableFilter === "occupati" ? "bg-red-700 text-white" : "bg-white"}`}>Occupati</button>
              <button onClick={() => window.print()} className="border rounded-xl px-4 py-2 bg-white">Stampa</button>
            </div>
          </div>

          <div className="space-y-6">
            {Object.entries(groupedTables).map(([area, rows]) => {
              if (rows.length === 0) return null;

              return (
                <div key={area}>
                  <h3 className="text-xl font-bold mb-3">{area}</h3>

                  <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
                    {rows.map(({ table, matches, status, capacity }) => (
                      <div key={table.id} className={`border rounded-2xl p-4 ${tableStatusClass(status)}`}>
                        <div className="flex justify-between gap-2">
                          <div>
                            <div className="text-xl font-bold">{table.label}</div>
                            <div className="text-sm font-medium">
                              {status === "libero" && "LIBERO TUTTA LA SERA"}
                              {status === "prenotato_dopo" && "LIBERO ORA · PRENOTATO PIÙ TARDI"}
                              {status === "occupato" && "OCCUPATO"}
                            </div>
                            <div className="text-xs mt-1 opacity-80">Capienza rapida: {capacity} posti</div>
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
                                  Stato: {r.status} · {isOccupiedStatus(r.status) ? `libero stimato alle ${getEstimatedReleaseTime(r)}` : minutesLabel(mins)}
                                  {r.highchairs ? ` · ${r.highchairs} seggiolone` : ""}
                                </div>
                                {r.notes && <div>Note: {r.notes}</div>}

                                <div className="flex gap-2 mt-2 flex-wrap">
                                  <button
                                    onClick={() => updateStatus(r.id, "arrivato")}
                                    className="rounded-lg bg-black text-white px-3 py-2"
                                  >
                                    Arrivato
                                  </button>

                                  <button
                                    onClick={() => updateStatus(r.id, "seduto")}
                                    className="rounded-lg border bg-white px-3 py-2"
                                  >
                                    Seduto
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

                          {status !== "occupato" && (
                            <button
                              onClick={() => occupyTableNow(table)}
                              className="mt-2 w-full rounded-xl bg-black text-white px-4 py-3 font-semibold"
                            >
                              Occupa ora · passaggio
                            </button>
                          )}

                          {status === "occupato" && (
                            <div className="text-xs font-medium mt-2 opacity-80">
                              Tavolo occupato: per liberarlo usa il pulsante Liberato sulla prenotazione/passaggio.
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {visibleTableRows.length === 0 && (
              <div className="text-gray-500 border rounded-xl p-4 bg-gray-50">Nessun tavolo con questi filtri.</div>
            )}
          </div>
        </section>

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
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
              <h2 className="text-2xl font-bold">Notifiche arrivi</h2>
              <p className="text-sm text-gray-500">
                Attiva il suono sul dispositivo. Su iPhone e Android serve premere il bottone almeno una volta.
              </p>
              {lastSoundMessage && <p className="text-sm font-semibold mt-2 text-green-800">Ultimo avviso: {lastSoundMessage}</p>}
            </div>

            <button
              onClick={() => {
                playArrivalSound();
                if (navigator.vibrate) navigator.vibrate(150);
                setSoundEnabled(true);
                setLastSoundMessage("Audio attivato correttamente");
              }}
              className={`rounded-xl px-5 py-3 font-semibold ${soundEnabled ? "bg-green-700 text-white" : "bg-black text-white"}`}
            >
              {soundEnabled ? "Suono attivo" : "Attiva suono"}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}



