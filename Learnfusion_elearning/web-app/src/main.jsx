import React from "react";
import ReactDOM from "react-dom/client";
import { createHashRouter, RouterProvider } from "react-router-dom";
import "sweetalert2/dist/sweetalert2.min.css";

import App from "./App.jsx";
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
import PrivateRoute from "./components/PrivateRoute.jsx";
import { AuthProvider } from "./context/AuthContext";
import DetailedChatView from "./components/DetailedChatView";

const router = createHashRouter(
  [
  {
    element: <App />, 
    errorElement: <div>Not Found</div>, 
    children: [
      { path: "/", element: <Login /> },
      { path: "/unauthorized", element: <Unauthorized /> },
      { path: "*", element: <div>Page Not Found</div> },
      {
        element: <PrivateRoute requiredRole="Admin" />,
        children: [
          { path: "/admin-dashboard", element: <AdminDashboard /> },
          { path: "/add-user", element: <AddUser /> },
          { path: "/sectionmanage", element: <AdminSectionManagement /> },
          { path: "/admin-manage-section/:sectionName", element: <AdminManageSection /> },
          { path: "/admin-handouts", element: <AdminHandouts /> },
        ],
      },
      {
        element: <PrivateRoute requiredRole="Teacher" />,
        children: [
          { path: "/teacher-dashboard", element: <TeacherDashboard /> },
          { path: "/assessment", element: <Assessment /> },
          { path: "/handouts", element: <Handouts /> },
          { path: "/section", element: <SectionManagement /> },
          { path: "/manage-section/:sectionId", element: <ManageSection /> },
          { path: "/assign-students/:sectionName", element: <AssignStudents /> },
          { path: "/messages", element: <Message /> },
          { path: "/report/:sectionName/:lessonName", element: <Report /> },
          { path: "/lesson/:id", element: <LessonDetails /> },
          { path: "/messages/chat/:otherUserId", element: <DetailedChatView /> },
        ],
      },
    ],
  },
],
{
  future: {
    v7_startTransition: true,
  },
}
);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AuthProvider>
      <RouterProvider router={router} />
    </AuthProvider>
  </React.StrictMode>
);
