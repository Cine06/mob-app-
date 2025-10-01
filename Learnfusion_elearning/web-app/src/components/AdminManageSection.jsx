import React, { useState, useEffect } from "react";
import { FaSearch, FaArchive, FaUserMinus } from "react-icons/fa";
import { supabase } from "../utils/supabaseClient";
import AdminSidebar from "./AdminSidebar";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { archiveRecord } from "../utils/archiveService";
import Swal from 'sweetalert2';
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/sections.css";

const AdminManageSection = () => {
  const { user: adminUser } = useAuth();
  const { sectionName } = useParams();
  const navigate = useNavigate();
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [selectedTeacher, setSelectedTeacher] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);
  const studentsPerPage = 10;

  useEffect(() => {
    fetchSectionDetails();
    fetchAvailableTeachers();
  }, [sectionName]);

  useEffect(() => {
    handleSearch();
  }, [searchTerm, students]);

  const fetchSectionDetails = async () => {
    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from("sections")
        .select("id, teacher_id")
        .eq("section_name", sectionName)
        .single();

      if (sectionError) {
        console.error("Error fetching section details:", sectionError.message);
        return;
      }

      const sectionId = sectionData?.id;
      setSelectedTeacher(sectionData?.teacher_id || "");

      const { data: studentData, error: studentError } = await supabase
        .from("users")
        .select("id, school_id, first_name, middle_name, last_name, email, contact_number")
        .eq("section_id", sectionId)
        .eq("role", "Student");

      if (studentError) {
        console.error("Error fetching students:", studentError.message);
        return;
      }

      setStudents(studentData);
      setFilteredStudents(studentData);
    } catch (error) {
      console.error("Error fetching section details:", error.message);
    }
  };

  const fetchAvailableTeachers = async () => {
    const { data, error } = await supabase
      .from("users")
      .select("id, first_name, last_name")
      .eq("role", "Teacher");

    if (error) {
      console.error("Error fetching available teachers:", error.message);
    } else {
      setAvailableTeachers(data);
    }
  };

  const handleSearch = () => {
    if (!searchTerm.trim()) {
      setFilteredStudents(students);
      setCurrentPage(1);
      return;
    }

    const filtered = students.filter((student) =>
      student.school_id.toString().includes(searchTerm.trim()) ||
      student.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.middle_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      student.last_name.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredStudents(filtered);
    setCurrentPage(1);
  };

  const handleRemoveStudent = async (studentId) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You want to remove this student from the section?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove them!",
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from("users")
        .update({ section_id: null })
        .eq("id", studentId);

      if (error) {
        console.error("Error removing student:", error.message);
        Swal.fire("Error!", "Failed to remove the student from the section.", "error");
      } else {
        Swal.fire("Removed!", "The student has been removed from the section.", "success");
        fetchSectionDetails();
      }
    }
  };

  const handleArchiveStudent = async (student) => {
    const result = await Swal.fire({
      title: "Are you sure you want to remove this student?",
      text: "This will remove their account.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove student!",
    });

    if (result.isConfirmed) {
      const { success: archiveSuccess, error: archiveError } = await archiveRecord("users", student);

      if (archiveSuccess) {
        const { error: deleteError } = await supabase
          .from("users")
          .delete()
          .eq("id", student.id);

        if (deleteError) {
          Swal.fire("Error!", `Student archived but failed to delete: ${deleteError.message}`, "error");
        } else {
          Swal.fire("Removed!", "The student's account has been removed.", "success");
          fetchSectionDetails();
        }
      } else {
        console.error("Error archiving student:", archiveError.message);
        Swal.fire("Error!", `Failed to archive the student: ${archiveError.message}`, "error");
      }
    }
  };

  const handleChangeTeacher = async (teacherId) => {
    const { error } = await supabase
      .from("sections")
      .update({ teacher_id: teacherId })
      .eq("section_name", sectionName);

    if (error) {
      console.error("Error changing teacher:", error.message);
    } else {
      setSelectedTeacher(teacherId);
      fetchSectionDetails();
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(prevMode => {
      if (prevMode) { 
        setSelectedStudents([]);
      }
      return !prevMode;
    });
  };

  const handleSelectStudentCheckbox = (studentId) => {
    setSelectedStudents((prevSelected) =>
      prevSelected.includes(studentId)
        ? prevSelected.filter((id) => id !== studentId)
        : [...prevSelected, studentId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const studentIdsOnPage = currentStudents.map((student) => student.id);
      setSelectedStudents(studentIdsOnPage);
    } else {
      setSelectedStudents([]);
    }
  };

  const handleRemoveSelectedFromSection = async () => {
    if (selectedStudents.length === 0) {
      Swal.fire("No students selected", "Please select students to remove.", "info");
      return;
    }

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `You want to remove these ${selectedStudents.length} students from this section?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove them!",
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from("users")
        .update({ section_id: null })
        .in("id", selectedStudents);

      if (error) {
        Swal.fire("Error!", `Failed to remove selected students: ${error.message}`, "error");
      } else {
        Swal.fire("Removed!", "The selected students have been removed from the section.", "success");
        fetchSectionDetails();
      }
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedStudents.length === 0) {
      Swal.fire("No students selected", "Please select students to remove.", "info");
      return;
    }

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `You want to remove these ${selectedStudents.length} students? This will remove their accounts entirely.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove them!",
    });

    if (result.isConfirmed) {
      const studentsToArchive = students.filter(student => selectedStudents.includes(student.id));
      const successfullyArchivedIds = [];
      const archiveErrors = [];

      for (const student of studentsToArchive) {
        const { success, error } = await archiveRecord("users", student);
        if (success) {
          successfullyArchivedIds.push(student.id);
        } else {
          archiveErrors.push(`Failed to archive ${student.first_name}: ${error.message}`);
        }
      }

      if (successfullyArchivedIds.length > 0) {
        const { error: deleteError } = await supabase.from("users").delete().in("id", successfullyArchivedIds);
        if (deleteError) archiveErrors.push(`Error removing archived students: ${deleteError.message}`);
      }

      Swal.fire("Process Complete", `${successfullyArchivedIds.length} students removed. ${archiveErrors.length} failed.`, archiveErrors.length > 0 ? "warning" : "success");
      fetchSectionDetails();
      setIsSelectionMode(false);
      setSelectedStudents([]);
    }
  };

  const totalPages = Math.ceil(filteredStudents.length / studentsPerPage);
  const indexOfLastStudent = currentPage * studentsPerPage;
  const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
  const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      setIsSelectionMode(false);
      setSelectedStudents([]);
    }
  };


  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <main className="dashboard-content">
        <h2 className="dashboard-title">Manage Section: {sectionName}</h2>
        <div className="search-filter">
            <input
              type="text"
              placeholder="Search by Name or School ID..."
              className="search-bar"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-btn" onClick={handleSearch}>
              <FaSearch />
            </button>
            
            <p>Teacher: </p>
          <select
            value={selectedTeacher}
            onChange={(e) => handleChangeTeacher(e.target.value)}
          >
            <option value="">Select Teacher</option>
            {availableTeachers.map((teacher) => (
              <option key={teacher.id} value={teacher.id}>
                {teacher.first_name} {teacher.last_name}
              </option>
            ))}
          </select>          
          <button
            className="select-multiple-btn"
            onClick={toggleSelectionMode}
          >
            {isSelectionMode ? 'Cancel' : 'Remove'}
          </button>
          {isSelectionMode && (
            <button
              className="archive-btn"
              onClick={handleArchiveSelected}
            >
              <FaArchive /> ({selectedStudents.length})
            </button>
          )}
          {isSelectionMode && (
            <button
              className="remove-btn"
              onClick={handleRemoveSelectedFromSection}
              style={{ marginLeft: '10px' }}
            >
              <FaUserMinus /> Remove ({selectedStudents.length})
            </button>
          )}
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>#</th>
                {isSelectionMode && (
                  <th><input type="checkbox" onChange={handleSelectAll} checked={currentStudents.length > 0 && selectedStudents.length === currentStudents.length} /></th>
                )}
                <th>School ID</th>
                <th>First Name</th>
                <th>Middle Name</th>
                <th>Last Name</th>
                <th>Email</th>
                <th>Contact Number</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {currentStudents.length > 0 ? (
                currentStudents.map((student, index) => (
                  <tr key={student.id}>
                    <td>{indexOfFirstStudent + index + 1}</td>
                    {isSelectionMode && (
                      <td><input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={() => handleSelectStudentCheckbox(student.id)} /></td>
                    )}
                    <td>{student.school_id}</td>
                    <td>{student.first_name}</td>
                    <td>{student.middle_name || "N/A"}</td>
                    <td>{student.last_name}</td>
                    <td>{student.email}</td>
                    <td>{student.contact_number}</td>
                    <td>
                      <div className="lf-actions">
                        <button
                          className="remove-btn"
                          onClick={() => handleRemoveStudent(student.id)}
                          title="Remove from Section"
                        >
                          <FaUserMinus />
                        </button>
                        <button
                          className="archive-btn"
                          onClick={() => handleArchiveStudent(student)}
                          title="Remove Student Account"
                        >
                          <FaArchive />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={isSelectionMode ? 9 : 8} style={{ textAlign: "center", padding: "10px" }}>
                    No students found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="dashboard-footer">
          <button onClick={() => navigate("/sectionmanage")} className="back-btn">
            Back
          </button>

          <div className="space"></div>
          {totalPages > 0 && (
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
                    page === currentPage ||
                    page === currentPage - 1 ||
                    page === currentPage + 1
                )
                .map((page) =>
                  page > 0 && page <= totalPages ? (
                    <button
                      key={page}
                      onClick={() => paginate(page)}
                      className={currentPage === page ? "active" : ""}
                    >
                      {page}
                    </button>
                  ) : null
                )}

              {currentPage < totalPages - 2 && <span className="page-dots">...</span>}
              {currentPage < totalPages - 1 && <button onClick={() => paginate(totalPages)}>{totalPages}</button>}

              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
            </div>
          )}
        </div>

      </main>
    </div>
  );
};

export default AdminManageSection;