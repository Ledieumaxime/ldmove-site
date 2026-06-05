// AUTO-GENERATED from Bibliothèque/warmup_templates.md.
// Edit the markdown then re-run scripts/build-warmup-templates.mjs.

export type WarmupTemplateExercise = {
  /** Canonical exercise name from the Supabase library. */
  name: string;
  sets: number | null;
  reps: string | null;
  tempo: string | null;
  load: string | null;
  rest_seconds: number | null;
  /** When non-null, exercises sharing the same value form a group
   *  (Superset / Drop set / Spine mobility, etc.). */
  group_name: string | null;
};

export type WarmupTemplate = {
  id: string;
  name: string;
  exercises: WarmupTemplateExercise[];
};

export const WARMUP_TEMPLATES: WarmupTemplate[] = [
  {
    "id": "handstand-1",
    "name": "🤸 HANDSTAND 1",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 2",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Wall chest opener",
        "sets": 1,
        "reps": "60s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Triceps opener (block or box)",
        "sets": 1,
        "reps": "60s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Cat stretch roller",
        "sets": 1,
        "reps": "60s",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Ring lad stretch",
        "sets": 1,
        "reps": "25s each side",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Trap raise",
        "sets": 1,
        "reps": "10",
        "tempo": "5s hold",
        "load": "5kg",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Kneeling shoulder elevation",
        "sets": 1,
        "reps": "10",
        "tempo": "3s hold each rep",
        "load": "6/8kg",
        "rest_seconds": 0,
        "group_name": null
      }
    ]
  },
  {
    "id": "handstand-2",
    "name": "🤸 HANDSTAND 2",
    "exercises": [
      {
        "name": "Box chest opener",
        "sets": 1,
        "reps": "45–60s",
        "tempo": null,
        "load": null,
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "Triceps opener (block or box)",
        "sets": 1,
        "reps": "45–60s",
        "tempo": null,
        "load": null,
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "Cat stretch roller",
        "sets": 1,
        "reps": "45–60s",
        "tempo": null,
        "load": null,
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "Ring lad stretch",
        "sets": 1,
        "reps": "20s each side",
        "tempo": null,
        "load": null,
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "Trap raise",
        "sets": 1,
        "reps": "10",
        "tempo": null,
        "load": null,
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "T shoulder elevation",
        "sets": 1,
        "reps": "8",
        "tempo": null,
        "load": "2kg max",
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "Y shoulder elevation",
        "sets": 1,
        "reps": "8",
        "tempo": null,
        "load": "2kg max",
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "I shoulder elevation",
        "sets": 1,
        "reps": "8",
        "tempo": null,
        "load": "2kg max",
        "rest_seconds": null,
        "group_name": null
      },
      {
        "name": "Jefferson curl",
        "sets": 3,
        "reps": "10",
        "tempo": "5s hold bottom",
        "load": "5/10kg",
        "rest_seconds": null,
        "group_name": "SUPERSET"
      },
      {
        "name": "Shoulder circle chest floor",
        "sets": null,
        "reps": "8",
        "tempo": "3s leg straight",
        "load": "2kg max",
        "rest_seconds": null,
        "group_name": "SUPERSET"
      }
    ]
  },
  {
    "id": "handstand-rehab",
    "name": "🤸 HANDSTAND REHAB",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 2",
        "sets": 1,
        "reps": "10",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Trap raise",
        "sets": 1,
        "reps": "10",
        "tempo": "Hold 3s each rep",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Kneeling Banded protraction",
        "sets": 1,
        "reps": "8",
        "tempo": "Hold 3s each rep",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded Cat&cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Slow",
        "load": "Medium band",
        "rest_seconds": 0,
        "group_name": "SPINE MOBILITY"
      },
      {
        "name": "Crunch thoracic extension",
        "sets": 1,
        "reps": "10",
        "tempo": "Hold 5s last rep",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": "SPINE MOBILITY"
      },
      {
        "name": "Chest in shoulder elevation",
        "sets": 1,
        "reps": "10",
        "tempo": "Hold 3–4s each rep",
        "load": "4kg",
        "rest_seconds": 0,
        "group_name": "SPINE MOBILITY"
      },
      {
        "name": "Overhead thoracic extension",
        "sets": 1,
        "reps": "10",
        "tempo": "Hold 3–4s each rep",
        "load": "4kg",
        "rest_seconds": 0,
        "group_name": "SPINE MOBILITY"
      },
      {
        "name": "Cat stretch roller",
        "sets": 1,
        "reps": "10",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": "SPINE MOBILITY"
      },
      {
        "name": "Box thoracic extension",
        "sets": 1,
        "reps": "8",
        "tempo": "Hold 3s at bottom",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": "SPINE MOBILITY"
      }
    ]
  },
  {
    "id": "push",
    "name": "💪 PUSH",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 2",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded elbow extension",
        "sets": 2,
        "reps": "10",
        "tempo": "1/1/2/1",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Scapula push up",
        "sets": 2,
        "reps": "10",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "All 4 shoulder & thoracic extension",
        "sets": 1,
        "reps": "8 each",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Kneeling Banded protraction",
        "sets": 2,
        "reps": "10",
        "tempo": "2s hold",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Plank",
        "sets": 2,
        "reps": "30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      }
    ]
  },
  {
    "id": "push-hspu-focus",
    "name": "🤸 PUSH / HSPU FOCUS",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 2,
        "reps": "10",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Banded Cat&cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Medium band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Scapula push up",
        "sets": 2,
        "reps": "10",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": "SUPERSET — Scap + spine"
      },
      {
        "name": "Jefferson curl",
        "sets": null,
        "reps": "10",
        "tempo": "5s hold bottom",
        "load": "5–10kg",
        "rest_seconds": 60,
        "group_name": "SUPERSET — Scap + spine"
      },
      {
        "name": "2 block elbow elevation",
        "sets": null,
        "reps": "10",
        "tempo": "5s hold",
        "load": null,
        "rest_seconds": null,
        "group_name": "SUPERSET — Scap + spine"
      },
      {
        "name": "Banded elbow extension",
        "sets": 2,
        "reps": "10",
        "tempo": "1/1/2/1",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": "SUPERSET — Elbow + lean"
      },
      {
        "name": "Planche lean",
        "sets": null,
        "reps": "20–30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 60,
        "group_name": "SUPERSET — Elbow + lean"
      },
      {
        "name": "Kneeling shoulder elevation",
        "sets": 1,
        "reps": "10",
        "tempo": "3s hold each rep",
        "load": "4–6kg",
        "rest_seconds": 30,
        "group_name": "SUPERSET — Elbow + lean"
      },
      {
        "name": "Trap raise",
        "sets": 1,
        "reps": "10",
        "tempo": "5s hold",
        "load": "Small band or 5kg",
        "rest_seconds": 0,
        "group_name": "SUPERSET — Elbow + lean"
      }
    ]
  },
  {
    "id": "pull",
    "name": "🏋️ PULL",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "T shoulder elevation",
        "sets": 1,
        "reps": "8",
        "tempo": null,
        "load": "2kg max",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Y shoulder elevation",
        "sets": 1,
        "reps": "8",
        "tempo": null,
        "load": "2kg max",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "I shoulder elevation",
        "sets": 1,
        "reps": "8",
        "tempo": null,
        "load": "2kg max",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Mix grip Hang",
        "sets": 2,
        "reps": "30s each side",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": "SUPERSET"
      },
      {
        "name": "Supination Dead Hang",
        "sets": 2,
        "reps": "30–45s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": "SUPERSET"
      },
      {
        "name": "Banded lat activation",
        "sets": 2,
        "reps": "10",
        "tempo": "3s hold",
        "load": "Small band",
        "rest_seconds": 45,
        "group_name": "SUPERSET"
      },
      {
        "name": "Hanging scapula retraction",
        "sets": 2,
        "reps": "8",
        "tempo": "2s hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": "SUPERSET"
      },
      {
        "name": "Ring row elbow outside",
        "sets": 1,
        "reps": "8",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": "SUPERSET"
      }
    ]
  },
  {
    "id": "front-lever",
    "name": "💥 FRONT LEVER",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Dead hang",
        "sets": 2,
        "reps": "30–45s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": null
      },
      {
        "name": "Hanging scapula retraction",
        "sets": 2,
        "reps": "8",
        "tempo": "2s hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": null
      },
      {
        "name": "Banded lat activation",
        "sets": 3,
        "reps": "10",
        "tempo": "3s hold",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": "SUPERSET — Lat activation"
      },
      {
        "name": "Hollow",
        "sets": null,
        "reps": "30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": "SUPERSET — Lat activation"
      },
      {
        "name": "Lat activation dumbbell",
        "sets": 3,
        "reps": "8–10",
        "tempo": "3s hold",
        "load": "4kg",
        "rest_seconds": 0,
        "group_name": "SUPERSET — Weighted lat + core"
      },
      {
        "name": "Bend over row elbow high & outside",
        "sets": 2,
        "reps": "10",
        "tempo": "0/3/0/0",
        "load": "4–6kg",
        "rest_seconds": 60,
        "group_name": "SUPERSET — Weighted lat + core"
      }
    ]
  },
  {
    "id": "pushpull-1",
    "name": "💥 PUSH-PULL 1",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded elbow extension",
        "sets": 1,
        "reps": "10",
        "tempo": "1/1/2/1",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Scapula push up",
        "sets": 2,
        "reps": "8",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Dead hang",
        "sets": 2,
        "reps": "30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": null
      },
      {
        "name": "Banded lat activation",
        "sets": 1,
        "reps": "10",
        "tempo": "3s hold",
        "load": "Small band",
        "rest_seconds": 45,
        "group_name": null
      },
      {
        "name": "Ring row elbow outside",
        "sets": 2,
        "reps": "8",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": "SUPERSET"
      },
      {
        "name": "Plank",
        "sets": null,
        "reps": "30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": "SUPERSET"
      }
    ]
  },
  {
    "id": "pushpull-2",
    "name": "💥 PUSH-PULL 2",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 2",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Trap raise",
        "sets": 1,
        "reps": "10",
        "tempo": "5s hold",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Kneeling Banded protraction",
        "sets": 1,
        "reps": "8",
        "tempo": "5s hold",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Scapula push up",
        "sets": 2,
        "reps": "10",
        "tempo": null,
        "load": null,
        "rest_seconds": 0,
        "group_name": "SUPERSET"
      },
      {
        "name": "Dead hang",
        "sets": null,
        "reps": "30s",
        "tempo": null,
        "load": null,
        "rest_seconds": 0,
        "group_name": "SUPERSET"
      },
      {
        "name": "Mix grip Hang",
        "sets": 2,
        "reps": "20s each side",
        "tempo": null,
        "load": null,
        "rest_seconds": 0,
        "group_name": "SUPERSET"
      },
      {
        "name": "Rowing pull up bar inclined",
        "sets": null,
        "reps": "8",
        "tempo": null,
        "load": null,
        "rest_seconds": 0,
        "group_name": "SUPERSET"
      }
    ]
  },
  {
    "id": "legs",
    "name": "🦵 LEGS",
    "exercises": [
      {
        "name": "Banded Cat&cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Medium band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Frog Banded anterior & posterior tilt-cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "90:90 HIP ROT",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "90:90 Up&down",
        "sets": 2,
        "reps": "8 each",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Banded knee flexion extension",
        "sets": 2,
        "reps": "10 each",
        "tempo": "1/1/2/1",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Couch stretch",
        "sets": 1,
        "reps": "30s each",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Deep squat KB twist",
        "sets": 2,
        "reps": "8 each",
        "tempo": "3s hold",
        "load": "Light KB",
        "rest_seconds": 30,
        "group_name": null
      }
    ]
  },
  {
    "id": "legs-thoracic",
    "name": "🦵 LEGS + THORACIC",
    "exercises": [
      {
        "name": "Banded Cat&cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Medium band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Frog Banded anterior & posterior tilt-cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "90:90 HIP ROT",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Box thoracic extension",
        "sets": 1,
        "reps": "8",
        "tempo": "Hold 3s at bottom",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Jefferson curl",
        "sets": 1,
        "reps": "1 min",
        "tempo": "1/3/1/1",
        "load": "5–10kg",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Deep squat to pike stretch",
        "sets": 1,
        "reps": "1 min",
        "tempo": "1/3/1/1",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Runner stretch",
        "sets": 2,
        "reps": "10 each side",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Deep squat to pike stretch",
        "sets": 2,
        "reps": "10",
        "tempo": "4s in deep squat",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Banded knee flexion extension",
        "sets": 2,
        "reps": "10 each leg",
        "tempo": "1/1/2/1",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      }
    ]
  },
  {
    "id": "split",
    "name": "🧘 SPLIT",
    "exercises": [
      {
        "name": "Banded Cat&cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Medium band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Frog Banded anterior & posterior tilt-cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "90:90 HIP ROT",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded hamstring stretch",
        "sets": 2,
        "reps": "30s each",
        "tempo": "Hold",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "Deep squat KB twist",
        "sets": 2,
        "reps": "8 each",
        "tempo": "3s hold",
        "load": "Light KB",
        "rest_seconds": 30,
        "group_name": "SUPERSET"
      },
      {
        "name": "Jefferson curl",
        "sets": null,
        "reps": "8",
        "tempo": "5s descent",
        "load": "Light KB",
        "rest_seconds": 60,
        "group_name": "SUPERSET"
      }
    ]
  },
  {
    "id": "upperlower",
    "name": "🔄 UPPER-LOWER",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "All 4 shoulder & thoracic extension",
        "sets": 1,
        "reps": "8 each",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded knee flexion extension",
        "sets": 2,
        "reps": "10 each",
        "tempo": "1/1/2/1",
        "load": "Small band",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "90:90 HIP ROT",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Couch stretch",
        "sets": 1,
        "reps": "30s each",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Scapula push up",
        "sets": 2,
        "reps": "8",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": "SUPERSET"
      },
      {
        "name": "Dead hang",
        "sets": null,
        "reps": "30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": "SUPERSET"
      }
    ]
  },
  {
    "id": "full-body",
    "name": "🌐 FULL BODY",
    "exercises": [
      {
        "name": "Banded shoulder dislocates",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Chest in shoulder circle 1",
        "sets": 1,
        "reps": "45s",
        "tempo": "Continuous",
        "load": "Small band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded Cat&cow",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Continuous",
        "load": "Medium band",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "All 4 shoulder & thoracic extension",
        "sets": 1,
        "reps": "8 each",
        "tempo": "Slow",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Dead hang",
        "sets": 2,
        "reps": "30s",
        "tempo": "Hold",
        "load": "BW",
        "rest_seconds": 45,
        "group_name": null
      },
      {
        "name": "Scapula push up",
        "sets": 2,
        "reps": "8",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 30,
        "group_name": null
      },
      {
        "name": "90:90 HIP ROT",
        "sets": 1,
        "reps": "1 min",
        "tempo": "Controlled",
        "load": "BW",
        "rest_seconds": 0,
        "group_name": null
      },
      {
        "name": "Banded lat activation",
        "sets": 1,
        "reps": "10",
        "tempo": "3s hold",
        "load": "Small band",
        "rest_seconds": 45,
        "group_name": null
      }
    ]
  }
];
