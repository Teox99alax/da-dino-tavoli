import { supabase } from "./supabase";

export async function saveReservations(reservations: any[]) {
  await supabase.from("reservations").delete().neq("id", 0);

  const payload = reservations.map((r, index) => ({
    id: index + 1,
    data: r,
  }));

  await supabase.from("reservations").insert(payload);
}

export async function loadReservations() {
  const { data } = await supabase
    .from("reservations")
    .select("*")
    .order("id");

  return data?.map((d) => d.data) || [];
}
