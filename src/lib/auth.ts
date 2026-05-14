import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getCurrentUserRole() {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) return null;

  const email = session.user.email || "";

  if (email === "matteo@dadino.local") return "admin";

  if (email === "ale@dadino.local") return "telefonista";
  if (email === "dino@dadino.local") return "telefonista";

  if (email === "bruna@dadino.local") return "staff";
  if (email === "lexi@dadino.local") return "staff";

  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", session.user.id)
    .single();

  return data?.role || "staff";
}
