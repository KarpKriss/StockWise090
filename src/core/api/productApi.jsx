import { supabase } from "./supabaseClient";
import { applySiteFilter, readActiveSiteId } from "../auth/siteScope";

export const getProducts = async () => {
  const { data, error } = await applySiteFilter(
    supabase.from("products").select("*"),
    readActiveSiteId()
  );

  if (error) {
    throw error;
  }

  return data;
};
