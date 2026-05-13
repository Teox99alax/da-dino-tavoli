"use client";

import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CloudRain,
  Clock3,
  Map,
  Plus,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  Utensils,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Area = "sala" | "saletta" | "dehor" | "esterno";
type Weather = "normale" | "rischio" | "pioggia";
type Service = "pranzo" | "cena";
type Risk = "basso" | "medio" | "alto";
type Awning = "aperte" | "chiuse";
type Consumption = "pinsa" | "cucina" | "misto" | "non_so";
type Category = "normale" | "affezionato" | "molto_importante";
type Status = "confermata" | "arrivato" | "seduto" | "in_uscita" | "liberato" | "no_show";

type Table = {
  id: string;
  label: string;
  area: Area;
  standard: number;
  max: number;
  notes: string;
  sidewalk?: boolean;
};

type Option = {
  id: string;
  label: string;
  area: Area;
  tables: string[];
  standard: number;
  max: number;
  notes: string;
  needsOpenAwningFor8?: boolean;
  manual?: boolean;
  flexibleExternal?: boolean;
};

type Reservation = {
  id: number;
  date: string;
  name: string;
  phone: string;
  time: string;
  adults: number;
  children: number;
  highchairs: number;
  category: Category;
  areaPreference: Area | "nessuna";
  table: string;
  tableIds: string[];
  status: Status;
  consumption: Consumption;
  notes: string;
};

type Settings = {
  service: Service;
  weather: Weather;
  risk: Risk;
  awning: Awning;
  resetMinutes: number;
  pinsaPct: number;
  kitchenPct: number;
};

type FormState = {
  name: string;
  phone: string;
  time: string;
  adults: number;
  children: number;
  highchairs: number;
  category: Category;
  areaPreference: Area | "nessuna";
  consumption: Consumption;
  notes: string;
};

type ScoredOption = Option & {
  score: number;
  warnings: string[];
  turn: string;
  estimatedEnd: string;
  resetEnd: string;
  duration: number;
  passaggio?: string;
};

const AREAS: Area[] = ["sala", "saletta", "dehor", "esterno"];

const SLOTS = {
  first: ["19:00", "19:15", "19:30", "19:45"],
  delicate: ["20:00", "20:15", "20:30", "20:45"],
  second: ["21:00", "21:15", "21:30", "21:45"],
};

const tables: Table[] = [
  { id: "sala-1", label: "1 sala", area: "sala", standard: 4, max: 5, notes: "4 comodo, 5 capotavola" },
  { id: "sala-2", label: "2 sala", area: "sala", standard: 2, max: 2, notes: "Unibile con 1" },
  { id: "sala-3", label: "3 sala", area: "sala", standard: 2, max: 2, notes: "Unibile con 4" },
  { id: "sala-4", label: "4 sala", area: "sala", standard: 2, max: 2, notes: "Unibile con 3" },
  { id: "sala-5", label: "5 sala", area: "sala", standard: 4, max: 4, notes: "Divisibile 2+2" },
  { id: "sala-6", label: "6 sala", area: "sala", standard: 6, max: 6, notes: "Divisibile 4+2" },
  { id: "saletta-1", label: "1 saletta", area: "saletta", standard: 4, max: 5, notes: "5 molto stretto" },
  { id: "saletta-2", label: "2 saletta", area: "saletta", standard: 4, max: 4, notes: "Unibile con 3" },
  { id: "saletta-3", label: "3 saletta", area: "saletta", standard: 4, max: 4, notes: "Unibile con 2" },
  { id: "saletta-4", label: "4 saletta", area: "saletta", standard: 4, max: 4, notes: "Divisibile 2+2" },
  ...[1, 2, 3, 9, 10].map((n) => ({ id: `dehor-${n}`, label: `${n} dehor`, area: "dehor" as Area, standard: 2, max: 2, notes: "Tavolo da 2" })),
  ...[4, 5, 6, 7, 8].map((n) => ({ id: `dehor-${n}`, label: `${n} dehor`, area: "dehor" as Area, standard: 4, max: 4, notes: "Tavolo da 4" })),
  ...[11, 12, 13, 14].map((n) => ({ id: `dehor-${n}`, label: `${n} dehor`, area: "dehor" as Area, standard: 2, max: 3, notes: "Marciapiede 2+1", sidewalk: true })),
];

const combos: Option[] = [
  { id: "sala-1-2", label: "1+2 sala", area: "sala", tables: ["sala-1", "sala-2"], standard: 6, max: 8, notes: "6 comodo, 7 stretto, 8 molto stretto", manual: true },
  { id: "sala-3-4", label: "3+4 sala", area: "sala", tables: ["sala-3", "sala-4"], standard: 4, max: 5, notes: "5+1 con vincoli" },
  { id: "sala-1-2-3-4", label: "1+2+3+4 sala", area: "sala", tables: ["sala-1", "sala-2", "sala-3", "sala-4"], standard: 12, max: 13, notes: "13 molto stretto", manual: true },
  { id: "sala-5-6", label: "5+6 sala", area: "sala", tables: ["sala-5", "sala-6"], standard: 10, max: 11, notes: "10+1 seggiolone, 11 adulti no", manual: true },
  { id: "saletta-2-3", label: "2+3 saletta", area: "saletta", tables: ["saletta-2", "saletta-3"], standard: 8, max: 9, notes: "9 stretto", manual: true },
  { id: "dehor-1-6", label: "1+6 dehor", area: "dehor", tables: ["dehor-1", "dehor-6"], standard: 6, max: 7, notes: "7 solo seggiolone" },
  { id: "dehor-2-5", label: "2+5 dehor", area: "dehor", tables: ["dehor-2", "dehor-5"], standard: 6, max: 8, notes: "8 solo tende aperte", needsOpenAwningFor8: true, manual: true },
  { id: "dehor-3-4", label: "3+4 dehor", area: "dehor", tables: ["dehor-3", "dehor-4"], standard: 6, max: 8, notes: "8 solo tende aperte", needsOpenAwningFor8: true, manual: true },
  { id: "dehor-8-9", label: "8+9 dehor", area: "dehor", tables: ["dehor-8", "dehor-9"], standard: 6, max: 8, notes: "8 solo tende aperte", needsOpenAwningFor8: true, manual: true },
  { id: "dehor-10-7", label: "10+7 dehor", area: "dehor", tables: ["dehor-10", "dehor-7"], standard: 6, max: 7, notes: "7 solo seggiolone" },
  { id: "esterno-flex", label: "Esterno modulabile", area: "esterno", tables: ["esterno-flex"], standard: 30, max: 40, notes: "30 adulti componibili; oltre 30 solo con bambini/seggioloni", flexibleExternal: true },
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

function duration(c: Consumption, s: Settings) {
  if (c === "pinsa") return 75;
  if (c === "cucina") return 105;
  if (c === "misto") return 90;
  return Math.round((s.pinsaPct / 100) * 75 + (s.kitchenPct / 100) * 105);
}

function turn(time: string, service: Service) {
  if (service === "pranzo") return "pranzo";
  if (SLOTS.first.includes(time)) return "primo turno";
  if (SLOTS.second.includes(time)) return "secondo turno";
  if (SLOTS.delicate.includes(time)) return "fuori turno";
  return "orario libero";
}

function times(r: { time: string; consumption: Consumption }, s: Settings) {
  const start = toMin(r.time);
  const dur = duration(r.consumption, s);
  return { start, end: start + dur, resetEnd: start + dur + s.resetMinutes, dur };
}

function overlap(a: number, b: number, c: number, d: number) {
  return a < d && c < b;
}

function isActiveStatus(status: Status) {
  return !["liberato", "no_show"].includes(status);
}

function Stat({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardContent className="p-4 flex gap-3 items-center">
        <div className="p-2 rounded-xl bg-gray-100"><Icon className="w-5 h-5" /></div>
        <div>
          <div className="text-xs text-gray-500">{label}</div>
          <div className="text-xl font-semibold">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DaDinoDashboard() {
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [settings, setSettings] = useState<Settings>({ service: "cena", weather: "normale", risk: "medio", awning: "chiuse", resetMinutes: 10, pinsaPct: 60, kitchenPct: 40 });
  const [area, setArea] = useState<Area>("sala");
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [form, setForm] = useState<FormState>({ name: "", phone: "", time: "21:00", adults: 2, children: 0, highchairs: 0, category: "normale", areaPreference: "nessuna", consumption: "non_so", notes: "" });

  const dayReservations = useMemo(() => reservations.filter((r) => r.date === selectedDate), [reservations, selectedDate]);
  const activeReservations = useMemo(() => dayReservations.filter((r) => isActiveStatus(r.status)), [dayReservations]);

  const options = useMemo<Option[]>(() => {
    const singleTables = tables.map((t) => ({ id: t.id, label: t.label, area: t.area, tables: [t.id], standard: t.standard, max: t.max, notes: t.notes }));
    return [...singleTables, ...combos];
  }, []);

  function disabled(t: Table) {
    return settings.weather === "pioggia" && (t.area === "esterno" || !!t.sidewalk);
  }

  function score(o: Option): ScoredOption | null {
    let s = 100;
    const warnings: string[] = [];
    const adults = Number(form.adults || 0);
    const children = Number(form.children || 0);
    const highchairs = Number(form.highchairs || 0);
    const total = adults + children + highchairs;

    if (settings.weather === "pioggia" && o.area === "esterno") return null;
    if (settings.weather === "pioggia" && o.tables.some((x) => ["dehor-11", "dehor-12", "dehor-13", "dehor-14"].includes(x))) return null;
    if ((settings.weather === "pioggia" || settings.awning === "chiuse") && o.needsOpenAwningFor8 && total > 6) return null;

    if (o.flexibleExternal) {
      if (adults > 30) return null;
      if (settings.weather === "rischio") {
        s -= settings.risk === "basso" ? 50 : settings.risk === "medio" ? 25 : 8;
        warnings.push("Esterno con rischio meteo");
      }
      if (adults >= 14) warnings.push("Gruppo grande esterno: confermare disposizione manuale");
    } else if (total > o.max) {
      return null;
    }

    const ct = times(form, settings);
    if (!o.flexibleExternal) {
      for (const r of activeReservations) {
        const rt = times(r, settings);
        if (overlap(ct.start, ct.resetEnd, rt.start, rt.resetEnd) && o.tables.some((x) => r.tableIds.includes(x))) return null;
      }
    }

    if (o.flexibleExternal) {
      const usedExternal = activeReservations
        .filter((r) => r.tableIds.includes("esterno-flex"))
        .filter((r) => {
          const rt = times(r, settings);
          return overlap(ct.start, ct.resetEnd, rt.start, rt.resetEnd);
        })
        .reduce((sum, r) => sum + r.adults, 0);
      if (usedExternal + adults > 30) return null;
      s += 20;
      warnings.push(`Esterno: ${30 - usedExternal - adults} posti adulti residui nello stesso orario`);
    }

    const empty = o.standard - adults;
    if (!o.flexibleExternal) {
      if (empty === 0) s += 40;
      if (empty === 1) s += 14;
      if (empty > 1) { s -= empty * 35; warnings.push("Spreco posti sopra la tolleranza"); }
      if (adults > o.standard) { s -= 18; warnings.push("Soluzione stretta/capotavola"); }
    }

    if (form.areaPreference !== "nessuna" && form.areaPreference !== o.area) {
      warnings.push("Preferenza area non rispettata");
      if (form.category !== "normale") s -= 45;
    } else if (form.areaPreference === o.area) {
      s += form.category === "normale" ? 5 : 35;
    }

    const tr = turn(form.time, settings.service);
    if (tr === "fuori turno") { s -= 70; warnings.push("Fuori turno: forzatura manuale"); }
    if (settings.service === "cena" && tr === "primo turno" && ct.resetEnd > toMin("21:00")) { s -= 80; warnings.push("Rischia di compromettere il secondo turno"); }
    if (tr === "secondo turno") s += 18;

    if (settings.weather === "rischio" && ["dehor", "esterno"].includes(o.area) && !o.flexibleExternal) {
      s -= settings.risk === "basso" ? 35 : settings.risk === "medio" ? 15 : 5;
      warnings.push("Rischio meteo");
    }
    if (o.manual) { s -= 5; warnings.push("Conferma manuale"); }
    if (highchairs > 0) warnings.push("Verificare spazio seggiolone");

    let passaggio = "";
    if (settings.service === "cena" && ct.resetEnd <= toMin("20:55") && tr === "primo turno") passaggio = "Possibile mini-passaggio prima del secondo turno";
    if (settings.service === "cena" && tr === "secondo turno" && ct.start >= toMin("21:15")) passaggio = "Valutare eventuale passaggio veloce prima";

    return { ...o, score: s, warnings, turn: tr, estimatedEnd: fromMin(ct.end), resetEnd: fromMin(ct.resetEnd), duration: ct.dur, passaggio };
  }

  const suggestions = useMemo(() => options.map(score).filter(Boolean).sort((a: any, b: any) => b.score - a.score).slice(0, 8) as ScoredOption[], [options, form, settings, activeReservations]);

  const enriched = useMemo(() => dayReservations.map((r) => ({ ...r, resetEnd: fromMin(times(r, settings).resetEnd), estimatedEnd: fromMin(times(r, settings).end), turn: turn(r.time, settings.service) })), [dayReservations, settings]);

  const occupied = new globalThis.Map<string, any>();
  enriched.filter((r) => isActiveStatus(r.status)).forEach((r) => r.tableIds.forEach((id) => occupied.set(id, r)));

  const booked = activeReservations.reduce((a, r) => a + r.adults, 0);
  const firstTurn = enriched.filter((r) => r.turn === "primo turno" && isActiveStatus(r.status));
  const secondTurn = enriched.filter((r) => r.turn === "secondo turno" && isActiveStatus(r.status));
  const notArrived = enriched.filter((r) => r.status === "confermata");
  const arrived = enriched.filter((r) => ["arrivato", "seduto", "in_uscita"].includes(r.status));
  const usable = tables.filter((t) => !disabled(t)).reduce((a, t) => a + t.standard, 0) + (settings.weather === "pioggia" ? 0 : 30);

  function add(o: ScoredOption = suggestions[0]) {
    if (!o) return;
    setReservations((prev) => [{
      id: Date.now(),
      date: selectedDate,
      name: form.name || "Senza nome",
      phone: form.phone,
      time: form.time,
      adults: Number(form.adults),
      children: Number(form.children),
      highchairs: Number(form.highchairs),
      category: form.category,
      areaPreference: form.areaPreference,
      table: o.label,
      tableIds: o.tables,
      status: "confermata",
      consumption: form.consumption,
      notes: form.notes,
    }, ...prev]);
    setForm({ name: "", phone: "", time: "21:00", adults: 2, children: 0, highchairs: 0, category: "normale", areaPreference: "nessuna", consumption: "non_so", notes: "" });
  }

  function updateStatus(id: number, status: Status) {
    setReservations((prev) => prev.map((r) => r.id === id ? { ...r, status } : r));
  }

  function removeReservation(id: number) {
    setReservations((prev) => prev.filter((r) => r.id !== id));
  }

  return (
    <div className="min-h-screen p-4 md:p-6 bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-5">
        <div className="flex justify-between gap-4 flex-col md:flex-row">
          <div>
            <h1 className="text-3xl font-bold">Da Dino · Dashboard tavoli</h1>
            <p className="text-gray-600">Calendario, turni, arrivi, meteo, passaggio e suggerimento automatico.</p>
          </div>
          <Button className="rounded-2xl"><Plus className="w-4 h-4 mr-2" />Nuova prenotazione</Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Stat icon={Users} label="Coperti attivi" value={booked} />
          <Stat icon={Clock3} label="Primo / secondo" value={`${firstTurn.reduce((a, r) => a + r.adults, 0)} / ${secondTurn.reduce((a, r) => a + r.adults, 0)}`} />
          <Stat icon={Map} label="Posti utilizzabili" value={usable} />
          <Stat icon={CloudRain} label="Meteo" value={settings.weather} />
          <Stat icon={BarChart3} label="Media stimata" value={`${duration("non_so", settings)} min`} />
        </div>

        <Card className="rounded-2xl">
          <CardContent className="p-4 grid grid-cols-2 md:grid-cols-7 gap-3">
            <label className="space-y-1 text-sm"><span className="text-gray-500">Data prenotazioni</span><input className="border rounded-xl p-2 w-full" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} /></label>
            <label className="space-y-1 text-sm"><span className="text-gray-500">Servizio</span><select className="border rounded-xl p-2 w-full" value={settings.service} onChange={(e) => setSettings({ ...settings, service: e.target.value as Service })}><option value="pranzo">Pranzo</option><option value="cena">Cena</option></select></label>
            <label className="space-y-1 text-sm"><span className="text-gray-500">Meteo</span><select className="border rounded-xl p-2 w-full" value={settings.weather} onChange={(e) => setSettings({ ...settings, weather: e.target.value as Weather, awning: e.target.value === "pioggia" ? "chiuse" : settings.awning })}><option value="normale">Normale</option><option value="rischio">Rischio pioggia</option><option value="pioggia">Pioggia</option></select></label>
            <label className="space-y-1 text-sm"><span className="text-gray-500">Rischio accettato</span><select className="border rounded-xl p-2 w-full" value={settings.risk} onChange={(e) => setSettings({ ...settings, risk: e.target.value as Risk })}><option value="basso">Basso</option><option value="medio">Medio</option><option value="alto">Alto</option></select></label>
            <label className="space-y-1 text-sm"><span className="text-gray-500">Tende dehor</span><select className="border rounded-xl p-2 w-full" value={settings.awning} disabled={settings.weather === "pioggia"} onChange={(e) => setSettings({ ...settings, awning: e.target.value as Awning })}><option value="chiuse">Chiuse</option><option value="aperte">Aperte</option></select></label>
            <label className="space-y-1 text-sm"><span className="text-gray-500">Reset tavolo</span><select className="border rounded-xl p-2 w-full" value={settings.resetMinutes} onChange={(e) => setSettings({ ...settings, resetMinutes: Number(e.target.value) })}><option value={10}>10 minuti</option><option value={7}>7 minuti</option></select></label>
            <label className="space-y-1 text-sm"><span className="text-gray-500">% pinsa stimata</span><input className="border rounded-xl p-2 w-full" type="number" value={settings.pinsaPct} onChange={(e) => { const p = Number(e.target.value); setSettings({ ...settings, pinsaPct: p, kitchenPct: 100 - p }); }} /></label>
          </CardContent>
        </Card>

        {settings.weather === "pioggia" && <div className="bg-white border rounded-2xl p-4 flex gap-3"><AlertTriangle />Modalità pioggia: esterno e marciapiede disattivati, dehor con tende chiuse.</div>}
        {settings.weather === "rischio" && <div className="bg-white border rounded-2xl p-4 flex gap-3"><ShieldAlert />Rischio pioggia: esterno/dehor penalizzati in base al rischio accettato.</div>}

        <div className="grid xl:grid-cols-[350px_1fr_390px] gap-5">
          <Card className="rounded-2xl">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-xl font-bold">Inserisci prenotazione</h2>
              <input className="w-full border rounded-xl p-3" placeholder="Nome cliente" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="w-full border rounded-xl p-3" placeholder="Telefono" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <div className="grid grid-cols-2 gap-2"><input className="border rounded-xl p-3" type="time" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} /><input className="border rounded-xl p-3" type="number" min="1" value={form.adults} onChange={(e) => setForm({ ...form, adults: Number(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-2"><input className="border rounded-xl p-3" type="number" min="0" placeholder="Bambini" value={form.children} onChange={(e) => setForm({ ...form, children: Number(e.target.value) })} /><input className="border rounded-xl p-3" type="number" min="0" placeholder="Seggioloni" value={form.highchairs} onChange={(e) => setForm({ ...form, highchairs: Number(e.target.value) })} /></div>
              <div className="grid grid-cols-2 gap-2"><select className="border rounded-xl p-3" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as Category })}><option value="normale">Normale</option><option value="affezionato">Affezionato</option><option value="molto_importante">Molto importante</option></select><select className="border rounded-xl p-3" value={form.areaPreference} onChange={(e) => setForm({ ...form, areaPreference: e.target.value as any })}><option value="nessuna">Nessuna pref.</option><option value="sala">Sala</option><option value="saletta">Saletta</option><option value="dehor">Dehor</option><option value="esterno">Esterno</option></select></div>
              <select className="border rounded-xl p-3 w-full" value={form.consumption} onChange={(e) => setForm({ ...form, consumption: e.target.value as Consumption })}><option value="non_so">Consumo non so</option><option value="pinsa">Pinsa</option><option value="cucina">Cucina</option><option value="misto">Misto</option></select>
              <textarea className="border rounded-xl p-3 w-full" placeholder="Note" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <Button className="w-full rounded-2xl" disabled={!suggestions[0]} onClick={() => add()}><CheckCircle2 className="w-4 h-4 mr-2" />Conferma migliore opzione</Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardContent className="p-4">
              <div className="flex justify-between mb-4 gap-3 flex-col md:flex-row"><div><h2 className="text-xl font-bold">Mappa tavoli</h2><p className="text-sm text-gray-500">Area selezionata: {area}</p></div><div className="flex gap-2 flex-wrap">{AREAS.map((a) => <Button key={a} variant={area === a ? "default" : "outline"} className="rounded-xl" onClick={() => setArea(a)}>{a}</Button>)}</div></div>
              {area === "esterno" ? <div className="border rounded-2xl p-4 bg-white"><b>Esterno modulabile</b><p className="text-sm text-gray-600 mt-1">30 posti adulti componibili liberamente. Con bambini può superare 30, ma richiede controllo manuale.</p></div> : <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">{tables.filter((t) => t.area === area).map((t) => <div key={t.id} className={`border rounded-2xl p-3 min-h-[100px] ${disabled(t) ? "opacity-40 bg-gray-100" : occupied.get(t.id) ? "bg-gray-900 text-white" : "bg-white"}`}><div className="flex justify-between"><b>{t.label}</b><span className="text-xs">{t.standard}/{t.max}</span></div><div className="text-xs mt-2 opacity-75">{occupied.get(t.id) ? `${occupied.get(t.id).name} · pronto ${occupied.get(t.id).resetEnd}` : t.notes}</div></div>)}</div>}
            </CardContent>
          </Card>

          <div className="space-y-5">
            <Card className="rounded-2xl"><CardContent className="p-4 space-y-3"><h2 className="text-xl font-bold flex gap-2"><Search />Suggerimenti</h2>{suggestions.map((s) => <div className="border rounded-2xl p-3 bg-white" key={s.id}><div className="flex justify-between gap-2"><div><b>{s.label}</b><div className="text-xs text-gray-500">{s.area} · {s.standard}/{s.max} · score {Math.round(s.score)}</div><div className="text-xs text-gray-500">{s.turn} · fine {s.estimatedEnd} · pronto {s.resetEnd}</div></div><Button size="sm" variant="outline" onClick={() => add(s)}>Scegli</Button></div><p className="text-xs text-gray-600 mt-2">{s.notes}</p>{s.passaggio && <div className="text-xs mt-2 font-medium">{s.passaggio}</div>}<div className="flex flex-wrap gap-1 mt-2">{s.warnings.map((w) => <span className="text-[11px] bg-gray-100 rounded-full px-2 py-1" key={w}>{w}</span>)}</div></div>)}</CardContent></Card>
            <Card className="rounded-2xl"><CardContent className="p-4"><h2 className="text-xl font-bold">Arrivi</h2><p className="text-sm text-gray-500">Da arrivare: {notArrived.length} · In sala: {arrived.length}</p></CardContent></Card>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-5">
          <ReservationList title="Primo turno" data={firstTurn} updateStatus={updateStatus} removeReservation={removeReservation} />
          <ReservationList title="Secondo turno" data={secondTurn} updateStatus={updateStatus} removeReservation={removeReservation} />
        </div>
        <ReservationList title="Tutte le prenotazioni del giorno" data={enriched} updateStatus={updateStatus} removeReservation={removeReservation} />
      </div>
    </div>
  );
}

function ReservationList({ title, data, updateStatus, removeReservation }: { title: string; data: any[]; updateStatus: (id: number, status: Status) => void; removeReservation: (id: number) => void }) {
  return (
    <Card className="rounded-2xl">
      <CardContent className="p-4">
        <h2 className="text-xl font-bold flex gap-2 mb-3"><Utensils />{title}</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <tbody>
              {data.length === 0 && <tr><td className="py-3 text-gray-500">Nessuna prenotazione</td></tr>}
              {data.map((r) => <tr key={r.id} className="border-b align-top"><td className="py-2 font-medium">{r.time}</td><td>{r.name}<div className="text-xs text-gray-500">{r.phone}</div></td><td>{r.adults}{r.children ? ` + ${r.children} b.` : ""}{r.highchairs ? ` + ${r.highchairs} seg.` : ""}</td><td>{r.table}<div className="text-xs text-gray-500">{r.estimatedEnd}/{r.resetEnd}</div></td><td>{r.status}</td><td className="space-x-1 whitespace-nowrap"><Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "arrivato")}>Arrivato</Button><Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "seduto")}>Seduto</Button><Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "liberato")}>Liberato</Button><Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "no_show")}>No-show</Button><Button size="sm" variant="outline" onClick={() => removeReservation(r.id)}><Trash2 className="w-4 h-4" /></Button></td></tr>)}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
