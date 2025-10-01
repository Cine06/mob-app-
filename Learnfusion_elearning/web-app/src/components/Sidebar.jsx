import React, { useState } from "react";
import "../styles/Sidebar.css";
import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import logo from "../assets/logo.png";
import { FaBars, FaTimes } from "react-icons/fa";

const Sidebar = () => {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.clear();
    setUser(null);
    navigate("/", { replace: true });
  };

  const handleLinkClick = () => {
    if (window.innerWidth <= 768) {
      setIsSidebarOpen(false);
    }
  };

  return (
    <>
      <button
        className="sidebar-toggle"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <FaTimes /> : <FaBars />}
      </button>
      <div className={`sidebar-container ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar">
          <div className="sidebar-logo">
            <img src={logo} alt="LearnFusion Logo" />
            <h2><span className="highlight">Learn</span>Fusion</h2>
          </div>

          <ul className="sidebar-nav">
            <li>
              <NavLink to="/teacher-dashboard" className={({ isActive }) => (isActive ? "active" : "")} onClick={handleLinkClick}>
                Dashboard
              </NavLink>
            </li>
            <li>
              <NavLink to="/assessment" className={({ isActive }) => (isActive ? "active" : "")} onClick={handleLinkClick}>
                Assessment
              </NavLink>
            </li>
            <li>
              <NavLink to="/handouts" className={({ isActive }) => (isActive ? "active" : "")} onClick={handleLinkClick}>
                Handouts
              </NavLink>
            </li>
            <li>
              <NavLink to="/section" className={({ isActive }) => (isActive ? "active" : "")} onClick={handleLinkClick}>
                Section
              </NavLink>
            </li>
            <li>
              <NavLink to="/messages" className={({ isActive }) => (isActive ? "active" : "")} onClick={handleLinkClick}>
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
    </>
  );
};

export default Sidebar;
