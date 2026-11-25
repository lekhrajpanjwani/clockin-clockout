import { API_BASE } from "../../../constants/api";
import { useAuthStore } from "../../auth/store/authStore";
import { ApiError } from "../../../services/httpClient";

/** Downloads the CSV export. Can't be a plain <a href> because the endpoint
 * needs the Bearer token, so it's fetched as a Blob and saved via an object URL. */
export async function exportCsv(year: number, month?: number): Promise<void> {
  const token = useAuthStore.getState().session?.access_token;
  const params = new URLSearchParams({ year: String(year) });
  if (month) params.set("month", String(month));

  const res = await fetch(`${API_BASE}/attendance/export?${params.toString()}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new ApiError("EXPORT_FAILED", "Could not export attendance.", res.status);

  const blob = await res.blob();
  const filename = month
    ? `attendance-${year}-${String(month).padStart(2, "0")}.csv`
    : `attendance-${year}.csv`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
