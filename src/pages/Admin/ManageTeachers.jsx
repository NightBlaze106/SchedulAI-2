import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2, Trash2, Edit } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox'; // We need to import this

// --- NEW COMPONENT: Availability Editor ---
// This will live inside the ManageTeachers file for simplicity
function AvailabilityEditor({ teacher, onClose }) {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
  const [availability, setAvailability] = useState({});
  const [loading, setLoading] = useState(true);

  // Default times
  const defaultStart = "09:00";
  const defaultEnd = "17:00";

  useEffect(() => {
    async function fetchAvailability() {
      setLoading(true);
      const { data, error } = await supabase
        .from('teacher_availability')
        .select('*')
        .eq('teacher_id', teacher.id);
      
      if (!error) {
        const availMap = {};
        for (const day of days) {
          const record = data.find(d => d.day_of_week === day);
          availMap[day] = {
            available: !!record,
            start_time: record?.start_time || defaultStart,
            end_time: record?.end_time || defaultEnd,
          };
        }
        setAvailability(availMap);
      }
      setLoading(false);
    }
    fetchAvailability();
  }, [teacher]);

  const handleDayToggle = (day) => {
    setAvailability(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        available: !prev[day].available,
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    const toUpsert = [];
    const toDelete = [];

    for (const day of days) {
      const dayData = availability[day];
      if (dayData.available) {
        toUpsert.push({
          teacher_id: teacher.id,
          day_of_week: day,
          start_time: dayData.start_time, // We can add time inputs later
          end_time: dayData.end_time,     // For now, use defaults
        });
      } else {
        toDelete.push(day);
      }
    }

    // Upsert all "available" days
    if (toUpsert.length > 0) {
      const { error } = await supabase.from('teacher_availability').upsert(toUpsert, {
        onConflict: 'teacher_id, day_of_week'
      });
      if (error) alert("Error saving availability: " + error.message);
    }

    // Delete all "unavailable" days
    if (toDelete.length > 0) {
      const { error } = await supabase
        .from('teacher_availability')
        .delete()
        .eq('teacher_id', teacher.id)
        .in('day_of_week', toDelete);
      if (error) alert("Error deleting availability: " + error.message);
    }

    alert("Availability saved!");
    setLoading(false);
    onClose();
  };

  if (loading) return <Loader2 className="animate-spin" />;

  return (
    <div className="space-y-4">
      {days.map(day => (
        <div key={day} className="flex items-center space-x-4 p-2 border rounded-md">
          <Checkbox
            id={day}
            checked={availability[day]?.available || false}
            onCheckedChange={() => handleDayToggle(day)}
          />
          <Label htmlFor={day} className="flex-1 text-base">
            {day}
          </Label>
          {/* We can add time inputs here later to make it even more granular */}
          <span className="text-sm text-slate-500">
            {availability[day]?.available ? "Available (9am - 5pm)" : "Unavailable"}
          </span>
        </div>
      ))}
      <Button onClick={handleSave} disabled={loading} className="w-full">
        {loading ? <Loader2 className="animate-spin" /> : "Save Availability"}
      </Button>
    </div>
  );
}

// --- MODIFIED COMPONENT: Teacher List ---
function TeacherList({ teachers, loading, onDelete }) {
  if (loading) return <Loader2 className="animate-spin" />;
  if (teachers.length === 0) return <p>No teachers found.</p>;

  return (
    <div className="space-y-2">
      {teachers.map(teacher => (
        <Dialog key={teacher.id}>
          <div className="flex items-center justify-between p-3 bg-white rounded-md shadow-sm border">
            <div>
              <p className="font-medium">{teacher.name}</p>
              <p className="text-sm text-slate-500">{teacher.email} - {teacher.department}</p>
            </div>
            <div className="flex gap-2">
              <DialogTrigger asChild>
                <Button variant="outline" size="sm">
                  <Edit className="h-4 w-4 mr-2" /> Availability
                </Button>
              </DialogTrigger>
              <Button variant="ghost" size="icon" onClick={() => onDelete(teacher.id)}>
                <Trash2 className="h-4 w-4 text-red-500" />
              </Button>
            </div>
          </div>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Availability for {teacher.name}</DialogTitle>
            </DialogHeader>
            <AvailabilityEditor teacher={teacher} onClose={() => {
              // This is a simple way to close; Dialog v1 might need manual state
            }} />
          </DialogContent>
        </Dialog>
      ))}
    </div>
  );
}

// --- MODIFIED PAGE: ManageTeachers ---
export default function ManageTeachers() {
  // Form state
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('CSE');

  // List state
  const [teachers, setTeachers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // To refresh list

  async function fetchTeachers() {
    setLoading(true);
    const { data, error } = await supabase.from('users').select('*').eq('role', 'teacher');
    if (!error) setTeachers(data || []);
    setLoading(false);
  }

  // Fetch on mount and when refreshKey changes
  useEffect(() => {
    fetchTeachers();
  }, [refreshKey]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { error } = await supabase
      .from('users')
      .insert([
        { 
          name, 
          email, 
          department,
          role: 'teacher', // Set role automatically
        }
      ]);

    if (error) {
      alert('Error adding teacher: ' + error.message);
    } else {
      alert('Teacher added!');
      setName('');
      setEmail('');
      setRefreshKey(k => k + 1); // Refresh list
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this teacher?')) {
      const { error } = await supabase.from('users').delete().eq('id', id);
      if (error) {
        alert('Error deleting teacher: ' + error.message);
      } else {
        alert('Teacher deleted.');
        setRefreshKey(k => k + 1); // Refresh list
      }
    }
  };

  return (
    <div className="grid gap-8 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle>Add New Teacher</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="name">Teacher Name</Label>
              <Input id="name" value={name} onChange={e => setName(e.target.value)} required />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </div>
            <div>
              <Label>Department</Label>
              <Select value={department} onValueChange={setDepartment}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["CSE", "ECE", "EEE", "MECH"].map(b => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" className="w-full">Add Teacher</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Teachers</CardTitle>
        </CardHeader>
        <CardContent>
          <TeacherList teachers={teachers} loading={loading} onDelete={handleDelete} />
        </CardContent>
      </Card>
    </div>
  );
}

// --- REQUIRED COMPONENT ---
// You will need to install shadcn/ui's Checkbox and Dialog components
// for this to work.
// npx shadcn-ui@latest add checkbox
// npx shadcn-ui@latest add dialog