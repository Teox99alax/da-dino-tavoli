import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("data");

  if (error) {
    alert("ERRORE LOAD: " + error.message);
    return [];
  }

  return data?.map((r: any) => r.data) || [];
}

export async function saveReservations(reservations: any[]) {
  alert("STO SALVANDO " + reservations.length + " prenotazioni");

  const { data, error } = await supabase
    .from("reservations")
    .insert(
      reservations.map((r) => ({
        data: r,
      }))
    )
    .select();

  if (error) {
    alert("ERRORE SAVE: " + error.message);
    console.error("Errore saveReservations:", error);
    return;
  }

  alert("SALVATO SU SUPABASE: " + JSON.stringify(data));
}
