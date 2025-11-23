import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Send, User, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function TeacherChat({ teacherId }) {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    // 1. Fetch initial messages
    async function fetchMessages() {
      const { data } = await supabase
        .from('messages')
        .select('*, users(name)')
        .order('created_at', { ascending: true })
        .limit(50);
      if (data) setMessages(data);
    }
    fetchMessages();

    // 2. Subscribe to new messages (Realtime!)
    const channel = supabase
      .channel('public:messages')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' },
        async (payload) => {
          // Fetch the user name for the new message
          const { data: userData } = await supabase.from('users').select('name').eq('id', payload.new.user_id).single();
          const newMsg = { ...payload.new, users: userData };
          setMessages(prev => [...prev, newMsg]);
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    await supabase.from('messages').insert([{ user_id: teacherId, content: newMessage }]);
    setNewMessage("");
  };

  return (
    <div className="flex flex-col h-[600px] bg-white/80 backdrop-blur-xl rounded-2xl border border-white/20 shadow-xl overflow-hidden relative">
      {/* Header */}
      <div className="p-4 bg-white/50 border-b border-slate-100 flex items-center gap-3 backdrop-blur-md sticky top-0 z-10">
        <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600">
          <MessageSquare className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-slate-900">Staff Room</h3>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-xs text-slate-500 font-medium">Live Chat</span>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-50/50">
        {messages.map((msg) => {
          const isMe = msg.user_id === teacherId;
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} max-w-[75%]`}>
                {!isMe && (
                  <span className="text-xs font-semibold text-slate-500 mb-1 ml-1">{msg.users?.name}</span>
                )}
                <div
                  className={`px-4 py-2.5 rounded-2xl shadow-sm text-sm leading-relaxed ${isMe
                      ? 'bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-none'
                      : 'bg-white text-slate-700 border border-slate-100 rounded-bl-none'
                    }`}
                >
                  {msg.content}
                </div>
                <span className="text-[10px] text-slate-400 mt-1 mx-1 opacity-70">
                  {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input Area */}
      <form onSubmit={handleSend} className="p-4 bg-white border-t border-slate-100 flex gap-2 relative z-10">
        <Input
          value={newMessage}
          onChange={e => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="bg-slate-50 border-slate-200 text-slate-900 focus-visible:ring-indigo-500 rounded-full px-4"
        />
        <Button size="icon" className="rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200 shrink-0 w-10 h-10">
          <Send className="w-4 h-4 ml-0.5" />
        </Button>
      </form>
    </div>
  );
}