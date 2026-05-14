const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function loadReservations() {
  const res = await fetch(`${supabaseUrl}/rest/v1/reservations?select=data`, {
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
    },
  });

  if (!res.ok) {
    alert("ERRORE LOAD HTTP: " + res.status + " - " + (await res.text()));
    return [];
  }

  const data = await res.json();
  return data.map((r: any) => r.data);
}

export async function saveReservations(reservations: any[]) {
  alert("URL: " + supabaseUrl);
  alert("KEY: " + supabaseAnonKey.slice(0, 30));

  const rows = reservations.map((r) => ({ data: r }));

  const res = await fetch(`${supabaseUrl}/rest/v1/reservations`, {
    method: "POST",
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify(rows),
  });

  if (!res.ok) {
    alert("ERRORE SAVE HTTP: " + res.status + " - " + (await res.text()));
    return;
  }

  alert("SALVATO OK");
}
