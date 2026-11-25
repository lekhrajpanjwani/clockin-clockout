import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "../../../components/ui/button";
import { Select } from "../../../components/ui/select";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface YearMonthPickerProps {
  year: number;
  /** `null` = whole year (only offered when `allowFullYear`). */
  month: number | null;
  onChange: (year: number, month: number | null) => void;
  allowFullYear?: boolean;
  /** Latest selectable year (defaults to the current one). */
  maxYear?: number;
}

export function YearMonthPicker({
  year,
  month,
  onChange,
  allowFullYear,
  maxYear = new Date().getFullYear(),
}: YearMonthPickerProps) {
  const years = Array.from({ length: 6 }, (_, i) => maxYear - i);

  const step = (delta: number) => {
    if (month === null) return onChange(year + delta, null);
    const index = year * 12 + (month - 1) + delta;
    onChange(Math.floor(index / 12), (index % 12) + 1);
  };

  const atMax =
    month === null ? year >= maxYear : year * 12 + month >= maxYear * 12 + new Date().getMonth() + 1;

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="icon" aria-label="Previous period" onClick={() => step(-1)}>
        <ChevronLeft />
      </Button>
      <Select
        aria-label="Month"
        value={month ?? "all"}
        onChange={(e) => onChange(year, e.target.value === "all" ? null : Number(e.target.value))}
        className="w-28"
      >
        {allowFullYear && <option value="all">Full year</option>}
        {MONTHS.map((label, i) => (
          <option key={label} value={i + 1}>
            {label}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Year"
        value={year}
        onChange={(e) => onChange(Number(e.target.value), month)}
        className="w-24"
      >
        {years.map((y) => (
          <option key={y} value={y}>
            {y}
          </option>
        ))}
      </Select>
      <Button variant="outline" size="icon" aria-label="Next period" onClick={() => step(1)} disabled={atMax}>
        <ChevronRight />
      </Button>
    </div>
  );
}
