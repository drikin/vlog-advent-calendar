/**
 * 月管理の一元化 — デスブロカレンダーは1年間（2026年6月〜12月）継続するため、
 * 月をハードコードせずここから導出する。
 */

/** 企画対象の全月（YYYY-MM 形式、昇順） */
export const MONTHS: string[] = [
  "2026-06",
  "2026-07",
  "2026-08",
  "2026-09",
  "2026-10",
  "2026-11",
  "2026-12",
];

/** 現在の月（YYYY-MM）。デフォルト表示や「未来月ロック」判定に使用 */
export function currentMonth(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

/** YYYY-MM → 表示ラベル "2026.07" */
export function monthLabel(month: string): string {
  const [y, m] = month.split("-");
  return `${y}.${m}`;
}

/** YYYY-MM → テーマ/URL用キー "july"（"07" → "july" のように先頭0除去し小文字月名） */
const MONTH_NAMES = ["", "january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export function monthKey(month: string): string {
  const m = parseInt(month.split("-")[1], 10);
  return MONTH_NAMES[m] || "july";
}

/** 月キー "7" → YYYY-MM "2026-07"（年は固定で2026企画） */
export function keyToMonth(key: string): string {
  const m = String(parseInt(key, 10)).padStart(2, "0");
  return `2026-${m}`;
}

/** その月の日数（うるう年考慮） */
export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  // 月の翌月1日の0日目 = その月の末日
  return new Date(y, m, 0).getDate();
}

/** その月が企画対象か（MONTHS に含まれるか） */
export function isSupportedMonth(month: string): boolean {
  return MONTHS.includes(month);
}

/** デフォルト表示月（現在の月が範囲内ならそれ、そうでなければ最初の月） */
export function defaultMonth(): string {
  const cur = currentMonth();
  if (isSupportedMonth(cur)) return cur;
  return MONTHS[0];
}

/** 今日の日付（JST, YYYY-MM-DD）— Intl でタイムゾーンを明示的に指定 */
export function todayJstDate(): string {
  const fmt = new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = fmt.formatToParts(new Date());
  const y = parts.find((p) => p.type === "year")?.value ?? "2026";
  const m = parts.find((p) => p.type === "month")?.value ?? "01";
  const d = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${y}-${m}-${d}`;
}
