import { ReactNode } from "react";
import { CheckCircle2, Wrench, Play, ChevronDown } from "lucide-react";

export type IntakeReview = {
  status: "validated" | "needs_work" | null;
  actual_value: string | null;
  notes: string | null;
};

type Props = {
  label: string;
  declared: string | null;
  review?: IntakeReview;
  videoUrl?: string;
  videoOpen: boolean;
  onToggleVideo: () => void;
  /** Optional extra content appended at the bottom of the row (used by the
   * coach page to render inline edit controls without changing the display). */
  children?: ReactNode;
};

/**
 * Shared read-only presentation of one verifiable skill row — used on both the
 * client intake view and the coach admin intake page so the visual is
 * guaranteed to stay in sync.
 */
const IntakeSkillRow = ({
  label,
  declared,
  review,
  videoUrl,
  videoOpen,
  onToggleVideo,
  children,
}: Props) => {
  const reviewState = review?.status ?? null;
  const hasNote = !!(review?.notes && review.notes.trim() !== "");
  const actualDiffers = !!(
    review?.actual_value && review.actual_value !== declared
  );

  return (
    <div className="px-5 py-4 border-t border-border first:border-t-0 first:mt-3 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
            {label}
          </p>
          <p className="text-sm mt-0.5">
            <span className="font-semibold">{declared || "—"}</span>
          </p>
        </div>
        {reviewState === "validated" && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-green-100 text-green-800 rounded-full px-2.5 py-1 shrink-0">
            <CheckCircle2 size={12} /> Validated
          </div>
        )}
        {reviewState === "needs_work" && (
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold bg-amber-100 text-amber-800 rounded-full px-2.5 py-1 shrink-0">
            <Wrench size={12} /> To work on
          </div>
        )}
      </div>

      {actualDiffers && (
        <p className="text-xs">
          <span className="text-muted-foreground font-semibold">Actual level:</span>{" "}
          <span className="font-semibold">{review?.actual_value}</span>
        </p>
      )}

      {hasNote && (
        <div
          className={`border rounded-lg p-3 text-xs leading-relaxed ${
            reviewState === "needs_work"
              ? "bg-amber-50/60 border-amber-100"
              : "bg-green-50/60 border-green-100"
          }`}
        >
          <p
            className={`font-semibold mb-0.5 ${
              reviewState === "needs_work" ? "text-amber-900" : "text-green-900"
            }`}
          >
            Coach note
          </p>
          <p
            className={`whitespace-pre-wrap ${
              reviewState === "needs_work" ? "text-amber-900" : "text-green-900"
            }`}
          >
            {review?.notes}
          </p>
        </div>
      )}

      {videoUrl && (
        <div>
          <button
            type="button"
            onClick={onToggleVideo}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border border-border hover:border-accent/60 transition-colors"
          >
            {videoOpen ? (
              <>
                <ChevronDown size={12} /> Hide video
              </>
            ) : (
              <>
                <Play size={12} className="fill-current" /> Show video
              </>
            )}
          </button>
          {videoOpen && (
            <video
              src={videoUrl}
              controls
              className="w-full rounded-lg bg-black max-h-[320px] mt-3"
            />
          )}
        </div>
      )}

      {children}
    </div>
  );
};

export default IntakeSkillRow;
