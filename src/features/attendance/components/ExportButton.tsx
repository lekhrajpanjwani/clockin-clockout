import { useState } from "react";
import { Download } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../../components/ui/button";
import { exportCsv } from "../api/exportCsv";

export function ExportButton({ year, month }: { year: number; month?: number | undefined }) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    setBusy(true);
    try {
      await exportCsv(year, month);
    } catch {
      toast.error("Could not export attendance. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button variant="outline" onClick={handleClick} disabled={busy}>
      <Download />
      {busy ? "Exporting…" : "Export CSV"}
    </Button>
  );
}
