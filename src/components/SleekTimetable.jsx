import React from "react";
import { Clock, Coffee, MapPin, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { getSubjectColor } from "@/lib/colorUtils";

export default function SleekTimetable({ timetable, days, slots, onSlotClick }) {
  if (!timetable) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6 mt-6">
      {days.map((day, dayIdx) => {
        // Get entries for this day, sorted by time
        const dayEntries = slots.map((slot) => {
          const entry = timetable[day]?.find((e) => e.slot === slot);
          return { slot, ...entry };
        });

        const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;

        return (
          <div key={day} className="flex flex-col gap-4">
            {/* --- Day Header --- */}
            <div className={cn(
              "p-4 rounded-2xl text-center font-bold shadow-sm border transition-all",
              isToday
                ? "bg-indigo-600 text-white border-indigo-500 shadow-indigo-200"
                : "bg-white text-slate-700 border-slate-200"
            )}>
              <span className="text-lg tracking-tight">{day}</span>
              {isToday && <span className="block text-xs font-normal opacity-80 mt-1">Today</span>}
            </div>

            {/* --- Time Slots --- */}
            <div className="flex flex-col gap-3">
              {dayEntries.map((entry, idx) => {
                // 1. LUNCH BREAK
                if (entry.slot === "13:00") {
                  return (
                    <div key={idx} className="flex items-center justify-center p-3 rounded-xl bg-slate-50 text-slate-400 text-xs border border-slate-200 border-dashed">
                      <Coffee className="w-3 h-3 mr-2" /> Lunch Break
                    </div>
                  );
                }

                // 2. EMPTY SLOT
                if (!entry.subject_id) {
                  return (
                    <div key={idx} className="group p-4 rounded-2xl bg-white border border-slate-100 min-h-[120px] flex flex-col items-center justify-center transition-all hover:border-slate-200 hover:shadow-sm">
                      <span className="text-slate-300 font-mono text-xs mb-1">{entry.slot}</span>
                      <span className="text-slate-300 text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity">Free Slot</span>
                    </div>
                  );
                }

                // 3. CLASS CARD
                const colors = getSubjectColor(entry.subject);

                return (
                  <div
                    key={idx}
                    onClick={() => onSlotClick && onSlotClick(entry)}
                    className={cn(
                      "relative group",
                      onSlotClick ? "cursor-pointer hover:scale-[1.02] active:scale-95 transition-transform" : ""
                    )}
                  >
                    <div className={cn(
                      "p-5 rounded-2xl border shadow-sm transition-all hover:shadow-md",
                      colors.bg,
                      colors.border
                    )}>
                      {/* Time Pill */}
                      <div className="flex justify-between items-start mb-3">
                        <div className="bg-white/60 backdrop-blur-sm px-2 py-1 rounded-lg border border-black/5">
                          <span className={cn("text-xs font-bold font-mono flex items-center gap-1", colors.text)}>
                            <Clock className="w-3 h-3" /> {entry.slot}
                          </span>
                        </div>
                        <div className={cn("px-2 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider", colors.badge)}>
                          {entry.class_name.split(" ")[0]} {/* e.g. CSE */}
                        </div>
                      </div>

                      {/* Subject Name */}
                      <h3 className={cn("font-bold text-lg leading-snug mb-1", colors.text)}>
                        {entry.subject}
                      </h3>

                      {/* Room Badge & Teacher Name */}
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-1 text-slate-600 text-xs font-medium">
                          <MapPin className="w-3 h-3 opacity-50" />
                          {entry.room_name || "No Room"}
                        </div>
                        {entry.teacher_name && (
                          <div className="flex items-center gap-1 text-slate-500 text-[10px] font-medium bg-white/50 px-1.5 py-0.5 rounded-md border border-black/5">
                            <User className="w-3 h-3 opacity-50" />
                            {entry.teacher_name}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}