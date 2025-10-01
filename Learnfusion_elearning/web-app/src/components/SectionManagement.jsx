import React, { useState, useEffect } from "react";
import Sidebar from "./Sidebar";
import { supabase } from "../utils/supabaseClient";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Swal from 'sweetalert2';
import { archiveRecord } from "../utils/archiveService";
import "sweetalert2/dist/sweetalert2.min.css";
import { FaArchive, FaUserEdit, FaSearch } from "react-icons/fa";
import "../styles/sections.css";

const SectionManagement = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [sections, setSections] = useState([]);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newSection, setNewSection] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const sectionsPerPage = 10;
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedSections, setSelectedSections] = useState([]);

  useEffect(() => {
    if (user?.id && user.role === "Teacher") {
      fetchSections();
      const interval = setInterval(fetchSections, 10000);
      return () => clearInterval(interval);
    } else {
      setSections([]);
    }
  }, [user]);

  const fetchSections = async () => {
    if (!user?.id) return;
    const { data, error } = await supabase
      .from("sections")
      .select("id, section_name, student_count") 
      .eq("teacher_id", user.id)
      .order("section_name", { ascending: true });

    if (error) {
      console.error("Error fetching sections:", error.message);
      setSections([]);
    } else {
      setSections(data || []);
    }
  };

  const handleAddSection = async () => {
    if (newSection.trim() === "") {
      Swal.fire({
        icon: "warning",
        title: "Incomplete Information",
        text: "Please provide a section name.",
      });
      return;
    }

    try {
      if (!user || user.role !== "Teacher") {
        console.error("Only teachers can add sections.");
        return;
      }

      const { data: existing, error: checkError } = await supabase
        .from("sections")
        .select("id")
        .eq("section_name", newSection)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking section:", checkError.message);
        return;
      }

      if (existing) {
        Swal.fire({
          icon: "error",
          title: "Section Exists",
          text: "This section name already exists. Please choose a different name.",
        });
        return;
      }

      const { data: insertedData, error: insertError } = await supabase
        .from("sections")
        .insert([
          {
            section_name: newSection,
            teacher_id: user.id,
          },
        ])
        .select("id, section_name, student_count") 
        .single();

      if (insertError) {
        Swal.fire({
          icon: "error",
          title: "Error",
          text: `Failed to add section: ${insertError.message}`,
        });
        console.error("Error adding section:", insertError.message);
      } else if (insertedData) {
        setSections((prev) => [...prev, insertedData].sort((a, b) => a.section_name.localeCompare(b.section_name)));
        setNewSection("");
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Section added successfully!",
        });
      }
    } catch (error) {
      console.error("Unexpected error:", error);
      Swal.fire({
        icon: "error",
        title: "Oops...",
        text: "An unexpected error occurred. Please try again.",
      }); 
    }
  };

  const handleArchiveSection = async (sectionId) => {
    const sectionToArchive = sections.find((s) => s.id === sectionId);
    if (!sectionToArchive) {
      Swal.fire("Error!", "Section not found.", "error");
      return;
    }

    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You want to remove this section?.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove it!",
    });
    if (result.isConfirmed) {
      const { success, error: archiveError } = await archiveRecord("sections", sectionToArchive, user.id);

      if (success) {
        const { error: deleteError } = await supabase.from("sections").delete().eq("id", sectionId);
        if (deleteError) {
          Swal.fire("Error!", `Section archived but failed to delete from active list: ${deleteError.message}`, "error");
        } else {
          setSections(sections.filter((section) => section.id !== sectionId));
          Swal.fire("Removed!", "The section has been removed.", "success");
        }
      } else {
        console.error("Error archiving section:", archiveError.message);
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
      Swal.fire("No sections selected", "Please select sections to remove.", "info");
      return;
    }

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `You want to remove these ${selectedSections.length} sections?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove them!",
    });

    if (!result.isConfirmed) return;

    const sectionsToArchive = sections.filter(section => selectedSections.includes(section.id));
    for (const section of sectionsToArchive) {
      await archiveRecord("sections", section, user.id);
    }
    await supabase.from("sections").delete().in("id", selectedSections);
    Swal.fire("Removed!", `${selectedSections.length} sections have been removed.`, "success");
    fetchSections();
    setIsSelectionMode(false);
  };

  const handleManageSection = (section) => {
    navigate(`/manage-section/${section.id}`);
  };

  const handleSearch = () => {
    setSearchTerm(search.trim());
    setCurrentPage(1);
  };

  const filteredSections = sections.filter(
    (section) =>
      searchTerm === "" ||
      section.section_name.toLowerCase().includes(searchTerm.toLowerCase())
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
      <Sidebar />
      <main className="dashboard-content">
        <div className="content">
          <h2 className="section-title">Section Management</h2>
          <div className="search-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search..."
                className="search-bar"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
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
              <button onClick={handleAddSection} className="add-user-btn">
                Add Section
              </button>
              <button
                className="select-multiple-btn"
                onClick={toggleSelectionMode}
              >
                {isSelectionMode ? 'Cancel' : 'Remove'}
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
                        checked={currentSections.length > 0 && selectedSections.length === currentSections.length}
                      />
                    </th>
                  )}
                  <th>Section</th>
                  <th>Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentSections.length > 0 ? (
                  currentSections
                    .map((section, index) => (
                      <tr key={section.id}>
                        {isSelectionMode && (
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedSections.includes(section.id)}
                              onChange={() => handleSelectSection(section.id)}
                            />
                          </td>
                        )}
                        <td>{indexOfFirstSection + index + 1}</td>
                        <td>{section.section_name}</td>
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
                              onClick={() => handleArchiveSection(section.id)}
                              title="Remove Section"
                            >
                              <FaArchive />
                            </button>
                            
                          </div>
                        </td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td colSpan={isSelectionMode ? 5 : 4} style={{ textAlign: "center", padding: "10px" }}>
                      No Data found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {totalPages > 0 && (
          <div className="dashboard-footer">
            <div className="pagination">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              <button className="active">{currentPage}</button>
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default SectionManagement;
