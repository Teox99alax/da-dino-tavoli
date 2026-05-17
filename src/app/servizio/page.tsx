"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/auth";
import { loadReservations, saveReservations } from "@/lib/storage";

type Status = "confermata" | "arrivato" | "seduto" | "in_uscita" | "pagato" | "liberato" | "no_show";
type Consumption = "pinsa" | "cucina" | "misto" | "non_so";
type Category = "normale" | "affezionato" | "molto_importante";
type TableFilter = "tutti" | "liberi" | "liberi_ora" | "occupati";
type AreaFilter = "TUTTE" | "SALA" | "SALETTA" | "DEHOR" | "MARCIAPIEDE" | "ESTERNO";
type MapTurn = "primo" | "secondo";

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

type MoveDestination = {
  id: string;
  label: string;
  area: BaseTable["area"];
  moduleIds: string[];
  capacity: number;
  tables: BaseTable[];
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

  ...Array.from({ length: 12 }, (_, i) => ({
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

function mapTurnOf(time: string): MapTurn {
  return toMin(time) >= toMin("21:00") ? "secondo" : "primo";
}

function tableNumberFromLabel(label: string) {
  return Number(label.split(" ")[0]) || 0;
}

function primaryNumberForReservation(r: Reservation, fallbackTable: BaseTable) {
  const area = fallbackTable.area.toLowerCase();
  const moduleNumbers = (r.moduleIds || [])
    .filter((moduleId) => moduleId.toLowerCase().includes(area))
    .map((moduleId) => {
      const match = moduleId.match(/-(\d+)/);
      return match ? Number(match[1]) : NaN;
    })
    .filter((n) => Number.isFinite(n));

  if (moduleNumbers.length > 0) return String(Math.min(...moduleNumbers));

  const labelMatch = (r.table || "").match(/(\d+)/);
  return labelMatch ? labelMatch[1] : fallbackTable.label.split(" ")[0];
}

function peopleCount(r: Reservation) {
  return Number(r.adults || 0) + Number(r.highchairs || 0);
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
  const [selectedTable, setSelectedTable] = useState<any | null>(null);
  const [mapTurn, setMapTurn] = useState<MapTurn>("primo");
  const [moveReservation, setMoveReservation] = useState<Reservation | null>(null);
  const [selectedMoveTables, setSelectedMoveTables] = useState<BaseTable[]>([]);
  const [passageMode, setPassageMode] = useState(false);
  const [selectedPassageTables, setSelectedPassageTables] = useState<BaseTable[]>([]);
  const [passagePeople, setPassagePeople] = useState(2);
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
    }, 3000);

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
      const allMatches = activeReservations
        .filter((r) => reservationUsesTable(r, table))
        .sort((a, b) => toMin(a.time) - toMin(b.time));

      const turnMatches = allMatches.filter((r) => mapTurnOf(r.time) === mapTurn);
      const secondTurnMatches = allMatches.filter((r) => mapTurnOf(r.time) === "secondo");
      const currentTurnOccupied = turnMatches.find((r) => isOccupiedStatus(r.status));
      const currentTurnBooked = turnMatches.find((r) => r.status === "confermata");
      const nextTurnBooked = mapTurn === "primo" ? secondTurnMatches.find((r) => r.status === "confermata" || isOccupiedStatus(r.status)) : undefined;

      let status: TableVisualStatus = "libero";
      if (currentTurnOccupied) status = "occupato";
      else if (currentTurnBooked || nextTurnBooked) status = "prenotato_dopo";

      const mainReservation = currentTurnOccupied || currentTurnBooked || nextTurnBooked || null;
      const mustTurn = mapTurn === "primo" && !!(currentTurnOccupied || currentTurnBooked) && !!nextTurnBooked;

      return {
        table,
        matches: turnMatches,
        allMatches,
        secondTurnMatches,
        occupied: currentTurnOccupied,
        booked: currentTurnBooked,
        nextTurnBooked,
        mainReservation,
        mustTurn,
        displayNumber: mainReservation ? primaryNumberForReservation(mainReservation, table) : table.label.split(" ")[0],
        status,
        capacity: getTableCapacity(table),
      };
    }).sort((a, b) => tableNumberFromLabel(a.table.label) - tableNumberFromLabel(b.table.label) || a.table.label.localeCompare(b.table.label));
  }, [activeReservations, now, mapTurn]);

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


  function makeMoveDestination(tables: BaseTable[]): MoveDestination | null {
    if (tables.length === 0) return null;

    const sorted = [...tables].sort((a, b) => {
      if (a.area !== b.area) return a.area.localeCompare(b.area);
      return tableNumberFromLabel(a.label) - tableNumberFromLabel(b.label);
    });

    const first = sorted[0];
    const moduleIds = Array.from(new Set(sorted.flatMap((table) => getBaseModuleIds(table))));

    return {
      id: sorted.map((table) => table.id).join("+"),
      label: `${first.label.split(" ")[0]} ${first.area.toLowerCase()}`,
      area: first.area,
      moduleIds,
      capacity: sorted.reduce((sum, table) => sum + getTableCapacity(table), 0),
      tables: sorted,
    };
  }

  function candidateDestinationsForPeople(totalPeople: number, forbiddenTableIds: string[] = []) {
    const byArea: Record<string, BaseTable[]> = {};

    BASE_TABLES
      .filter((table) => !forbiddenTableIds.includes(table.id))
      .forEach((table) => {
        const area = table.area;
        byArea[area] = byArea[area] || [];
        byArea[area].push(table);
      });

    const candidates: MoveDestination[] = [];

    Object.values(byArea).forEach((tables) => {
      const sorted = [...tables].sort((a, b) => tableNumberFromLabel(a.label) - tableNumberFromLabel(b.label));

      for (let start = 0; start < sorted.length; start++) {
        for (let size = 1; size <= 6 && start + size <= sorted.length; size++) {
          const group = sorted.slice(start, start + size);
          const destination = makeMoveDestination(group);
          if (!destination) continue;
          if (destination.capacity < totalPeople) continue;
          candidates.push(destination);
        }
      }
    });

    const unique = new Map<string, MoveDestination>();
    candidates.forEach((destination) => unique.set(destination.id, destination));

    return Array.from(unique.values()).sort((a, b) => {
      const capacityWasteA = a.capacity - totalPeople;
      const capacityWasteB = b.capacity - totalPeople;
      return capacityWasteA - capacityWasteB || a.tables.length - b.tables.length || a.label.localeCompare(b.label);
    });
  }

  function conflictsForModules(moduleIds: string[], target: Reservation) {
    const start = toMin(target.time);
    const end = getEstimatedReleaseMin(target);

    return activeReservations.filter((r) => {
      if (r.id === target.id) return false;
      if (!moduleIds.some((moduleId) => (r.moduleIds || []).includes(moduleId))) return false;
      return overlap(start, end, toMin(r.time), getEstimatedReleaseMin(r));
    });
  }

  function uniqueReservations(list: Reservation[]) {
    const map = new Map<number, Reservation>();
    list.forEach((r) => map.set(r.id, r));
    return Array.from(map.values());
  }

  function sourceDestinationForTarget(target: Reservation): MoveDestination | null {
    const usedTables = BASE_TABLES.filter((table) => reservationUsesTable(target, table));
    if (usedTables.length > 0) return makeMoveDestination(usedTables);

    const fallback = findCurrentBaseTable(target);
    return fallback ? makeMoveDestination([fallback]) : null;
  }

  function moveWarningDetails(target: Reservation, destination: MoveDestination, swapReservation: Reservation | null, sourceDestination: MoveDestination | null) {
    const warnings: string[] = [];

    if (!sourceDestination) {
      warnings.push(`Non riesco a riconoscere con precisione il tavolo attuale di ${target.name}. Lo spostamento va controllato manualmente.`);
    }

    const destinationAreas = Array.from(new Set(destination.tables.map((table) => table.area)));
    if (destinationAreas.length > 1) {
      warnings.push(`Hai selezionato tavoli di zone diverse (${destinationAreas.join(", ")}). Consiglio di usare tavoli della stessa zona per evitare confusione in sala.`);
    }

    if (destination.capacity < peopleCount(target)) {
      warnings.push(`${destination.label} ha capienza rapida ${destination.capacity} posti, ma ${target.name} è da ${peopleCount(target)} persone. Puoi forzare, ma controlla fisicamente la disposizione.`);
    }

    if (swapReservation && sourceDestination) {
      if (sourceDestination.capacity < peopleCount(swapReservation)) {
        warnings.push(`${swapReservation.name} è da ${peopleCount(swapReservation)} persone: ${sourceDestination.label} potrebbe essere stretto.`);
      }

      if (swapReservation.areaPreference && swapReservation.areaPreference !== "nessuna") {
        const requestedArea = String(swapReservation.areaPreference).toLowerCase();
        if (requestedArea === destination.area.toLowerCase() && sourceDestination.area !== destination.area) {
          warnings.push(`${swapReservation.name} aveva chiesto/preferito la zona ${destination.area.toLowerCase()}: spostarla a ${sourceDestination.label} potrebbe creare problemi all'arrivo.`);
        } else if (requestedArea !== sourceDestination.area.toLowerCase()) {
          warnings.push(`${swapReservation.name} aveva preferenza ${requestedArea}: ${sourceDestination.label} non rispetta questa preferenza.`);
        }
      }

      const note = (swapReservation.notes || "").toLowerCase();
      const sensitiveWords = ["specific", "richiesto", "chiesto", "tavolo", "posto", "fisso", "solito", "prefer", "vip", "importante"];
      if (sensitiveWords.some((word) => note.includes(word))) {
        warnings.push(`Nelle note di ${swapReservation.name} c'è una possibile richiesta specifica: "${swapReservation.notes}".`);
      }

      const swapStart = toMin(swapReservation.time);
      const swapEnd = getEstimatedReleaseMin(swapReservation);
      const sourceConflicts = activeReservations.filter((r) => {
        if (r.id === target.id || r.id === swapReservation.id) return false;
        if (!sourceDestination.moduleIds.some((moduleId) => (r.moduleIds || []).includes(moduleId))) return false;
        return overlap(swapStart, swapEnd, toMin(r.time), getEstimatedReleaseMin(r));
      });

      if (sourceConflicts.length > 0) {
        warnings.push(`${sourceDestination.label} non è pulito per ${swapReservation.name}: si sovrappone con ${sourceConflicts.map((r) => `${r.name} alle ${r.time}`).join(", ")}.`);
      }

      const secondTurnOnSource = activeReservations.find((r) => {
        if (r.id === target.id || r.id === swapReservation.id) return false;
        return mapTurnOf(r.time) === "secondo" && sourceDestination.moduleIds.some((moduleId) => (r.moduleIds || []).includes(moduleId));
      });

      if (secondTurnOnSource && mapTurnOf(swapReservation.time) === "primo") {
        warnings.push(`${sourceDestination.label} deve girare al secondo turno per ${secondTurnOnSource.name} alle ${secondTurnOnSource.time}: attenzione ai tempi di uscita.`);
      }
    }

    return warnings;
  }

  function alternativeMoveMessage(target: Reservation, forbiddenTableIds: string[]) {
    const totalPeople = peopleCount(target);
    const destinations = candidateDestinationsForPeople(totalPeople, forbiddenTableIds);

    const clean = destinations
      .map((destination) => ({ destination, conflicts: conflictsForModules(destination.moduleIds, target) }))
      .filter((entry) => uniqueReservations(entry.conflicts).length === 0);

    if (clean.length > 0) {
      const destination = clean[0].destination;
      return `Alternativa consigliata: puoi spostare ${target.name} a ${destination.label}, usando ${destination.tables.map((table) => table.label).join(" + ")}, senza scambiare nessuna prenotazione.`;
    }

    const sourceDestination = sourceDestinationForTarget(target);
    const safeSwap = destinations
      .map((destination) => ({ destination, conflicts: uniqueReservations(conflictsForModules(destination.moduleIds, target)) }))
      .find((entry) => {
        if (entry.conflicts.length !== 1) return false;
        const other = entry.conflicts[0];
        return !!sourceDestination && canMoveOtherReservationToOldTable(other, sourceDestination.tables[0], target) && !hasStrongPreference(other);
      });

    if (safeSwap) {
      return `Alternativa possibile: sposta ${target.name} a ${safeSwap.destination.label} facendo scambio con ${safeSwap.conflicts[0].name}, senza criticità evidenti.`;
    }

    return "Non ho trovato un'alternativa pulita automatica: serve decisione manuale del direttore di sala.";
  }

  function startManualMove(target: Reservation) {
    setMoveReservation(target);
    setSelectedMoveTables([]);
    setPassageMode(false);
    setSelectedPassageTables([]);
    setSelectedTable(null);
    setChangeRequestId(null);
    const targetTurn = mapTurnOf(target.time);
    setMapTurn(targetTurn);
    setTableFilter("tutti");
    setAreaFilter("TUTTE");
  }

  function toggleMoveTable(table: BaseTable) {
    setSelectedMoveTables((prev) => {
      if (prev.some((t) => t.id === table.id)) return prev.filter((t) => t.id !== table.id);
      return [...prev, table];
    });
  }

  function isMoveTableSelected(table: BaseTable) {
    return selectedMoveTables.some((t) => t.id === table.id);
  }

  async function performManualMoveMultiple() {
    if (!moveReservation) return;

    const destination = makeMoveDestination(selectedMoveTables);
    if (!destination) {
      alert("Seleziona uno o più tavoli dalla mappa prima di confermare lo spostamento.");
      return;
    }

    const target = moveReservation;
    const sourceDestination = sourceDestinationForTarget(target);

    if (sourceDestination && sourceDestination.id === destination.id) {
      alert(`${target.name} è già su ${destination.label}.`);
      setMoveReservation(null);
      setSelectedMoveTables([]);
      return;
    }

    const destinationConflicts = uniqueReservations(conflictsForModules(destination.moduleIds, target));

    if (destinationConflicts.length > 1) {
      alert(`Non posso fare lo scambio automatico: sui tavoli selezionati risultano più prenotazioni sovrapposte (${destinationConflicts.map((r) => r.name).join(", ")}). ${alternativeMoveMessage(target, [...selectedMoveTables.map((t) => t.id), ...(sourceDestination?.tables.map((t) => t.id) || [])])}`);
      return;
    }

    const swapReservation = destinationConflicts.length === 1 ? destinationConflicts[0] : null;
    const warnings = moveWarningDetails(target, destination, swapReservation, sourceDestination);

    if (warnings.length > 0) {
      const alternative = alternativeMoveMessage(target, [...selectedMoveTables.map((t) => t.id), ...(sourceDestination?.tables.map((t) => t.id) || [])]);
      const ok = window.confirm(
        `ATTENZIONE SPOSTAMENTO\n\n${warnings.join("\n\n")}\n\n${alternative}\n\nVuoi forzare comunque lo spostamento?`
      );
      if (!ok) return;
    }

    const updated = reservations.map((r) => {
      if (r.id === target.id) {
        return {
          ...r,
          table: destination.label,
          optionId: destination.id,
          moduleIds: destination.moduleIds,
          notes: `${r.notes || ""}${r.notes ? " · " : ""}Spostato manualmente da sala a ${destination.label}`,
        };
      }

      if (swapReservation && sourceDestination && r.id === swapReservation.id) {
        return {
          ...r,
          table: sourceDestination.label,
          optionId: sourceDestination.id,
          moduleIds: sourceDestination.moduleIds,
          notes: `${r.notes || ""}${r.notes ? " · " : ""}Spostato automaticamente per scambio con ${target.name}`,
        };
      }

      return r;
    });

    setReservations(updated);
    await saveReservations(updated);
    setMoveReservation(null);
    setSelectedMoveTables([]);
    setSelectedTable(null);
  }

  function startPassageSelection(initialTable?: BaseTable) {
    setPassageMode(true);
    setMoveReservation(null);
    setSelectedMoveTables([]);
    setSelectedTable(null);
    setTableFilter("tutti");
    setAreaFilter("TUTTE");
    setSelectedPassageTables(initialTable ? [initialTable] : []);
  }

  function togglePassageTable(table: BaseTable) {
    setSelectedPassageTables((prev) => {
      if (prev.some((t) => t.id === table.id)) return prev.filter((t) => t.id !== table.id);
      return [...prev, table];
    });
  }

  function isPassageTableSelected(table: BaseTable) {
    return selectedPassageTables.some((t) => t.id === table.id);
  }

  async function performPassageMultiple() {
    const people = Number(passagePeople || 0);
    if (!people || people < 1) {
      alert("Inserisci il numero di persone del passaggio.");
      return;
    }

    const destination = makeMoveDestination(selectedPassageTables);
    if (!destination) {
      alert("Seleziona uno o più tavoli dalla mappa per il passaggio.");
      return;
    }

    if (destination.capacity < people) {
      const ok = window.confirm(`${destination.label} ha capienza rapida ${destination.capacity} posti, ma il passaggio è da ${people} persone. Vuoi confermare comunque?`);
      if (!ok) return;
    }

    const time = currentTimeLabel();
    const tempTarget: Reservation = {
      id: Date.now(),
      date: selectedDate,
      name: "Passaggio",
      phone: "",
      time,
      adults: people,
      highchairs: 0,
      category: "normale",
      areaPreference: "nessuna",
      table: destination.label,
      optionId: destination.id,
      moduleIds: destination.moduleIds,
      status: "arrivato",
      consumption: "non_so",
      notes: "Inserito dalla modalità servizio",
      mode: "passaggio",
      seatedAt: Date.now(),
    };

    const conflicts = uniqueReservations(conflictsForModules(destination.moduleIds, tempTarget));
    if (conflicts.length > 0) {
      const ok = window.confirm(
        `Attenzione: sui tavoli selezionati risultano già prenotazioni/occupazioni sovrapposte: ${conflicts.map((r) => `${r.name} alle ${r.time}`).join(", ")}. Vuoi forzare comunque il passaggio?`
      );
      if (!ok) return;
    }

    const updated = [tempTarget, ...reservations];
    setReservations(updated);
    await saveReservations(updated);
    setPassageMode(false);
    setSelectedPassageTables([]);
    setPassagePeople(2);
    setSelectedTable(null);
  }

  function tableSelectionClass(table: BaseTable) {
    if (moveReservation && isMoveTableSelected(table)) return "ring-4 ring-blue-600 scale-95";
    if (passageMode && isPassageTableSelected(table)) return "ring-4 ring-green-700 scale-95";
    return "";
  }

  function handleTableClick(row: any) {
    if (moveReservation) {
      toggleMoveTable(row.table);
      return;
    }
    if (passageMode) {
      togglePassageTable(row.table);
      return;
    }
    setSelectedTable(row);
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
      r.id === id ? { ...r, status, seatedAt: status === "arrivato" ? Date.now() : r.seatedAt } : r
    );

    setReservations(updated);
    await saveReservations(updated);
  }

  async function occupyTableNow(table: BaseTable) {
    const value = window.prompt("Numero persone per il passaggio", "2");
    if (value === null) return;
    const people = Number(value);
    if (!people || people < 1) {
      alert("Numero persone non valido.");
      return;
    }

    const time = currentTimeLabel();
    const newReservation: Reservation = {
      id: Date.now(),
      date: selectedDate,
      name: "Passaggio",
      phone: "",
      time,
      adults: people,
      highchairs: 0,
      category: "normale",
      areaPreference: "nessuna",
      table: table.label,
      optionId: table.id,
      moduleIds: getBaseModuleIds(table),
      status: "arrivato",
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
                          onClick={() => updateStatus(r.id, "liberato")}
                          className="rounded-xl border bg-white px-5 py-3 font-semibold"
                        >
                          Liberato
                        </button>
                        <button
                          onClick={() => updateStatus(r.id, "no_show")}
                          className="rounded-xl border bg-white px-5 py-3 font-semibold text-red-700"
                        >
                          No-show
                        </button>
                        <button
                          onClick={() => startManualMove(r)}
                          className="rounded-xl bg-blue-700 text-white px-5 py-3 font-semibold"
                        >
                          Sposta manualmente
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
                              <button
                                onClick={() => startManualMove(r)}
                                className="rounded-xl bg-red-700 text-white px-4 py-2 font-semibold text-sm"
                              >
                                Forza spostamento
                              </button>
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
            <div className="flex flex-wrap gap-2 items-center">
              <div className="text-sm font-semibold text-green-800">
                {freeAllNightCount + freeNowCount} tavoli utilizzabili ora
              </div>
              <button
                onClick={() => startPassageSelection()}
                className="rounded-xl bg-green-700 text-white px-4 py-3 font-semibold"
              >
                Passaggio multiplo da mappa
              </button>
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

        <section className="bg-white border rounded-3xl p-4 overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-2xl font-bold">Mappa sala live</h2>
              <p className="text-sm text-gray-500">
                Verde libero · Giallo prenotato più tardi · Rosso arrivato · ↻ deve girare
              </p>
            </div>

            <div className="flex gap-2 flex-wrap text-sm font-bold">
              <button
                onClick={() => setMapTurn("primo")}
                className={`px-3 py-2 rounded-xl border ${mapTurn === "primo" ? "bg-black text-white" : "bg-white"}`}
              >
                1° turno
              </button>

              <button
                onClick={() => setMapTurn("secondo")}
                className={`px-3 py-2 rounded-xl border ${mapTurn === "secondo" ? "bg-black text-white" : "bg-white"}`}
              >
                2° turno
              </button>

              <button
                onClick={() => {
                  setTableFilter("tutti");
                  setAreaFilter("TUTTE");
                }}
                className={`px-3 py-2 rounded-xl border ${tableFilter === "tutti" && areaFilter === "TUTTE" ? "bg-black text-white" : "bg-white"}`}
              >
                Tutti
              </button>

              <button
                onClick={() => setTableFilter("liberi")}
                className={`px-3 py-2 rounded-xl border ${tableFilter === "liberi" ? "bg-green-700 text-white" : "bg-green-100 text-green-900"}`}
              >
                {freeAllNightCount} liberi
              </button>

              <button
                onClick={() => setTableFilter("liberi_ora")}
                className={`px-3 py-2 rounded-xl border ${tableFilter === "liberi_ora" ? "bg-yellow-500 text-white" : "bg-yellow-100 text-yellow-900"}`}
              >
                {freeAllNightCount + freeNowCount} liberi ora
              </button>

              <button
                onClick={() => setTableFilter("occupati")}
                className={`px-3 py-2 rounded-xl border ${tableFilter === "occupati" ? "bg-red-700 text-white" : "bg-red-100 text-red-900"}`}
              >
                {occupiedCount} occupati
              </button>

              <button onClick={() => window.print()} className="px-3 py-2 rounded-xl border bg-white">
                Stampa
              </button>
            </div>
          </div>

          {moveReservation && (
            <div className="mb-4 rounded-2xl border-2 border-blue-300 bg-blue-50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xl font-black text-blue-950">Spostamento manuale multiplo attivo</div>
                <div className="text-sm text-blue-900">
                  Tocca uno o più tavoli sulla mappa per {moveReservation.name} x{peopleCount(moveReservation)}. Poi premi Conferma spostamento.
                </div>
                {selectedMoveTables.length > 0 && (
                  <div className="text-sm font-bold text-blue-950 mt-1">
                    Selezionati: {selectedMoveTables.map((table) => table.label).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={performManualMoveMultiple}
                  className="rounded-xl bg-blue-700 text-white px-4 py-3 font-semibold"
                >
                  Conferma spostamento
                </button>
                <button
                  onClick={() => {
                    setMoveReservation(null);
                    setSelectedMoveTables([]);
                  }}
                  className="rounded-xl border bg-white px-4 py-3 font-semibold"
                >
                  Annulla spostamento
                </button>
              </div>
            </div>
          )}

          {passageMode && (
            <div className="mb-4 rounded-2xl border-2 border-green-300 bg-green-50 p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
              <div>
                <div className="text-xl font-black text-green-950">Passaggio multiplo attivo</div>
                <div className="text-sm text-green-900">
                  Inserisci persone, poi tocca uno o più tavoli sulla mappa e conferma.
                </div>
                {selectedPassageTables.length > 0 && (
                  <div className="text-sm font-bold text-green-950 mt-1">
                    Selezionati: {selectedPassageTables.map((table) => table.label).join(", ")}
                  </div>
                )}
              </div>
              <div className="flex gap-2 flex-wrap items-center">
                <label className="text-sm font-bold">
                  Persone
                  <input
                    type="number"
                    min={1}
                    className="ml-2 w-20 border rounded-xl px-3 py-2 bg-white"
                    value={passagePeople}
                    onChange={(e) => setPassagePeople(Number(e.target.value))}
                  />
                </label>
                <button
                  onClick={performPassageMultiple}
                  className="rounded-xl bg-green-700 text-white px-4 py-3 font-semibold"
                >
                  Conferma passaggio
                </button>
                <button
                  onClick={() => {
                    setPassageMode(false);
                    setSelectedPassageTables([]);
                    setPassagePeople(2);
                  }}
                  className="rounded-xl border bg-white px-4 py-3 font-semibold"
                >
                  Annulla
                </button>
              </div>
            </div>
          )}

          <div className="rounded-3xl bg-gray-50 border p-3 md:p-4 overflow-x-auto">
            <div className="min-w-[920px] grid grid-cols-12 gap-3">

              <div className="col-span-8 bg-yellow-50 border border-yellow-200 rounded-3xl p-3">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-black text-lg">ESTERNO</div>
                  <div className="text-xs text-gray-500 font-semibold">{mapTurn === "primo" ? "1° turno" : "2° turno"}</div>
                </div>

                <div className="grid grid-cols-6 gap-2">
                  {visibleTableRows
                    .filter((row) => row.table.area === "ESTERNO")
                    .slice()
                    .sort((a, b) => Number(a.table.label.split(" ")[0]) - Number(b.table.label.split(" ")[0]))
                    .map((row) => (
                      <button
                        key={row.table.id}
                        onClick={() => handleTableClick(row)}
                        className={`h-16 rounded-2xl border-2 transition active:scale-95 shadow-sm ${tableStatusClass(row.status)} ${tableSelectionClass(row.table)}`}
                      >
                        <div className="text-2xl font-black leading-none">
                          {row.displayNumber}{row.mustTurn ? " ↻" : ""}
                        </div>
                        {row.mainReservation ? (
                          <div className="text-[10px] font-black leading-tight mt-1 px-1 truncate">
                            {row.mainReservation.name} x{peopleCount(row.mainReservation)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold uppercase opacity-70">esterno</div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="col-span-4 bg-red-50 border border-red-200 rounded-3xl p-3">
                <div className="font-black text-lg mb-3">MARCIAPIEDE</div>

                <div className="grid grid-cols-5 gap-2">
                  {visibleTableRows
                    .filter((row) => row.table.area === "MARCIAPIEDE")
                    .slice()
                    .sort((a, b) => Number(a.table.label.split(" ")[0]) - Number(b.table.label.split(" ")[0]))
                    .map((row) => (
                      <button
                        key={row.table.id}
                        onClick={() => handleTableClick(row)}
                        className={`h-16 rounded-2xl border-2 transition active:scale-95 shadow-sm ${tableStatusClass(row.status)} ${tableSelectionClass(row.table)}`}
                      >
                        <div className="text-2xl font-black leading-none">
                          {row.displayNumber}{row.mustTurn ? " ↻" : ""}
                        </div>
                        {row.mainReservation ? (
                          <div className="text-[10px] font-black leading-tight mt-1 px-1 truncate">
                            {row.mainReservation.name} x{peopleCount(row.mainReservation)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold uppercase opacity-70">marciap.</div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="col-span-7 bg-gray-100 border border-gray-300 rounded-3xl p-3">
                <div className="font-black text-lg mb-3">DEHOR</div>

                <div className="grid grid-cols-5 gap-2">
                  {visibleTableRows
                    .filter((row) => row.table.area === "DEHOR")
                    .slice()
                    .sort((a, b) => Number(a.table.label.split(" ")[0]) - Number(b.table.label.split(" ")[0]))
                    .map((row) => (
                      <button
                        key={row.table.id}
                        onClick={() => handleTableClick(row)}
                        className={`h-16 rounded-2xl border-2 transition active:scale-95 shadow-sm ${tableStatusClass(row.status)} ${tableSelectionClass(row.table)}`}
                      >
                        <div className="text-2xl font-black leading-none">
                          {row.displayNumber}{row.mustTurn ? " ↻" : ""}
                        </div>
                        {row.mainReservation ? (
                          <div className="text-[10px] font-black leading-tight mt-1 px-1 truncate">
                            {row.mainReservation.name} x{peopleCount(row.mainReservation)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold uppercase opacity-70">dehor</div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="col-span-5 row-span-2 bg-blue-50 border border-blue-200 rounded-3xl p-3">
                <div className="font-black text-lg mb-3">SALETTA</div>

                <div className="grid grid-cols-2 gap-3">
                  {visibleTableRows
                    .filter((row) => row.table.area === "SALETTA")
                    .slice()
                    .sort((a, b) => Number(a.table.label.split(" ")[0]) - Number(b.table.label.split(" ")[0]))
                    .map((row) => (
                      <button
                        key={row.table.id}
                        onClick={() => handleTableClick(row)}
                        className={`h-20 rounded-2xl border-2 transition active:scale-95 shadow-sm ${tableStatusClass(row.status)} ${tableSelectionClass(row.table)}`}
                      >
                        <div className="text-3xl font-black leading-none">
                          {row.displayNumber}{row.mustTurn ? " ↻" : ""}
                        </div>
                        {row.mainReservation ? (
                          <div className="text-[10px] font-black leading-tight mt-1 px-1 truncate">
                            {row.mainReservation.name} x{peopleCount(row.mainReservation)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold uppercase opacity-70">saletta</div>
                        )}
                      </button>
                    ))}
                </div>
              </div>

              <div className="col-span-7 bg-green-50 border border-green-200 rounded-3xl p-3">
                <div className="font-black text-lg mb-3">SALA</div>

                <div className="grid grid-cols-3 gap-3">
                  {visibleTableRows
                    .filter((row) => row.table.area === "SALA")
                    .slice()
                    .sort((a, b) => Number(a.table.label.split(" ")[0]) - Number(b.table.label.split(" ")[0]))
                    .map((row) => (
                      <button
                        key={row.table.id}
                        onClick={() => handleTableClick(row)}
                        className={`h-20 rounded-2xl border-2 transition active:scale-95 shadow-sm ${tableStatusClass(row.status)} ${tableSelectionClass(row.table)}`}
                      >
                        <div className="text-3xl font-black leading-none">
                          {row.displayNumber}{row.mustTurn ? " ↻" : ""}
                        </div>
                        {row.mainReservation ? (
                          <div className="text-[10px] font-black leading-tight mt-1 px-1 truncate">
                            {row.mainReservation.name} x{peopleCount(row.mainReservation)}
                          </div>
                        ) : (
                          <div className="text-[10px] font-bold uppercase opacity-70">sala</div>
                        )}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {visibleTableRows.length === 0 && (
            <div className="text-gray-500 border rounded-xl p-4 bg-gray-50 mt-4">
              Nessun tavolo con questi filtri.
            </div>
          )}
        </section>

        {selectedTable && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-end md:items-center justify-center p-4">
            <div className="bg-white rounded-3xl w-full max-w-xl p-5 max-h-[90vh] overflow-auto shadow-2xl">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <div className="text-3xl font-black">Tavolo {selectedTable.displayNumber} · {selectedTable.table.area}</div>
                  <div className="text-sm text-gray-500 mt-1">
                    {selectedTable.capacity} posti · riferimento reale: {selectedTable.table.label}
                  </div>
                  <div className={`inline-block mt-3 px-3 py-2 rounded-xl text-sm font-bold ${tableStatusClass(selectedTable.status)}`}>
                    {selectedTable.status === "libero" && "LIBERO TUTTA LA SERA"}
                    {selectedTable.status === "prenotato_dopo" && "LIBERO ORA · PRENOTATO PIÙ TARDI"}
                    {selectedTable.status === "occupato" && "OCCUPATO"}
                  </div>
                </div>

                <button
                  onClick={() => setSelectedTable(null)}
                  className="border rounded-xl px-4 py-2 bg-white font-semibold"
                >
                  Chiudi
                </button>
              </div>

              <div className="space-y-3">
                {selectedTable.allMatches.length === 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-2xl p-4 font-semibold text-green-900">
                    Tavolo libero. Nessuna prenotazione su questo tavolo.
                  </div>
                )}

                {selectedTable.allMatches.map((r: Reservation) => {
                  const mins = toMin(r.time) - nowMin();

                  return (
                    <div key={r.id} className="border rounded-2xl p-4 bg-gray-50">
                      <div className="text-xl font-bold">
                        {r.name} x{r.adults} · {r.time}
                      </div>

                      <div className="text-sm mt-1 font-medium">
                        Stato: {r.status} · {turnOf(r.time)}
                        {r.highchairs ? ` · ${r.highchairs} seggiolone` : ""}
                      </div>

                      {r.phone && (
                        <div className="text-sm mt-1">
                          Tel: {r.phone}
                        </div>
                      )}

                      <div className="text-sm mt-1 text-gray-600">
                        {isOccupiedStatus(r.status)
                          ? `Libero stimato alle ${getEstimatedReleaseTime(r)}`
                          : minutesLabel(mins)}
                      </div>

                      {r.notes && <div className="text-sm mt-2">Note: {r.notes}</div>}

                      <div className="flex flex-wrap gap-2 mt-4">
                        <button
                          onClick={() => updateStatus(r.id, "arrivato")}
                          className="rounded-xl bg-black text-white px-4 py-3 font-semibold"
                        >
                          Arrivato
                        </button>

                        <button
                          onClick={() => updateStatus(r.id, "no_show")}
                          className="rounded-xl border bg-white px-4 py-3 font-semibold text-red-700"
                        >
                          No-show
                        </button>

                        <button
                          onClick={() => updateStatus(r.id, "liberato")}
                          className="rounded-xl border bg-white px-4 py-3 font-semibold"
                        >
                          Liberato
                        </button>

                        <button
                          onClick={() => startManualMove(r)}
                          className="rounded-xl bg-blue-700 text-white px-4 py-3 font-semibold"
                        >
                          Sposta tavolo
                        </button>
                      </div>
                    </div>
                  );
                })}

                {selectedTable.status !== "occupato" && (
                  <button
                    onClick={() => startPassageSelection(selectedTable.table)}
                    className="w-full rounded-2xl bg-black text-white py-4 font-bold text-lg"
                  >
                    Occupa ora · passaggio
                  </button>
                )}

                {selectedTable.status === "occupato" && (
                  <div className="text-xs font-medium opacity-70">
                    Tavolo occupato: per liberarlo usa il pulsante Liberato sulla prenotazione/passaggio.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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

                    <button
                      onClick={() => updateStatus(r.id, "no_show")}
                      className="rounded-xl border bg-white px-5 py-3 font-semibold text-red-700"
                    >
                      No-show
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
