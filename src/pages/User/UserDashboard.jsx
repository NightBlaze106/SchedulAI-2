import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Hourglass } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, GraduationCap, User, Lock } from "lucide-react";
import CustomToast from "@/components/ui/CustomToast";

export default function UserDashboard() {
  const [teachers, setTeachers] = useState([]);
  const [studentGroups, setStudentGroups] = useState([]);

  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [selectedGroup, setSelectedGroup] = useState("");

  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // --- Auth State ---
  const [showAuthDialog, setShowAuthDialog] = useState(false);
  const [authRole, setAuthRole] = useState(""); // 'admin' or 'teacher'
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);

      const { data: teacherData } = await supabase
        .from("users")
        .select("id, name")
        .eq("role", "teacher");
      const { data: groupData } = await supabase.rpc(
        "get_generated_timetables"
      );

      setTeachers(teacherData || []);
      setStudentGroups(groupData || []);
      setLoading(false);
    }
    fetchData();
  }, []);

  const handleAdminClick = () => {
    setAuthRole("admin");
    setAuthError("");
    setPassword("");
    setShowAuthDialog(true);
  };

  const handleTeacherClick = () => {
    setAuthRole("teacher");
    setAuthError("");
    setPassword("");
    setShowAuthDialog(true);
  };

  const handleLoginSubmit = async () => {
    setLoading(true); // Reuse loading state or create a specific authLoading state if preferred

    try {
      if (authRole === "admin") {
        // For Admin: Check if there is an admin user in DB with this password
        // OR just keep a simple hardcoded check if you prefer simplicity for the demo
        // Let's do a DB check for "admin@college.edu" or similar

        const { data, error } = await supabase
          .from("users")
          .select("id")
          .eq("role", "admin")
          .eq("password", password)
          .single();

        if (data) {
          navigate("/admin");
        } else {
          // Fallback for the hardcoded demo admin if DB check fails
          if (password === "admin123") {
            navigate("/admin");
          } else {
            setAuthError("Invalid Admin Password");
          }
        }
      } else if (authRole === "teacher") {
        if (!selectedTeacher) {
          setAuthError("Please select a teacher profile first.");
          setLoading(false);
          return;
        }

        // Query the database for this specific teacher's password
        const { data, error } = await supabase
          .from("users")
          .select("password")
          .eq("id", selectedTeacher)
          .single();

        if (error || !data) {
          setAuthError("User not found.");
        } else if (data.password === password) {
          // SUCCESS!
          navigate(`/teacher/${selectedTeacher}`);
        } else {
          setAuthError("Invalid Password. (Hint: Try 123456)");
        }
      }
    } catch (err) {
      console.error(err);
      setAuthError("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudent = () => {
    if (selectedGroup) {
      const [branch, semester] = selectedGroup.split("-");
      navigate(`/student/${branch}/${semester}`);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen bg-slate-50">
        <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-8 flex flex-col items-center justify-center font-sans text-slate-900">
      <CustomToast
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* --- Auth Dialog --- */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[400px] bg-white p-6 rounded-xl shadow-xl">
          <DialogHeader>
            <div className="mx-auto w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mb-4 text-indigo-600">
              <Lock className="w-6 h-6" />
            </div>
            <DialogTitle className="text-center text-xl font-bold text-slate-900">
              {authRole === "admin" ? "Admin Access" : "Teacher Login"}
            </DialogTitle>
            <p className="text-center text-slate-500 text-sm">
              Enter your password to continue.
            </p>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="border-slate-300 focus-visible:ring-indigo-500"
                onKeyDown={(e) => e.key === "Enter" && handleLoginSubmit()}
              />
              {authError && (
                <p className="text-red-500 text-xs font-medium">{authError}</p>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              onClick={handleLoginSubmit}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              Unlock Portal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* --- Main Content --- */}
      <div className="text-center mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <h1 className="flex items-center justify-center gap-3 text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight mb-4">
          <Hourglass className="w-12 h-12 text-indigo-600" />
          SchedulAI
        </h1>

        <p className="text-slate-500 text-lg">
          Select your role to access the system.
        </p>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 px-4">
        {/* --- 1. Admin Card --- */}
        <Card className="border-slate-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
          <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <div className="w-14 h-14 bg-indigo-600 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-indigo-200 group-hover:scale-110 transition-transform duration-300">
              <Shield className="w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              Administrator
            </CardTitle>
            <p className="text-sm text-slate-500 font-medium">
              System Configuration & Management
            </p>
          </CardHeader>
          <CardContent className="pt-8 pb-8 px-6">
            <p className="text-slate-600 text-sm mb-6 leading-relaxed">
              Access global settings, manage subjects, teachers, rooms, and
              generate new timetables.
            </p>
            <Button
              onClick={handleAdminClick}
              className="w-full h-12 bg-slate-900 hover:bg-slate-800 text-white font-medium"
            >
              Secure Login
            </Button>
          </CardContent>
        </Card>

        {/* --- 2. Teacher View --- */}
        <Card className="border-slate-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
          <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <div className="w-14 h-14 bg-violet-600 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-violet-200 group-hover:scale-110 transition-transform duration-300">
              <User className="w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              Faculty
            </CardTitle>
            <p className="text-sm text-slate-500 font-medium">
              Schedule & Classroom Management
            </p>
          </CardHeader>
          <CardContent className="pt-8 pb-8 px-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">
                Select Profile
              </Label>
              <Select
                value={selectedTeacher}
                onValueChange={setSelectedTeacher}
              >
                <SelectTrigger className="h-11 border-slate-300 focus:ring-violet-500">
                  <SelectValue placeholder="Select your name..." />
                </SelectTrigger>
                <SelectContent>
                  {teachers.map((teacher) => (
                    <SelectItem key={teacher.id} value={teacher.id}>
                      {teacher.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleTeacherClick}
              disabled={!selectedTeacher}
              className="w-full h-12 bg-violet-600 hover:bg-violet-700 text-white font-medium"
            >
              Faculty Login
            </Button>
          </CardContent>
        </Card>

        {/* --- 3. Student View --- */}
        <Card className="border-slate-200 shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group">
          <CardHeader className="pb-4 border-b border-slate-100 bg-slate-50/50 rounded-t-xl">
            <div className="w-14 h-14 bg-emerald-500 rounded-2xl flex items-center justify-center mb-4 text-white shadow-lg shadow-emerald-200 group-hover:scale-110 transition-transform duration-300">
              <GraduationCap className="w-7 h-7" />
            </div>
            <CardTitle className="text-2xl font-bold text-slate-900">
              Student Portal
            </CardTitle>
            <p className="text-sm text-slate-500 font-medium">
              Access Timetables & Notices
            </p>
          </CardHeader>
          <CardContent className="pt-8 pb-8 px-6 space-y-6">
            <div className="space-y-2">
              <Label className="text-xs uppercase text-slate-400 font-bold tracking-wider">
                Select Class
              </Label>
              <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                <SelectTrigger className="h-11 border-slate-300 focus:ring-emerald-500">
                  <SelectValue placeholder="Select your class..." />
                </SelectTrigger>
                <SelectContent>
                  {studentGroups.map((group) => (
                    <SelectItem
                      key={`${group.branch}-${group.semester}`}
                      value={`${group.branch}-${group.semester}`}
                    >
                      {group.branch} - Semester {group.semester}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={handleViewStudent}
              disabled={!selectedGroup}
              className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
            >
              View Timetable
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
