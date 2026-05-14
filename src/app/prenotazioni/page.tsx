"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase, getCurrentUserRole } from "@/lib/auth";
import { loadReservations, saveReservations } from "@/lib/storage";

type Area = "sala" | "saletta" | "dehor" | "marciapiede" | "esterno";
type Consumption = "pinsa" | "cucina" | "misto" | "non_so";
type Category = "normale" | "affezionato" | "molto_importante";
type Status = "confermata" | "arrivato" | "seduto" | "in_uscita" | "pagato" | "liberato" | "no_show";
type BookingMode = "prenotazione" | "passaggio";

type Reservation = {
  id: number;
  date: string;
  name: string;
  phone: string;
  time: string;
  adults: number;
  highchairs: number;
  category: Category;
  areaPreference: Area | "nessuna";
  table: string;
  optionId: string;
  moduleIds: string[];
  status: Status;
  consumption: Consumption;
  notes: string;
  seatedAt?: number;
  mode: BookingMode;
  suggestedWaitMinutes?: number;
};

type FormState = {
  name: string;
  phone: string;
  time: string;
  adults: number;
  highchairs: number;
  category: Category;
  areaPreference: Area | "nessuna";
  consumption: Consumption;
  notes: string;
};

type CustomerHistory = {
  name: string;
  phone: string;
  visits: number;
  lastVisit: string;
  lastTime: string;
  lastTable: string;
  lastNotes: string;
  category: Category;
};

const QUICK_TIMES = ["19:15", "19:30", "19:45", "21:00", "21:15", "21:30"];
const AREAS: Area[] = ["sala", "saletta", "dehor", "marciapiede", "esterno"];
const TOTAL_CAPACITY = 27 + 18 + 30 + 15 + 36;

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function toMin(t: string) {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function getTurn(time: string) {
  const m = toMin(time);
  if (m >= toMin("21:00")) return "secondo turno";
  if (m >= toMin("20:00")) return "fuori turno";
  return "primo turno";
}

function isActiveStatus(status: Status) {
  return !["liberato", "no_show"].includes(status);
}

function statusClass(status: Status) {
  if (status === "confermata") return "bg-yellow-100 text-yellow-900";
  if (status === "arrivato") return "bg-green-100 text-green-900";
  if (status === "seduto") return "bg-blue-100 text-blue-900";
  if (status === "no_show") return "bg-red-100 text-red-900";
  return "bg-gray-100 text-gray-900";
}

function makeEmptyForm(): FormState {
  return {
    name: "",
    phone: "",
    time: "21:00",
    adults: 2,
    highchairs: 0,
    category: "normale",
    areaPreference: "nessuna",
    consumption: "non_so",
    notes: "",
  };
}

function normalizePhone(value: string) {
  return (value || "").replace(/\s/g, "").replace(/-/g, "").replace(/\./g, "");
}

function normalizeName(value: string) {
  return (value || "").trim().toLowerCase();
}

export default function PrenotazioniPage() {
  const [email, setEmail] = useState("");
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [form, setForm] = useState<FormState>(makeEmptyForm());
  const [search, setSearch] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function checkLogin() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        window.location.href = "/login";
        return;
      }

      setEmail(session.user.email || "");
      const role = await getCurrentUserRole();

      if (role === "admin") return;
      if (role !== "telefonista") window.location.href = "/servizio";
    }

    checkLogin();
  }, []);

  useEffect(() => {
    async function loadData() {
      const data = await loadReservations();
      setReservations(data || []);
    }

    loadData();
  }, []);

  const dayReservations = useMemo(() => {
    return reservations
      .filter((r) => r.date === selectedDate)
      .sort((a, b) => toMin(a.time) - toMin(b.time));
  }, [reservations, selectedDate]);

  const activeReservations = useMemo(() => {
    return dayReservations.filter((r) => isActiveStatus(r.status));
  }, [dayReservations]);

  const firstTurn = useMemo(() => {
    return activeReservations.filter((r) => getTurn(r.time) === "primo turno");
  }, [activeReservations]);

  const secondTurn = useMemo(() => {
    return activeReservations.filter((r) => getTurn(r.time) === "secondo turno");
  }, [activeReservations]);

  const outsideTurn = useMemo(() => {
    return activeReservations.filter((r) => getTurn(r.time) === "fuori turno");
  }, [activeReservations]);

  const firstTurnBooked = firstTurn.reduce((sum, r) => sum + Number(r.adults || 0), 0);
  const secondTurnBooked = secondTurn.reduce((sum, r) => sum + Number(r.adults || 0), 0);
  const firstTurnFree = Math.max(TOTAL_CAPACITY - firstTurnBooked, 0);
  const secondTurnFree = Math.max(TOTAL_CAPACITY - secondTurnBooked, 0);

  const filteredReservations = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return dayReservations;

    return dayReservations.filter((r) => {
      return (
        (r.name || "").toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.time || "").toLowerCase().includes(q)
      );
    });
  }, [dayReservations, search]);

  const possibleDuplicate = useMemo(() => {
    const name = normalizeName(form.name);
    const phone = normalizePhone(form.phone);
    if (!name && !phone) return null;

    return activeReservations.find((r) => {
      const samePhone = phone && normalizePhone(r.phone || "") === phone;
      const sameName = name && normalizeName(r.name || "") === name;
      return samePhone || sameName;
    });
  }, [activeReservations, form.name, form.phone]);

  const customerHistory = useMemo<CustomerHistory | null>(() => {
    const name = normalizeName(form.name);
    const phone = normalizePhone(form.phone);
    if (!name && !phone) return null;

    const matches = reservations
      .filter((r) => {
        const samePhone = phone && normalizePhone(r.phone || "") === phone;
        const sameName = name && normalizeName(r.name || "") === name;
        return samePhone || sameName;
      })
      .sort((a, b) => {
        const ad = `${a.date} ${a.time}`;
        const bd = `${b.date} ${b.time}`;
        return bd.localeCompare(ad);
      });

    if (matches.length === 0) return null;

    const last = matches[0];

    return {
      name: last.name || form.name,
      phone: last.phone || form.phone,
      visits: matches.length,
      lastVisit: last.date,
      lastTime: last.time,
      lastTable: last.table,
      lastNotes: last.notes || "",
      category: last.category || "normale",
    };
  }, [reservations, form.name, form.phone]);

  async function saveUnassignedReservation() {
    setMessage("");

    if (!form.name.trim()) {
      setMessage("Inserisci almeno il nome del cliente.");
      return;
    }

    if (Number(form.adults || 0) < 1) {
      setMessage("Inserisci almeno 1 adulto.");
      return;
    }

    try {
      setLoading(true);

      const newReservation: Reservation = {
        id: Date.now(),
        date: selectedDate,
        name: form.name.trim(),
        phone: form.phone.trim(),
        time: form.time,
        adults: Number(form.adults || 1),
        highchairs: Number(form.highchairs || 0),
        category: form.category,
        areaPreference: form.areaPreference,
        table: "Da assegnare",
        optionId: "da-assegnare",
        moduleIds: [],
        status: "confermata",
        consumption: form.consumption,
        notes: form.notes,
        mode: "prenotazione",
        suggestedWaitMinutes: 0,
      };

      const updated = [newReservation, ...reservations];
      setReservations(updated);
      await saveReservations(updated);
      setForm(makeEmptyForm());
      setMessage("Prenotazione salvata: tavolo da assegnare.");
    } catch (error) {
      console.error(error);
      setMessage("Errore durante il salvataggio. Riprova.");
    } finally {
      setLoading(false);
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-5">
        <div className="flex flex-col md:flex-row justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold">Da Dino - Prenotazioni</h1>
            <p className="text-gray-500">Accesso telefonista: {email}</p>
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <input
              type="date"
              className="border rounded-xl px-3 py-2 bg-white"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
            <button onClick={logout} className="border rounded-xl px-4 py-2 bg-white">
              Esci
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-3">
          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Posti rimasti 1 turno</div>
            <div className="text-4xl font-bold">{firstTurnFree}</div>
            <div className="text-xs text-gray-500 mt-1">Prenotati: {firstTurnBooked}</div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Posti rimasti 2 turno</div>
            <div className="text-4xl font-bold">{secondTurnFree}</div>
            <div className="text-xs text-gray-500 mt-1">Prenotati: {secondTurnBooked}</div>
          </div>

          <div className="bg-white border rounded-2xl p-5">
            <div className="text-sm text-gray-500">Prenotazioni oggi</div>
            <div className="text-4xl font-bold">{activeReservations.length}</div>
            <div className="text-xs text-gray-500 mt-1">Fuori turno: {outsideTurn.length}</div>
          </div>
        </div>

        <section className="bg-white border rounded-2xl p-5 space-y-4">
          <div>
            <h2 className="text-2xl font-bold">Nuova prenotazione</h2>
            <p className="text-sm text-gray-500">
              Questa pagina salva sempre il tavolo come Da assegnare. Matteo lo assegnera dalla dashboard.
            </p>
          </div>

          {message ? (
            <div className="border rounded-xl p-3 bg-yellow-50 text-yellow-900 font-medium">
              {message}
            </div>
          ) : null}

          {possibleDuplicate ? (
            <div className="border rounded-xl p-3 bg-orange-50 text-orange-900">
              Possibile doppione oggi: {possibleDuplicate.time} - {possibleDuplicate.name} x{possibleDuplicate.adults} - {possibleDuplicate.table}
            </div>
          ) : null}

          {customerHistory ? (
            <div className="border rounded-xl p-4 bg-blue-50 text-blue-950 space-y-1">
              <div className="font-bold text-lg">Cliente gia conosciuto</div>
              <div className="text-sm">
                {customerHistory.name} {customerHistory.phone ? `- ${customerHistory.phone}` : ""}
              </div>
              <div className="text-sm">
                Visite registrate: <b>{customerHistory.visits}</b> - Ultima volta: <b>{customerHistory.lastVisit}</b> alle <b>{customerHistory.lastTime}</b>
              </div>
              <div className="text-sm">
                Ultimo tavolo: <b>{customerHistory.lastTable}</b> - Categoria: <b>{customerHistory.category}</b>
              </div>
              {customerHistory.lastNotes ? (
                <div className="text-sm">Note precedenti: {customerHistory.lastNotes}</div>
              ) : null}
            </div>
          ) : null}

          <div className="grid md:grid-cols-2 gap-3">
            <input
              className="border rounded-xl p-4 text-lg"
              placeholder="Nome cliente"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <input
              className="border rounded-xl p-4 text-lg"
              placeholder="Telefono"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <label className="text-sm text-gray-500">Orario</label>
              <input
                className="border rounded-xl p-4 text-lg w-full"
                type="time"
                value={form.time}
                onChange={(e) => setForm({ ...form, time: e.target.value })}
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {QUICK_TIMES.map((time) => (
                  <button
                    key={time}
                    type="button"
                    onClick={() => setForm({ ...form, time })}
                    className={`px-3 py-2 rounded-xl border text-sm ${form.time === time ? "bg-black text-white border-black" : "bg-white"}`}
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="text-sm text-gray-500">Adulti</label>
              <input
                className="border rounded-xl p-4 text-lg w-full"
                type="number"
                min="1"
                value={form.adults}
                onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })}
              />
            </div>

            <div>
              <label className="text-sm text-gray-500">Seggioloni</label>
              <input
                className="border rounded-xl p-4 text-lg w-full"
                type="number"
                min="0"
                value={form.highchairs}
                onChange={(e) => setForm({ ...form, highchairs: Number(e.target.value) })}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-3">
            <select
              className="border rounded-xl p-4"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value as Category })}
            >
              <option value="normale">Normale</option>
              <option value="affezionato">Affezionato</option>
              <option value="molto_importante">VIP</option>
            </select>

            <select
              className="border rounded-xl p-4"
              value={form.areaPreference}
              onChange={(e) => setForm({ ...form, areaPreference: e.target.value as Area | "nessuna" })}
            >
              <option value="nessuna">Nessuna preferenza area</option>
              {AREAS.map((area) => (
                <option key={area} value={area}>
                  {area}
                </option>
              ))}
            </select>

            <select
              className="border rounded-xl p-4"
              value={form.consumption}
              onChange={(e) => setForm({ ...form, consumption: e.target.value as Consumption })}
            >
              <option value="non_so">Consumo non so</option>
              <option value="pinsa">Pinsa</option>
              <option value="cucina">Cucina</option>
              <option value="misto">Misto</option>
            </select>
          </div>

          <textarea
            className="border rounded-xl p-4 w-full min-h-[100px]"
            placeholder="Note: passeggino, compleanno, allergie, preferenze, richieste..."
            value={form.notes}
            onChange={(e) => setForm({ ...form, notes: e.target.value })}
          />

          <button
            onClick={saveUnassignedReservation}
            disabled={loading}
            className="w-full bg-black text-white rounded-2xl p-4 text-lg font-bold disabled:opacity-50"
          >
            {loading ? "Salvataggio..." : "Registra prenotazione - Da assegnare"}
          </button>
        </section>

        <section className="bg-white border rounded-2xl p-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Prenotazioni del giorno</h2>
              <p className="text-sm text-gray-500">Include anche quelle gia assegnate da Matteo.</p>
            </div>
            <input
              className="border rounded-xl p-3"
              placeholder="Cerca nome, telefono, orario..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            {filteredReservations.length === 0 ? (
              <div className="text-gray-500">Nessuna prenotazione per questa data.</div>
            ) : null}

            {filteredReservations.map((r) => (
              <div
                key={r.id}
                className="border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3"
              >
                <div>
                  <div className="text-lg font-bold">
                    {r.time} - {r.name} x{r.adults}
                  </div>
                  <div className="text-sm text-gray-600">
                    {r.phone || "Senza telefono"} - {getTurn(r.time)} - {r.table}
                    {r.highchairs ? ` - ${r.highchairs} seggiolone` : ""}
                  </div>
                  {r.notes ? <div className="text-xs mt-1">Note: {r.notes}</div> : null}
                </div>

                <span className={`text-xs px-3 py-2 rounded-full font-medium ${statusClass(r.status)}`}>
                  {r.status}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}


