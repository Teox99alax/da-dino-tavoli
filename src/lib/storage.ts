import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("data");

  if (error) {
    console.error("Errore loadReservations:", error);
    return [];
  }

  return data.map((r: any) => r.data);
}

export async function saveReservations(reservations: any[]) {
  const { error: deleteError } = await supabase
    .from("reservations")
    .delete()
    .neq("id", 0);

  if (deleteError) {
    console.error("Errore delete:", deleteError);
    return;
  }

  const rows = reservations.map((r) => ({
    data: r,
  }));

  const { error } = await supabase
    .from("reservations")
    .insert(rows);

  if (error) {
    console.error("Errore saveReservations:", error);
  }
}
