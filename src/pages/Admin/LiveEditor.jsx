import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Loader2, ArrowLeft, RefreshCw, CheckCircle2, Ban } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSubjectColor } from '@/lib/colorUtils';
import { cn } from '@/lib/utils';
import CustomToast from '@/components/ui/CustomToast';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
const SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];
const LUNCH_SLOT = "13:00";

export default function LiveEditor() {
  const { branch, semester } = useParams();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [timetable, setTimetable] = useState([]); 
  
  const [teacherAvailability, setTeacherAvailability] = useState({});
  const [teacherBusySlots, setTeacherBusySlots] = useState({});
  
  const [draggedId, setDraggedId] = useState(null);
  const [hoveredSlot, setHoveredSlot] = useState(null);
  const [notification, setNotification] = useState(null);

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type, id: Date.now() });
  };

  useEffect(() => {
    fetchData();
  }, [branch, semester]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: currentData } = await supabase
        .from('timetable')
        .select('*, subject:subjects(name), teacher:users!timetable_teacher_id_fkey(name), room:rooms(name)')
        .eq('branch', branch)
        .eq('semester', semester);

      if (currentData) {
        const normalized = currentData.map(c => ({
          ...c,
          start_time: c.start_time.slice(0, 5) 
        }));
        setTimetable(normalized);
        
        const teacherIds = [...new Set(normalized.map(c => c.teacher_id).filter(Boolean))];
        if (teacherIds.length > 0) {
          await fetchConstraints(teacherIds, normalized);
        }
      }
    } catch (error) {
      console.error("Fetch error:", error);
      showNotification("Failed to load timetable data", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchConstraints = async (teacherIds, currentClasses) => {
    // 1. Availability
    const { data: availData } = await supabase
      .from('teacher_availability')
      .select('teacher_id, day_of_week')
      .in('teacher_id', teacherIds);
    
    const availMap = {};
    availData?.forEach(r => {
      if (!availMap[r.teacher_id]) availMap[r.teacher_id] = new Set();
      availMap[r.teacher_id].add(r.day_of_week);
    });
    setTeacherAvailability(availMap);

    // 2. Busy Slots
    const currentIds = currentClasses.map(c => c.id);
    const { data: busyData } = await supabase
      .from('timetable')
      .select('teacher_id, day, start_time')
      .in('teacher_id', teacherIds);
      
    const busyMap = {};
    busyData?.forEach(r => {
      if (!currentIds.includes(r.id)) {
        const key = `${r.teacher_id}-${r.day}-${r.start_time.slice(0, 5)}`;
        busyMap[key] = true;
      }
    });
    setTeacherBusySlots(busyMap);
  };

  const validateMove = (classObj, targetDay, targetTime) => {
    if (!classObj) return { valid: false };
    
    const teacherId = classObj.teacher_id;
    const teacherName = classObj.teacher?.name || "Teacher";

    if (teacherAvailability[teacherId] && !teacherAvailability[teacherId].has(targetDay)) {
      return { valid: false, reason: `${teacherName} off on ${targetDay}` };
    }

    const busyKey = `${teacherId}-${targetDay}-${targetTime}`;
    if (teacherBusySlots[busyKey]) {
      return { valid: false, reason: `${teacherName} busy elsewhere` };
    }

    return { valid: true, reason: "Available" };
  };

  const handleDragStart = (e, id) => {
    setDraggedId(id);
    e.dataTransfer.effectAllowed = "move";
    // Make element semi-transparent while dragging
    setTimeout(() => e.target.classList.add('opacity-50'), 0);
  };

  const handleDragEnd = (e) => {
    e.target.classList.remove('opacity-50');
    setDraggedId(null);
    setHoveredSlot(null);
  };

  const handleDragOver = (e, day, time) => {
    e.preventDefault();
    if (hoveredSlot?.day !== day || hoveredSlot?.time !== time) {
      setHoveredSlot({ day, time });
    }
  };

  const handleDrop = async (e, day, time) => {
    e.preventDefault();
    setHoveredSlot(null);
    if (!draggedId) return;

    const draggedClass = timetable.find(c => c.id === draggedId);
    if (!draggedClass) return;

    const targetClass = timetable.find(c => c.day === day && c.start_time === time);

    const check1 = validateMove(draggedClass, day, time);
    if (!check1.valid) {
      showNotification(`Cannot move: ${check1.reason}`, "error");
      return;
    }

    if (targetClass) {
      const check2 = validateMove(targetClass, draggedClass.day, draggedClass.start_time);
      if (!check2.valid) {
        showNotification(`Cannot swap: ${check2.reason}`, "error");
        return;
      }
    }

    const newTimetable = timetable.map(item => {
      if (item.id === draggedId) {
        return { ...item, day: day, start_time: time };
      }
      if (targetClass && item.id === targetClass.id) {
        return { ...item, day: draggedClass.day, start_time: draggedClass.start_time };
      }
      return item;
    });

    setTimetable(newTimetable);

    setSaving(true);
    try {
      const updates = [
        { id: draggedId, day: day, start_time: time }
      ];
      if (targetClass) {
        updates.push({ id: targetClass.id, day: draggedClass.day, start_time: draggedClass.start_time });
      }

      for (const update of updates) {
        await supabase.from('timetable').update({ 
          day: update.day, 
          start_time: update.start_time 
        }).eq('id', update.id);
      }
      
      showNotification("Timetable updated successfully!", "success");

    } catch (err) {
      console.error("Save failed", err);
      showNotification("Failed to save changes. Refreshing...", "error");
      fetchData(); 
    } finally {
      setSaving(false);
      setDraggedId(null);
    }
  };

  if (loading) return <div className="h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-50 p-6 font-sans text-slate-900 relative">
      
      <CustomToast notification={notification} onClose={() => setNotification(null)} />

      <header className="flex justify-between items-center mb-8 max-w-7xl mx-auto">
        <div>
          <Button variant="ghost" onClick={() => navigate('/admin')} className="mb-2 pl-0 text-slate-500 hover:text-slate-900">
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          <h1 className="text-3xl font-bold text-slate-900">Live Editor <span className="text-indigo-600 text-lg ml-2 bg-indigo-50 px-2 py-1 rounded-md">Beta</span></h1>
          <p className="text-slate-500">Drag and drop to reschedule or swap classes.</p>
        </div>
        <div className="flex items-center gap-4">
          {saving && <span className="text-sm text-slate-500 animate-pulse flex items-center"><RefreshCw className="w-3 h-3 mr-2 animate-spin" /> Saving...</span>}
          <div className="flex gap-2 text-xs font-medium text-slate-500 bg-white p-2 rounded-lg border border-slate-200 shadow-sm">
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-emerald-500 rounded-full"></div> Valid</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 bg-red-500 rounded-full"></div> Conflict</div>
          </div>
        </div>
      </header>

      {/* --- The Grid Layout --- */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 max-w-7xl mx-auto">
        {DAYS.map(day => (
          <div key={day} className="flex flex-col gap-4">
            {/* Day Header */}
            <div className="p-4 rounded-2xl text-center font-bold shadow-sm border bg-white text-slate-700 border-slate-200">
              <span className="text-lg tracking-tight">{day}</span>
            </div>

            {/* Time Slots */}
            <div className="flex flex-col gap-3">
              {SLOTS.map(time => {
                if (time === LUNCH_SLOT) {
                  return (
                    <div key={day+time} className="flex items-center justify-center p-3 rounded-xl bg-slate-100 border border-slate-200 border-dashed text-xs text-slate-400 font-medium">
                      LUNCH BREAK
                    </div>
                  );
                }

                const classInSlot = timetable.find(c => c.day === day && c.start_time === time);
                const isHovered = hoveredSlot?.day === day && hoveredSlot?.time === time;
                const draggedClass = draggedId ? timetable.find(c => c.id === draggedId) : null;
                
                let isValid = true;
                if (isHovered && draggedClass) {
                  isValid = validateMove(draggedClass, day, time).valid;
                }

                const colors = classInSlot ? getSubjectColor(classInSlot.subject?.name) : {};

                return (
                  <div
                    key={day+time}
                    onDragOver={(e) => handleDragOver(e, day, time)}
                    onDrop={(e) => handleDrop(e, day, time)}
                    className={cn(
                      "relative min-h-[120px] rounded-xl transition-all duration-200 border-2",
                      // Empty Slot
                      !classInSlot && "bg-slate-50/50 border-dashed border-slate-200 hover:border-slate-300",
                      // Filled Slot
                      classInSlot && `bg-white ${colors.border} shadow-sm`,
                      
                      // Drag Feedback
                      isHovered && isValid && "bg-emerald-50 border-emerald-400 ring-2 ring-emerald-200 scale-[1.02] z-10",
                      isHovered && !isValid && "bg-red-50 border-red-400 ring-2 ring-red-200 scale-[1.02] z-10",
                    )}
                  >
                    {/* Empty Slot Hint */}
                    {!classInSlot && (
                      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <span className="text-xs font-mono text-slate-300 group-hover:text-slate-400 transition-colors">{time}</span>
                      </div>
                    )}

                    {/* Class Card */}
                    {classInSlot && (
                      <div
                        draggable
                        onDragStart={(e) => handleDragStart(e, classInSlot.id)}
                        onDragEnd={handleDragEnd}
                        className="h-full w-full p-4 flex flex-col justify-between cursor-grab active:cursor-grabbing"
                      >
                        <div>
                          <div className="flex justify-between items-start mb-2">
                            <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-bold uppercase tracking-wider", colors.badge)}>
                              {classInSlot.class_name.split(" ")[0]}
                            </span>
                            <span className="text-[10px] font-mono text-slate-400">{time}</span>
                          </div>
                          <h4 className={cn("text-sm font-bold leading-tight", colors.text)}>
                            {classInSlot.subject?.name}
                          </h4>
                        </div>
                        
                        <div className="mt-3 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500 font-medium">
                          <span className="truncate max-w-[80px]">{classInSlot.teacher?.name}</span>
                          <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[10px]">{classInSlot.room?.name}</span>
                        </div>
                      </div>
                    )}
                    
                    {/* Conflict Tooltip */}
                    {isHovered && !isValid && (
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow-lg font-bold animate-in fade-in zoom-in-95 whitespace-nowrap z-20 flex items-center gap-1">
                        <Ban className="w-3 h-3" />
                        {validateMove(draggedClass, day, time).reason}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}