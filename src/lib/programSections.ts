// Shared color coding for program sections so the full-program view and
// the daily workout view stay visually consistent. Warmups are blue,
// everything else is the accent red.

export type SectionStyle = {
  badge: string;
  border: string;
  groupBox: string;
  groupBadge: string;
  groupBullet: string;
  /** Outlined pill for the group's sets / rounds and rest, so the
   *  prescription reads as loudly as the group name itself. */
  groupMeta: string;
  /** Filled strip that opens every block, single exercise or group. */
  strip: string;
  /** The white pill sitting on the strip, carrying sets + rest. */
  stripPill: string;
  /** Block container border, matching the strip. */
  blockBorder: string;
};

/** A circuit loops through its exercises, so its repetitions are
 *  "rounds". A superset or a drop set is one set of the whole chain,
 *  so they are "sets". The group's kind is carried by its group_name
 *  (see the program editor), which is why this reads the label. */
export function isCircuitGroup(groupName: string | null | undefined): boolean {
  return /circuit/i.test(groupName ?? "");
}

/** "3 rounds" for a circuit, "3 sets" for a superset / drop set. */
export function groupSetsLabel(
  groupName: string | null | undefined,
  count: number
): string {
  const unit = isCircuitGroup(groupName) ? "round" : "set";
  return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** The group's kind on its own, without the number: the position in
 *  the session is now carried by the block's numbered pill, so the
 *  badge only needs to say what the group is. "Superset 2" -> "Superset". */
export function groupTypeLabel(groupName: string | null | undefined): string {
  const raw = (groupName ?? "").trim();
  if (!raw) return "";
  if (/drop/i.test(raw)) return "Drop set";
  if (/circuit/i.test(raw)) return "Circuit";
  if (/superset/i.test(raw)) return "Superset";
  // Unknown label (hand-typed group): keep it as the coach wrote it,
  // minus any trailing number.
  return raw.replace(/\s*\d+\s*$/, "");
}

/** "90s rest between rounds" / "90s rest between sets". */
export function groupRestLabel(
  groupName: string | null | undefined,
  seconds: number
): string {
  return `${seconds}s rest between ${
    isCircuitGroup(groupName) ? "rounds" : "sets"
  }`;
}

export function sectionStyle(section: string): SectionStyle {
  const isWarmup = section.toUpperCase().includes("WARM");
  if (isWarmup) {
    return {
      badge: "bg-sky-100 text-sky-800",
      border: "border-2 !border-sky-500",
      groupBox: "border-2 border-sky-500 bg-sky-50/60",
      groupBadge: "bg-sky-200 text-sky-900",
      groupBullet: "bg-sky-500",
      groupMeta: "border-2 border-sky-500 bg-white text-sky-900",
      strip: "bg-sky-500",
      stripPill: "bg-white text-sky-900",
      blockBorder: "border-sky-500",
    };
  }
  return {
    badge: "bg-red-100 text-red-800",
    border: "border-2 !border-red-500",
    groupBox: "border-2 border-red-500 bg-red-50/60",
    groupBadge: "bg-red-200 text-red-900",
    groupBullet: "bg-red-500",
    groupMeta: "border-2 border-red-500 bg-white text-red-900",
    strip: "bg-red-500",
    stripPill: "bg-white text-red-900",
    blockBorder: "border-red-500",
  };
}

/** The block's whole prescription in one pill: "3 sets · 90s rest",
 *  "3 rounds · 45s rest". Kept as a single string on purpose: split
 *  into two badges it wrapped onto three lines on a 375px screen.
 *  Returns null when the coach prescribed neither. */
export function blockStatsLabel(
  groupName: string | null | undefined,
  sets: number | null | undefined,
  restSeconds: number | null | undefined
): string | null {
  const parts: string[] = [];
  if (sets != null) parts.push(groupSetsLabel(groupName, sets));
  if (restSeconds != null) parts.push(`${restSeconds}s rest`);
  return parts.length ? parts.join(" · ") : null;
}
