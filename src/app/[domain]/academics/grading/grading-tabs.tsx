"use client"

import { Award, ClipboardList } from "lucide-react"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { GradingSettingsClient } from "./grading-settings-client"
import { RubricsClient } from "./rubrics-client"
import type { ResolvedGradingSettings } from "@/lib/grading-config"
import type { Rubric, RubricCriterion } from "../../../../../generated/prisma/client"

type RubricWithCriteria = Rubric & {
  criteria: RubricCriterion[]
  _count:   { evaluations: number }
}

interface Props {
  schoolId:        string
  userId:          string
  initialSettings: ResolvedGradingSettings
  initialRubrics:  RubricWithCriteria[]
}

export function GradingTabs({
  schoolId,
  userId,
  initialSettings,
  initialRubrics,
}: Props) {
  return (
    <Tabs defaultValue="rubrics" className="gap-5">
      <TabsList className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-sm h-10 p-1 rounded-xl">
        <TabsTrigger value="rubrics" className="gap-1.5 text-xs h-8 px-3 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg">
          <ClipboardList className="w-3.5 h-3.5" /> Rubrics
        </TabsTrigger>
        <TabsTrigger value="scale" className="gap-1.5 text-xs h-8 px-3 cursor-pointer data-[state=active]:bg-primary data-[state=active]:text-white data-[state=active]:shadow-md rounded-lg">
          <Award className="w-3.5 h-3.5" /> Grade Scale
        </TabsTrigger>
      </TabsList>

      <TabsContent value="rubrics" className="mt-0">
        <RubricsClient schoolId={schoolId} userId={userId} initialRubrics={initialRubrics} />
      </TabsContent>

      <TabsContent value="scale" className="mt-0">
        <GradingSettingsClient schoolId={schoolId} initialSettings={initialSettings} />
      </TabsContent>
    </Tabs>
  )
}
