import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader2, Bot, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { supabase } from '@/lib/supabaseClient';
import { API_BASE } from '@/lib/api'; // <--- THIS WAS MISSING

export default function TeacherAIWidget({ teacherId }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'ai', content: "Hi! I'm your AI assistant. Ask me about your schedule, class requests, or today's topics." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg = input;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/ai-chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacher_id: teacherId, message: userMsg })
      });

      const data = await response.json();

      if (response.ok) {
        setMessages(prev => [...prev, { role: 'ai', content: data.response }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', content: "Sorry, I encountered an error. Please try again." }]);
      }
    } catch (error) {
      console.error("AI Error:", error);
      setMessages(prev => [...prev, { role: 'ai', content: "Network error. Is the backend running?" }]);
    } finally {
      setLoading(false);
    }
  };

  // --- Action Logic ---
  const executeClaim = async (teacherName, day, time, msgIndex) => {
    // 1. Find Teacher
    const { data: teachers } = await supabase.from('users').select('id, name').ilike('name', `%${teacherName}%`).eq('role', 'teacher');

    if (!teachers || teachers.length === 0) {
      updateMessage(msgIndex, `❌ Could not find a teacher named "${teacherName}".`);
      return;
    }
    if (teachers.length > 1) {
      updateMessage(msgIndex, `⚠️ Found multiple teachers matching "${teacherName}". Please be more specific.`);
      return;
    }
    const targetTeacher = teachers[0];

    
    const { data: classes } = await supabase
      .from('timetable')
      .select('id, subject:subjects(name)')
      .eq('teacher_id', targetTeacher.id)
      .eq('day', day)
      .ilike('start_time', `${time}%`); // Match "09:00" in "09:00:00"

    if (!classes || classes.length === 0) {
      updateMessage(msgIndex, `❌ ${targetTeacher.name} does not have a class on ${day} at ${time}.`);
      return;
    }
    const targetClass = classes[0];

    // 3. Send Request
    const { error } = await supabase.from('class_requests').insert([{
      from_teacher_id: teacherId,
      to_teacher_id: targetTeacher.id,
      timetable_id: targetClass.id,
      status: 'pending'
    }]);

    if (error) {
      updateMessage(msgIndex, `❌ Error sending request: ${error.message}`);
    } else {
      // Notify
      await supabase.from('notifications').insert([{
        user_id: targetTeacher.id,
        title: "Class Claim Request",
        message: "A teacher has offered to take your class via AI Assistant.",
        is_read: false
      }]);
      updateMessage(msgIndex, `✅ Request sent to ${targetTeacher.name} for ${targetClass.subject?.name}!`);
    }
  };

  const updateMessage = (index, newContent) => {
    setMessages(prev => prev.map((m, i) => i === index ? { ...m, actionResult: newContent } : m));
  };

  // --- Render Helper ---
  const renderMessageContent = (msg, idx) => {
    // Check for [[CLAIM: ...]] tag
    const claimRegex = /\[\[CLAIM:\s*(.*?)\s*\|\s*(.*?)\s*\|\s*(.*?)\]\]/;
    const match = msg.content.match(claimRegex);

    if (match && msg.role === 'ai') {
      const [fullTag, tName, tDay, tTime] = match;
      const displayContent = msg.content.replace(fullTag, "").trim();

      return (
        <div className="space-y-3">
          <div className="markdown-content">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{displayContent}</ReactMarkdown>
          </div>

          {/* Action Card */}
          <div className="bg-slate-900/50 border border-indigo-500/30 rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-indigo-200 text-xs font-semibold uppercase tracking-wider">
              <Sparkles className="w-3 h-3" /> Suggested Action
            </div>
            <div className="text-sm text-white font-medium">
              Claim {tName}'s class on {tDay} at {tTime}?
            </div>

            {msg.actionResult ? (
              <div className="text-xs p-2 rounded bg-slate-800 border border-slate-700 text-slate-300">
                {msg.actionResult}
              </div>
            ) : (
              <Button
                size="sm"
                onClick={() => executeClaim(tName, tDay, tTime, idx)}
                className="w-full bg-indigo-600 hover:bg-indigo-500 text-white"
              >
                Confirm & Send Request
              </Button>
            )}
          </div>
        </div>
      );
    }

    // Normal Message
    if (msg.role === 'ai') {
      return (
        <div className="markdown-content space-y-2">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              p: ({ node, ...props }) => <p className="mb-2 last:mb-0" {...props} />,
              ul: ({ node, ...props }) => <ul className="list-disc pl-4 mb-2 space-y-1" {...props} />,
              ol: ({ node, ...props }) => <ol className="list-decimal pl-4 mb-2 space-y-1" {...props} />,
              li: ({ node, ...props }) => <li className="pl-1" {...props} />,
              strong: ({ node, ...props }) => <span className="font-bold text-indigo-300" {...props} />,
              table: ({ node, ...props }) => <div className="overflow-x-auto my-2 rounded-lg border border-slate-700"><table className="w-full text-xs text-left" {...props} /></div>,
              thead: ({ node, ...props }) => <thead className="bg-slate-900/50 text-slate-300 uppercase" {...props} />,
              th: ({ node, ...props }) => <th className="px-3 py-2 font-semibold" {...props} />,
              td: ({ node, ...props }) => <td className="px-3 py-2 border-t border-slate-700/50" {...props} />,
            }}
          >
            {msg.content}
          </ReactMarkdown>
        </div>
      );
    }

    return msg.content;
  };

  return (
    <div className="fixed bottom-8 right-8 z-50 flex flex-col items-end gap-4 font-sans">
      {/* Chat Window */}
      {isOpen && (
        <Card className="w-96 h-[500px] flex flex-col shadow-2xl animate-in slide-in-from-bottom-10 fade-in duration-300 border-0 overflow-hidden rounded-3xl bg-slate-900/95 backdrop-blur-xl ring-1 ring-white/10">
          {/* Header */}
          <div className="p-4 bg-gradient-to-r from-indigo-600 to-violet-600 flex justify-between items-center text-white shadow-lg z-10">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm leading-tight">AI Assistant</h3>
                <p className="text-[10px] text-indigo-100 opacity-90">Always here to help</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 hover:bg-white/20 text-white rounded-full transition-colors"
              onClick={() => setIsOpen(false)}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
            {messages.map((msg, idx) => (
              <div key={idx} className={cn(
                "flex w-full animate-in fade-in slide-in-from-bottom-2 duration-300",
                msg.role === 'user' ? "justify-end" : "justify-start"
              )}>
                <div className={cn(
                  "max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm leading-relaxed",
                  msg.role === 'user'
                    ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white rounded-br-sm"
                    : "bg-slate-800/80 text-slate-200 rounded-bl-sm border border-slate-700/50"
                )}>
                  {renderMessageContent(msg, idx)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start animate-in fade-in slide-in-from-bottom-2">
                <div className="bg-slate-800/80 p-4 rounded-2xl rounded-bl-sm border border-slate-700/50 flex gap-1.5 items-center">
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.3s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:-0.15s]" />
                  <div className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce" />
                </div>
              </div>
            )}
            <div ref={scrollRef} />
          </div>

          {/* Input */}
          <form onSubmit={handleSend} className="p-4 bg-slate-900/50 border-t border-white/5 flex gap-2 backdrop-blur-md">
            <Input
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask about your schedule..."
              className="bg-slate-800/50 border-slate-700/50 text-white placeholder:text-slate-500 focus-visible:ring-indigo-500/50 focus-visible:border-indigo-500/50 rounded-xl"
            />
            <Button
              type="submit"
              size="icon"
              className={cn(
                "bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl transition-all duration-300",
                loading ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg hover:shadow-indigo-500/25 hover:scale-105"
              )}
              disabled={loading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </Card>
      )}

      {/* Toggle Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group relative h-16 w-16 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-2xl shadow-indigo-500/40 flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-indigo-500/60 active:scale-95"
        >
          <div className="absolute inset-0 rounded-full bg-white/20 animate-ping opacity-20" />
          <Sparkles className="w-7 h-7 fill-white/20 group-hover:rotate-12 transition-transform duration-300" />
        </button>
      )}
    </div>
  );
}
