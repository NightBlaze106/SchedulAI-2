import { useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";

export default function ManageSubjects() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [branch, setBranch] = useState("CSE");
  const [semester, setSemester] = useState(1);
  const [hours, setHours] = useState(3);
  const [type, setType] = useState("Theory");
  
  // --- NEW FIELDS ---
  const [studentCount, setStudentCount] = useState(50);
  const [blockSize, setBlockSize] = useState(1);
  // ------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Check for 2-hour lab logic
    if (type === 'Lab' && blockSize === 1) {
      if (window.confirm("Labs usually have a 2-hour block size. Set to 2?")) {
        setBlockSize(2);
        return; // Let user re-submit
      }
    }

    const { data, error } = await supabase
      .from("subjects")
      .insert([
        { 
          name, 
          code, 
          branch, 
          semester: Number(semester), 
          hours_per_week: Number(hours), 
          type,
          student_count: Number(studentCount), // <-- ADDED
          block_size: Number(blockSize)      // <-- ADDED
        }
      ]);

    if (error) {
      alert("Error adding subject: " + error.message);
    } else {
      alert("Subject added!");
      // Reset form
      setName("");
      setCode("");
      setStudentCount(50);
      setBlockSize(1);
    }
  };

  return (
    <Card className="max-w-3xl mx-auto mt-10">
      <CardHeader>
        <CardTitle>Manage Subjects</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Subject Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="code">Subject Code</Label>
              <Input id="code" value={code} onChange={e => setCode(e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Branch</Label>
              <Select value={branch} onValueChange={setBranch}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CSE", "ECE", "EEE", "MECH"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Semester</Label>
              <Select value={semester.toString()} onValueChange={v => setSemester(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <SelectItem key={s} value={s.toString()}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="hours">Hours/Week</Label>
              <Input id="hours" type="number" value={hours} onChange={e => setHours(Number(e.target.value))} required />
            </div>
            <div>
              <Label>Type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Theory">Theory</SelectItem>
                  <SelectItem value="Lab">Lab</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {/* --- NEW FIELDS --- */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="studentCount">Student Count</Label>
              <Input id="studentCount" type="number" value={studentCount} onChange={e => setStudentCount(Number(e.target.value))} required />
            </div>
            <div>
              <Label>Block Size (Consecutive Hours)</Label>
              <Select value={blockSize.toString()} onValueChange={v => setBlockSize(Number(v))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 Hour (Default)</SelectItem>
                  <SelectItem value="2">2 Hours (e.g., Lab)</SelectItem>
                  <SelectItem value="3">3 Hours</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button type="submit" className="w-full">Add Subject</Button>
        </form>
      </CardContent>
    </Card>
  );
}