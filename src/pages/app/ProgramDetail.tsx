import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { Lock, ArrowLeft, CheckCircle2 } from "lucide-react";
import { sbGet, sbPost } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ExerciseComments from "@/components/ExerciseComments";
import FormCheckUpload from "@/components/FormCheckUpload";

type Program = {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  type: "catalogue" | "custom";
  price_eur: number;
  billing_type: "one_time" | "subscription";
  duration_weeks: number | null;
  assigned_client_id: string | null;
  is_archived: boolean;
};

type Week = {
  id: string;
  week_number: number;
  title: string | null;
  notes: string | null;
};

type Item = {
  id: string;
  week_id: string;
  order_index: number;
  custom_name: string | null;
  sets: number | null;
  reps: string | null;
  rest_seconds: number | null;
  notes: string | null;
  video_url: string | null;
  group_name: string | null;
};

type Enrollment = {
  id: string;
  program_id: string;
  status: "pending" | "paid" | "active" | "completed" | "canceled";
};

const ProgramDetail = () => {
  const { slug } = useParams();
  const { user, profile } = useAuth();
  const [program, setProgram] = useState<Program | null>(null);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unlocking, setUnlocking] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const programs = await sbGet<Program[]>(
          `programs?select=*&slug=eq.${slug}&limit=1`
        );
        if (programs.length === 0) {
          setError("Program not found.");
          setLoading(false);
          return;
        }
        const p = programs[0];
        setProgram(p);

        const [w, e] = await Promise.all([
          sbGet<Week[]>(
            `program_weeks?select=*&program_id=eq.${p.id}&order=week_number.asc`
          ),
          user
            ? sbGet<Enrollment[]>(
                `enrollments?select=*&program_id=eq.${p.id}&client_id=eq.${user.id}`
              )
            : Promise.resolve([]),
        ]);
        setWeeks(w);
        setEnrollment(e[0] ?? null);
        if (w.length > 0) {
          const ids = w.map((x) => x.id).join(",");
          const its = await sbGet<Item[]>(
            `program_items?select=*&week_id=in.(${ids})&order=order_index.asc`
          );
          setItems(its);
        }
      } catch (err) {
        setError(String(err));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [slug, user]);

  const handleUnlock = async () => {
    if (!program || !user) return;
    setUnlocking(true);
    try {
      const raw = localStorage.getItem("ldmove-session");
      const session = raw ? JSON.parse(raw) : null;
      const token = session?.access_token;
      if (!token) throw new Error("Not signed in");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-checkout-session`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ program_id: program.id }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Payment creation error");
      }
      // Redirect to Stripe Checkout
      window.location.href = data.url;
    } catch (err) {
      alert("Erreur : " + String(err));
      setUnlocking(false);
    }
  };

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );
  if (!program) return null;

  const isCoach = profile?.role === "coach";
  const isPaid =
    enrollment?.status === "paid" ||
    enrollment?.status === "active" ||
    enrollment?.status === "completed";
  const isArchived = program.is_archived;
  const isFree = Number(program.price_eur) <= 0;
  const canView = isCoach || isPaid || isArchived || isFree;

  return (
    <div className="space-y-6 max-w-3xl">
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={16} /> Back to dashboard
      </Link>

      <div>
        <p className="text-xs uppercase tracking-wider text-accent font-semibold mb-2">
          {program.type === "catalogue" ? "Catalogue" : "1:1 Program"}
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold mb-3">
          {program.title}
        </h1>
        {program.description && (
          <p className="text-muted-foreground">{program.description}</p>
        )}
        {program.duration_weeks && (
          <p className="text-sm text-muted-foreground mt-3">
            Duration: {program.duration_weeks} weeks
          </p>
        )}
      </div>

      {!canView && (
        <div className="bg-white border-2 border-accent/30 rounded-2xl p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
            <Lock className="text-accent" size={20} />
          </div>
          <h2 className="font-heading text-xl font-bold mb-1">Locked</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Unlock this program to access the weeks and exercises.
          </p>
          <p className="font-heading text-3xl font-bold mb-4">
            {program.price_eur}€
            {program.billing_type === "subscription" && (
              <span className="text-base text-muted-foreground"> /month</span>
            )}
          </p>
          <Button onClick={handleUnlock} disabled={unlocking} className="w-full md:w-auto">
            {unlocking ? "Redirecting to Stripe…" : "Unlock"}
          </Button>
          <p className="text-xs text-muted-foreground mt-3">
            Secure payment via Stripe. Instant access after unlock.
          </p>
        </div>
      )}

      {canView && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <CheckCircle2 size={16} />
            {isCoach
              ? "Coach view — you see everything."
              : isArchived
              ? "Archived program — free access."
              : "Access unlocked."}
          </div>
          {weeks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No days published yet.</p>
          ) : (
            <div className="space-y-6">
              {weeks.map((w) => {
                const dayItems = items
                  .filter((i) => i.week_id === w.id)
                  .sort((a, b) => a.order_index - b.order_index);

                // Group items by section (extracted from [SECTION] prefix in custom_name)
                type SectionGroup = { section: string; items: Item[] };
                const sections: SectionGroup[] = [];
                for (const it of dayItems) {
                  const match = it.custom_name?.match(/^\[([^\]]+)\]\s*(.*)$/);
                  const section = match ? match[1].trim().toUpperCase() : "EXERCISES";
                  const last = sections[sections.length - 1];
                  if (last && last.section === section) {
                    last.items.push(it);
                  } else {
                    sections.push({ section, items: [it] });
                  }
                }

                return (
                  <div key={w.id} className="bg-white border border-border rounded-2xl overflow-hidden">
                    <div className="bg-foreground text-background px-5 py-4">
                      <h3 className="font-heading text-xl font-bold">
                        {w.title?.trim() ? w.title : `Day ${w.week_number}`}
                      </h3>
                      {w.notes && <p className="text-sm opacity-80 mt-1">{w.notes}</p>}
                    </div>

                    <div className="p-5 space-y-5">
                      {sections.map((sec, sIdx) => {
                        const style = sectionStyle(sec.section);
                        // Build blocks (solo / group) for this section
                        type Block =
                          | { type: "solo"; item: Item }
                          | { type: "group"; name: string; items: Item[] };
                        const blocks: Block[] = [];
                        for (const it of sec.items) {
                          if (it.group_name) {
                            const last = blocks[blocks.length - 1];
                            if (last && last.type === "group" && last.name === it.group_name) {
                              last.items.push(it);
                            } else {
                              blocks.push({ type: "group", name: it.group_name, items: [it] });
                            }
                          } else {
                            blocks.push({ type: "solo", item: it });
                          }
                        }
                        return (
                          <div key={sIdx}>
                            <div
                              className={`inline-block text-sm md:text-base font-bold uppercase tracking-widest px-4 py-2 rounded-lg mb-4 shadow-sm ${style.badge}`}
                            >
                              {sec.section}
                            </div>
                            <div className="space-y-2.5">
                              {blocks.map((b, bIdx) =>
                                b.type === "solo" ? (
                                  <ItemCard
                                    key={b.item.id}
                                    item={b.item}
                                    canComment={!isCoach}
                                    accent={style.border}
                                  />
                                ) : (
                                  (() => {
                                    // Aggregate sets and rest for the superset group
                                    const groupSets = b.items.find((it) => it.sets != null)?.sets ?? null;
                                    const groupRest =
                                      [...b.items].reverse().find((it) => it.rest_seconds != null && it.rest_seconds > 0)?.rest_seconds ?? null;
                                    return (
                                      <div
                                        key={`g-${bIdx}`}
                                        className={`rounded-xl p-3 ${style.groupBox}`}
                                      >
                                        <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                                          <span className={`text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded ${style.groupBadge}`}>
                                            🔗 {b.name}
                                          </span>
                                          <div className="flex items-center gap-3 text-xs font-semibold">
                                            {groupSets != null && (
                                              <span className="text-foreground">{groupSets} rounds</span>
                                            )}
                                            {groupRest != null && (
                                              <span className="text-muted-foreground">
                                                ⏱ {groupRest}s rest between rounds
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                        <p className="text-[11px] text-muted-foreground italic mb-2">
                                          Chain exercises with no rest, then rest after the last one.
                                        </p>
                                        <div className="space-y-2">
                                          {b.items.map((it, i) => (
                                            <div key={it.id} className="relative pl-7">
                                              <span className={`absolute left-0 top-2 w-5 h-5 rounded-full text-white text-[10px] font-bold flex items-center justify-center ${style.groupBullet}`}>
                                                {i + 1}
                                              </span>
                                              <ItemCard
                                                item={it}
                                                compact
                                                canComment={!isCoach}
                                                inSuperset
                                              />
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })()
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Color code per section type — blue (warmup) or red (everything else)
function sectionStyle(section: string): {
  badge: string;
  border: string;
  groupBox: string;
  groupBadge: string;
  groupBullet: string;
} {
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

// Parse a notes string like "Tempo: 3s | Load: 20 kg | Keep back straight"
// into { tempo, load, comment }
function parseNotes(notes: string | null) {
  if (!notes) return { tempo: null, load: null, comment: null };
  const parts = notes.split("|").map((p) => p.trim());
  let tempo: string | null = null;
  let load: string | null = null;
  const others: string[] = [];
  for (const p of parts) {
    const t = p.match(/^Tempo:\s*(.+)$/i);
    const l = p.match(/^Load:\s*(.+)$/i);
    if (t) tempo = t[1];
    else if (l) load = l[1];
    else if (p) others.push(p);
  }
  return { tempo, load, comment: others.join(" · ") || null };
}

// Strip [SECTION] prefix from exercise name
function stripSection(name: string | null) {
  if (!name) return "Exercise";
  return name.replace(/^\[[^\]]+\]\s*/, "");
}

// Reps as-is (the "Rep" label is enough context)
function formatReps(reps: string | null) {
  if (!reps) return null;
  const trimmed = reps.trim();
  return trimmed || null;
}

const ItemCard = ({
  item,
  compact = false,
  canComment = true,
  accent = "",
  inSuperset = false,
}: {
  item: Item;
  compact?: boolean;
  canComment?: boolean;
  accent?: string;
  inSuperset?: boolean;
}) => {
  const { tempo, load, comment } = parseNotes(item.notes);
  const displayName = stripSection(item.custom_name);
  const hasLoad = !!load && load.trim() !== "" && load.trim() !== "-";
  const formattedReps = formatReps(item.reps);

  return (
    <div
      className={`bg-white border border-border rounded-lg ${compact ? "p-3" : "p-4"} hover:shadow-sm transition-shadow ${accent}`}
    >
      {/* Title + video button */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <h4 className={`font-semibold ${compact ? "text-sm" : "text-base"} leading-snug`}>
          {displayName}
        </h4>
        {item.video_url && (
          <a
            href={item.video_url}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-accent text-white rounded-full px-2.5 py-1 hover:bg-accent/90"
          >
            ▶ Video
          </a>
        )}
      </div>

      {/* Stacked "Key => Value" rows */}
      {(() => {
        const rows: Array<[string, string]> = [];
        // In a superset, sets + rest are shown at the group level
        if (!inSuperset && item.sets != null) rows.push(["Set", String(item.sets)]);
        if (formattedReps) rows.push(["Rep", formattedReps]);
        if (hasLoad) rows.push(["Load", load!]);
        if (!inSuperset && item.rest_seconds != null) rows.push(["Rest", `${item.rest_seconds}s`]);
        if (tempo) rows.push(["Tempo", tempo]);
        if (rows.length === 0) return null;
        return (
          <div className="text-sm space-y-0.5 mt-1">
            {rows.map(([k, v]) => (
              <div key={k} className="flex gap-2 items-baseline">
                <span className="font-semibold w-12 text-muted-foreground">{k}</span>
                <span className="text-accent">→</span>
                <span className="font-semibold text-foreground">{v}</span>
              </div>
            ))}
          </div>
        );
      })()}

      {/* Coach comment */}
      {comment && (
        <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap leading-relaxed">
          {comment}
        </p>
      )}

      {canComment && <FormCheckUpload itemId={item.id} />}
      {canComment && <ExerciseComments itemId={item.id} />}
    </div>
  );
};

export default ProgramDetail;
