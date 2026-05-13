import { supabase } from "./supabase";

export async function saveReservations(reservations: any[]) {
  const { error: deleteError } = await supabase
    .from("reservations")
    .delete()
    .gte("id", 0);

  if (deleteError) {
    console.error("Errore delete reservations:", deleteError);
    throw deleteError;
  }

  if (reservations.length === 0) return;

  const payload = reservations.map((r) => ({
    data: r,
  }));

  const { error: insertError } = await supabase
    .from("reservations")
    .insert(payload);

  if (insertError) {
    console.error("Errore insert reservations:", insertError);
    throw insertError;
  }
}

export async function loadReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Errore load reservations:", error);
    throw error;
  }

  return data?.map((d) => d.data) || [];
}
