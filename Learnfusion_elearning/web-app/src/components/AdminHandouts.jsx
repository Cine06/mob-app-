import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { FaArchive, FaUserEdit, FaSearch } from "react-icons/fa";
import { supabase } from "../utils/supabaseClient";
import { archiveRecord } from "../utils/archiveService";
import { useAuth } from "../context/AuthContext";
import Swal from 'sweetalert2';
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/Handouts.css";

const AdminHandouts = () => {
  const navigate = useNavigate();
  const { user } = useAuth(); 
  const [handouts, setHandouts] = useState([]);
  const [usersMap, setUsersMap] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [newHandout, setNewHandout] = useState({
    title: "",
    youtube_link: "",
    file_attachments: "",
  });
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editingHandoutId, setEditingHandoutId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedHandouts, setSelectedHandouts] = useState([]);
  const itemsPerPage = 10;

  const fetchHandouts = useCallback(async () => {
    if (!user?.id) {
      setHandouts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const { data: handoutsData, error: fetchError } = await supabase
        .from("handouts")
        .select("*")
        .order("created_at", { ascending: false });

      if (fetchError) {
        console.error("Error fetching handouts for admin:", fetchError.message);
        setHandouts([]);
        setError(fetchError.message);
        return;
      }

      setHandouts(handoutsData || []);

      const userIds = [...new Set((handoutsData || []).map((h) => h.users_id))];
      if (userIds.length > 0) {
        const { data: usersData } = await supabase
          .from("users")
          .select("id, first_name, last_name")
          .in("id", userIds);

        if (usersData) {
          const map = {};
          usersData.forEach((u) => {
            map[u.id] = `${u.first_name} ${u.last_name}`;
          });
          setUsersMap(map);
        }
      }
    } catch (err) {
      console.error("Error fetching handouts data:", err);
      setError(err.message);
      setHandouts([]);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      fetchHandouts();
      const interval = setInterval(fetchHandouts, 10000);
      return () => clearInterval(interval);
    } else {
      setHandouts([]);
      setLoading(false);
    }
  }, [user?.id, fetchHandouts]);

  const isValidUrl = (string) => {
    try {
      const url = new URL(string);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch (_) {
      return false;
    }
  };

  const isValidYouTubeUrl = (url) => {
    if (!url || url.trim() === "") return true;
    if (!isValidUrl(url)) return false;
    const youtubeRegex =
      /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
    return youtubeRegex.test(url);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.type !== "application/pdf") {
        Swal.fire({
          icon: "warning",
          title: "Invalid File Type",
          text: "Only PDF files are allowed.",
        });
        event.target.value = ""; 
        setSelectedFile(null);
        return;
      }

      const maxSize = 250 * 1024 * 1024;
      if (file.size > maxSize) {
        Swal.fire({
          icon: "warning",
          title: "File Too Large",
          text: "File size must be less than 250MB.",
        });
        event.target.value = ""; 
        setSelectedFile(null);
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return null;
    const fileExt = file.name.split(".").pop();
    const fileName = `${Math.random()
      .toString(36)
      .substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `handouts/${fileName}`;

    const { error } = await supabase.storage.from("handouts").upload(filePath, file);
    if (error) throw error;

    const { data: urlData } = supabase.storage
      .from("handouts")
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleAddOrUpdateHandout = async () => {
    if (newHandout.title.trim() === "") {
      Swal.fire({
        icon: "warning",
        title: "Missing Title",
        text: "Please provide a handout title.",
      });
      return;
    }

    if (!newHandout.youtube_link || !isValidYouTubeUrl(newHandout.youtube_link)) {
      Swal.fire({
        icon: "warning",
        title: "Invalid URL",
        text: "Please enter a valid YouTube URL.",
      });
      return;
    }

 
    if (!isEditing && !selectedFile) {
      Swal.fire({
        icon: "warning",
        title: "Missing File",
        text: "Please select a file to upload.",
      });
      return;
    }

    if (isEditing && !newHandout.file_attachments && !selectedFile) {
      Swal.fire({
        icon: "warning",
        title: "Missing File",
        text: "Please ensure a file is attached or select a new one.",
      });
      return;
    }

    try {
      setUploading(true);
      let fileUrl = newHandout.file_attachments || null;
      if (selectedFile) {
        fileUrl = await uploadFile(selectedFile);
      }

      if (isEditing) {
        const { error: updateError } = await supabase
          .from("handouts")
          .update({
            handouts_title: newHandout.title,
            youtube_link: newHandout.youtube_link || null,
            file_attachments: fileUrl,
          })
          .eq("id", editingHandoutId);

        if (updateError) throw updateError;
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Handout updated successfully!",
        });
      } else {
        const { error: insertError } = await supabase.from("handouts").insert([
          {
            handouts_title: newHandout.title,
            youtube_link: newHandout.youtube_link || null,
            file_attachments: fileUrl,
            users_id: user.id,
          },
        ]);

        if (insertError) throw insertError;
        Swal.fire({
          icon: "success",
          title: "Success!",
          text: "Handout added successfully!",
        });
      }

      fetchHandouts();
      closeModal();
    } catch (error) {
      console.error("Error saving handout:", error.message);
      Swal.fire({
        icon: "error",
        title: "Error",
        text: `Failed to save handout: ${error.message}`,
      });
    } finally {
      setUploading(false);
    }
  };

  const handleArchiveHandout = async (handout) => {
    const result = await Swal.fire({
      title: "Are you sure?",
      text: "You want to remove this handout?",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove it!",
    });

    if (result.isConfirmed) {
      const { success: archiveSuccess, error: archiveError } = await archiveRecord("handouts", handout, user?.id);

      if (archiveSuccess) {
        const { error: deleteError } = await supabase
          .from("handouts")
          .delete()
          .eq("id", handout.id);

        if (deleteError) {
          Swal.fire("Error!", `Handout archived but failed to delete: ${deleteError.message}`, "error");
        } else {
          Swal.fire(
            "Removed!",
            "The handout has been removed.",
            "success"
          );
          fetchHandouts();
        }
      } else {
        Swal.fire("Error!", `Failed to archive handout: ${archiveError.message}`, "error");
      }
    }
  };

  const toggleSelectionMode = () => {
    setIsSelectionMode(prevMode => {
      if (prevMode) { 
        setSelectedHandouts([]);
      }
      return !prevMode;
    });
  };

  const handleSelectHandout = (handoutId) => {
    setSelectedHandouts((prevSelected) =>
      prevSelected.includes(handoutId)
        ? prevSelected.filter((id) => id !== handoutId)
        : [...prevSelected, handoutId]
    );
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      const handoutIdsOnPage = currentHandouts.map((handout) => handout.id);
      setSelectedHandouts(handoutIdsOnPage);
    } else {
      setSelectedHandouts([]);
    }
  };

  const handleArchiveSelected = async () => {
    if (selectedHandouts.length === 0) {
      Swal.fire("No handouts selected", "Please select handouts to remove.", "info");
      return;
    }

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `You want to remove these ${selectedHandouts.length} handouts?`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove them!",
    });

    if (result.isConfirmed) {
      const handoutsToArchive = handouts.filter(handout => selectedHandouts.includes(handout.id));
      const successfullyArchivedIds = [];
      const archiveErrors = [];

      for (const handout of handoutsToArchive) {
        const { success, error } = await archiveRecord("handouts", handout, user?.id);
        if (success) successfullyArchivedIds.push(handout.id);
        else archiveErrors.push(`Failed to archive ${handout.handouts_title}: ${error.message}`);
      }

      if (successfullyArchivedIds.length > 0) await supabase.from("handouts").delete().in("id", successfullyArchivedIds);
      Swal.fire("Process Complete", `${successfullyArchivedIds.length} handouts removed. ${archiveErrors.length} failed.`, archiveErrors.length > 0 ? "warning" : "success");
      fetchHandouts();
      setIsSelectionMode(false);
    }
  };

  const handleSearch = () => setSearchTerm(search.trim());

  const filterHandouts = (handouts, searchTerm) => {
    if (!searchTerm) return handouts;
    const term = searchTerm.toLowerCase();
    return handouts.filter((handout) => {
      const titleMatch = handout.handouts_title.toLowerCase().includes(term);
      const creatorName = usersMap[handout.users_id] || "";
      const creatorMatch = creatorName.toLowerCase().includes(term);
      const youtubeMatch =
        handout.youtube_link && handout.youtube_link.toLowerCase().includes(term);
      const fileMatch =
        handout.file_attachments &&
        handout.file_attachments.toLowerCase().includes(term);
      const dateMatch = new Date(handout.created_at)
        .toLocaleDateString()
        .toLowerCase()
        .includes(term);
      return titleMatch || creatorMatch || youtubeMatch || fileMatch || dateMatch;
    });
  };

  const filteredHandouts = filterHandouts(handouts, searchTerm);
  const totalPages = Math.ceil(filteredHandouts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const currentHandouts = filteredHandouts.slice(
    indexOfLastItem - itemsPerPage,
    indexOfLastItem
  );

  const openModal = (handout = null) => {
    if (handout) {
      setIsEditing(true);
      setEditingHandoutId(handout.id);
      setNewHandout({
        title: handout.handouts_title,
        youtube_link: handout.youtube_link || "",
        file_attachments: handout.file_attachments || "",
      });
    } else {
      setIsEditing(false);
      setEditingHandoutId(null);
      setNewHandout({ title: "", youtube_link: "", file_attachments: "" });
    }
    setSelectedFile(null);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setIsEditing(false);
    setEditingHandoutId(null);
    setNewHandout({ title: "", youtube_link: "", file_attachments: "" });
    setSelectedFile(null);
  };

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
      setIsSelectionMode(false);
      setSelectedHandouts([]);
    }
  };

  return (
    <div className="dashboard-container">
      <AdminSidebar />
      <main className="dashboard-content">
        <div className="content">
          <h2 className="section-title">Handouts Management</h2>
          <div className="search-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search handouts..."
                className="search-bar"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchTerm(e.target.value.trim());
                  setIsSelectionMode(false);
                  setSelectedHandouts([]);
                }}
              />
              <button className="search-btn" onClick={handleSearch}>
                <FaSearch />
              </button>
            </div>
            <div className="add-section">
              <button onClick={() => openModal()} className="add-user-btn">
                Add Handout
              </button>
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
                  <FaArchive></FaArchive> ({selectedHandouts.length})
                </button>
              )}
            </div>
          </div>

          {loading && <p>Loading handouts...</p>}
          {error && <p style={{ color: "red" }}> {error}</p>}

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
                        checked={currentHandouts.length > 0 && selectedHandouts.length === currentHandouts.length}
                      />
                    </th>
                  )}
                  <th>Title</th>
                  <th>YouTube</th>
                  <th>File</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {currentHandouts.length > 0 ? (
                  currentHandouts.map((handout, index) => (
                    <tr key={handout.id}>
                      <td>{indexOfLastItem - itemsPerPage + index + 1}</td>
                      {isSelectionMode && (
                        <td>
                          <input
                            type="checkbox"
                            checked={selectedHandouts.includes(handout.id)}
                            onChange={() => handleSelectHandout(handout.id)}
                          />
                        </td>
                      )}
                      <td>{handout.handouts_title}</td>
                      <td>
                        {handout.youtube_link ? (
                          isValidYouTubeUrl(handout.youtube_link) ? (
                            <a
                              href={handout.youtube_link}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              View
                            </a>
                          ) : (
                            "Invalid"
                          )
                        ) : (
                          "No link"
                        )}
                      </td>
                      <td>
                        {handout.file_attachments ? (
                          <a
                            href={handout.file_attachments}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            Download
                          </a>
                        ) : (
                          "No file"
                        )}
                      </td>
                      <td>
                        {new Date(handout.created_at).toLocaleDateString()}
                      </td>
                      <td>
                        <div className="action-buttons">
                          <button className="edit-btn" onClick={() => openModal(handout)} title="Edit Handout"><FaUserEdit/></button>
                          <button
                            className="archive-btn"
                            onClick={() => handleArchiveHandout(handout)}
                            title="Remove Handout">
                            <FaArchive/>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isSelectionMode ? 7 : 6} style={{ textAlign: "center" }}>
                      {searchTerm
                        ? `No handouts found matching "${searchTerm}"`
                        : "No handouts found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
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
          )}
        </div>
      </main>

      {showModal && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>{isEditing ? "Update Handout" : "Add New Handout"}</h3>
            <label>Title *</label>
            <input
              type="text"
              value={newHandout.title}
              onChange={(e) =>
                setNewHandout({ ...newHandout, title: e.target.value })
              }
            />
            <label>YouTube *</label>
            <input
              type="text"
              value={newHandout.youtube_link}
              onChange={(e) =>
                setNewHandout({ ...newHandout, youtube_link: e.target.value })
              }
            />
            <label>File *</label>
            <input type="file" onChange={handleFileChange} accept="application/pdf" />
            <div>
              <button onClick={closeModal}>Cancel</button>
              <button onClick={handleAddOrUpdateHandout} disabled={uploading}>
                {uploading ? "Saving..." : isEditing ? "Update" : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminHandouts;
