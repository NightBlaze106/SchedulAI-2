import React from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/**
 * Helper function to find an item in a list by its ID
 */
function findById(array, id) {
  return array.find((item) => item.id === id);
}

export default function TimetableGrid({
  timetable,
  subjects = [],
  teachers = [],
  rooms = [],
}) {
  if (!timetable) return null;

  const days = Object.keys(timetable);
  const slots =
    timetable[days[0]]?.map((slot) => slot.slot) || [];

  return (
    <Card className="mt-8 border border-slate-200 shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">
          Generated Timetable
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-slate-200 text-sm">
            <thead className="bg-slate-100 text-slate-700">
              <tr>
                <th className="border border-slate-200 p-2 text-left">Time</th>
                {days.map((day) => (
                  <th
                    key={day}
                    className="border border-slate-200 p-2 text-center"
                  >
                    {day}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {slots.map((slot) => {
                
                // --- MODIFIED LUNCH BREAK LOGIC ---
                // Intercept the "13:00" slot to show the break
                if (slot === "13:00") {
                  return (
                    <tr key="lunch" className="bg-green-50 text-green-700 font-medium">
                      <td className="border border-slate-200 p-2 font-medium">
                        13:00 - 14:00
                      </td>
                      <td
                        className="border border-slate-200 p-2 text-center"
                        colSpan={days.length}
                      >
                        🍱 Lunch Break
                      </td>
                    </tr>
                  );
                }
                // ------------------------------------

                // This renders a normal class row
                return (
                  <tr key={slot} className="even:bg-slate-50">
                    <td className="border border-slate-200 p-2 font-medium text-slate-600">
                      {slot}
                    </td>

                    {days.map((day) => {
                      const entry = timetable[day].find(
                        (item) => item.slot === slot
                      );

                      // Check for empty slot
                      if (!entry || !entry.subject_id) {
                        return (
                          <td
                            key={day + slot}
                            className="border border-slate-200 text-center text-slate-400 p-2"
                          >
                            –
                          </td>
                        );
                      }

                      // Find names from IDs
                      const subject = findById(subjects, entry.subject_id);
                      const teacher = findById(teachers, entry.teacher_id);
                      const room = findById(rooms, entry.room_id);

                      return (
                        <td
                          key={day + slot}
                          className="border border-slate-200 p-2 text-center"
                        >
                          <div className="flex flex-col items-center">
                            <span className="font-medium text-slate-800">
                              {subject?.name || "Unknown Sub"}
                            </span>
                            <Badge
                              variant="secondary"
                              className="mt-1 bg-slate-100 text-slate-600"
                            >
                              {teacher?.name || "Unknown Prof"}
                            </Badge>
                            <span className="text-xs text-slate-500 mt-1">
                              {room?.name || "No Room"}
                            </span>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}