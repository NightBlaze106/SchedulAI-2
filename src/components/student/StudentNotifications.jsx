import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Bell } from 'lucide-react';

export default function StudentNotifications({ branch, semester }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    if (!branch || !semester) return;

    async function fetchNotices() {
      // Fetch notices specifically for this class (or global notices)
      const { data } = await supabase
        .from('student_notices')
        .select('*')
        .match({ branch, semester }) // Simple filter
        .order('created_at', { ascending: false });

      setNotifications(data || []);
    }
    fetchNotices();

    // Realtime Subscription
    const channel = supabase
      .channel('student_notices')
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'student_notices', filter: `branch=eq.${branch}` },
        (payload) => {
          // Double check semester in the client callback
          if (payload.new.semester == semester) {
            setNotifications(prev => [payload.new, ...prev]);
          }
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [branch, semester]);

  return (
    <div className="w-80 max-h-96 overflow-y-auto bg-white rounded-xl shadow-xl border border-slate-200 p-4">
      <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2 sticky top-0 bg-white pb-2 border-b border-slate-100">
        <Bell className="w-4 h-4 text-indigo-600" /> Notice Board
      </h3>
      <div className="space-y-3">
        {notifications.length === 0 && <p className="text-slate-500 text-xs text-center py-4">No new notices.</p>}

        {notifications.map(note => (
          <div key={note.id} className="p-3 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 transition-colors">
            <h4 className="text-sm font-medium text-slate-800">{note.title}</h4>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">{note.message}</p>
            <span className="text-[10px] text-slate-400 mt-2 block">
              {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}