import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import TimetableGrid from './TimetableGrid';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Helper to convert flat Supabase data to the nested object TimetableGrid expects
function formatTimetable(data, days, slots) {
  const timetable = {};

  for (const day of days) {
    // Filter entries for the current day and sort them by slot
    const dayEntries = data
      .filter((entry) => entry.day === day)
      .sort((a, b) => slots.indexOf(a.start_time) - slots.indexOf(b.start_time));

    // Map to the format TimetableGrid expects
    timetable[day] = slots.map(slot => {
      // Find the entry that *starts* at this slot
      const entry = dayEntries.find(e => e.start_time.startsWith(slot));
      if (entry) {
        return {
          slot: slot,
          subject_id: entry.subject_id,
          teacher_id: entry.teacher_id,
          room_id: entry.room_id,
        };
      }
      // Fill blank
      return { slot: slot, subject_id: null, teacher_id: null, room_id: null };
    });
  }
  return timetable;
}

export default function ViewTimetable() {
  const { branch, semester } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [timetable, setTimetable] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [rooms, setRooms] = useState([]);

  // --- THIS WAS THE BUG. IT IS NOW FIXED. ---
  // These must match the slots used during generation
  const [days] = useState(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  const [slots] = useState([
    "09:00", 
    "10:00", 
    "11:00", 
    "12:00", 
    "13:00", // Lunch Slot
    "14:00", 
    "15:00"
  ]);
  // ------------------------------------------

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      // Fetch all required data in parallel
      const [ttData, subjectData, teacherData, roomData] = await Promise.all([
        supabase.from('timetable').select('*').eq('branch', branch).eq('semester', semester),
        supabase.from('subjects').select('*').eq('branch', branch).eq('semester', semester),
        supabase.from('users').select('id, name').eq('role', 'teacher'),
        supabase.from('rooms').select('*')
      ]);

      if (ttData.error || subjectData.error || teacherData.error || roomData.error) {
        console.error('Error fetching data:', ttData.error || subjectData.error || teacherData.error || roomData.error);
        setLoading(false);
        return;
      }

      // Set data for the grid
      setSubjects(subjectData.data);
      setTeachers(teacherData.data);
      setRooms(roomData.data);

      // Format the flat timetable data
      // This will now correctly process the 7-slot day
      const formatted = formatTimetable(ttData.data, days, slots);
      setTimetable(formatted);
      setLoading(false);
    }

    fetchData();
  }, [branch, semester]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="outline" onClick={() => navigate('/admin')}>
        &larr; Back to Dashboard
      </Button>
      <TimetableGrid
        timetable={timetable}
        subjects={subjects}
        teachers={teachers}
        rooms={rooms}
      />
    </div>
  );
}