// Shared color coding for program sections so the full-program view and
// the daily workout view stay visually consistent. Warmups are blue,
// everything else is the accent red.

export type SectionStyle = {
  badge: string;
  border: string;
  groupBox: string;
  groupBadge: string;
  groupBullet: string;
};

export function sectionStyle(section: string): SectionStyle {
  const isWarmup = section.toUpperCase().includes("WARM");
  if (isWarmup) {
    return {
      badge: "bg-sky-100 text-sky-800",
      border: "border-2 !border-sky-500",
      groupBox: "border-2 border-sky-500 bg-sky-50/60",
      groupBadge: "bg-sky-200 text-sky-900",
      groupBullet: "bg-sky-500",
    };
  }
  return {
    badge: "bg-red-100 text-red-800",
    border: "border-2 !border-red-500",
    groupBox: "border-2 border-red-500 bg-red-50/60",
    groupBadge: "bg-red-200 text-red-900",
    groupBullet: "bg-red-500",
  };
}
