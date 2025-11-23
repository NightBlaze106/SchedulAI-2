import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import SleekTimetable from '@/components/SleekTimetable';
import StudentNotifications from '@/components/student/StudentNotifications';
import { Loader2, BookOpen, User, Bell } from 'lucide-react';

export default function StudentDashboard() {
  const { branch, semester } = useParams();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef(null);

  // Constants
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const slots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

  // Close notifications when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch the timetable for this Branch & Semester
      // We use 'timetable_teacher_id_fkey' to get the teacher's name
      const { data: rawData, error } = await supabase
        .from('timetable')
        .select(`
          slot: start_time,
          day,
          class_name,
          subject: subjects(name),
          room: rooms(name),
          teacher: users!timetable_teacher_id_fkey(name)
        `)
        .eq('branch', branch)
        .eq('semester', semester);

      if (error) {
        console.error("Error fetching student timetable:", error);
        setLoading(false);
        return;
      }

      // Process Data for SleekTimetable component
      const timetableObj = {};
      days.forEach(day => {
        timetableObj[day] = [];
        rawData.filter(r => r.day === day).forEach(r => {
          timetableObj[day].push({
            slot: r.slot.slice(0, 5),
            subject: r.subject?.name,
            class_name: r.class_name, // Use the actual class name
            teacher_name: r.teacher?.name, // Pass teacher name separately
            room_name: r.room?.name,
            subject_id: "true"
          });
        });
      });

      setTimetable(timetableObj);
      setLoading(false);
    }

    fetchData();
  }, [branch, semester]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-900">
        <Loader2 className="animate-spin w-8 h-8" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans relative overflow-hidden">

      {/* Background Blobs */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-violet-200/30 rounded-full blur-[100px] translate-x-1/2 translate-y/2 pointer-events-none" />

      {/* --- Top Navbar --- */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">

          {/* Left: Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-emerald-600 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-200">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">Student Portal</span>
          </div>

          {/* Right: Status & Profile */}
          <div className="flex items-center gap-4 md:gap-6">

            {/* Notification Bell */}
            <div className="relative" ref={notificationRef}>
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors relative"
              >
                <Bell className="w-5 h-5" />
                {/* Optional: Add unread badge here if needed */}
              </button>

              {/* Popup */}
              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                  <StudentNotifications branch={branch} semester={semester} />
                </div>
              )}
            </div>

            {/* Live Indicator */}
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-100 rounded-full animate-pulse">
              <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
              <span className="text-[10px] font-bold text-red-500 tracking-wider uppercase">Live</span>
            </div>

            {/* Student Info Chip */}
            <div className="flex items-center gap-3 pl-4 md:pl-6 border-l border-slate-200">
              <div className="text-right hidden sm:block">
                <p className="text-sm font-semibold text-slate-900 leading-none mb-1">{branch}</p>
                <p className="text-xs text-slate-500">Semester {semester}</p>
              </div>
              <div className="w-9 h-9 rounded-full bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 font-bold text-sm">
                {branch?.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto p-4 lg:p-8 relative z-10">
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="flex items-end justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-slate-900 mb-1">Weekly Schedule</h1>
              <p className="text-slate-500 text-sm">View your classes and upcoming events.</p>
            </div>
          </div>

          <SleekTimetable timetable={timetable} days={days} slots={slots} />
        </div>
      </main>
    </div>
  );
}