  import { useState, useEffect } from "react";
  import { useNavigate } from "react-router-dom";
  import { FaArchive, FaUserEdit, FaTimes } from "react-icons/fa";
  import AdminSidebar from "./AdminSidebar";
  import { supabase } from "../utils/supabaseClient";
  import { useAuth } from "../context/AuthContext";
  import { archiveRecord } from "../utils/archiveService";
  import Swal from "sweetalert2";
  import "sweetalert2/dist/sweetalert2.min.css";
  import "../styles/AdminDashboard.css";

  const AdminDashboard = () => {
    const navigate = useNavigate();
    const { user: adminUser } = useAuth();
    const [users, setUsers] = useState([]);
    const [filteredUsers, setFilteredUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedRole, setSelectedRole] = useState("All");
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [isSelectionMode, setIsSelectionMode] = useState(false);
    const [updatedUser, setUpdatedUser] = useState({});
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [sections, setSections] = useState([]);
    const [currentPage, setCurrentPage] = useState(1);

    const usersPerPage = 10;

    useEffect(() => {
      fetchUsers();
      fetchSections();
    }, []);

    useEffect(() => {
      let filtered = users;
      if (selectedRole !== "All") {
        filtered = filtered.filter((user) => user.role === selectedRole);
      }
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase().trim();
        filtered = filtered.filter(
          (user) =>
            user.school_id.toString().includes(lowerSearch) ||
            user.first_name.toLowerCase().includes(lowerSearch) ||
            (user.middle_name &&
              user.middle_name.toLowerCase().includes(lowerSearch)) ||
            user.last_name.toLowerCase().includes(lowerSearch)
        );
      }
      setFilteredUsers(filtered);
      setCurrentPage(1);
      setIsSelectionMode(false); 
      setSelectedUsers([]); 
    }, [searchTerm, selectedRole, users]);

    const fetchUsers = async () => {
      const { data, error } = await supabase.from("users").select("*");
      if (!error) setUsers(data);
    };

    const fetchSections = async () => {
      const { data, error } = await supabase
        .from("sections")
        .select("id, section_name");
      if (!error) setSections(data);
    };

    const handleStatusChange = async (userId, newStatus) => {
      const { error } = await supabase
        .from("users")
        .update({ status: newStatus })
        .eq("id", userId);
      if (!error) fetchUsers();
    };

    const handleArchiveUser = async (user) => {
      const result = await Swal.fire({
        title: "Are you sure?",
        text: "You want to archive this user? They will be removed from the active list but can be restored later.",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, archive it!",
      });
  
      if (result.isConfirmed) {
        const { success: archiveSuccess, error: archiveError } = await archiveRecord("users", user, adminUser?.id);
  
        if (archiveSuccess) {
          const { error: deleteError } = await supabase
            .from("users")
            .delete()
            .eq("id", user.id);
  
          if (deleteError) {
            console.error("Error deleting user after archiving:", deleteError);
            Swal.fire("Error!", `User was archived, but failed to be removed from the active list. Error: ${deleteError.message}`, "error");
          } else {
            Swal.fire("Archived!", "User archived successfully.", "success");
            fetchUsers();
          }
        } else {
          console.error("Error archiving user:", archiveError);
          Swal.fire("Error!", `Failed to archive user: ${archiveError.message}`, "error");
        }
      }
    };

    const handleSelectUser = (userId) => {
      setSelectedUsers((prevSelected) =>
        prevSelected.includes(userId)
          ? prevSelected.filter((id) => id !== userId)
          : [...prevSelected, userId]
      );
    };

    const handleSelectAll = (e) => {
      if (e.target.checked) {
        const userIdsOnPage = currentUsers.map((user) => user.id);
        setSelectedUsers(userIdsOnPage);
      } else {
        setSelectedUsers([]);
      }
    };

    const toggleSelectionMode = () => {
      setIsSelectionMode(prevMode => {
        if (prevMode) { 
          setSelectedUsers([]);
        }
        return !prevMode;
      });
    };

    const handleArchiveSelected = async () => {
      if (selectedUsers.length === 0) {
        Swal.fire("No users selected", "Please select users to archive.", "info");
        return;
      }
  
      const result = await Swal.fire({
        title: `Are you sure?`,
        text: `You want to archive these ${selectedUsers.length} users? They will be removed from the active list but can be restored later.`,
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#d33",
        cancelButtonColor: "#3085d6",
        confirmButtonText: "Yes, archive them!",
      });
  
      if (result.isConfirmed) {
        const usersToArchive = users.filter(user => selectedUsers.includes(user.id));
        const successfullyArchivedIds = [];
        const archiveErrors = [];
  
        for (const user of usersToArchive) {
          const { success, error } = await archiveRecord("users", user, adminUser?.id);
          if (success) {
            successfullyArchivedIds.push(user.id);
          } else {
            archiveErrors.push(`Failed to archive ${user.first_name}: ${error.message}`);
          }
        }
  
        if (successfullyArchivedIds.length > 0) {
          const { error: deleteError } = await supabase.from("users").delete().in("id", successfullyArchivedIds);
          if (deleteError) archiveErrors.push(`Error removing archived users: ${deleteError.message}`);
        }
  
        Swal.fire("Process Complete", `${successfullyArchivedIds.length} users archived. ${archiveErrors.length} failed.`, archiveErrors.length > 0 ? "warning" : "success");
        fetchUsers();
        setIsSelectionMode(false);
      }
    };

    const handleEditClick = (user) => {
      setCurrentUser(user);
      setUpdatedUser({ ...user });
      setIsEditModalOpen(true);
    };

    const handleModalClose = () => {
      setIsEditModalOpen(false);
      setCurrentUser(null);
      setUpdatedUser({});
    };

    const handleUpdateChange = (e) => {
      setUpdatedUser({ ...updatedUser, [e.target.name]: e.target.value });
    };

    const handleSaveChanges = async () => {
      if (!currentUser) return;
      const { error } = await supabase
        .from("users")
        .update(updatedUser)
        .eq("id", currentUser.id);
      if (!error) {
        handleModalClose();
        fetchUsers();
      }
    };

    const paginate = (pageNumber) => {
      if (
        pageNumber > 0 &&
        pageNumber <= Math.ceil(filteredUsers.length / usersPerPage)
      ) {
        setCurrentPage(pageNumber);
        setIsSelectionMode(false); 
        setSelectedUsers([]); 
      }
    };

    const indexOfLastUser = currentPage * usersPerPage;
    const indexOfFirstUser = indexOfLastUser - usersPerPage;
    const currentUsers = filteredUsers.slice(indexOfFirstUser, indexOfLastUser);
    const totalPages = Math.ceil(filteredUsers.length / usersPerPage);

    return (
      <div className="dashboard-container">
        <AdminSidebar />
        <main className="dashboard-content">
          <h2 className="dashboard-title">Account Management</h2>

          <div className="search-filter">
        <input
          type="text"
          placeholder="Search by Name or School ID..."
          className="search-bar"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select
          className="role-filter"
          value={selectedRole}
          onChange={(e) => setSelectedRole(e.target.value)}
        >
          <option value="All">All Accounts</option>
          <option value="Admin">Admin Accounts</option>
          <option value="Teacher">Teacher Accounts</option>
          <option value="Student">Student Accounts</option>
        </select>
        <button
          className="add-user-btn"
          onClick={() => navigate("/add-user")}
        >
          Add User
        </button>
        <button
          className="select-multiple-btn"
          onClick={toggleSelectionMode}
        >
          {isSelectionMode ? 'Cancel' : 'Archive'}
        </button>
        {isSelectionMode && selectedUsers.length > 0 && (
          <button
            className="archive-btn"
            onClick={handleArchiveSelected}
          >
            <FaArchive /> ({selectedUsers.length})
          </button>
        )}
          </div>

          <div className="table-container">
        <table>
          <thead>
            <tr>
          <th>#</th>
          {isSelectionMode && (
            <th>
              <input
            type="checkbox"
            onChange={handleSelectAll}
            checked={currentUsers.length > 0 && selectedUsers.length === currentUsers.length}
              />
            </th>
          )}
          <th>School ID</th>
          <th>First Name</th>
          <th>Middle Name</th>
          <th>Last Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Contact Number</th>
          <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {currentUsers.length > 0 ? (
          currentUsers.map((user, index) => (
            <tr key={user.id}>
              <td>{indexOfFirstUser + index + 1}</td>
              {isSelectionMode && (
            <td>
              <input
                type="checkbox"
                checked={selectedUsers.includes(user.id)}
                onChange={() => handleSelectUser(user.id)}
              />
            </td>
              )}
              <td>{user.school_id}</td>
              <td>{user.first_name}</td>
              <td>{user.middle_name || "N/A"}</td>
              <td>{user.last_name}</td>
              <td>{user.email}</td>
              <td>{user.role}</td>
              <td>{user.contact_number}</td>
              <td>
            <div className="actions-container">
              <select
                className="status-dropdown"
                value={user.status}
                onChange={(e) =>
              handleStatusChange(user.id, e.target.value)
                }
              >
                <option value="Active">Active</option>
                <option value="Inactive">Deactive</option>
              </select>
              <button
                className="edit-btn"
                onClick={() => handleEditClick(user)}
              >
                <FaUserEdit />
              </button>
              <button
                className="archive-btn"
                onClick={() => handleArchiveUser(user)}
                title="Archive User"
              >
                <FaArchive />
              </button>
            </div>
              </td>
            </tr>
          ))
            ) : (
          <tr>
            <td colSpan={isSelectionMode ? 11 : 10} style={{ textAlign: "center", padding: "10px" }}>
              No Data found.
            </td>
          </tr>
            )}
          </tbody>
        </table>
          </div>

          <div className="dashboard-footer">
     
      <div className="pagination">
        <button
      onClick={() => paginate(currentPage - 1)}
      disabled={currentPage === 1}
        >
      Previous
        </button>

        <button
      onClick={() => paginate(1)}
      className={currentPage === 1 ? "active" : ""}
        >
      1
        </button>

        {currentPage > 3 && <span className="page-dots">...</span>}

        {Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(
        (page) =>
          page !== 1 &&
          page !== totalPages &&
          Math.abs(currentPage - page) <= 1
      )
      .map((page) => (
        <button
          key={page}
          onClick={() => paginate(page)}
          className={currentPage === page ? "active" : ""}
        >
          {page}
        </button>
      ))}

        {currentPage < totalPages - 2 && (
      <span className="page-dots">...</span>
        )}

        {totalPages > 1 && (
      <button
        onClick={() => paginate(totalPages)}
        className={currentPage === totalPages ? "active" : ""}
      >
        {totalPages}
      </button>
        )}

        <button
      onClick={() => paginate(currentPage + 1)}
      disabled={currentPage === totalPages || totalPages === 0}
        >
      Next
        </button>
      </div>
    </div>

        </main>

        {/* Edit Modal */}
        {isEditModalOpen && currentUser && (
          <div className="lf-overlay">
        <div className="lf-modal">
          <div className="lf-modal-header">
            <h2>Edit User Details</h2>
            <button className="lf-close-btn" onClick={handleModalClose}>
          <FaTimes />
            </button>
          </div>
          <div className="lf-modal-body">
            <div className="lf-user-details">
          <div className="lf-form-group">
            <label>School ID:</label>
            <input
              type="text"
              name="school_id"
              value={updatedUser.school_id || ""}
              onChange={handleUpdateChange}
            />
          </div>
          <div className="lf-form-group">
            <label>First Name:</label>
            <input
              type="text"
              name="first_name"
              value={updatedUser.first_name || ""}
              onChange={handleUpdateChange}
            />
          </div>
          <div className="lf-form-group">
            <label>Middle Name:</label>
            <input
              type="text"
              name="middle_name"
              value={updatedUser.middle_name || ""}
              onChange={handleUpdateChange}
            />
          </div>
          <div className="lf-form-group">
            <label>Last Name:</label>
            <input
              type="text"
              name="last_name"
              value={updatedUser.last_name || ""}
              onChange={handleUpdateChange}
            />
          </div>
          <div className="lf-form-group">
            <label>Email:</label>
            <input
              type="email"
              name="email"
              value={updatedUser.email || ""}
              onChange={handleUpdateChange}
            />
          </div>
          <div className="lf-form-group">
            <label>Contact Number:</label>
            <input
              type="text"
              name="contact_number"
              value={updatedUser.contact_number || ""}
              onChange={handleUpdateChange}
            />
          </div>
            <div className="lf-form-group">
          <label>Role:</label>
          <select name="role" value={updatedUser.role || ""} onChange={handleUpdateChange}>
            <option value="Admin">Admin</option>
            <option value="Teacher">Teacher</option>
            <option value="Student">Student</option>
          </select>
            </div>
            <div className="lf-form-group">
          <label>Status:</label>
          <select name="status" value={updatedUser.status || ""} onChange={handleUpdateChange}>
            <option value="Active">Active</option>
            <option value="Inactive">Inactive</option>
          </select>
            </div>
          <div className="lf-form-group">
            {updatedUser.role === "Student" && (
              <>
            <label>Section:</label>
            <select
              name="section_id"
              value={updatedUser.section_id || ""}
              onChange={handleUpdateChange}
            >
              <option value="">No Section</option>
              {sections.map((section) => (
                <option key={section.id} value={section.id}>
              {section.section_name}
                </option>
              ))}
            </select>
              </>
            )}
          </div>
            </div>
          </div>
          <div className="lf-modal-footer">
            <div className="lf-actions">
          <button className="lf-cancel-btn" onClick={handleModalClose}>
            Cancel
          </button>
          <button className="lf-save-btn" onClick={handleSaveChanges}>
            Save Changes
          </button>
            </div>
          </div>
        </div>
          </div>
        )}
      </div>
        );
  };

  export default AdminDashboard;
