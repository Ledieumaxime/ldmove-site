import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ClipboardList, Calendar } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";

type Intake = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  age: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  injuries: string | null;
  days_per_week: string | null;
  session_length: string | null;
  sport_background: string | null;
  consistency: string | null;
  current_training: string[] | null;
  sessions_per_week: string | null;
  max_pull_ups: string | null;
  max_dips: string | null;
  max_push_ups: string | null;
  deep_squat: string | null;
  handstand: string | null;
  muscle_up: string | null;
  planche: string | null;
  front_lever: string | null;
  lsit_vsit: string | null;
  hspu: string | null;
  hamstrings: string | null;
  splits: string[] | null;
  shoulder_mobility: string | null;
  squat_flat_heels: string | null;
  backbend: string | null;
  main_goal: string | null;
  specific_skills: string[] | null;
  timeframe: string | null;
  additional_info: string | null;
  submitted_at: string;
  updated_at: string;
};

type Client = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
};

const AdminClientIntake = () => {
  const { id } = useParams<{ id: string }>();
  const [intake, setIntake] = useState<Intake | null>(null);
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const [c, i] = await Promise.all([
          sbGet<Client[]>(
            `profiles?id=eq.${id}&select=id,email,first_name,last_name&limit=1`
          ),
          sbGet<Intake[]>(`client_intakes?client_id=eq.${id}&select=*&limit=1`),
        ]);
        setClient(c[0] ?? null);
        setIntake(i[0] ?? null);
      } catch (e) {
        setError(String(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  if (loading) return <div className="text-muted-foreground">Loading…</div>;
  if (error)
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
        {error}
      </div>
    );

  if (!client) {
    return (
      <div className="space-y-4">
        <Link
          to="/app/admin/clients"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft size={14} /> Back to clients
        </Link>
        <div className="bg-white rounded-2xl border border-border p-8 text-center">
          <p className="text-muted-foreground">Client not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/app/admin/clients"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} /> Back to clients
      </Link>

      <div>
        <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-1">
          Intake form
        </p>
        <h1 className="font-heading text-3xl md:text-4xl font-bold">
          {client.first_name} {client.last_name}
        </h1>
        <p className="text-sm text-muted-foreground">{client.email}</p>
      </div>

      {!intake ? (
        <div className="bg-white rounded-2xl border border-border p-8 text-center space-y-3">
          <div className="w-12 h-12 mx-auto rounded-full bg-muted flex items-center justify-center">
            <ClipboardList className="text-muted-foreground" size={22} />
          </div>
          <p className="font-body text-muted-foreground">
            This client hasn't filled their intake form yet.
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar size={12} />
            Submitted{" "}
            {new Date(intake.submitted_at).toLocaleDateString("en-US", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
            {intake.updated_at !== intake.submitted_at && (
              <span>
                {" "}· updated{" "}
                {new Date(intake.updated_at).toLocaleDateString("en-US", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>

          <Section title="Basic info">
            <Row label="Full name" value={`${intake.first_name ?? ""} ${intake.last_name ?? ""}`} />
            <Row label="Age" value={intake.age != null ? `${intake.age} yrs` : null} />
            <Row label="Weight" value={intake.weight_kg != null ? `${intake.weight_kg} kg` : null} />
            <Row label="Height" value={intake.height_cm != null ? `${intake.height_cm} cm` : null} />
            <Row label="Injuries" value={intake.injuries} />
            <Row label="Days per week available" value={intake.days_per_week} />
            <Row label="Session length" value={intake.session_length} />
            <Row label="Sport background" value={intake.sport_background} />
          </Section>

          <Section title="Training history">
            <Row label="Consistency" value={intake.consistency} />
            <Row label="Current training" value={intake.current_training?.join(", ")} />
            <Row label="Sessions per week now" value={intake.sessions_per_week} />
          </Section>

          <Section title="Base strength">
            <Row label="Max pull-ups" value={intake.max_pull_ups} />
            <Row label="Max dips" value={intake.max_dips} />
            <Row label="Max push-ups" value={intake.max_push_ups} />
            <Row label="Deep squat capability" value={intake.deep_squat} />
          </Section>

          <Section title="Skills level">
            <Row label="Handstand" value={intake.handstand} />
            <Row label="Muscle up" value={intake.muscle_up} />
            <Row label="Planche" value={intake.planche} />
            <Row label="Front lever" value={intake.front_lever} />
            <Row label="L-sit / V-sit" value={intake.lsit_vsit} />
            <Row label="HSPU" value={intake.hspu} />
          </Section>

          <Section title="Mobility">
            <Row label="Hamstrings flexibility" value={intake.hamstrings} />
            <Row label="Splits" value={intake.splits?.join(", ")} />
            <Row label="Shoulder mobility" value={intake.shoulder_mobility} />
            <Row label="Deep squat flat heels" value={intake.squat_flat_heels} />
            <Row label="Backbend flexibility" value={intake.backbend} />
          </Section>

          <Section title="Goals">
            <Row label="Main goal" value={intake.main_goal} />
            <Row label="Specific skills to learn" value={intake.specific_skills?.join(", ")} />
            <Row label="Timeframe for results" value={intake.timeframe} />
            <Row label="Additional information" value={intake.additional_info} />
          </Section>
        </>
      )}
    </div>
  );
};

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white rounded-2xl border border-border overflow-hidden">
    <h2 className="font-heading text-lg font-bold px-5 pt-4">{title}</h2>
    <dl className="divide-y divide-border">{children}</dl>
  </section>
);

const Row = ({ label, value }: { label: string; value: string | null | undefined }) => {
  const isEmpty = !value || value.trim() === "" || value.trim() === ",";
  return (
    <div className="grid sm:grid-cols-3 gap-2 px-5 py-3">
      <dt className="text-xs font-semibold text-muted-foreground uppercase tracking-wide sm:col-span-1">
        {label}
      </dt>
      <dd
        className={`sm:col-span-2 text-sm ${
          isEmpty ? "text-muted-foreground italic" : "text-foreground"
        }`}
      >
        {isEmpty ? "—" : value}
      </dd>
    </div>
  );
};

export default AdminClientIntake;
