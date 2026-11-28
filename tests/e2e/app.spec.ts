import { expect, test } from "@playwright/test";
import { completed, mockApi, signIn } from "./mockApi";
import { addDaysIso, localDateString } from "../../src/lib/shared/time/attendance";

const today = () => localDateString(new Date(), "Asia/Kolkata");

test.beforeEach(async ({ page }) => {
  await signIn(page);
});

test("clock in, then clock out from the dashboard", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await expect(page.getByText("Not clocked in")).toBeVisible();
  await page.getByRole("button", { name: "Clock In" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Clock Out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clock Out" }).click();
  await expect(page.getByText("Clocked out", { exact: true })).toBeVisible();
});

test("breaks and a second session on the same day", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Clock In" }).click();
  await page.getByRole("button", { name: "Start Break" }).click();
  await expect(page.getByText("On break", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "End Break" })).toBeVisible();

  await page.getByRole("button", { name: "End Break" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();
  await expect(page.getByText(/1 break ·/)).toBeVisible();

  await page.getByRole("button", { name: "Clock Out" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Clock Out" }).click();
  await page.getByRole("button", { name: "Clock In again" }).click();
  await expect(page.getByText("Working", { exact: true })).toBeVisible();
  await expect(page.getByText("Session 2", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Timeline: 2 sessions today" })).toBeVisible();
});

test("monthly logs show daily rows, week totals and month total", async ({ page }) => {
  const t = today();
  const firstOfMonth = `${t.slice(0, 7)}-01`;
  await mockApi(page, [completed(firstOfMonth, 480)]);
  await page.goto("/monthly-logs");

  await expect(page.getByRole("heading", { name: "Monthly Logs" })).toBeVisible();
  await expect(page.getByText("Month total")).toBeVisible();
  await expect(page.getByText("Week total").first()).toBeVisible();
  await expect(page.getByRole("cell", { name: "8h 00m" }).first()).toBeVisible();
});

test("history filters by status and paginates", async ({ page }) => {
  const t = today();
  const seed = Array.from({ length: 25 }, (_, i) => completed(addDaysIso(t, -(i + 1)), 400 + i));
  await mockApi(page, seed);
  await page.goto("/history");

  await expect(page.getByText("1–20 of 25")).toBeVisible();
  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("21–25 of 25")).toBeVisible();
  await expect(page).toHaveURL(/page=2/);

  await page.getByLabel("Status").selectOption("working");
  await expect(page.getByText("No records match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByText("1–20 of 25")).toBeVisible();

  await page.getByLabel("Date").fill("July");
  await expect(page.getByText("Use a date prefix like")).toBeVisible();
});

test("reports show summary, chart and heatmap", async ({ page }) => {
  const t = today();
  await mockApi(page, [completed(addDaysIso(t, -1), 540), completed(addDaysIso(t, -2), 300)]);
  await page.goto("/reports");

  await expect(page.getByText("Working days", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Worked hours per period" })).toBeVisible();
  await expect(page.getByRole("grid", { name: /Attendance heatmap/ })).toBeVisible();

  await page.getByLabel("Month").selectOption("all");
  await expect(page.getByText("Hours per month")).toBeVisible();
});

test("auto-closed days are flagged for review", async ({ page }) => {
  const t = today();
  const flagged = { ...completed(addDaysIso(t, -1), 899), autoClosed: true, needsReview: true };
  await mockApi(page, [flagged, completed(addDaysIso(t, -2), 480)]);
  await page.goto("/");

  await expect(page.getByText("1 day was left open and auto-closed at 23:59.")).toBeVisible();
  await page.getByRole("link", { name: "Review" }).click();

  await expect(page).toHaveURL(/needsReview=true/);
  await expect(page.getByText("1–1 of 1")).toBeVisible();
  await expect(page.getByText("Needs review", { exact: true }).last()).toBeVisible();
});

test("correct an auto-closed day, then see it in the change history", async ({ page }) => {
  const t = today();
  const day = addDaysIso(t, -1);
  const flagged = { ...completed(day, 899), autoClosed: true, needsReview: true };
  await mockApi(page, [flagged]);
  await page.goto("/history?needsReview=true");

  await page.getByRole("button", { name: `Correct ${day}` }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByText("auto-closed at 23:59")).toBeVisible();
  await expect(dialog.getByLabel("Clock out")).toHaveValue("23:59");

  await dialog.getByLabel("Clock out").fill("18:10");
  await dialog.getByRole("button", { name: "Add break" }).click();
  await dialog.getByLabel("Break 1 start").fill("13:00");
  await dialog.getByLabel("Break 1 end").fill("13:30");
  await expect(dialog.getByText("Worked 8h 40m")).toBeVisible();

  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog.getByText("Please give a reason")).toBeVisible();
  await dialog.getByLabel("Reason (required)").fill("Forgot to clock out, left at 6:10 PM");
  await dialog.getByRole("button", { name: "Save correction" }).click();
  await expect(dialog).toBeHidden();

  await expect(page.getByText("No records match these filters.")).toBeVisible();
  await page.getByRole("button", { name: "Clear" }).click();
  await expect(page.getByRole("cell", { name: "8h 40m" })).toBeVisible();

  await page.getByRole("button", { name: `Change history for ${day}` }).click();
  await expect(page.getByRole("dialog").getByText("Corrected")).toBeVisible();
  await expect(page.getByRole("dialog").getByText("“Forgot to clock out, left at 6:10 PM”")).toBeVisible();
});

test("the correction editor shows validation problems before saving", async ({ page }) => {
  const day = addDaysIso(today(), -2);
  await mockApi(page, [completed(day, 480)]);
  await page.goto("/history");
  await page.getByRole("button", { name: `Correct ${day}` }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Add session" }).click();
  await dialog.getByLabel("Clock in").nth(1).fill("12:00");
  await dialog.getByLabel("Clock out").nth(1).fill("14:00");
  await expect(dialog.getByText("Sessions overlap each other.")).toBeVisible();
});

test("mark today as leave from the dashboard, then cancel it", async ({ page }) => {
  await mockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: "Mark leave" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Mark leave" }).click();
  await expect(dialog.getByText("Please give a reason")).toBeVisible();
  await dialog.getByLabel("Reason").fill("Family function");
  await dialog.getByRole("button", { name: "Mark leave" }).click();

  await expect(page.getByText("On leave", { exact: true })).toBeVisible();
  await expect(page.getByText("Family function")).toBeVisible();
  await expect(page.getByRole("button", { name: "Clock In" })).toHaveCount(0);

  await page.getByRole("button", { name: /Cancel leave on/ }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Cancel leave" }).click();
  await expect(page.getByText("Not clocked in")).toBeVisible();
});

test("plan a future leave day and find it in History and Reports", async ({ page }) => {
  const tomorrow = addDaysIso(today(), 1);
  await mockApi(page);
  await page.goto("/monthly-logs");

  await page.getByRole("button", { name: "Mark leave" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Date").fill(tomorrow);
  await dialog.getByLabel("Reason").fill("Doctor's appointment");
  await dialog.getByRole("button", { name: "Mark leave" }).click();
  await expect(dialog).toBeHidden();

  await page.goto("/history?status=leave");
  await expect(page.getByText("Doctor's appointment")).toBeVisible();
  await expect(page.getByRole("button", { name: `Cancel leave on ${tomorrow}` })).toBeVisible();
});
