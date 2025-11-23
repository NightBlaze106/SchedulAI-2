import React from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, CalendarPlus, Book, Home, Users } from 'lucide-react';

// Reusable NavLink component
const SideNavLink = ({ to, children, icon: Icon }) => (
  <NavLink
    to={to}
    className={({ isActive }) =>
      cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 text-slate-700 transition-all hover:bg-slate-200',
        isActive && 'bg-slate-900 text-white hover:bg-slate-800'
      )
    }
  >
    <Icon className="h-4 w-4" />
    {children}
  </NavLink>
);

export default function AdminLayout() {
  return (
    <div className="grid min-h-screen w-full md:grid-cols-[220px_1fr]">
      {/* --- Sidebar --- */}
      <div className="hidden border-r bg-slate-100/40 md:block">
        <div className="flex h-full max-h-screen flex-col gap-2">
          <div className="flex h-14 items-center border-b px-4 lg:h-[60px] lg:px-6">
            <h2 className="font-semibold text-lg">AI Timetable</h2>
          </div>
          <div className="flex-1">
            <nav className="grid items-start gap-1 px-2 text-sm font-medium lg:px-4">
              <SideNavLink to="/admin" icon={LayoutDashboard}>
                Dashboard
              </SideNavLink>
              <SideNavLink to="/admin/generate" icon={CalendarPlus}>
                Generate Timetable
              </SideNavLink>
              <SideNavLink to="/admin/subjects" icon={Book}>
                Manage Subjects
              </SideNavLink>
              <SideNavLink to="/admin/rooms" icon={Home}>
                Manage Rooms
              </SideNavLink>
              <SideNavLink to="/admin/teachers" icon={Users}>
                Manage Teachers
              </SideNavLink>
            </nav>
          </div>
        </div>
      </div>
      
      {/* --- Main Content --- */}
      <div className="flex flex-col">
        <header className="flex h-14 items-center gap-4 border-b bg-slate-100/40 px-4 lg:h-[60px] lg:px-6">
          {/* We can add a user menu or search bar here later */}
          <div className="w-full flex-1">
            <h1 className="text-lg font-semibold">Admin Dashboard</h1>
          </div>
        </header>
        <main className="flex-1 flex-col gap-4 p-4 md:gap-8 md:p-8 bg-slate-50">
          {/* This Outlet renders the specific page (e.g., DashboardHome, TimetableWizard) */}
          <Outlet />
        </main>
      </div>
    </div>
  );
}