import { FormEvent, useEffect, useState } from "react";
import { CheckCircle2, Send, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { sbGet, sbPost, sbPatch } from "@/integrations/supabase/api";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

type Intake = {
  client_id: string;
  first_name: string | null;
  last_name: string | null;
  gender: string | null;
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
  rope_climb: string | null;
  hamstrings: string | null;
  splits: string[] | null;
  shoulder_mobility: string | null;
  squat_flat_heels: string | null;
  backbend: string | null;
  main_goal: string | null;
  specific_skills: string[] | null;
  timeframe: string | null;
  additional_info: string | null;
};

const empty = (cid: string): Intake => ({
  client_id: cid,
  first_name: "",
  last_name: "",
  gender: "",
  age: null,
  weight_kg: null,
  height_cm: null,
  injuries: "",
  days_per_week: "",
  session_length: "",
  sport_background: "",
  consistency: "",
  current_training: [],
  sessions_per_week: "",
  max_pull_ups: "",
  max_dips: "",
  max_push_ups: "",
  deep_squat: "",
  handstand: "",
  muscle_up: "",
  planche: "",
  front_lever: "",
  lsit_vsit: "",
  hspu: "",
  rope_climb: "",
  hamstrings: "",
  splits: [],
  shoulder_mobility: "",
  squat_flat_heels: "",
  backbend: "",
  main_goal: "",
  specific_skills: [],
  timeframe: "",
  additional_info: "",
});

const OnboardingIntake = () => {
  const { user, profile } = useAuth();
  const [form, setForm] = useState<Intake | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [existing, setExisting] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const rows = await sbGet<Intake[]>(
          `client_intakes?client_id=eq.${user.id}&select=*&limit=1`
        );
        if (rows.length) {
          setForm(rows[0]);
          setExisting(true);
        } else {
          const blank = empty(user.id);
          if (profile?.first_name) blank.first_name = profile.first_name;
          if (profile?.last_name) blank.last_name = profile.last_name;
          setForm(blank);
        }
        setLoaded(true);
      } catch (e) {
        setErr(String(e));
      }
    })();
  }, [user, profile]);

  const update = <K extends keyof Intake>(key: K, value: Intake[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  };

  const toggle = (key: "current_training" | "splits" | "specific_skills", value: string) => {
    setForm((prev) => {
      if (!prev) return prev;
      const list = prev[key] ?? [];
      const next = list.includes(value)
        ? list.filter((v) => v !== value)
        : [...list, value];
      return { ...prev, [key]: next };
    });
  };

  const required = (v: string | null | undefined) => !!v && v.trim() !== "";

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setErr(null);

    // Basic validation — mirror the required fields from the Google Form
    const missing: string[] = [];
    if (!required(form.first_name)) missing.push("First name");
    if (!required(form.last_name)) missing.push("Last name");
    if (!required(form.gender)) missing.push("Gender");
    if (form.age == null || form.age <= 0) missing.push("Age");
    if (!required(form.days_per_week)) missing.push("Days per week");
    if (!required(form.session_length)) missing.push("Session length");
    if (!required(form.consistency)) missing.push("Training consistency");
    if (!(form.current_training?.length)) missing.push("Current type of training");
    if (!required(form.sessions_per_week)) missing.push("Sessions per week");
    if (!required(form.max_pull_ups)) missing.push("Max pull-ups");
    if (!required(form.max_dips)) missing.push("Max dips");
    if (!required(form.max_push_ups)) missing.push("Max push-ups");
    if (!required(form.deep_squat)) missing.push("Deep squat capability");
    if (!required(form.handstand)) missing.push("Handstand");
    if (!required(form.muscle_up)) missing.push("Muscle up");
    if (!required(form.planche)) missing.push("Planche");
    if (!required(form.front_lever)) missing.push("Front lever");
    if (!required(form.lsit_vsit)) missing.push("L-sit / V-sit");
    if (!required(form.hspu)) missing.push("HSPU");
    if (!required(form.rope_climb)) missing.push("Rope climb");
    if (!required(form.hamstrings)) missing.push("Hamstrings flexibility");
    if (!(form.splits?.length)) missing.push("Splits");
    if (!required(form.shoulder_mobility)) missing.push("Shoulder mobility");
    if (!required(form.squat_flat_heels)) missing.push("Deep squat with flat heels");
    if (!required(form.backbend)) missing.push("Backbend flexibility");
    if (!required(form.main_goal)) missing.push("Main goal");
    if (!required(form.timeframe)) missing.push("Timeframe for results");

    if (missing.length) {
      setErr(`Please fill in the required fields: ${missing.slice(0, 3).join(", ")}${missing.length > 3 ? "…" : ""}`);
      return;
    }

    setSending(true);
    try {
      const payload = { ...form };
      if (existing) {
        await sbPatch(`client_intakes?client_id=eq.${form.client_id}`, payload);
      } else {
        await sbPost("client_intakes", payload);
      }
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  };

  if (!loaded || !form) {
    return (
      <div className="flex items-center gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" /> Loading…
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-2xl mx-auto bg-white border border-border rounded-2xl p-8 text-center space-y-4">
        <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
          <CheckCircle2 className="text-green-600" size={36} />
        </div>
        <h1 className="font-heading text-3xl font-bold">Intake received</h1>
        <p className="font-body text-muted-foreground leading-relaxed">
          Thanks for filling this out. Next step is to film and upload your
          assessment videos — once Maxime has both, he'll build your first program.
        </p>
        <div className="pt-2 flex flex-wrap gap-2 justify-center">
          <Button asChild>
            <Link to="/app/onboarding/assessment">Upload my assessment videos</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link to="/app/home">Back to my space</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <p className="text-xs font-semibold text-accent uppercase tracking-widest mb-2">
        Onboarding · Step 1
      </p>
      <h1 className="font-heading text-3xl md:text-4xl font-bold mb-2">
        Your intake form
      </h1>
      <p className="font-body text-muted-foreground leading-relaxed mb-8">
        A few questions to understand where you are today. Take 5 minutes, be
        honest — this is what I'll use to design your first program.
      </p>

      {existing && (
        <div className="mb-6 bg-sky-50 border border-sky-200 text-sky-800 rounded-lg p-3 text-sm">
          You already sent this intake. Edit any answer and submit again to
          update.
        </div>
      )}

      <form onSubmit={onSubmit} className="space-y-10">
        {/* Section 1 */}
        <Section title="Basic info">
          <TwoCols>
            <Field label="First name" required>
              <Input
                value={form.first_name ?? ""}
                onChange={(e) => update("first_name", e.target.value)}
                maxLength={100}
              />
            </Field>
            <Field label="Last name" required>
              <Input
                value={form.last_name ?? ""}
                onChange={(e) => update("last_name", e.target.value)}
                maxLength={100}
              />
            </Field>
          </TwoCols>
          <RadioField
            label="Gender"
            required
            value={form.gender}
            onChange={(v) => update("gender", v)}
            options={["Male", "Female", "Other / prefer not to say"]}
          />
          <ThreeCols>
            <Field label="Age" required>
              <Input
                type="number"
                min={10}
                max={100}
                value={form.age ?? ""}
                onChange={(e) =>
                  update("age", e.target.value ? Number(e.target.value) : null)
                }
              />
            </Field>
            <Field label="Weight (kg)">
              <Input
                type="number"
                min={20}
                max={200}
                value={form.weight_kg ?? ""}
                onChange={(e) =>
                  update(
                    "weight_kg",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </Field>
            <Field label="Height (cm)">
              <Input
                type="number"
                min={100}
                max={230}
                value={form.height_cm ?? ""}
                onChange={(e) =>
                  update(
                    "height_cm",
                    e.target.value ? Number(e.target.value) : null
                  )
                }
              />
            </Field>
          </ThreeCols>
          <Field label="Current or past injuries">
            <Textarea
              rows={2}
              value={form.injuries ?? ""}
              onChange={(e) => update("injuries", e.target.value)}
              placeholder="Anything I should know — shoulder, back, knees…"
            />
          </Field>
          <RadioField
            label="How many days per week are you available to train?"
            required
            value={form.days_per_week}
            onChange={(v) => update("days_per_week", v)}
            options={["1 day", "2 days", "3 days", "4 days", "5 days", "6 days"]}
          />
          <RadioField
            label="How long can your sessions be?"
            required
            value={form.session_length}
            onChange={(v) => update("session_length", v)}
            options={["Less than 45 min", "45–60 min", "60–90 min", "90 min+"]}
          />
          <Field label="Sport background">
            <Textarea
              rows={2}
              value={form.sport_background ?? ""}
              onChange={(e) => update("sport_background", e.target.value)}
              placeholder="Past sports, disciplines you've practiced…"
            />
          </Field>
        </Section>

        {/* Section 2 */}
        <Section title="Training history">
          <RadioField
            label="How long have you been training consistently?"
            required
            value={form.consistency}
            onChange={(v) => update("consistency", v)}
            options={[
              "Beginner — less than 6 months",
              "6 months – 1 year",
              "1 – 3 years",
              "3 – 5 years",
              "5+ years",
            ]}
          />
          <CheckboxField
            label="Current type of training"
            required
            values={form.current_training ?? []}
            onToggle={(v) => toggle("current_training", v)}
            options={[
              "Gym / Weight training",
              "Calisthenics / Street workout",
              "Team sport",
              "Martial arts",
              "Yoga / Mobility",
              "Not training",
              "Other",
            ]}
          />
          <RadioField
            label="How many sessions per week are you doing right now?"
            required
            value={form.sessions_per_week}
            onChange={(v) => update("sessions_per_week", v)}
            options={["0", "1", "2", "3", "4", "5+"]}
          />
        </Section>

        {/* Section 3 */}
        <Section title="Base strength">
          <RadioField
            label="Max pull-ups"
            required
            value={form.max_pull_ups}
            onChange={(v) => update("max_pull_ups", v)}
            options={["0", "1 – 3", "4 – 6", "7 – 10", "11 – 15", "15+"]}
          />
          <RadioField
            label="Max dips"
            required
            value={form.max_dips}
            onChange={(v) => update("max_dips", v)}
            options={["0", "1 – 3", "4 – 6", "7 – 10", "10 – 15", "15+"]}
          />
          <RadioField
            label="Max push-ups"
            required
            value={form.max_push_ups}
            onChange={(v) => update("max_push_ups", v)}
            options={["0 – 5", "6 – 15", "16 – 30", "30+"]}
          />
          <RadioField
            label="Deep squat capability"
            required
            value={form.deep_squat}
            onChange={(v) => update("deep_squat", v)}
            options={["Yes easily", "With effort / compensation", "No, not yet"]}
          />
        </Section>

        {/* Section 4 */}
        <Section title="Skills level">
          <RadioField
            label="Handstand"
            required
            value={form.handstand}
            onChange={(v) => update("handstand", v)}
            options={[
              "Never tried",
              "Wall only",
              "Freestanding — a few seconds",
              "Freestanding — 5 to 15 seconds",
              "Freestanding — 15+ seconds",
            ]}
          />
          <RadioField
            label="Muscle up"
            required
            value={form.muscle_up}
            onChange={(v) => update("muscle_up", v)}
            options={[
              "Never / still learning",
              "Yes with momentum",
              "Yes strict (bar)",
              "Yes strict (rings)",
            ]}
          />
          <RadioField
            label="Planche"
            required
            value={form.planche}
            onChange={(v) => update("planche", v)}
            options={[
              "Never tried",
              "Planche lean only",
              "Tuck planche",
              "Straddle planche",
              "Full planche",
            ]}
          />
          <RadioField
            label="Front lever"
            required
            value={form.front_lever}
            onChange={(v) => update("front_lever", v)}
            options={["Never tried", "Tucked", "Straddle", "One leg extended", "Full"]}
          />
          <RadioField
            label="L-sit / V-sit"
            required
            value={form.lsit_vsit}
            onChange={(v) => update("lsit_vsit", v)}
            options={["None yet", "L-sit — few seconds", "L-sit — 10+ seconds", "V-sit"]}
          />
          <RadioField
            label="HSPU"
            required
            value={form.hspu}
            onChange={(v) => update("hspu", v)}
            options={[
              "Never tried",
              "Pike push-up",
              "1 – 3 strict reps",
              "5+ strict reps",
              "90° HSPU or rings",
            ]}
          />
          <RadioField
            label="Rope climb (arms only)"
            desc="Can you climb a rope using only your arms (no legs)?"
            required
            value={form.rope_climb}
            onChange={(v) => update("rope_climb", v)}
            options={[
              "Never tried",
              "With legs only",
              "Yes, arms only (short distance)",
              "Yes, arms only (5 m+)",
            ]}
          />
        </Section>

        {/* Section 5 */}
        <Section title="Mobility">
          <RadioField
            label="Pike stretch — standing toe touch"
            desc="Stand with legs straight, bend forward. How close are your hands to the floor?"
            required
            value={form.hamstrings}
            onChange={(v) => update("hamstrings", v)}
            options={[
              "Palms flat on the floor",
              "Fingertips touch the floor",
              "Below my knees but not the floor",
              "I can't reach my knees",
            ]}
          />
          <CheckboxField
            label="Splits"
            required
            values={form.splits ?? []}
            onToggle={(v) => toggle("splits", v)}
            options={[
              "None yet",
              "In progress",
              "Full splits",
              "Pancake — none yet",
              "Pancake — in progress",
              "Chest on floor",
            ]}
          />
          <RadioField
            label="Shoulder wall test — arms overhead"
            desc="Stand with your back flat against a wall. Raise both arms straight above your head and try to touch the wall — without arching your lower back."
            required
            value={form.shoulder_mobility}
            onChange={(v) => update("shoulder_mobility", v)}
            options={[
              "Both hands touch the wall easily",
              "Only one side touches / I need to arch to do it",
              "I can't touch the wall",
            ]}
          />
          <RadioField
            label="Deep squat with flat heels"
            required
            value={form.squat_flat_heels}
            onChange={(v) => update("squat_flat_heels", v)}
            options={["Yes easily", "With effort", "No"]}
          />
          <RadioField
            label="Backbend flexibility"
            required
            value={form.backbend}
            onChange={(v) => update("backbend", v)}
            options={["Never tried / stiff", "Bridge from floor", "Bridge from standing"]}
          />
        </Section>

        {/* Section 6 */}
        <Section title="Goals">
          <RadioField
            label="Main goal"
            required
            value={form.main_goal}
            onChange={(v) => update("main_goal", v)}
            options={[
              "Gymnastic skills",
              "Maximum strength",
              "Muscle mass",
              "Weight loss / recomposition",
              "Mobility",
              "Endurance",
              "Return to training",
            ]}
          />
          <CheckboxField
            label="Specific skills to learn"
            values={form.specific_skills ?? []}
            onToggle={(v) => toggle("specific_skills", v)}
            options={[
              "Freestanding handstand",
              "Muscle up",
              "Front lever",
              "Planche",
              "HSPU",
              "One arm pull-up",
              "Press to handstand",
              "Splits / Pancake",
              "Backbend / Bridge",
              "General strength",
            ]}
          />
          <RadioField
            label="Timeframe for results"
            required
            value={form.timeframe}
            onChange={(v) => update("timeframe", v)}
            options={[
              "Short term — less than 3 months",
              "Mid term — 3 to 6 months",
              "Long term — 6 months+",
            ]}
          />
          <Field label="Additional information">
            <Textarea
              rows={3}
              value={form.additional_info ?? ""}
              onChange={(e) => update("additional_info", e.target.value)}
              placeholder="Anything else you'd like me to know"
            />
          </Field>
        </Section>

        {err && (
          <div className="bg-red-50 border border-red-200 rounded p-3 text-sm text-red-700">
            {err}
          </div>
        )}

        <div className="pt-2">
          <Button type="submit" size="lg" disabled={sending} className="gap-2">
            <Send size={16} />
            {sending ? "Sending…" : existing ? "Update intake" : "Send my intake"}
          </Button>
        </div>
      </form>
    </div>
  );
};

// Layout helpers
const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="bg-white border border-border rounded-2xl p-5 md:p-6 space-y-5">
    <h2 className="font-heading text-xl font-bold">{title}</h2>
    {children}
  </section>
);

const TwoCols = ({ children }: { children: React.ReactNode }) => (
  <div className="grid sm:grid-cols-2 gap-4">{children}</div>
);
const ThreeCols = ({ children }: { children: React.ReactNode }) => (
  <div className="grid sm:grid-cols-3 gap-4">{children}</div>
);

const Field = ({
  label,
  desc,
  required,
  children,
}: {
  label: string;
  desc?: string;
  required?: boolean;
  children: React.ReactNode;
}) => (
  <div>
    <label className="font-body text-sm font-medium mb-1 block">
      {label}
      {required && <span className="text-destructive ml-1">*</span>}
    </label>
    {desc && (
      <p className="font-body text-xs text-muted-foreground mb-2 leading-relaxed">
        {desc}
      </p>
    )}
    {children}
  </div>
);

const RadioField = ({
  label,
  desc,
  required,
  value,
  onChange,
  options,
}: {
  label: string;
  desc?: string;
  required?: boolean;
  value: string | null;
  onChange: (v: string) => void;
  options: string[];
}) => (
  <Field label={label} desc={desc} required={required}>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = value === opt;
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onChange(opt)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              active
                ? "bg-accent text-white border-accent"
                : "bg-white border-border hover:border-accent/50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </Field>
);

const CheckboxField = ({
  label,
  required,
  values,
  onToggle,
  options,
}: {
  label: string;
  required?: boolean;
  values: string[];
  onToggle: (v: string) => void;
  options: string[];
}) => (
  <Field label={label} required={required}>
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const active = values.includes(opt);
        return (
          <button
            type="button"
            key={opt}
            onClick={() => onToggle(opt)}
            className={`text-sm px-3 py-1.5 rounded-full border transition-colors ${
              active
                ? "bg-accent text-white border-accent"
                : "bg-white border-border hover:border-accent/50"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  </Field>
);

export default OnboardingIntake;
