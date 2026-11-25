import { getSupabaseClient } from "../../../services/supabaseClient";

export async function signOut(): Promise<void> {
  const { error } = await getSupabaseClient().auth.signOut();
  if (error) throw error;
}
