import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import App from './App';
import './index.css';

// Admin Pages
import AdminLayout from './components/AdminLayout';
import DashboardHome from './pages/Admin/DashboardHome';
import TimetableWizard from './pages/Admin/TimetableWizard';
import ManageSubjects from './pages/Admin/ManageSubjects';
import ManageRooms from './pages/Admin/ManageRooms';
import ManageTeachers from './pages/Admin/ManageTeachers';
import ViewTimetable from './pages/Admin/ViewTimetable';
import LiveEditor from './pages/Admin/LiveEditor';

// User Pages
import UserDashboard from './pages/User/UserDashboard';
import TeacherDashboard from './pages/User/TeacherDashboard';
import StudentDashboard from './pages/User/StudentDashboard'; // <-- NEW IMPORT

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<UserDashboard />} />

        {/* Admin Routes */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route index element={<DashboardHome />} />
          <Route path="generate" element={<TimetableWizard />} />
          <Route path="subjects" element={<ManageSubjects />} />
          <Route path="rooms" element={<ManageRooms />} />
          <Route path="teachers" element={<ManageTeachers />} />
          <Route path="editor/:branch/:semester" element={<LiveEditor />} />
          <Route path="view/:branch/:semester" element={<ViewTimetable />} />
        </Route>
        
        {/* User Routes */}
        {/* <Route path="/dashboard" element={<UserDashboard />} /> */}
        <Route path="/teacher/:teacherId" element={<TeacherDashboard />} />
        
        {/* UPDATED: Points to the new sleek dashboard */}
        <Route path="/student/:branch/:semester" element={<StudentDashboard />} />
        
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);