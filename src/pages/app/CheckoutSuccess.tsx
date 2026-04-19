import { useEffect, useState } from "react";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { CheckCircle2, Loader2 } from "lucide-react";
import { sbGet } from "@/integrations/supabase/api";
import { Button } from "@/components/ui/button";

type Enrollment = {
  id: string;
  status: "pending" | "paid" | "active" | "completed" | "canceled";
  program_id: string;
};

type Program = { id: string; slug: string; title: string };

const CheckoutSuccess = () => {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const enrollmentId = params.get("enrollment");
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [status, setStatus] = useState<"polling" | "success" | "timeout">("polling");

  useEffect(() => {
    if (!enrollmentId) return;
    let attempts = 0;
    let timer: number | undefined;

    const poll = async () => {
      attempts++;
      try {
        const rows = await sbGet<Enrollment[]>(
          `enrollments?select=*&id=eq.${enrollmentId}&limit=1`
        );
        const e = rows[0] ?? null;
        setEnrollment(e);
        if (e && (e.status === "paid" || e.status === "active")) {
          const progRows = await sbGet<Program[]>(
            `programs?select=id,slug,title&id=eq.${e.program_id}&limit=1`
          );
          setProgram(progRows[0] ?? null);
          setStatus("success");
          return;
        }
      } catch (err) {
        console.error(err);
      }
      if (attempts >= 15) {
        setStatus("timeout");
        return;
      }
      timer = window.setTimeout(poll, 2000);
    };

    poll();
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [enrollmentId]);

  return (
    <div className="max-w-md mx-auto text-center py-10 space-y-6">
      {status === "polling" && (
        <>
          <Loader2 className="animate-spin mx-auto text-accent" size={40} />
          <h1 className="font-heading text-2xl font-bold">Validating payment…</h1>
          <p className="text-sm text-muted-foreground">
            Hold tight while Stripe confirms your payment. This only takes a few seconds.
          </p>
        </>
      )}

      {status === "success" && program && (
        <>
          <div className="w-16 h-16 mx-auto rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="text-green-600" size={36} />
          </div>
          <h1 className="font-heading text-2xl font-bold">Payment successful 🎉</h1>
          <p className="text-muted-foreground">
            Your access to <b>{program.title}</b> is unlocked.
          </p>
          <div className="flex flex-col gap-2">
            <Button onClick={() => navigate(`/app/programs/${program.slug}`)}>
              Open program
            </Button>
            <Link to="/app/programs" className="text-sm text-muted-foreground hover:underline">
              See all my programs
            </Link>
          </div>
        </>
      )}

      {status === "timeout" && (
        <>
          <h1 className="font-heading text-2xl font-bold">Payment in progress…</h1>
          <p className="text-sm text-muted-foreground">
            The payment may take a few minutes to validate. Refresh in a moment,
            or check your programs — access will unlock automatically.
          </p>
          <Button onClick={() => navigate("/app/programs")}>My programs</Button>
        </>
      )}
    </div>
  );
};

export default CheckoutSuccess;
