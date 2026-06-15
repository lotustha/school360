"use client"

import { useState, useTransition } from "react"
import { toast } from "sonner"
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import {
  CalendarClock, Plus, Save, X, Trash2, GripVertical, Coffee, Clock,
} from "lucide-react"
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { createSchedule, updateSchedule, setScheduleSlots, type SlotInput } from "@/actions/routine"

type SlotShape = { id: string; label: string; startTime: string; endTime: string; isBreak: boolean }
type ScheduleShape = {
  id: string
  name: string
  description: string | null
  slots: SlotShape[]
}

type DraftSlot = SlotInput & { tempKey: string }

function newKey() { return `tmp-${Math.random().toString(36).slice(2, 10)}` }

interface Props {
  schoolId: string
  editing:  ScheduleShape | null
  onClose:  () => void
}

export function ScheduleBuilder({ schoolId, editing, onClose }: Props) {
  const isEdit = editing !== null
  const [name,        setName]        = useState(editing?.name ?? "")
  const [description, setDescription] = useState(editing?.description ?? "")
  const [slots, setSlots] = useState<DraftSlot[]>(
    editing?.slots.map(s => ({
      id:        s.id,
      tempKey:   s.id,
      label:     s.label,
      startTime: s.startTime,
      endTime:   s.endTime,
      isBreak:   s.isBreak,
    })) ?? [
      { tempKey: newKey(), label: "Period 1", startTime: "09:00", endTime: "09:45", isBreak: false },
      { tempKey: newKey(), label: "Period 2", startTime: "09:45", endTime: "10:30", isBreak: false },
    ]
  )
  const [pending, startT] = useTransition()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const oldIdx = slots.findIndex(s => s.tempKey === active.id)
    const newIdx = slots.findIndex(s => s.tempKey === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = [...slots]
    const [moved] = next.splice(oldIdx, 1)
    next.splice(newIdx, 0, moved)
    setSlots(next)
  }

  function addSlot(isBreak: boolean) {
    const last = slots[slots.length - 1]
    const nextStart = last?.endTime ?? "09:00"
    // Add 45 minutes for periods, 15 for breaks (rough default)
    const nextEnd   = addMinutes(nextStart, isBreak ? 15 : 45)
    setSlots([...slots, {
      tempKey: newKey(),
      label:   isBreak ? `Break ${slots.filter(s => s.isBreak).length + 1}` : `Period ${slots.filter(s => !s.isBreak).length + 1}`,
      startTime: nextStart,
      endTime:   nextEnd,
      isBreak,
    }])
  }

  function update(key: string, patch: Partial<DraftSlot>) {
    setSlots(slots.map(s => s.tempKey === key ? { ...s, ...patch } : s))
  }

  function removeSlot(key: string) {
    setSlots(slots.filter(s => s.tempKey !== key))
  }

  async function handleSave() {
    if (!name.trim()) { toast.error("Name is required"); return }
    if (slots.length === 0) { toast.error("Add at least one slot"); return }
    // Validate locally first so the user gets the precise message immediately.
    for (const s of slots) {
      if (!s.label.trim())          { toast.error("Every slot needs a label"); return }
      if (s.startTime >= s.endTime) { toast.error(`"${s.label}": end time must be after start time`); return }
    }
    startT(async () => {
      try {
        let scheduleId = editing?.id
        if (isEdit && editing) {
          const res = await updateSchedule(editing.id, { name, description })
          if (!res.ok) { toast.error(res.error); return }
        } else {
          const res = await createSchedule({ schoolId, name, description })
          if (!res.ok) { toast.error(res.error); return }
          scheduleId = res.id
        }
        if (!scheduleId) { toast.error("Could not resolve schedule id"); return }
        const slotsRes = await setScheduleSlots(scheduleId, slots.map(s => ({ id: s.id, startTime: s.startTime, endTime: s.endTime, label: s.label, isBreak: s.isBreak })))
        if (!slotsRes.ok) { toast.error(slotsRes.error); return }
        toast.success(isEdit ? "Schedule updated" : "Schedule created")
        onClose()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to save")
      }
    })
  }

  return (
    <Sheet open={true} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-xl border-b border-slate-100 px-6 py-4">
          <SheetTitle className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <div>
              <div className="text-base font-semibold">{isEdit ? "Edit Schedule" : "New Schedule"}</div>
              <div className="text-xs text-muted-foreground font-normal">Define period times + breaks (drag to reorder)</div>
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">Schedule editor</SheetDescription>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Name</label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Standard 8-period"
              className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Description (optional)</label>
            <Input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="e.g. 8:00am morning sessions, 2 breaks"
              className="mt-1 h-9 text-sm bg-white border-slate-200 rounded-lg" />
          </div>

          {/* Slots */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> Slots ({slots.length})
            </p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={slots.map(s => s.tempKey)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {slots.map((s, i) => (
                    <SlotRow key={s.tempKey} slot={s} index={i + 1}
                      onUpdate={(patch) => update(s.tempKey, patch)}
                      onRemove={() => removeSlot(s.tempKey)} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>

            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" onClick={() => addSlot(false)}
                className="gap-1.5 cursor-pointer text-xs h-8 flex-1 bg-white">
                <Plus className="w-3.5 h-3.5" /> Add Period
              </Button>
              <Button size="sm" variant="outline" onClick={() => addSlot(true)}
                className="gap-1.5 cursor-pointer text-xs h-8 flex-1 bg-white">
                <Coffee className="w-3.5 h-3.5" /> Add Break
              </Button>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white/95 backdrop-blur-xl border-t border-slate-100 px-6 py-3 flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onClose}
            className="gap-1.5 cursor-pointer text-xs h-8">
            <X className="w-3.5 h-3.5" /> Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={pending}
            className="gap-1.5 cursor-pointer shadow-md shadow-primary/20 text-xs h-8">
            <Save className="w-3.5 h-3.5" /> {pending ? "Saving…" : "Save"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}

function SlotRow({
  slot, index, onUpdate, onRemove,
}: {
  slot:     DraftSlot
  index:    number
  onUpdate: (patch: Partial<DraftSlot>) => void
  onRemove: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: slot.tempKey })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex:    isDragging ? 50 : "auto" as const,
  }
  return (
    <div ref={setNodeRef} style={style}
      className={cn(
        "bg-white rounded-lg border p-2 flex items-center gap-2",
        slot.isBreak ? "border-amber-200 bg-amber-50/30" : "border-slate-200",
        isDragging && "shadow-lg"
      )}>
      <button {...attributes} {...listeners}
        className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing">
        <GripVertical className="w-4 h-4" />
      </button>
      <span className="text-[10px] font-bold text-slate-400 w-5 text-center">{index}</span>
      <Input value={slot.label} onChange={e => onUpdate({ label: e.target.value })}
        placeholder="Label"
        className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg flex-1 font-medium" />
      <Input type="time" value={slot.startTime} onChange={e => onUpdate({ startTime: e.target.value })}
        className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg w-24" />
      <span className="text-[10px] text-slate-400">→</span>
      <Input type="time" value={slot.endTime} onChange={e => onUpdate({ endTime: e.target.value })}
        className="h-8 text-xs bg-slate-50 border-slate-200 rounded-lg w-24" />
      <label className="flex items-center gap-1 text-[10px] text-slate-600 cursor-pointer">
        <Checkbox checked={slot.isBreak} onCheckedChange={(v) => onUpdate({ isBreak: !!v })}
          className="cursor-pointer h-3.5 w-3.5" />
        Break
      </label>
      <Button size="icon" variant="ghost" onClick={onRemove}
        className="h-7 w-7 cursor-pointer text-rose-600 hover:bg-rose-50">
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  )
}

function addMinutes(time: string, mins: number): string {
  const [h, m] = time.split(":").map(Number)
  const total = h * 60 + m + mins
  const hh = Math.floor(total / 60) % 24
  const mm = total % 60
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`
}
