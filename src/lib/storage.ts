import { supabase } from "./supabase";

export async function saveReservations(reservations: any[]) {
  await supabase
    .from("reservations")
    .delete()
    .neq("id", 0);

  if (!reservations.length) return;

  const rows = reservations.map((reservation) => ({
    data: reservation,
  }));

  const { error } = await supabase
    .from("reservations")
    .insert(rows);

  if (error) {
    console.error("saveReservations", error);
  }
}

export async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("id");

  if (error) {
    console.error("loadReservations", error);
    return [];
  }

  return data.map((row) => row.data);
}
