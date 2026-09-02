import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import {
  Lock,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Dumbbell,
} from "lucide-react";
import { sbGet, sbPost } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import ProgramItemCard from "@/components/ProgramItemCard";
import {
  blockStatsLabel,
  groupTypeLabel,
  blockAccent,
} from "@/lib/programSections";

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
  description?: string | null;
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
  // Sessions and their sections both start collapsed: a block is five
  // sessions of forty-odd exercises, so opened flat the page is a wall
  // you have to scroll past to reach the session you came for. Keyed by
  // id (and by `weekId:SECTION`) so two sessions never share a state.
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [openSections, setOpenSections] = useState<Set<string>>(new Set());

  const toggle = (set: Set<string>, key: string) => {
    const next = new Set(set);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  };

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
          const its = await sbGet<Array<Item & { exercise: { description: string | null } | null }>>(
            `program_items?select=*,exercise:exercises(description)&week_id=in.(${ids})&order=order_index.asc`
          );
          setItems(
            its.map(({ exercise, ...rest }) => ({
              ...rest,
              description: exercise?.description ?? null,
            }))
          );
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
      alert("Error: " + String(err));
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

  // Let the client upload a form-check video against any exercise of
  // their own active (non-archived) 1:1 program, from any session —
  // not just today's. This is the "I finished session 4 but want to
  // go back and add a video" case: the overview page is the natural
  // place to do it because it lists every session at once.
  const clientCanUploadFormCheck =
    !isCoach &&
    program.type === "custom" &&
    !program.is_archived &&
    program.assigned_client_id === profile?.id;

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
        {clientCanUploadFormCheck && (
          <p className="text-xs text-muted-foreground mt-3 bg-muted/40 border border-border rounded-lg px-3 py-2">
            Want to add a form-check video to an exercise you already did?
            Scroll to any session below and use the upload button on that
            exercise. You can do it any time, even after finishing the
            session.
          </p>
        )}
      </div>

      {/* Clients sometimes run their whole session from this overview
          page, where nothing gets logged, and their progress flatlines.
          Point them at the Today page before they scroll into the
          program. */}
      {clientCanUploadFormCheck && (
        <div className="bg-accent/10 border-2 border-accent/40 rounded-2xl p-4 flex items-start gap-3">
          <div className="w-9 h-9 rounded-full bg-accent text-white flex items-center justify-center shrink-0">
            <Dumbbell size={16} />
          </div>
          <div className="flex-1">
            <p className="font-heading font-bold text-sm">Training right now?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              This page is just the program overview: nothing you do here is
              tracked. Use the Today page to log your sets so every session
              counts toward your progress.
            </p>
            <Link
              to="/app/today"
              className="inline-flex items-center gap-1.5 mt-2.5 bg-accent text-white text-xs font-semibold rounded-full px-4 py-2 hover:opacity-95 transition"
            >
              Go to Today <ArrowRight size={12} />
            </Link>
          </div>
        </div>
      )}

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
              ? "Coach view. You see everything."
              : isArchived
              ? "Archived program, free access."
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

                const dayOpen = openDays.has(w.id);

                return (
                  <div key={w.id} className="bg-white border border-border rounded-2xl overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setOpenDays((s) => toggle(s, w.id))}
                      className="w-full bg-foreground text-background px-5 py-4 flex items-center gap-3 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-heading text-xl font-bold">
                          {w.title?.trim() ? w.title : `Day ${w.week_number}`}
                        </h3>
                        {w.notes && <p className="text-sm opacity-80 mt-1">{w.notes}</p>}
                      </div>
                      {/* Collapsed, the count is the only clue to what is
                          inside, so it has to survive the fold. */}
                      <span className="text-xs opacity-70 whitespace-nowrap">
                        {dayItems.length} exercise
                        {dayItems.length !== 1 ? "s" : ""}
                      </span>
                      {dayOpen ? (
                        <ChevronDown size={18} className="opacity-70 shrink-0" />
                      ) : (
                        <ChevronRight size={18} className="opacity-70 shrink-0" />
                      )}
                    </button>

                    {/* Tight horizontal padding below: the rows indent
                        themselves, and at p-5 the exercise names broke
                        across three lines on a phone. */}
                    {dayOpen && (
                      <div className="px-3 pt-4 pb-5 space-y-5">
                        {sections.map((sec, sIdx) => {
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
                          const secKey = `${w.id}:${sec.section}:${sIdx}`;
                          const secOpen = openSections.has(secKey);
                          const sectionAccent = blockAccent(sec.section, null);
                          return (
                            <div key={sIdx} className="mb-6">
                              {/* Same language as the session screen: a
                                  ruled heading in the section's colour,
                                  ticks instead of banners, rows instead
                                  of cards. Only the toggle is extra —
                                  this page shows a whole block, so the
                                  sections fold away. */}
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenSections((s) => toggle(s, secKey))
                                }
                                className="w-full flex items-baseline justify-between gap-2 pb-2 mb-5 border-b border-foreground/20"
                              >
                                <span
                                  className="font-heading text-[13px] font-semibold uppercase tracking-[0.18em]"
                                  style={{ color: sectionAccent.label }}
                                >
                                  {sec.section}
                                </span>
                                <span className="flex items-center gap-2 text-[12.5px] text-foreground/45">
                                  {sec.items.length} exercise
                                  {sec.items.length === 1 ? "" : "s"}
                                  {secOpen ? (
                                    <ChevronDown size={14} />
                                  ) : (
                                    <ChevronRight size={14} />
                                  )}
                                </span>
                              </button>
                              {secOpen && (
                                <div>
                                  {blocks.map((b, bIdx) => {
                                    const isGroup = b.type === "group";
                                    const groupName = isGroup ? b.name : null;
                                    const accent = blockAccent(
                                      sec.section,
                                      groupName
                                    );
                                    const groupSets = isGroup
                                      ? b.items.find((it) => it.sets != null)
                                          ?.sets ?? null
                                      : b.item.sets;
                                    const groupRest = isGroup
                                      ? [...b.items]
                                          .reverse()
                                          .find(
                                            (it) =>
                                              it.rest_seconds != null &&
                                              it.rest_seconds > 0
                                          )?.rest_seconds ?? null
                                      : b.item.rest_seconds;
                                    const stats = blockStatsLabel(
                                      groupName,
                                      groupSets,
                                      groupRest
                                    );
                                    const items = isGroup ? b.items : [b.item];
                                    return (
                                      // Same card as the workout screen:
                                      // the preview and the session a
                                      // client trains from have to look
                                      // like the same program.
                                      <div
                                        key={`b-${bIdx}`}
                                        className={`rounded-2xl border border-foreground/10 bg-white px-4 pt-4 pb-1 ${
                                          bIdx === 0 ? "" : "mt-4"
                                        }`}
                                        style={
                                          accent.chained
                                            ? {
                                                borderLeft: `3px solid ${accent.chain}`,
                                              }
                                            : undefined
                                        }
                                      >
                                        <div className="flex items-center gap-[9px] flex-wrap">
                                          <span
                                            className="font-heading text-[15px] font-bold shrink-0 tabular-nums"
                                            style={{ color: accent.label }}
                                          >
                                            {bIdx + 1}
                                          </span>
                                          <span
                                            aria-hidden
                                            className="w-px h-[13px] shrink-0"
                                            style={{ background: accent.tick }}
                                          />
                                          <span
                                            className="text-[11.5px] font-semibold uppercase tracking-[0.16em]"
                                            style={{ color: accent.label }}
                                          >
                                            {isGroup
                                              ? groupTypeLabel(groupName)
                                              : "Set"}
                                          </span>
                                          {stats && (
                                            <span className="text-[12.5px] text-foreground/45">
                                              {stats}
                                            </span>
                                          )}
                                        </div>
                                        {accent.note && (
                                          <p className="italic text-[13.5px] leading-[1.5] text-foreground/55 mt-2 pl-3">
                                            {accent.note}
                                          </p>
                                        )}
                                        <div className="mt-1">
                                          {items.map((it, i) => (
                                            <div
                                              key={it.id}
                                              className={`flex items-start gap-3 py-4 ${
                                                i < items.length - 1
                                                  ? "border-b border-foreground/10"
                                                  : ""
                                              }`}
                                            >
                                              {/* Numbered only inside a
                                                  chained block, where the
                                                  order is the instruction. */}
                                              {isGroup && (
                                                <span
                                                  className="font-heading text-[13px] font-semibold w-4 shrink-0 pt-1 tabular-nums"
                                                  style={{ color: accent.label }}
                                                >
                                                  {i + 1}
                                                </span>
                                              )}
                                              <div className="flex-1 min-w-0">
                                                <ProgramItemCard
                                                  item={it}
                                                  compact={isGroup}
                                                  inSuperset={isGroup}
                                                  canComment={
                                                    program.type === "custom"
                                                  }
                                                  commentsReadOnly={
                                                    program.is_archived
                                                  }
                                                  canUploadFormCheck={
                                                    clientCanUploadFormCheck
                                                  }
                                                  // Overview page: no interactive
                                                  // logger for the client. The coach
                                                  // keeps a read-only summary of what
                                                  // has been logged, so coaching
                                                  // decisions stay data-driven.
                                                  loggerClientId={
                                                    isCoach
                                                      ? program.assigned_client_id
                                                      : null
                                                  }
                                                  loggerReadOnly
                                                  setsOverride={
                                                    isGroup ? groupSets : undefined
                                                  }
                                                  flush
                                                  noPadding
                                                />
                                              </div>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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

export default ProgramDetail;
