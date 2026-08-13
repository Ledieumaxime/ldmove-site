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
    };
  }
  return {
    badge: "bg-red-100 text-red-800",
    border: "border-2 !border-red-500",
    groupBox: "border-2 border-red-500 bg-red-50/60",
    groupBadge: "bg-red-200 text-red-900",
    groupBullet: "bg-red-500",
    groupMeta: "border-2 border-red-500 bg-white text-red-900",
  };
}
