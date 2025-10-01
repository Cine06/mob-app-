import React, { useEffect, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { FaBars, FaTimes } from "react-icons/fa";
import { supabase } from "../utils/supabaseClient";
import defaultProfile from "/public/default_profile.png";
import "../styles/Sidebar.css"; 
import "../styles/AdminSidebar.css"; 
import { useAuth } from "../context/AuthContext";

const AdminSidebar = () => {
  const navigate = useNavigate();
  const [adminName, setAdminName] = useState("Admin");
  const [profilePic, setProfilePic] = useState(defaultProfile);
  const [isUploading, setIsUploading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const { user, setUser } = useAuth();

  useEffect(() => {
    const fetchAndSetAdminDetails = async () => {
      if (user && user.role === "Admin" && user.id) {
        const initialName = [user.first_name, user.last_name].filter(Boolean).join(' ');
        setAdminName(initialName || user.email || 'Admin');
        setProfilePic(user.profile_picture || defaultProfile); 

        try {
          const { data, error } = await supabase
            .from("users")
            .select("first_name, last_name, profile_picture")
            .eq("id", user.id)
            .single();

          if (error) throw error;

          if (data) {
            const fullName = [data.first_name, data.last_name].filter(Boolean).join(' ');

            const freshUser = {
              ...user,
              first_name: data.first_name,
              last_name: data.last_name,
              profile_picture: data.profile_picture,
            };
            
            setAdminName(fullName || user.email || 'Admin');
            setProfilePic(data.profile_picture || defaultProfile); 

            setUser(freshUser);
            localStorage.setItem("user", JSON.stringify(freshUser));
          }
        } catch (error) {
          console.error("Error fetching fresh admin details:", error.message);
        }
      }
    };
    fetchAndSetAdminDetails();
  }, [user?.id, setUser]);

  const handleProfileChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !user?.id) return;
    
    setIsUploading(true);
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64ProfilePic = reader.result;
      try {
        const { data: updatedUserData, error } = await supabase
          .from("users")
          .update({ profile_picture: base64ProfilePic })
          .eq("id", user.id)
          .select()
          .single();

        if (error) throw error;

        const updatedUser = { ...user, profile_picture: updatedUserData.profile_picture };
        setUser(updatedUser);
        localStorage.setItem("user", JSON.stringify(updatedUser));
      } catch (error) {
        console.error("Error updating profile picture:", error.message);
        alert("Failed to update profile picture.");
      } finally {
        setIsUploading(false);
      }
    };
    reader.readAsDataURL(file);
  };

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
      <button className="sidebar-toggle" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
        {isSidebarOpen ? <FaTimes /> : <FaBars />}
      </button>
      <div className={`sidebar-container ${isSidebarOpen ? "open" : ""}`}>
        <div className="sidebar">
          <div className="admin-profile">
            <label htmlFor="profile-upload" className="admin-profile-pic-label">
              <img
                className={`admin-profile-pic ${isUploading ? "uploading" : ""}`}
                src={profilePic}
                alt="Profile"
                onError={(e) => {
                  e.target.src = defaultProfile;
                }}
              />
            </label>
            <input
              type="file"
              id="profile-upload"
              accept="image/*"
              onChange={handleProfileChange}
              style={{ display: "none" }}
            />
            <p className="admin-profile-name">{adminName}</p>
          </div>

          <ul className="sidebar-nav">
            <li>
              <NavLink
                to="/admin-dashboard"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={handleLinkClick}
              >
                Account Management
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/sectionmanage"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={handleLinkClick}
              >
                Section Management
              </NavLink>
            </li>
            <li>
              <NavLink
                to="/admin-handouts"
                className={({ isActive }) => (isActive ? "active" : "")}
                onClick={handleLinkClick}
              >
                Handouts Management
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

export default AdminSidebar;
