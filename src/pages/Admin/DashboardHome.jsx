import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Loader2, Plus, Users, Book, Home } from 'lucide-react';

export default function DashboardHome() {
  const [timetables, setTimetables] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchTimetables() {
      setLoading(true);
      // Call the new SQL function
      const { data, error } = await supabase.rpc('get_generated_timetables');
      
      if (error) {
        console.error('Error fetching generated timetables:', error);
      } else {
        setTimetables(data || []);
      }
      setLoading(false);
    }
    fetchTimetables();
  }, []);

  return (
    <div className="space-y-6">
      {/* --- Quick Actions --- */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Quick Actions</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Button size="lg" className="justify-start gap-3" onClick={() => navigate('/admin/generate')}>
            <Plus className="h-5 w-5" /> Generate New Timetable
          </Button>
          <Button size="lg" variant="outline" className="justify-start gap-3" onClick={() => navigate('/admin/subjects')}>
            <Book className="h-5 w-5" /> Manage Subjects
          </Button>
          <Button size="lg" variant="outline" className="justify-start gap-3" onClick={() => navigate('/admin/rooms')}>
            <Home className="h-5 w-5" /> Manage Rooms
          </Button>
          <Button size="lg" variant="outline" className="justify-start gap-3" onClick={() => navigate('/admin/teachers')}>
            <Users className="h-5 w-5" /> Manage Teachers
          </Button>
        </div>
      </section>

      <div className="h-px bg-slate-200" />

      {/* --- Generated Timetables --- */}
      <section>
        <h2 className="text-xl font-semibold mb-3">Generated Timetables</h2>
        {loading && <Loader2 className="h-6 w-6 animate-spin text-slate-500" />}
        {!loading && timetables.length === 0 && (
          <p className="text-slate-500">No timetables generated yet.</p>
        )}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {timetables.map((tt, idx) => (
            <Card 
              key={idx} 
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate(`/admin/editor/${tt.branch}/${tt.semester}`)}
            >
              <CardHeader>
                <CardTitle className="text-lg">{tt.branch} - Semester {tt.semester}</CardTitle>
              </CardHeader>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}