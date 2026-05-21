// ============================================================================
// Evaluation framework configuration types and presets
// ============================================================================
// Three default frameworks (CAS / Primary / Secondary) plus CUSTOM.
// A framework is assigned to a Class as the default; each Subject can override.
// The `config` JSON on EvaluationFramework is one of the discriminated shapes below.

// ─── Shared marks-workspace types (live here, not in /actions, because
//     server-action files can only export async functions) ───────────────────

export type BreakdownRow = {
  label:        string
  maxMarks:     number
  isAttendance?: boolean
}

export type MarksWorkspaceData = {
  framework: {
    id:   string
    name: string
    type: string
  } | null
  component: {
    id:        string
    type:      "INTERNAL" | "EXTERNAL" | "CAS"
    fullMarks: number
    passMarks: number
    breakdown: BreakdownRow[]
  } | null
  allComponents: { id: string; type: "INTERNAL" | "EXTERNAL" | "CAS"; fullMarks: number }[]
  students: {
    id:          string
    userId:      string
    admissionNo: string
    fullName:    string
    rollNumber:  string | null
  }[]
  existingMarks: Record<string, {
    obtainedMarks:  number | null
    breakdownMarks: Record<string, number>
    isAbsent:       boolean
  }>
  attendanceBands: AttendanceBand[]
}

export type AttendanceBand = { minPercent: number; marks: number }

export type RatingScalePoint = { value: number; label: string }

export const DEFAULT_ATTENDANCE_BANDS: AttendanceBand[] = [
  { minPercent: 90, marks: 2.0  },
  { minPercent: 85, marks: 1.5  },
  { minPercent: 80, marks: 1.0  },
  { minPercent: 75, marks: 0.5  },
  { minPercent: 0,  marks: 0.0  },
]

export const POINT_4_SCALE: RatingScalePoint[] = [
  { value: 4, label: "Outstanding" },
  { value: 3, label: "Excellent"   },
  { value: 2, label: "Medium"      },
  { value: 1, label: "Low"         },
]

export const POINT_5_SCALE: RatingScalePoint[] = [
  { value: 5, label: "Excellent"   },
  { value: 4, label: "Very Good"   },
  { value: 3, label: "Good"        },
  { value: 2, label: "Satisfactory"},
  { value: 1, label: "Needs Work"  },
]

// ─── Rubric template presets (pre-seeded CDC-aligned templates) ──────────────

export type RubricCategory =
  | "FIELD_TRIP"
  | "STORYTELLING"
  | "MODEL_MAKING"
  | "PRESENTATION"
  | "PRACTICAL"
  | "GROUP_DISCUSSION"
  | "CUSTOM"

export type RubricTemplate = {
  category:    RubricCategory
  name:        string
  description: string
  type:        "ANALYTICAL" | "HOLISTIC"
  totalMarks:  number
  criteria:    { name: string; maxMarks: number; description?: string }[]
}

export const RUBRIC_TEMPLATES: RubricTemplate[] = [
  {
    category:    "FIELD_TRIP",
    name:        "Field Trip Report",
    description: "Evaluates observation, recording, and reflection after a field visit",
    type:        "ANALYTICAL",
    totalMarks:  20,
    criteria: [
      { name: "Observation Detail",   maxMarks: 5, description: "Quality and depth of observations recorded" },
      { name: "Accuracy of Facts",    maxMarks: 5, description: "Factual correctness of report content"      },
      { name: "Presentation",         maxMarks: 5, description: "Organization, neatness, visual aids"        },
      { name: "Reflection/Learning",  maxMarks: 5, description: "Personal takeaways and analysis"            },
    ],
  },
  {
    category:    "STORYTELLING",
    name:        "Storytelling",
    description: "Evaluates oral storytelling performance",
    type:        "ANALYTICAL",
    totalMarks:  16,
    criteria: [
      { name: "Voice Clarity",     maxMarks: 4, description: "Pronunciation, projection, pace" },
      { name: "Expression",        maxMarks: 4, description: "Emotion, body language, eye contact" },
      { name: "Story Structure",   maxMarks: 4, description: "Beginning, middle, end coherence"  },
      { name: "Creativity",        maxMarks: 4, description: "Original elements and engagement" },
    ],
  },
  {
    category:    "MODEL_MAKING",
    name:        "Model Making / Practical Project",
    description: "Evaluates a hands-on STEM model or craft project",
    type:        "ANALYTICAL",
    totalMarks:  16,
    criteria: [
      { name: "Mathematical/Scientific Accuracy", maxMarks: 4, description: "Correctness of underlying concept" },
      { name: "Material Quality",                  maxMarks: 3, description: "Appropriateness and finish"        },
      { name: "Group Discussion",                  maxMarks: 3, description: "Contribution to team work"         },
      { name: "Task Completion",                   maxMarks: 3, description: "Timeliness and completeness"       },
      { name: "Presentation/Record-keeping",       maxMarks: 3, description: "Explaining process and documentation" },
    ],
  },
  {
    category:    "PRESENTATION",
    name:        "Oral Presentation",
    description: "Evaluates a classroom presentation",
    type:        "ANALYTICAL",
    totalMarks:  12,
    criteria: [
      { name: "Content Knowledge", maxMarks: 4, description: "Understanding of topic"        },
      { name: "Delivery",          maxMarks: 4, description: "Clarity, confidence, pace"     },
      { name: "Visual Aids",       maxMarks: 2, description: "Use of charts, slides, props"  },
      { name: "Q&A Handling",      maxMarks: 2, description: "Response to audience questions" },
    ],
  },
  {
    category:    "GROUP_DISCUSSION",
    name:        "Group Discussion Participation",
    description: "Evaluates contribution to a group discussion or debate",
    type:        "HOLISTIC",
    totalMarks:  8,
    criteria: [
      { name: "Overall Participation", maxMarks: 8, description: "Holistic rating of contribution, listening, and respect" },
    ],
  },
  {
    category:    "PRACTICAL",
    name:        "Science Practical / Lab Work",
    description: "Evaluates a science laboratory experiment",
    type:        "ANALYTICAL",
    totalMarks:  20,
    criteria: [
      { name: "Procedure Adherence",   maxMarks: 5, description: "Following experimental steps"    },
      { name: "Observation Recording", maxMarks: 5, description: "Accurate readings and tables"    },
      { name: "Analysis",              maxMarks: 5, description: "Interpretation of results"       },
      { name: "Safety & Cleanup",      maxMarks: 5, description: "Lab safety and station tidiness" },
    ],
  },
]

// ─── Attendance calculation helper (pure function, usable on client + server) ─

export function calculateAttendanceMarks(
  presentCount: number,
  totalDays:    number,
  bands:        AttendanceBand[] = DEFAULT_ATTENDANCE_BANDS,
  maxMarks:     number = 2,
): { percent: number; marks: number; band: AttendanceBand | null } {
  if (totalDays <= 0) return { percent: 0, marks: 0, band: null }
  const percent = (presentCount / totalDays) * 100
  // Bands assumed sorted descending by minPercent; pick first band the % meets
  const sorted = [...bands].sort((a, b) => b.minPercent - a.minPercent)
  const band = sorted.find(b => percent >= b.minPercent) ?? null
  const rawMarks = band?.marks ?? 0
  // Bands store absolute marks (e.g. 2.0). If maxMarks differs, scale proportionally.
  const topBandMarks = sorted[0]?.marks ?? maxMarks
  const marks = topBandMarks > 0 ? (rawMarks / topBandMarks) * maxMarks : 0
  return { percent: Math.round(percent * 100) / 100, marks: Math.round(marks * 100) / 100, band }
}
