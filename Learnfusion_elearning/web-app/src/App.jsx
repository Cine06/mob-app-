import { Routes, Route } from "react-router-dom";
import Login from "./components/Login";

import AdminDashboard from "./components/AdminDashboard";
import AddUser from "./components/AddUser";
import AdminSectionManagement from "./components/AdminSectionManagement";
import AdminManageSection from "./components/AdminManageSection";
import AdminHandouts from "./components/AdminHandouts";
import Unauthorized from "./components/Unauthorized";

import TeacherDashboard from "./components/TeacherDashboard";
import Assessment from "./components/Assessment";
import Handouts from "./components/Handouts";
import SectionManagement from "./components/SectionManagement";
import ManageSection from "./components/ManageSection";
import AssignStudents from "./components/AssignStudents";
import Message from "./components/Messages";
import Report from "./components/Report";
import LessonDetails from "./components/LessonDetails";
import PrivateRoute from "./components/PrivateRoute";
import { AuthProvider } from "./context/AuthContext";
import DetailedChatView from "./components/DetailedChatView";


function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* Public Route */}
        <Route path="/" element={<Login />} />
        <Route path="/unauthorized" element={<Unauthorized />} />

        {/* Admin Routes */}
        <Route path="/admin-dashboard" element={<PrivateRoute requiredRole="Admin"><AdminDashboard /></PrivateRoute> }/>
        <Route path="/teacher-dashboard"element={<PrivateRoute requiredRole="Teacher"><TeacherDashboard /></PrivateRoute>}/>
        <Route path="/add-user" element={<AddUser />} />
        <Route path="/sectionmanage" element={<AdminSectionManagement />} />
        <Route path="/admin-manage-section/:sectionName" element={<PrivateRoute requiredRole="Admin"><AdminManageSection /></PrivateRoute>} />
        <Route path="/admin-handouts" element={<PrivateRoute requiredRole="Admin"><AdminHandouts /></PrivateRoute>} />

        <Route
          path="/assessment"
          element={
            <PrivateRoute requiredRole="Teacher">
              <Assessment />
            </PrivateRoute>
          }
        />
        <Route
          path="/handouts"
          element={
            <PrivateRoute requiredRole="Teacher">
              <Handouts />
            </PrivateRoute>
          }
        />
        <Route
          path="/section"
          element={
            <PrivateRoute requiredRole="Teacher">
              <SectionManagement />
            </PrivateRoute>
          }
        />
        <Route path="/manage-section/:sectionId" element={<ManageSection />} />

        <Route
          path="/assign-students/:sectionName"
          element={
            <PrivateRoute requiredRole="Teacher">
              <AssignStudents />
            </PrivateRoute>
          }
        />
        <Route
          path="/messages"
          element={
            <PrivateRoute requiredRole="Teacher">
              <Message />
            </PrivateRoute>
          }
        />
        <Route
          path="/report/:sectionName/:lessonName"
          element={
            <PrivateRoute requiredRole="Teacher">
              <Report />
            </PrivateRoute>
          }
        />
        <Route
          path="/lesson/:id"
          element={
            <PrivateRoute requiredRole="Teacher">
              <LessonDetails />
            </PrivateRoute>
          }
        />
        <Route
          path="/messages/chat/:otherUserId"
          element={
            <PrivateRoute requiredRole="Teacher">
              <DetailedChatView />
            </PrivateRoute>
          }
        />
      </Routes>
    </AuthProvider>
  );
}

export default App;
