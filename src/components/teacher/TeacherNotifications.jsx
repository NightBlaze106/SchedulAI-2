
import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Bell, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function TeacherNotifications({ teacherId }) {
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    fetchNotes();

    // Enable Realtime Notifications
    const channel = supabase
      .channel('notifications_channel')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id = eq.${teacherId} ` },
        (payload) => {
          setNotifications(prev => [payload.new, ...prev]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [teacherId]);

  async function fetchNotes() {
    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', teacherId)
      .order('created_at', { ascending: false })
      .limit(10); // Limit to recent 10 for popup
    setNotifications(data || []);
  }

  const markAsRead = async (id) => {
    await supabase.from('notifications').update({ is_read: true }).eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllRead = async () => {
    await supabase.from('notifications').update({ is_read: true }).eq('user_id', teacherId);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  return (
    <div className="w-80 max-h-[400px] overflow-y-auto bg-white rounded-xl shadow-2xl border border-slate-200 flex flex-col">
      <div className="p-3 border-b border-slate-100 flex justify-between items-center bg-slate-50 sticky top-0 z-10">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Bell className="w-4 h-4 text-indigo-600" /> Notifications
        </h3>
        <Button variant="ghost" size="xs" onClick={markAllRead} className="text-xs text-indigo-600 hover:text-indigo-700 h-6 px-2">
          Mark all read
        </Button>
      </div>

      <div className="divide-y divide-slate-100">
        {notifications.length === 0 && (
          <div className="p-8 text-center text-slate-500 text-sm">
            <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" />
            No notifications
          </div>
        )}
        {notifications.map(note => (
          <div
            key={note.id}
            className={`p-3 hover:bg-slate-50 transition-colors cursor-pointer relative group ${!note.is_read ? 'bg-indigo-50/50' : ''} `}
            onClick={() => markAsRead(note.id)}
          >
            <div className="flex justify-between items-start gap-2">
              <div>
                <h4 className={`text-sm ${!note.is_read ? 'font-semibold text-slate-900' : 'font-medium text-slate-600'} `}>
                  {note.title}
                </h4>
                <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{note.message}</p>
                <span className="text-[10px] text-slate-400 mt-1 block">
                  {new Date(note.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              {!note.is_read && (
                <div className="w-2 h-2 rounded-full bg-indigo-600 mt-1.5 shrink-0" />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
