import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Check, X, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import SleekTimetable from '@/components/SleekTimetable';

export default function TeacherRequests({ teacherId, myClasses, onToast }) {
  const [activeTab, setActiveTab] = useState('incoming'); 
  const [teachers, setTeachers] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);

  // Form State
  const [selectedClassId, setSelectedClassId] = useState('');
  const [targetTeacherId, setTargetTeacherId] = useState('');

  // Claim State
  const [claimTeacherId, setClaimTeacherId] = useState('');
  const [claimableTimetable, setClaimableTimetable] = useState(null);
  const [selectedClaimClass, setSelectedClaimClass] = useState(null);
  const [claimConflict, setClaimConflict] = useState(null);
  
  // --- NEW: My Subjects State ---
  const [mySubjects, setMySubjects] = useState([]);
  const [subjectToTeach, setSubjectToTeach] = useState('');
  // -----------------------------

  const [loading, setLoading] = useState(false);

  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const slots = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00"];

  useEffect(() => {
    fetchTeachers();
    fetchIncomingRequests();
    fetchMySubjects(); // <-- Fetch subjects I can teach

    const channel = supabase
      .channel('requests_channel')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'class_requests' }, () => {
        fetchIncomingRequests();
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [teacherId]);

  useEffect(() => {
    if (claimTeacherId) fetchTeacherClasses(claimTeacherId);
    else setClaimableTimetable(null);
  }, [claimTeacherId]);

  async function fetchTeachers() {
    const { data } = await supabase.from('users').select('id, name').eq('role', 'teacher').neq('id', teacherId);
    setTeachers(data || []);
  }
  
  // --- NEW: Fetch "My" Subjects ---
  // We find subjects linked to this teacher in the timetable to know what they teach
  async function fetchMySubjects() {
    // This is a heuristic: we look at what they are ALREADY teaching.
    const { data } = await supabase
        .from('timetable')
        .select('subject:subjects(id, name)')
        .eq('teacher_id', teacherId);
    
    if (data) {
        // Deduplicate subjects
        const unique = {};
        data.forEach(row => {
            if (row.subject) unique[row.subject.id] = row.subject.name;
        });
        // Convert back to array
        const subjectsArr = Object.keys(unique).map(id => ({ id, name: unique[id] }));
        setMySubjects(subjectsArr);
    }
  }

  async function fetchTeacherClasses(tId) {
    setLoading(true);
    const { data } = await supabase
      .from('timetable')
      .select('*, subject:subjects(name), room:rooms(name)')
      .eq('teacher_id', tId);

    if (data) {
      const timetableObj = {};
      days.forEach(day => {
        timetableObj[day] = [];
        data.filter(r => r.day === day).forEach(r => {
          timetableObj[day].push({
            id: r.id,
            slot: r.start_time.slice(0, 5),
            subject: r.subject?.name,
            room_name: r.room?.name,
            class_name: r.class_name,
            subject_id: "true",
            raw: r
          });
        });
      });
      setClaimableTimetable(timetableObj);
    }
    setLoading(false);
  }

  async function fetchIncomingRequests() {
    const { data: requests, error } = await supabase
      .from('class_requests')
      .select(`
        *,
        timetable:timetable (
          day, 
          start_time, 
          class_name, 
          branch, 
          semester,
          subject:subjects(name)
        ),
        new_subject:subjects(name) 
      `)
      .eq('to_teacher_id', teacherId)
      .eq('status', 'pending');
    
    // Note: added 'new_subject:subjects(name)' to query to show what they want to teach

    if (error) {
      console.error("Error fetching requests:", error);
      return;
    }

    if (!requests || requests.length === 0) {
      setIncomingRequests([]);
      return;
    }

    const senderIds = [...new Set(requests.map(r => r.from_teacher_id))];
    const { data: senders } = await supabase.from('users').select('id, name').in('id', senderIds);
    const senderMap = {};
    senders?.forEach(user => senderMap[user.id] = user);

    const combinedData = requests.map(req => ({
      ...req,
      sender: senderMap[req.from_teacher_id] || { name: "Unknown Teacher" }
    }));

    setIncomingRequests(combinedData);
  }

  const handleSlotClick = (entry) => {
    if (!entry || !entry.id) return;
    setSelectedClaimClass(entry);
    const myConflict = myClasses.find(my => my.day === entry.raw.day && my.start_time === entry.raw.start_time);
    setClaimConflict(myConflict || null);
  };

  const handleSendRequest = async (type) => {
    setLoading(true);
    let payload = {};

    if (type === 'sub') {
      if (!selectedClassId || !targetTeacherId) return;
      payload = { 
        from_teacher_id: teacherId, 
        to_teacher_id: targetTeacherId, 
        timetable_id: selectedClassId, 
        status: 'pending' 
      };
    } else if (type === 'claim') {
      if (!selectedClaimClass || !claimTeacherId) {
          onToast("Please select a class.", "error");
          setLoading(false); return;
      }
      // --- NEW CHECK ---
      if (!subjectToTeach) {
          onToast("Please select the subject you will teach.", "error");
          setLoading(false); return;
      }

      if (claimConflict && onToast) {
        onToast("Warning: You have a conflicting class, but request was sent.", "warning");
      }

      payload = { 
        from_teacher_id: teacherId, 
        to_teacher_id: claimTeacherId, 
        timetable_id: selectedClaimClass.id, 
        status: 'pending',
        new_subject_id: subjectToTeach // <-- SEND NEW SUBJECT ID
      };
    }

    const { error } = await supabase.from('class_requests').insert([payload]);

    if (error) {
      if (onToast) onToast("Request failed: " + error.message, "error");
      else alert("Failed: " + error.message);
    } else {
      await supabase.from('notifications').insert([{
        user_id: payload.to_teacher_id,
        title: type === 'sub' ? "New Sub Request" : "Class Claim Request",
        message: type === 'sub' ? "A teacher has asked you to cover their class." : "A teacher has offered to take your class.",
        is_read: false
      }]);

      if (onToast) onToast("Request sent successfully!", "success");
      
      setActiveTab('incoming');
      setSelectedClassId('');
      setTargetTeacherId('');
      setClaimTeacherId('');
      setSelectedClaimClass(null);
      setClaimConflict(null);
      setSubjectToTeach('');
    }
    setLoading(false);
  };

  const handleResponse = async (request, status) => {
    await supabase.from('class_requests').update({ status }).eq('id', request.id);
    
    const subjectName = request.timetable?.subject?.name || "Unknown Subject";

    if (status === 'approved') {
      let newTeacherId = null;
      let newSubjectId = request.timetable.subject_id; // Default to original subject

      if (request.timetable.teacher_id === request.from_teacher_id) {
          // Sub Request: I take their class. Subject usually stays same (Substitution).
          newTeacherId = teacherId;
      } else {
          // Claim Request: They take MY class. 
          // They might want to teach a DIFFERENT subject.
          newTeacherId = request.from_teacher_id;
          if (request.new_subject_id) {
              newSubjectId = request.new_subject_id; // <-- UPDATE SUBJECT
          }
      }

      const { error } = await supabase
        .from('timetable')
        .update({ 
            teacher_id: newTeacherId,
            subject_id: newSubjectId // <-- Apply Subject Change
        })
        .eq('id', request.timetable_id);

      if (error) {
         if (onToast) onToast("Error updating timetable: " + error.message, "error");
         return;
      }

      // Notify Students
      // If subject changed, mention it!
      const newSubjectName = request.new_subject?.name;
      let noticeMsg = `Your ${subjectName} class on ${request.timetable.day} at ${request.timetable.start_time} has a new teacher.`;
      
      if (newSubjectName && newSubjectName !== subjectName) {
          noticeMsg = `Your ${subjectName} class on ${request.timetable.day} at ${request.timetable.start_time} has been changed to ${newSubjectName}.`;
      }

      if (request.timetable?.branch && request.timetable?.semester) {
        await supabase.from('student_notices').insert([{
          branch: request.timetable.branch,
          semester: request.timetable.semester,
          title: "Schedule Update",
          message: noticeMsg
        }]);
      }
    }

    // Notify Sender
    const responseText = status === 'approved' ? "accepted" : "rejected";
    await supabase.from('notifications').insert([{
      user_id: request.from_teacher_id,
      title: `Request ${status}`,
      message: `Your request for ${subjectName} was ${responseText}.`,
      is_read: false
    }]);

    if (onToast) onToast(`Request ${status}!`, "success");
    fetchIncomingRequests();
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4">
        <Button 
          variant={activeTab === 'incoming' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('incoming')} 
          className={activeTab === 'incoming' ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-transparent text-slate-600 border-slate-300 hover:bg-slate-100"}
        >
          Incoming Requests
          {incomingRequests.length > 0 && (
            <Badge className="ml-2 bg-red-500 text-white border-none">{incomingRequests.length}</Badge>
          )}
        </Button>
        {/* <Button 
          variant={activeTab === 'new' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('new')} 
          className={activeTab === 'new' ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-transparent text-slate-600 border-slate-300 hover:bg-slate-100"}
        >
          Request a Sub
        </Button> */}
        <Button 
          variant={activeTab === 'claim' ? 'default' : 'outline'} 
          onClick={() => setActiveTab('claim')} 
          className={activeTab === 'claim' ? "bg-indigo-600 text-white hover:bg-indigo-700" : "bg-transparent text-slate-600 border-slate-300 hover:bg-slate-100"}
        >
          Request a Class
        </Button>
      </div>

      {activeTab === 'incoming' && (
        <div className="grid gap-4">
          {incomingRequests.length === 0 && <p className="text-slate-500">No pending requests.</p>}
          {incomingRequests.map(req => (
            <Card key={req.id} className="bg-white border-slate-200 shadow-sm">
              <CardContent className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-semibold text-slate-900">{req.sender?.name}</p>
                  <p className="text-sm text-slate-500">
                    {req.timetable?.subject?.name || "Unknown Subject"} ({req.timetable?.class_name})
                  </p>
                  {/* Display Intent */}
                  {req.new_subject && (
                     <p className="text-xs font-bold text-indigo-600 mt-1">
                        Wants to teach: {req.new_subject.name}
                     </p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {req.timetable?.day} at {req.timetable?.start_time}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="bg-green-600 hover:bg-green-700 text-white" onClick={() => handleResponse(req, 'approved')}>
                    <Check className="w-4 h-4 mr-1" /> Accept
                  </Button>
                  <Button size="sm" variant="destructive" className="bg-red-600 hover:bg-red-700 text-white" onClick={() => handleResponse(req, 'rejected')}>
                    <X className="w-4 h-4 mr-1" /> Reject
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {activeTab === 'new' && (
        <Card className="bg-white border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <label className="text-sm text-slate-700 mb-2 block">Which class do you need covered?</label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="Select a class" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                {myClasses.map(cls => (
                  <SelectItem key={cls.id} value={cls.id}>
                    {cls.day} - {cls.slot}: {cls.subject?.name || "Unknown"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Target Teacher Select */}
          <div>
            <label className="text-sm text-slate-700 mb-2 block">Ask which teacher?</label>
            <Select value={targetTeacherId} onValueChange={setTargetTeacherId}>
              <SelectTrigger className="bg-white border-slate-300 text-slate-900">
                <SelectValue placeholder="Select a teacher" />
              </SelectTrigger>
              <SelectContent className="bg-white border-slate-200 text-slate-900">
                {teachers.map(t => (
                  <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={() => handleSendRequest('sub')} disabled={loading} className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
            {loading && <Loader2 className="animate-spin mr-2" />} Send Request
          </Button>
        </Card>
      )}

      {activeTab === 'claim' && (
        <div className="space-y-6">
           {/* 1. Select Teacher */}
           <div className="max-w-md">
              <label className="text-sm text-slate-700 mb-2 block">Select Teacher</label>
              <Select value={claimTeacherId} onValueChange={setClaimTeacherId}>
                  <SelectTrigger className="bg-white border-slate-300 text-slate-900"><SelectValue placeholder="Select teacher" /></SelectTrigger>
                  <SelectContent className="bg-white border-slate-200 text-slate-900">
                      {teachers.map(t => (<SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>))}
                  </SelectContent>
              </Select>
           </div>
           
           {claimTeacherId && claimableTimetable && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                 {/* 2. Selection & Action Area */}
                 <div className="flex flex-col gap-4 mb-4 bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <h4 className="font-semibold text-slate-800 text-sm">Select a class to claim:</h4>
                    
                    {selectedClaimClass ? (
                       <div className="space-y-4">
                          <div className="text-sm text-slate-600">
                             Selected: <span className="font-bold text-indigo-700">{selectedClaimClass.subject}</span> 
                             <span className="mx-2">|</span> 
                             {selectedClaimClass.raw.day} {selectedClaimClass.slot}
                          </div>

                          {/* --- NEW DROPDOWN: Subject to Teach --- */}
                          <div className="w-full md:w-1/2">
                             <label className="text-xs text-slate-500 mb-1 block uppercase font-bold">What will you teach?</label>
                             <Select value={subjectToTeach} onValueChange={setSubjectToTeach}>
                                <SelectTrigger className="bg-white border-slate-300 text-slate-900 h-9">
                                  <SelectValue placeholder="Select Subject..." />
                                </SelectTrigger>
                                <SelectContent className="bg-white border-slate-200 text-slate-900">
                                  {mySubjects.map(sub => (
                                    <SelectItem key={sub.id} value={sub.id}>{sub.name}</SelectItem>
                                  ))}
                                </SelectContent>
                             </Select>
                          </div>
                          {/* -------------------------------------- */}

                          <Button onClick={() => handleSendRequest('claim')} disabled={loading} size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white w-full md:w-auto">
                            Confirm Claim
                          </Button>
                       </div>
                    ) : (
                        <p className="text-xs text-slate-400 italic">Click on a class in the grid below...</p>
                    )}
                 </div>

                 {claimConflict && (
                    <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-amber-800 text-sm">
                       <AlertTriangle className="w-4 h-4" />
                       <span><strong>Warning:</strong> Conflict with your class ({claimConflict.subject?.name})!</span>
                    </div>
                 )}

                 <SleekTimetable timetable={claimableTimetable} days={days} slots={slots} onSlotClick={handleSlotClick} />
              </div>
           )}
        </div>
      )}
    </div>
  );
}