import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { generateTimetable } from "@/lib/api";
import TimetableGrid from "./TimetableGrid";

import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RadioGroup,
  RadioGroupItem,
} from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Loader2 } from "lucide-react";

export default function TimetableWizard() {
  const [branch, setBranch] = useState("CSE");
  const [semester, setSemester] = useState(3);
  
  // Data fetched from DB
  const [teachers, setTeachers] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [rooms, setRooms] = useState([]); // Needed for the grid display

  // This is the new state for assignments!
  // It will store: { "subject_id_123": "teacher_id_456" }
  const [assignments, setAssignments] = useState({});

  // Timetable result
  const [days] = useState(["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);
  
  // --- MODIFIED SLOTS ---
  // Now includes "13:00" for a 7-slot day
  const [slots] = useState([
    "09:00", 
    "10:00", 
    "11:00", 
    "12:00", 
    "13:00", // Lunch Slot
    "14:00", 
    "15:00"
  ]);
  // -----------------------

  const [timetable, setTimetable] = useState(null);
  const [loading, setLoading] = useState(false);

  // --- Data Fetching Effects ---

  // Fetch teachers
  useEffect(() => {
    async function fetchTeachers() {
      const { data, error } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "teacher");
      if (!error) setTeachers(data || []);
    }
    fetchTeachers();
  }, []);

  // Fetch rooms
  useEffect(() => {
    async function fetchRooms() {
      const { data, error } = await supabase.from("rooms").select("*");
      if (!error) setRooms(data || []);
    }
    fetchRooms();
  }, []);

  // Fetch subjects WHEN branch or semester changes
  useEffect(() => {
    async function fetchSubjects() {
      if (!branch || !semester) return;

      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .eq("branch", branch)
        .eq("semester", semester);
      
      if (!error) {
        setSubjects(data || []);
        // Reset assignments when subjects change
        setAssignments({});
      } else {
        console.error("Error fetching subjects:", error);
      }
    }
    fetchSubjects();
  }, [branch, semester]);

  // --- Handlers ---

  const handleAssignTeacher = (subjectId, teacherId) => {
    setAssignments((prev) => ({
      ...prev,
      [subjectId]: teacherId,
    }));
  };

  const handleGenerate = async () => {
    setLoading(true);
    setTimetable(null);

    // Build the new payload
    const assignmentsPayload = Object.keys(assignments).map((subjectId) => ({
      subject_id: subjectId,
      teacher_id: assignments[subjectId],
    }));

    // Filter out any assignments where teacher_id is missing
    const validAssignments = assignmentsPayload.filter(a => a.teacher_id);

    if (validAssignments.length === 0) {
      alert("Please assign at least one teacher to a subject.");
      setLoading(false);
      return;
    }

    // --- MODIFIED: Define non-bookable slots ---
    const nonBookableSlots = ["13:00"]; 
    // ------------------------------------------

    try {
      const payload = {
        branch,
        semester,
        days,
        slots,
        assignments: validAssignments,
        save_to_db: true,
        non_bookable_slots: nonBookableSlots, // <-- Pass this to the AI
      };
      
      const data = await generateTimetable(payload);
      // The AI solver will now see "13:00" as a non-bookable slot
      // and will schedule around it.
      
      setTimetable(data.timetable);
    } catch (err) {
      console.error(err);
      alert("Failed to generate timetable: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* --- Card: Timetable Generator --- */}
      <Card className="shadow-sm border border-slate-200">
        <CardHeader>
          <CardTitle className="text-xl font-semibold">AI Timetable Generator</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Branch */}
          <div>
            <Label className="text-sm font-medium">Select Branch</Label>
            <RadioGroup
              value={branch}
              onValueChange={setBranch}
              className="flex flex-wrap gap-6 pt-2"
            >
              {["CSE", "ECE", "EEE", "MECH"].map((b) => (
                <div key={b} className="flex items-center space-x-2">
                  <RadioGroupItem value={b} id={b} />
                  <Label htmlFor={b}>{b}</Label>
                </div>
              ))}
            </RadioGroup>
          </div>

          {/* Semester */}
          <div>
            <Label className="text-sm font-medium">Select Semester</Label>
            <RadioGroup
              value={semester.toString()}
              onValueChange={(val) => setSemester(Number(val))}
              className="flex flex-wrap gap-6 pt-2"
            >
              {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <div key={sem} className="flex items-center space-x-2">
                    <RadioGroupItem value={sem.toString()} id={`sem${sem}`} />
                    <Label htmlFor={`sem${sem}`}>{sem}</Label>
                  </div>
                ))}
            </RadioGroup>
          </div>

          <Separator />

          {/* Subjects & Teachers Assignment Section */}
          <div className="space-y-4">
            <Label className="text-sm font-medium">Assign Teachers to Subjects</Label>
            
            {subjects.length === 0 && (
              <p className="text-sm text-slate-500">
                No subjects found for this branch/semester. (Have you added them in the 'Manage Subjects' page?)
              </p>
            )}

            {subjects.map((sub) => (
              <div key={sub.id} className="grid grid-cols-2 gap-4 items-center">
                {/* Subject Info */}
                <div className="flex flex-col">
                  <span className="font-medium">{sub.name}</span>
                  <span className="text-xs text-slate-500">
                    {sub.type} - {sub.hours_per_week} hrs/week
                  </span>
                </div>

                {/* Teacher Select Dropdown */}
                <Select
                  value={assignments[sub.id] || ""}
                  onValueChange={(teacherId) =>
                    handleAssignTeacher(sub.id, teacherId)
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select Teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    {teachers.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>
        </CardContent>

        <CardFooter className="flex justify-end">
          <Button
            onClick={handleGenerate}
            disabled={loading || subjects.length === 0}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {loading ? "Generating..." : "Generate Timetable"}
          </Button>
        </CardFooter>
      </Card>

      {/* --- Generated Timetable --- */}
      {timetable && (
        <TimetableGrid
          timetable={timetable}
          // We must pass this data so the grid can look up names from IDs
          subjects={subjects}
          teachers={teachers}
          rooms={rooms}
        />
      )}
    </div>
  );
}