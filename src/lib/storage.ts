const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

async function supabaseRequest(path: string, options: RequestInit = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${supabaseAnonKey}`,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`${res.status} - ${text}`);
  }

  return res;
}

export async function loadReservations() {
  const res = await supabaseRequest("reservations?select=data&order=id.asc", {
    method: "GET",
  });

  const data = await res.json();
  return data.map((row: any) => row.data);
}

export async function saveReservations(reservations: any[]) {
  await supabaseRequest("reservations?id=neq.0", {
    method: "DELETE",
  });

  if (!reservations.length) return;

  await supabaseRequest("reservations", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(reservations.map((r) => ({ data: r }))),
  });
}

export async function loadCustomers() {
  const res = await supabaseRequest("customers?select=*&order=id.desc", {
    method: "GET",
  });

  return await res.json();
}

export async function saveCustomer(customer: any) {
  await supabaseRequest("customers", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(customer),
  });
}

export async function loadWaitlist() {
  const res = await supabaseRequest("waitlist?select=data&order=id.asc", {
    method: "GET",
  });

  const data = await res.json();
  return data.map((row: any) => row.data);
}

export async function saveWaitlist(waitlist: any[]) {
  await supabaseRequest("waitlist?id=neq.0", {
    method: "DELETE",
  });

  if (!waitlist.length) return;

  await supabaseRequest("waitlist", {
    method: "POST",
    headers: {
      Prefer: "return=minimal",
    },
    body: JSON.stringify(waitlist.map((w) => ({ data: w }))),
  });
}
