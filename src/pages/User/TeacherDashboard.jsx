import React, { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import SleekTimetable from "@/components/SleekTimetable";
import TeacherChat from "@/components/teacher/TeacherChat";
import TeacherRequests from "@/components/teacher/TeacherRequests";
import TeacherNotifications from "@/components/teacher/TeacherNotifications";
import TeacherAIWidget from "@/components/teacher/TeacherAIWidget";
import {
  Loader2,
  Calendar,
  MessageSquare,
  Bell,
  ArrowRightLeft,
  User,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import CustomToast from "@/components/ui/CustomToast";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";

const NavItem = ({ icon: Icon, label, id, activeId, onClick }) => (
  <button
    onClick={() => onClick(id)}
    className={cn(
      "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all",
      activeId === id
        ? "bg-slate-900 text-white shadow-md"
        : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
    )}
  >
    <Icon className="w-4 h-4" />
    <span>{label}</span>
  </button>
);

export default function TeacherDashboard() {
  const { teacherId } = useParams();
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState("timetable");
  
  // Toast State
  const [notification, setNotification] = useState(null);
  const showToast = (msg, type = "success") =>
    setNotification({ message: msg, type, id: Date.now() });

  // ... Existing State ...
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const notificationRef = useRef(null);
  const timetableRef = useRef(null); 

  const [fullTimetable, setFullTimetable] = useState(null);
  const [filteredTimetable, setFilteredTimetable] = useState(null);
  const [rawClasses, setRawClasses] = useState([]);
  const [teacherName, setTeacherName] = useState("");
  const [classList, setClassList] = useState([]);
  const [activeFilter, setActiveFilter] = useState("All Classes");

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const slots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

  // --- FETCH LOGIC ---
  // Moved outside useEffect so we can call it from the Realtime listener
  async function fetchData() {
      // Only show loader on initial load, not background refresh
      if (!fullTimetable) setLoading(true); 

      try {
        const { data: userData } = await supabase
          .from("users")
          .select("name")
          .eq("id", teacherId)
          .single();

        setTeacherName(userData?.name || "Teacher");

        const { data: rawData, error } = await supabase
          .from("timetable")
          .select(`
            id, slot: start_time, day, class_name,
            subject: subjects(name), room: rooms(name)
          `)
          .eq("teacher_id", teacherId);

        if (error) throw error;

        setRawClasses(rawData);

        const uniqueClasses = ["All Classes", ...new Set(rawData.map((r) => r.class_name))];
        setClassList(uniqueClasses);

        const processRows = (rows) => {
          const timetableObj = {};
          days.forEach((day) => {
            timetableObj[day] = [];
            rows
              .filter((r) => r.day === day)
              .forEach((r) => {
                timetableObj[day].push({
                  slot: r.slot.slice(0, 5),
                  subject: r.subject?.name,
                  room_name: r.room?.name,
                  class_name: r.class_name,
                  subject_id: "true",
                });
              });
          });
          return timetableObj;
        };

        const processed = processRows(rawData);
        setFullTimetable(processed);
        
        // Preserve filter if active
        if (activeFilter !== "All Classes") {
             const newTimetable = {};
             days.forEach((day) => {
                newTimetable[day] = processed[day].filter(
                  (entry) => entry.class_name === activeFilter
                );
             });
             setFilteredTimetable(newTimetable);
        } else {
             setFilteredTimetable(processed);
        }

      } catch (err) {
        console.error(err);
        showToast("Failed to load schedule", "error");
      } finally {
        setLoading(false);
      }
  }

  async function fetchUnreadCount() {
    const { count } = await supabase
      .from("notifications")
      .select("*", { count: "exact", head: true })
      .eq("user_id", teacherId)
      .eq("is_read", false);
    setUnreadCount(count || 0);
  }

  // --- INITIAL LOAD & REALTIME ---
  useEffect(() => {
    fetchData();
    fetchUnreadCount();

    // 1. Notification Listener
    const notificationChannel = supabase
      .channel("unread_count")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${teacherId}` },
        () => fetchUnreadCount()
      )
      .subscribe();
      
    // 2. Timetable Listener (NEW)
    const timetableChannel = supabase
      .channel("timetable_updates")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "timetable" },
        (payload) => {
          // Check if the change involves this teacher
          // 'new' might be null on DELETE, 'old' might be null on INSERT
          const isRelated = (payload.new && payload.new.teacher_id === teacherId) || 
                            (payload.old && payload.old.teacher_id === teacherId);
          
          if (isRelated) {
             console.log("Timetable updated, refreshing...");
             fetchData(); // Refresh data
             showToast("Schedule updated!", "success");
          }
        }
      )
      .subscribe();

    return () => {
        supabase.removeChannel(notificationChannel);
        supabase.removeChannel(timetableChannel);
    };
  }, [teacherId]); // Removed activeFilter dependency to avoid re-subscribing


  useEffect(() => {
    function handleClickOutside(event) {
      if (notificationRef.current && !notificationRef.current.contains(event.target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // --- Handlers ---

  const handleFilter = (filterName) => {
    setActiveFilter(filterName);
    if (filterName === "All Classes") {
      setFilteredTimetable(fullTimetable);
    } else {
      const newTimetable = {};
      days.forEach((day) => {
        newTimetable[day] = fullTimetable[day].filter(
          (entry) => entry.class_name === filterName
        );
      });
      setFilteredTimetable(newTimetable);
    }
  };

  const handleExportPDF = async () => {
    if (!timetableRef.current) return;
    showToast("Generating PDF...", "success");
    
    try {
      const element = timetableRef.current;
      const originalOverflow = element.style.overflow;
      const originalHeight = element.style.height;
      const originalWidth = element.style.width;

      element.style.overflow = 'visible'; 
      element.style.height = '1200px';
      element.style.width = '1800px'; 
      
      const canvas = await html2canvas(element, { 
        scale: 2, 
        useCORS: true,
        windowWidth: 1200 
      });
      
      element.style.overflow = originalOverflow;
      element.style.height = originalHeight;
      element.style.width = originalWidth;

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pageHeight = pdf.internal.pageSize.getHeight();
      let finalWidth = pdfWidth;
      let finalHeight = pdfHeight;
      
      if (pdfHeight > pageHeight) {
         const ratio = pageHeight / pdfHeight;
         finalWidth = pdfWidth * ratio;
         finalHeight = pageHeight;
      }

      pdf.addImage(imgData, 'PNG', 0, 10, finalWidth, finalHeight);
      pdf.save(`${teacherName.replace(/ /g, '_')}_Timetable.pdf`);
      
      showToast("Download complete!", "success");
    } catch (err) {
      console.error(err);
      showToast("Failed to generate PDF", "error");
    }
  };

  if (loading)
    return (
      <div className="min-h-screen bg-white flex items-center justify-center text-slate-900">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 relative overflow-hidden">
      <CustomToast
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Background Blobs */}
      <div className="fixed top-0 left-0 w-[500px] h-[500px] bg-indigo-200/30 rounded-full blur-[100px] -translate-x-1/2 -translate-y-1/2 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-[500px] h-[500px] bg-violet-200/30 rounded-full blur-[100px] translate-x-1/2 translate-y/2 pointer-events-none" />

      {/* --- Top Navigation --- */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-indigo-200 shadow-lg">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold tracking-tight text-slate-900">
                  Teacher Portal
                </span>
              </div>

              <div className="hidden md:flex items-center gap-2">
                <NavItem icon={Calendar} label="Timetable" id="timetable" activeId={activeView} onClick={setActiveView} />
                <NavItem icon={ArrowRightLeft} label="Requests" id="requests" activeId={activeView} onClick={setActiveView} />
                <NavItem icon={MessageSquare} label="Staff Chat" id="chat" activeId={activeView} onClick={setActiveView} />
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative" ref={notificationRef}>
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="p-2 rounded-full hover:bg-slate-100 text-slate-500 transition-colors relative"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white" />
                  )}
                </button>
                {showNotifications && (
                  <div className="absolute right-0 top-full mt-2 z-50 animate-in fade-in zoom-in-95 duration-200">
                    <TeacherNotifications teacherId={teacherId} />
                  </div>
                )}
              </div>

              <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
                <div className="text-right hidden sm:block">
                  <p className="text-sm font-semibold text-slate-900">{teacherName}</p>
                  <p className="text-xs text-slate-500">Faculty Member</p>
                </div>
                <div className="w-9 h-9 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600">
                  <User className="w-5 h-5" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* --- Main Content --- */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {activeView === "timetable" && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
            <header className="flex flex-col sm:flex-row sm:justify-between sm:items-end mb-8 gap-4">
              <div>
                <h1 className="text-3xl font-bold text-slate-900 mb-2">Weekly Schedule</h1>
                <p className="text-slate-500 text-lg">Manage your classes and stay organized.</p>
              </div>
              <div className="flex items-center gap-3">
                <Button variant="outline" className="border-slate-300 text-slate-700 hover:bg-slate-50" onClick={handleExportPDF}>
                  <Download className="w-4 h-4 mr-2" /> Export PDF
                </Button>
                <Button onClick={() => setActiveView("requests")} className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-200">
                  + Request Sub
                </Button>
              </div>
            </header>

            <div className="flex flex-wrap gap-2 mb-8 p-1 bg-slate-100/50 rounded-2xl w-fit border border-slate-200/60">
              {classList.map((cls) => (
                <button
                  key={cls}
                  onClick={() => handleFilter(cls)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-sm font-medium transition-all",
                    activeFilter === cls
                      ? "bg-white text-indigo-600 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-900 hover:bg-slate-200/50"
                  )}
                >
                  {cls}
                </button>
              ))}
            </div>

            <div ref={timetableRef} className="p-4 bg-white/50 rounded-3xl">
              <SleekTimetable timetable={filteredTimetable} days={days} slots={slots} />
            </div>
          </div>
        )}

        {activeView === "chat" && <TeacherChat teacherId={teacherId} />}

        {activeView === "requests" && (
          <TeacherRequests teacherId={teacherId} myClasses={rawClasses} onToast={showToast} />
        )}
      </main>

      <TeacherAIWidget teacherId={teacherId} />
    </div>
  );
}