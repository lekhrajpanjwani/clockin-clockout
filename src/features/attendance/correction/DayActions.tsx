import { useState } from "react";
import { History, Pencil, Plus, Umbrella } from "lucide-react";
import { Button } from "../../../components/ui/button";
import type { AttendanceRecord } from "../../../lib/shared/types/attendance";
import { addDaysIso } from "../../../lib/shared/time/attendance";
import { CORRECTION_WINDOW_DAYS } from "../../../lib/shared/aggregate/day";
import { CorrectionDialog } from "./CorrectionDialog";
import { AuditDialog } from "./AuditDialog";
import { LeaveDialog } from "../leave/LeaveDialog";
import { CancelLeaveButton } from "../leave/CancelLeaveButton";

interface DayActionsProps {
  date: string;
  record: AttendanceRecord | null;
  todayIso: string;
}

/** Row actions: Correct / Add (within the correction window), Mark leave
 * (today and future days without attendance), Cancel leave, Change history. */
export function DayActions({ date, record, todayIso }: DayActionsProps) {
  const [editing, setEditing] = useState(false);
  const [auditing, setAuditing] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const inWindow = date <= todayIso && date >= addDaysIso(todayIso, -CORRECTION_WINDOW_DAYS);
  const active = record?.status === "working" || record?.status === "on_break";
  const canEdit = inWindow && !active && record?.status !== "leave";
  const editTitle = !inWindow
    ? `Only the last ${CORRECTION_WINDOW_DAYS} days can be corrected`
    : active
      ? "Clock out first"
      : record?.status === "leave"
        ? "Leave day"
        : undefined;

  const isLeave = record?.status === "leave";
  const canMarkLeave = !record && date >= todayIso && date <= addDaysIso(todayIso, 365);
  const canCancelLeave = isLeave && date >= addDaysIso(todayIso, -CORRECTION_WINDOW_DAYS);

  if (!record && !inWindow && !canMarkLeave) return null;

  return (
    <div className="flex items-center justify-end gap-1">
      {(record || inWindow) && !isLeave && (
        <Button
          variant={record?.needsReview ? "outline" : "ghost"}
          size="sm"
          onClick={() => setEditing(true)}
          disabled={!canEdit}
          title={editTitle}
          aria-label={`${record ? "Correct" : "Add attendance for"} ${date}`}
        >
          {record ? <Pencil /> : <Plus />}
          <span className="hidden sm:inline">{record ? "Correct" : "Add"}</span>
        </Button>
      )}
      {canMarkLeave && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLeaving(true)}
          aria-label={`Mark leave on ${date}`}
          title="Mark leave"
        >
          <Umbrella />
          <span className="hidden sm:inline">Leave</span>
        </Button>
      )}
      {canCancelLeave && <CancelLeaveButton date={date} variant="ghost" size="sm" compact />}
      {record && (
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setAuditing(true)}
          aria-label={`Change history for ${date}`}
          title="Change history"
        >
          <History />
        </Button>
      )}
      {editing && <CorrectionDialog date={date} open={editing} onOpenChange={setEditing} />}
      {auditing && <AuditDialog date={date} open={auditing} onOpenChange={setAuditing} />}
      {leaving && <LeaveDialog date={date} open={leaving} onOpenChange={setLeaving} />}
    </div>
  );
}
