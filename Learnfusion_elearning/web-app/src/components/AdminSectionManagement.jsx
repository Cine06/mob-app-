import React, { useState, useEffect } from "react";
import AdminSidebar from "./AdminSidebar";
import { FaArchive, FaUserEdit, FaSearch } from "react-icons/fa";
import { supabase } from "../utils/supabaseClient";
import { archiveRecord } from "../utils/archiveService";
import { useAuth } from "../context/AuthContext";
import Swal from 'sweetalert2';
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/sections.css";
import { useNavigate } from "react-router-dom";

const AdminSectionManagement = () => {
  const { user: adminUser } = useAuth();
  const navigate = useNavigate();
  const [sections, setSections] = useState([]);
  const [search, setSearch] = useState("");
  const [newSection, setNewSection] = useState("");
  const [selectedSection, setSelectedSection] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSections, setSelectedSections] = useState([]);
  const sectionsPerPage = 10;

  useEffect(() => {
    fetchSections();
    fetchTeachers();
  }, []);

  useEffect(() => {
    setCurrentPage(1);
  }, []);

  const fetchSections = async () => {
    const { data, error } = await supabase
      .from("sections")
      .select(`
        id, 
        section_name, 
        student_count, 
        teacher_id,
        teacher:users!teacher_id_fkey(id, first_name, last_name)
      `)
      .order("section_name", { ascending: true });

    if (error) {
      console.error("Error fetching sections:", error.message);
    } else {
      setSections(data);
    }
  };

  const fetchTeachers = async () => {
    const { data, error } = await supabase.from("users").select("*").eq("role", "Teacher");
    if (error) {
      console.error("Error fetching teachers:", error.message);
    } else {
      setTeachers(data);
    }
  };

  const handleAddSection = async () => {
    if (newSection.trim() === "" || !selectedTeacher) {
      Swal.fire({
        icon: "warning",
        title: "Incomplete Information",
        text: "Please enter a section name and select a teacher.",
      });
      return;
    }

    try {
      const { data, error } = await supabase
        .from("sections")
        .insert([{ section_name: newSection, teacher_id: selectedTeacher }])
        .select();

      if (error) throw error;

      if (data) {
        Swal.fire("Success!", "Section added successfully!", "success");
        setNewSection("");
        setSelectedTeacher("");
        fetchSections();
      }
    } catch (error) {
      console.error("Error adding section:", error.message);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `Failed: A section with this name might already exist.`,
      });
    }
  };

  const handleArchiveSection = async (section) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You want to archive this section? It will be removed but can be restored later.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, archive it!",
    });

    if (result.isConfirmed) {
      const { success: archiveSuccess, error: archiveError } = await archiveRecord("sections", section);

      if (archiveSuccess) {
        const { error: deleteError } = await supabase
          .from("sections")
          .delete()
          .eq("id", section.id);

        if (deleteError) {
          Swal.fire("Error!", `Section archived but failed to delete: ${deleteError.message}`, "error");
        } else {
          Swal.fire("Archived!", "The section has been archived.", "success");
          fetchSections();
        }
      } else {
        Swal.fire("Error!", `Failed to archive the section: ${archiveError.message}`, "error");
      }
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(prevMode => {
      if (prevMode) { 
        setSelectedSections([]);
      }
      return !prevMode;
    });
  };

  const handleSelectSection = (sectionId) => {
    setSelectedSections((prevSelected) =>
      prevSelected.includes(sectionId)
        ? prevSelected.filter((id) => id !== sectionId)
        : [...prevSelected, sectionId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const sectionIdsOnPage = currentSections.map((section) => section.id);
      setSelectedSections(sectionIdsOnPage);
    } else {
      setSelectedSections([]);
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedSections.length === 0) {
      Swal.fire("No sections selected", "Please select sections to archive.", "info");
      return;
    }

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `You want to archive these ${selectedSections.length} sections? They can be restored later.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, archive them!",
    });

    if (result.isConfirmed) {
      const sectionsToArchive = sections.filter(section => selectedSections.includes(section.id));
      const successfullyArchivedIds = [];
      const archiveErrors = [];

      for (const section of sectionsToArchive) {
        const { success, error } = await archiveRecord("sections", section);
        if (success) {
          successfullyArchivedIds.push(section.id);
        } else {
          archiveErrors.push(`Failed to archive ${section.section_name}: ${error.message}`);
        }
      }

      if (successfullyArchivedIds.length > 0) {
        const { error: deleteError } = await supabase.from("sections").delete().in("id", successfullyArchivedIds);
        if (deleteError) archiveErrors.push(`Error removing archived sections: ${deleteError.message}`);
      }

      Swal.fire("Process Complete", `${successfullyArchivedIds.length} sections archived. ${archiveErrors.length} failed.`, archiveErrors.length > 0 ? "warning" : "success");
      fetchSections();
      setIsSelectionMode(false);
    }
  };

  const handleManageSection = (section) => {
    navigate(`/admin-manage-section/${section.section_name}`);
  };

  const handleSearch = () => {
    
  };

  const handleTeacherChange = (e) => {
    setSelectedTeacher(e.target.value);
  };

  const filteredSections = sections.filter((section) =>
    section.section_name.toLowerCase().includes(search.toLowerCase())
  );

  const totalPages = Math.ceil(filteredSections.length / sectionsPerPage);
  const indexOfLastSection = currentPage * sectionsPerPage;
  const indexOfFirstSection = indexOfLastSection - sectionsPerPage;
  const currentSections = filteredSections.slice(indexOfFirstSection, indexOfLastSection);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      setIsSelectionMode(false);
      setSelectedSections([]);
    }
  };

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <main className="dashboard-content">
        <div className="content">
          <h2>Section Management</h2>
          <div className="search-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search..."
                className="search-bar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <button className="search-btn" onClick={handleSearch}>
                <FaSearch />
              </button>
            </div>

            <div className="add-section">
              <input
                type="text"
                placeholder="New section name"
                value={newSection}
                onChange={(e) => setNewSection(e.target.value)}
                className="new-section-input"
              />
              <select
                value={selectedTeacher}
                onChange={handleTeacherChange}
                className="new-section-input"
              >
                <option value="">Select Teacher</option>
                {teachers.map((teacher) => (
                  <option key={teacher.id} value={teacher.id}>
                    {teacher.first_name} {teacher.last_name}
                  </option>
                ))}
              </select>
              <button onClick={handleAddSection} className="add-user-btn">
                Add Section
              </button>
            </div>
            <button
              className="select-multiple-btn"
              onClick={toggleSelectionMode}
            >
              {isSelectionMode ? 'Cancel' : 'Archive'}
            </button>
            {isSelectionMode && selectedSections.length > 0 && (
              <button
                className="archive-btn"
                onClick={handleArchiveSelected}
              >
                <FaArchive /> ({selectedSections.length})
              </button>
            )}
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  {isSelectionMode && (
                    <th><input type="checkbox" onChange={handleSelectAll} checked={currentSections.length > 0 && selectedSections.length === currentSections.length} /></th>
                  )}
                  <th>Section</th>
                  <th>Teacher</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentSections.length > 0 ? (
                  currentSections
                    .map((section, index) => (
                      <tr key={section.id}>
                        <td>{indexOfFirstSection + index + 1}</td>
                        {isSelectionMode && (
                          <td><input type="checkbox" checked={selectedSections.includes(section.id)} onChange={() => handleSelectSection(section.id)} /></td>
                        )}
                        <td>{section.section_name}</td>
                        <td>
                          {section.teacher
                            ? `${section.teacher.first_name} ${section.teacher.last_name}`
                            : "No Teacher Assigned"}
                        </td>
                        <td>{section.student_count ?? 0}</td>
                        <td>
                          <div className="lf-actions">
                            <button
                              className="edit-btn"
                              onClick={() => handleManageSection(section)}
                            >
                              <FaUserEdit />
                            </button>
                            <button
                              className="archive-btn"
                              onClick={() => handleArchiveSection(section)}
                              title="Archive Section"
                            >
                              <FaArchive/>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={isSelectionMode ? 6 : 5} style={{ textAlign: "center", padding: "10px" }}>
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

              {currentPage > 2 && <button onClick={() => paginate(1)}>1</button>}
              {currentPage > 3 && <span className="page-dots">...</span>}

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(
                  (page) =>
                    page > 0 &&
                    totalPages > 1 &&
                    Math.abs(currentPage - page) < 2
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

              {currentPage < totalPages - 2 && <span className="page-dots">...</span>}
              {currentPage < totalPages - 1 && totalPages > 1 && (
                <button onClick={() => paginate(totalPages)}>{totalPages}</button>
              )}

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
};

export default AdminSectionManagement;