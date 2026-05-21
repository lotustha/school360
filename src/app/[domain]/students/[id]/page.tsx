import { Metadata } from "next"
import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { getStudentById } from "@/actions/students"
import {
  ArrowLeft, GraduationCap, User, MapPin, Phone,
  Shield, Star, BookOpen, Calendar, FileText,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { EditableField, StaticRow } from "./editable-field"
import { StudentPageActions } from "./student-page-actions"
import { EditModeProvider } from "./edit-mode-context"
import { StudentHeroAvatar } from "./student-hero-avatar"
import { GuardiansSection } from "./guardians-section"

export const metadata: Metadata = { title: "Student Profile" }

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  ACTIVE:    { label: "Active",    cls: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  LEFT:      { label: "Left",      cls: "bg-slate-50 text-slate-600 border-slate-200" },
  GRADUATED: { label: "Graduated", cls: "bg-blue-50 text-blue-700 border-blue-200" },
  SUSPENDED: { label: "Suspended", cls: "bg-rose-50 text-rose-700 border-rose-200" },
}

const STATUS_OPTIONS    = Object.entries(STATUS_CONFIG).map(([value, { label }]) => ({ value, label }))
const GENDER_OPTIONS    = [
  { value: "Male",   label: "Male"   },
  { value: "Female", label: "Female" },
  { value: "Other",  label: "Other"  },
]
const BLOOD_OPTIONS     = ["A+","A-","B+","B-","O+","O-","AB+","AB-"].map(v => ({ value: v, label: v }))
const DISABILITY_OPTIONS = [
  { value: "NONE",         label: "None"         },
  { value: "PHYSICAL",     label: "Physical"     },
  { value: "VISUAL",       label: "Visual"       },
  { value: "HEARING",      label: "Hearing"      },
  { value: "INTELLECTUAL", label: "Intellectual" },
  { value: "SPEECH",       label: "Speech"       },
  { value: "MULTIPLE",     label: "Multiple"     },
]
const SCHOLARSHIP_OPTIONS = [
  { value: "NONE",       label: "None"             },
  { value: "GOVERNMENT", label: "Government (DoE)" },
  { value: "SCHOOL",     label: "School"           },
  { value: "DALIT",      label: "Dalit"            },
  { value: "JANAJATI",   label: "Janajati"         },
  { value: "DISABILITY", label: "Disability"       },
  { value: "OTHER",      label: "Other"            },
]

const DISABILITY_LABELS = Object.fromEntries(DISABILITY_OPTIONS.map(o => [o.value, o.label]))
const SCHOLARSHIP_LABELS = Object.fromEntries(SCHOLARSHIP_OPTIONS.map(o => [o.value, o.label]))

function Section({ title, icon: Icon, children, color = "text-primary", bg = "bg-primary/10" }: {
  title: string; icon: React.ElementType; children: React.ReactNode; color?: string; bg?: string
}) {
  return (
    <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm overflow-hidden">
      <div className="flex items-center gap-3 px-5 py-4 border-b border-white/60">
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", bg)}>
          <Icon className={cn("w-4 h-4", color)} />
        </div>
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="px-5 py-1">{children}</div>
    </div>
  )
}

export default async function StudentProfilePage({
  params,
}: {
  params: Promise<{ domain: string; id: string }>
}) {
  const { domain, id } = await params
  const school = await prisma.school.findUnique({ where: { slug: domain } })
  if (!school) notFound()

  const student = await getStudentById(school.id, id)
  if (!student) notFound()

  const statusConfig = STATUS_CONFIG[student.status]

  const ef = (props: Omit<React.ComponentProps<typeof EditableField>, "schoolId" | "studentId">) =>
    <EditableField {...props} schoolId={school.id} studentId={student.id} />

  return (
    <EditModeProvider>
    <div className="space-y-5 max-w-5xl mx-auto">
      {/* Back + actions */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <Link href="/students">
          <Button variant="ghost" size="sm" className="gap-1.5 cursor-pointer hover:bg-primary/8 -ml-2">
            <ArrowLeft className="w-4 h-4" /> Students
          </Button>
        </Link>
        <StudentPageActions
          schoolId={school.id}
          studentId={student.id}
          studentName={student.user.fullName}
        />
      </div>

      {/* Profile hero */}
      <div className="bg-white/70 backdrop-blur-xl rounded-xl border border-white/40 shadow-sm p-6">
        <div className="flex items-start gap-5 flex-wrap">
          <StudentHeroAvatar
            schoolId={school.id}
            studentId={student.id}
            initialUrl={student.user.avatarUrl ?? null}
            initials={student.user.fullName.split(" ").map(n => n[0]).join("").slice(0, 2).toUpperCase()}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">{student.user.fullName}</h1>
              {statusConfig && (
                <Badge variant="outline" className={cn("text-[10px] font-bold", statusConfig.cls)}>
                  {statusConfig.label}
                </Badge>
              )}
              {student.disabilityStatus && student.disabilityStatus !== "NONE" && (
                <Badge variant="outline" className="text-[10px] font-bold bg-violet-50 text-violet-700 border-violet-200">
                  <Shield className="w-2.5 h-2.5 mr-1" />
                  {DISABILITY_LABELS[student.disabilityStatus] ?? student.disabilityStatus}
                </Badge>
              )}
              {student.scholarshipType && student.scholarshipType !== "NONE" && (
                <Badge variant="outline" className="text-[10px] font-bold bg-amber-50 text-amber-700 border-amber-200">
                  <Star className="w-2.5 h-2.5 mr-1" />
                  {SCHOLARSHIP_LABELS[student.scholarshipType] ?? student.scholarshipType}
                </Badge>
              )}
            </div>
            {student.fullNameNepali && (
              <p className="text-slate-500 text-sm mt-0.5">{student.fullNameNepali}</p>
            )}
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{student.admissionNo}</span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <GraduationCap className="w-3.5 h-3.5" />
                {student.class.name}{student.section ? ` · Section ${student.section.name}` : ""}
              </span>
              {student.nebRegistrationNo && (
                <span className="text-xs font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">
                  NEB: {student.nebRegistrationNo}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 text-right text-xs text-muted-foreground">
            <span>Enrolled {new Date(student.enrolledAt).toLocaleDateString("en-NP")}</span>
            {student.academicYear && <span>{student.academicYear.name}</span>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* Personal */}
        <Section title="Personal Information" icon={User}>
          {ef({ field: "fullName",       label: "Full Name (EN)", value: student.user.fullName })}
          {ef({ field: "fullNameNepali", label: "Full Name (NP)", value: student.fullNameNepali })}
          {ef({ field: "dobBS",          label: "Date of Birth",  value: student.dobBS, type: "nepali-date", mono: true })}
          {ef({ field: "gender",         label: "Gender",         value: student.gender,      type: "select", options: GENDER_OPTIONS })}
          {ef({ field: "bloodGroup",     label: "Blood Group",    value: student.bloodGroup,  type: "select", options: BLOOD_OPTIONS })}
          {ef({ field: "nationality",    label: "Nationality",    value: student.nationality })}
          {ef({ field: "religion",       label: "Religion",       value: student.religion })}
          {ef({ field: "ethnicity",      label: "Ethnicity",      value: student.ethnicity ?? student.caste })}
          {ef({ field: "motherTongue",   label: "Mother Tongue",  value: student.motherTongue })}
        </Section>

        {/* Identity Documents */}
        <Section title="Identity Documents" icon={FileText} color="text-violet-600" bg="bg-violet-500/10">
          {ef({ field: "birthCertNo",       label: "Birth Cert. No",  value: student.birthCertNo,       mono: true })}
          {ef({ field: "nationalIdNo",      label: "National ID",     value: student.nationalIdNo,      mono: true })}
          {ef({ field: "nebRegistrationNo", label: "NEB Reg. No",     value: student.nebRegistrationNo, mono: true })}
          {ef({ field: "symbolNumber",      label: "Symbol No.",      value: student.symbolNumber,      mono: true })}
          {ef({ field: "rollNumber",        label: "Roll Number",     value: student.rollNumber,        mono: true })}
          <StaticRow                          label="Admission No"   value={student.admissionNo}                    mono />
          {ef({ field: "previousSchool",    label: "Previous School", value: student.previousSchool })}
          {ef({ field: "transferCertNo",    label: "Transfer Cert.",  value: student.transferCertNo,    mono: true })}
        </Section>

        {/* Address */}
        <Section title="Address" icon={MapPin} color="text-emerald-600" bg="bg-emerald-500/10">
          {ef({ field: "province",         label: "Province",         value: student.province })}
          {ef({ field: "district",         label: "District",         value: student.district })}
          {ef({ field: "municipality",     label: "Municipality",     value: student.municipality })}
          {ef({ field: "wardNo",           label: "Ward No.",         value: student.wardNo })}
          {ef({ field: "street",           label: "Street/Tole",      value: student.street })}
          {ef({ field: "permanentAddress", label: "Permanent (full)", value: student.permanentAddress, type: "textarea" })}
          {ef({ field: "temporaryAddress", label: "Temporary",        value: student.temporaryAddress, type: "textarea" })}
        </Section>

        {/* Academic */}
        <Section title="Academic Details" icon={BookOpen} color="text-amber-600" bg="bg-amber-500/10">
          <StaticRow label="Class"         value={`${student.class.name}${student.section ? ` · Section ${student.section.name}` : ""}`} />
          <StaticRow label="Academic Year" value={student.academicYear?.name} />
          {ef({ field: "rollNumber",        label: "Roll Number",  value: student.rollNumber,        mono: true })}
          {ef({ field: "nebRegistrationNo", label: "NEB Reg. No",  value: student.nebRegistrationNo, mono: true })}
          {ef({ field: "symbolNumber",      label: "Symbol No.",   value: student.symbolNumber,      mono: true })}
          {ef({ field: "status",            label: "Status",       value: student.status, type: "select", options: STATUS_OPTIONS })}
          <StaticRow label="Enrolled On" value={new Date(student.enrolledAt).toLocaleDateString("en-NP")} />
          {student.leftAt && (
            <StaticRow label="Left On" value={new Date(student.leftAt).toLocaleDateString("en-NP")} />
          )}
        </Section>

        {/* Guardians */}
        <Section title="Parents & Guardian" icon={Phone} color="text-blue-600" bg="bg-blue-500/10">
          <GuardiansSection
            schoolId={school.id}
            studentId={student.id}
            studentEmail={student.user.email}
            guardians={student.guardians.map(g => ({
              id:             g.id,
              name:           g.name,
              relation:       g.relation,
              phone:          g.phone,
              email:          g.email,
              occupation:     g.occupation,
              educationLevel: g.educationLevel,
              isPrimary:      g.isPrimary,
            }))}
          />
        </Section>

        {/* EMIS */}
        <Section title="EMIS Indicators" icon={Calendar} color="text-rose-600" bg="bg-rose-500/10">
          {ef({ field: "disabilityStatus", label: "Disability",   value: student.disabilityStatus ?? "NONE", type: "select", options: DISABILITY_OPTIONS })}
          {ef({ field: "scholarshipType",  label: "Scholarship",  value: student.scholarshipType  ?? "NONE", type: "select", options: SCHOLARSHIP_OPTIONS })}
          <StaticRow label="Student Type" value={student.isResidential ? "Boarding" : "Day Scholar"} />
          {student.distanceKm && <StaticRow label="Distance" value={`${student.distanceKm} km`} />}
        </Section>
      </div>
    </div>
    </EditModeProvider>
  )
}
