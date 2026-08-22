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

/**
 * The colour a block carries on the session screen.
 *
 * Replaces the full-width coloured banner with a 3px tick and, for the
 * chained kinds, a rule down the left of the group: the banner shouted
 * the block's type louder than the exercises inside it, and a client
 * reading a session needs the exercise names first.
 *
 * The palette is the brand's own warm family — taupe, charcoal, orange,
 * terracotta, gold — rather than the cyan and magenta of the design
 * reference, so the screen stays part of the same product as the
 * dashboard it opens from.
 *
 * `tick` and `chain` take the raw colour; `label` takes a darker step
 * wherever the raw one is too pale to read as small uppercase type on a
 * light ground.
 */
export type BlockAccent = {
  tick: string;
  label: string;
  chain: string;
  /** Whether the exercises hang off a rule. True for the kinds where the
   *  exercises are performed as one unit, which is exactly what the rule
   *  is drawing. */
  chained: boolean;
  /** The sentence that makes the kind mean something to a client. */
  note: string;
};

export function blockAccent(
  section: string,
  groupName: string | null | undefined
): BlockAccent {
  // The group's kind wins over the section. A superset inside the warmup
  // is still a superset, and it needs its rule and its sentence: the
  // section only decides the colour of a plain, ungrouped exercise.
  const raw = (groupName ?? "").trim();
  if (/circuit/i.test(raw)) {
    return {
      tick: "hsl(42 75% 50%)",
      label: "hsl(42 80% 30%)",
      chain: "hsl(42 75% 50%)",
      chained: true,
      note: "Run every exercise once, then rest and start the next round.",
    };
  }
  if (/drop/i.test(raw)) {
    return {
      tick: "hsl(14 62% 52%)",
      label: "hsl(14 65% 38%)",
      chain: "hsl(14 62% 52%)",
      chained: true,
      note: "Drop the load after each set, no rest in between.",
    };
  }
  if (raw) {
    return {
      tick: "hsl(28 85% 55%)",
      label: "hsl(28 85% 38%)",
      chain: "hsl(28 85% 55%)",
      chained: true,
      note: "Chain exercises with no rest, then rest after the last one.",
    };
  }
  if (section.toUpperCase().includes("WARM")) {
    return {
      tick: "hsl(33 30% 62%)",
      label: "hsl(30 25% 38%)",
      chain: "hsl(33 30% 62%)",
      chained: false,
      note: "",
    };
  }
  return {
    tick: "hsl(30 10% 45%)",
    label: "hsl(30 10% 30%)",
    chain: "hsl(30 10% 45%)",
    chained: false,
    note: "",
  };
}
