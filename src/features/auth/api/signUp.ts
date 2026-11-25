import { getSupabaseClient } from "../../../services/supabaseClient";

export async function signUp(email: string, password: string) {
  const { data, error } = await getSupabaseClient().auth.signUp({ email, password });
  if (error) throw error;
  return data;
}
