import React from "react";
import "../styles/Sidebar.css";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

const Sidebar = () => {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/");
  };

  return (
    <div className="sidebar-container">
      <div className="sidebar">
        <div className="sidebar-logo">
          <img src={`${import.meta.env.BASE_URL}logo.png`} alt="LearnFusion Logo" />
          <h2><span className="highlight">Learn</span>Fusion</h2>
        </div>

        <ul className="sidebar-nav">
          <li>
            <NavLink to="/teacher-dashboard" className={({ isActive }) => (isActive ? "active" : "")}>
              Dashboard
            </NavLink>
          </li>
          <li>
            <NavLink to="/assessment" className={({ isActive }) => (isActive ? "active" : "")}>
              Assessment
            </NavLink>
          </li>
          <li>
            <NavLink to="/handouts" className={({ isActive }) => (isActive ? "active" : "")}>
              Handouts
            </NavLink>
          </li>
          <li>
            <NavLink to="/section" className={({ isActive }) => (isActive ? "active" : "")}>
              Section
            </NavLink>
          </li>
          <li>
            <NavLink to="/messages" className={({ isActive }) => (isActive ? "active" : "")}>
              Messages
            </NavLink>
          </li>
          <li>
            <button className="logout-btn" onClick={handleLogout}>
              Logout
            </button>
          </li>
        </ul>
      </div>
    </div>
  );
};

export default Sidebar;
