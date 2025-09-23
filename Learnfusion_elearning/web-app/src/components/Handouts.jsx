import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { FaSearch } from "react-icons/fa";
import { supabase } from '../utils/supabaseClient'; 
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import '../styles/Handouts.css';

const Handouts = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [handouts, setHandouts] = useState([]);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [showTagModal, setShowTagModal] = useState(false);
  const [tagHandoutId, setTagHandoutId] = useState(null);
  const [sections, setSections] = useState([]);
  const [selectedSections, setSelectedSections] = useState([]);
  const [tagging, setTagging] = useState(false);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedHandoutStudents, setSelectedHandoutStudents] = useState([]);
  const [showUntagModal, setShowUntagModal] = useState(false);
  const [untagHandout, setUntagHandout] = useState(null);
  const [selectedTagsToUntag, setSelectedTagsToUntag] = useState([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  useEffect(() => {
    if (user?.id) {
      const fetchTeacherDetails = async () => {
        const { data, error } = await supabase
          .from("users")
          .select("id, role")
          .eq("id", user.id)
          .eq("role", "Teacher")
          .single();

        if (error) {
          console.error("Error fetching teacher details for Handouts:", error.message);
          setTeacherInfo(null);
          setLoading(false); 
        } else if (data) {
          setTeacherInfo(data);
        } else {
          setTeacherInfo(null);
          setLoading(false);
          console.log("Logged in user is not a teacher or no teacher record found.");
        }
      };
      fetchTeacherDetails();
    } else {
      setTeacherInfo(null);
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (teacherInfo?.id) {
      fetchHandouts();
      fetchSections();
      const interval = setInterval(fetchHandouts, 10000);
      return () => clearInterval(interval);
    } else {
      setHandouts([]);
      setSections([]);
      setLoading(false); 
    }
  }, [teacherInfo]);

    const fetchHandouts = async () => {
  if (!teacherInfo?.id || !user?.id) {
    setHandouts([]);
    setLoading(false);
    return;
  }

  setLoading(true);
  setError(null);

  try {
    const { data: handoutsData, error: fetchError } = await supabase
      .from("handouts")
      .select("id, handouts_title, youtube_link, file_attachments, created_at, users_id")
      .order("created_at", { ascending: false });

    if (fetchError) {
      console.error("Error fetching handouts:", fetchError.message);
      setHandouts([]);
      setError(fetchError.message);
      return;
    }

    const { data: usersData, error: usersError } = await supabase
      .from("users")
      .select("id, first_name, last_name");

    if (usersError) {
      console.error("Error fetching users:", usersError.message);
    }

    const merged = (handoutsData || []).map(h => {
      const creator = usersData?.find(u => u.id === h.users_id) || null;
      return { ...h, creator };
    });

    const handoutsWithTagInfo = await Promise.all(
      merged.map(async (handout) => {
        const { data: handoutTags } = await supabase
          .from("handouts_tag_section")
          .select("*")
          .eq("handouts_id", handout.id);

        let taggedSections = [];
        let studentCount = 0;

        if (handoutTags && handoutTags.length > 0) {
          for (const tag of handoutTags) {
            const { data: sectionData } = await supabase
              .from("sections")
              .select("id, section_name")
              .eq("id", tag.section_id)
              .single();

            if (sectionData) {
              taggedSections.push({
                id: tag.id,
                section_id: tag.section_id,
                sections: { section_name: sectionData.section_name }
              });
            }

            const { data: students } = await supabase
              .from("handouts_list_student_under_tag_section")
              .select("*")
              .eq("handouts_tag_section_id", tag.id);

            if (students) {
              studentCount += students.length;
            }
          }
        }

        return {
          ...handout,
          taggedSections,
          studentCount
        };
      })
    );

    setHandouts(handoutsWithTagInfo);
  } catch (err) {
    console.error("Error fetching handouts data:", err);
    setError(err.message);
    setHandouts([]);
  } finally {
    setLoading(false);
  }
};


  const fetchSections = async () => {
    if (!user?.id) {
      setSections([]);
      return;
    }

    try {
      const { data, error } = await supabase
        .from("sections")
        .select("id, section_name")
        .eq("teacher_id", user.id)
        .order("section_name", { ascending: true });

      if (error) {
        console.error("Error fetching sections:", error.message);
        setSections([]);
      } else {
        setSections(data || []);
      }
    } catch (err) {
      console.error('Error fetching sections:', err);
      setSections([]);
    }
  };

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
    
    const youtubeRegex = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+/i;
    return youtubeRegex.test(url);
  };

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        Swal.fire({
          icon: 'warning',
          title: 'File Too Large',
          text: 'File size should be less than 10MB.',
        });
        return;
      }
      setSelectedFile(file);
    }
  };

  const uploadFile = async (file) => {
    if (!file) return null;

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `handouts/${fileName}`;

    const { data, error } = await supabase.storage
      .from('handouts')
      .upload(filePath, file);

    if (error) {
      console.error('Error uploading file:', error);
      throw error;
    }

    const { data: urlData } = supabase.storage
      .from('handouts')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  };

  const handleSearch = () => {
    setSearchTerm(search.trim());
  };

  const filterHandouts = (handouts, searchTerm) => {
    if (!searchTerm) return handouts;

    const term = searchTerm.toLowerCase();
    
    return handouts.filter(handout => {
      const titleMatch = handout.handouts_title.toLowerCase().includes(term);
      
      const sectionMatch = handout.taggedSections && handout.taggedSections.some(section => 
        section.sections.section_name.toLowerCase().includes(term)
      );
      
      const youtubeMatch = handout.youtube_link && handout.youtube_link.toLowerCase().includes(term);
      
      const fileMatch = handout.file_attachments && handout.file_attachments.toLowerCase().includes(term);
      
      const studentCountMatch = handout.studentCount.toString().includes(term);
      
      
      return titleMatch || sectionMatch || youtubeMatch || fileMatch || studentCountMatch || dateMatch;
    });
  };

  const openTagModal = (handoutId) => {
    setTagHandoutId(handoutId);
    setSelectedSections([]);
    setShowTagModal(true);
  };

  const closeTagModal = () => {
    setShowTagModal(false);
    setTagHandoutId(null);
    setSelectedSections([]);
    setTagging(false);
  };

  const openUntagModal = (handout) => {
    setUntagHandout(handout);
    setSelectedTagsToUntag([]);
    setShowUntagModal(true);
  };

  const closeUntagModal = () => {
    setShowUntagModal(false);
    setUntagHandout(null);
    setSelectedTagsToUntag([]);
  };

  const openStudentsModal = async (handoutId) => {
    setLoadingStudents(true);
    setShowStudentsModal(true);
    setSelectedHandoutStudents([]);

    try {
      const { data: handoutTags, error: tagsError } = await supabase
        .from("handouts_tag_section")
        .select("*")
        .eq("handouts_id", handoutId);

      if (tagsError) {
        console.error("Error fetching handout tags:", tagsError);
        return;
      }

      if (!handoutTags || handoutTags.length === 0) {
        return;
      }

      let allStudents = [];

      for (const tag of handoutTags) {
        const { data: sectionData, error: sectionError } = await supabase
          .from("sections")
          .select("section_name")
          .eq("id", tag.section_id)
          .single();

        const sectionName = sectionError ? "Unknown Section" : sectionData.section_name;

        const { data: studentAssignments, error: assignmentError } = await supabase
          .from("handouts_list_student_under_tag_section")
          .select("users_id")
          .eq("handouts_tag_section_id", tag.id);

        if (assignmentError) {
          console.error("Error fetching student assignments:", assignmentError);
          continue;
        }

        if (studentAssignments && studentAssignments.length > 0) {
          for (const assignment of studentAssignments) {
            const { data: userData, error: userError } = await supabase
              .from("users")
              .select("id, first_name, last_name, email, school_id")
              .eq("id", assignment.users_id)
              .single();

            if (!userError && userData) {
              allStudents.push({
                ...userData,
                section_name: sectionName
              });
            }
          }
        }
      }

      setSelectedHandoutStudents(allStudents);

    } catch (error) {
      console.error("Error fetching student details:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const closeStudentsModal = () => {
    setShowStudentsModal(false);
    setSelectedHandoutStudents([]);
    setLoadingStudents(false);
  };

  const handleTagCheckboxChange = (sectionId) => {
    setSelectedSections(prev =>
      prev.includes(sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId]
    );
  };

  const handleTagHandout = async () => {
    if (selectedSections.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Section Selected',
        text: 'Please select a section.',
      });
      return;
    }

    if (!tagHandoutId) {
      Swal.fire({
        icon: 'warning',
        title: 'No Handout Selected',
        text: 'No handout selected.',
      });
      return;
    }

    try {
      setTagging(true);

      let totalStudentsAffected = 0;

      for (const sectionId of selectedSections) {
        const { data: existingTag, error: checkError } = await supabase
          .from("handouts_tag_section")
          .select("id")
          .eq("handouts_id", tagHandoutId)
          .eq("section_id", sectionId)
          .single();

        if (checkError && checkError.code !== 'PGRST116') { 
          throw new Error(`Error checking for existing tag: ${checkError.message}`);
        }
        if (existingTag) continue; 

        const { data: tagData, error: tagError } = await supabase
          .from("handouts_tag_section")
          .insert([
            {
              handouts_id: tagHandoutId,
              section_id: sectionId,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }
          ])
          .select();
        
        if (tagError || !tagData || tagData.length === 0) {
          const sectionName = sections.find(s => s.id === sectionId)?.section_name || sectionId;
          throw new Error(`Failed to create tag record for section ${sectionName}.`);
        }

        const { data: students, error: studentsError } = await supabase
          .from("users")
          .select("id")
          .eq("section_id", sectionId)
          .eq("role", "Student");

        if (studentsError) {
          const sectionName = sections.find(s => s.id === sectionId)?.section_name || sectionId;
          console.error(`Error fetching students for section ${sectionName}:`, studentsError.message);
          continue; 
        }

        if (students && students.length > 0) {
          totalStudentsAffected += students.length;
          const studentAssignments = students.map(student => ({
            users_id: student.id,
            handouts_tag_section_id: tagData[0].id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }));

          const { error: assignmentError } = await supabase
            .from("handouts_list_student_under_tag_section")
            .insert(studentAssignments);

          if (assignmentError) {
            const sectionName = sections.find(s => s.id === sectionId)?.section_name || sectionId;
            console.error(`Error assigning handout to students in section ${sectionName}:`, assignmentError.message);
            continue;
          }
        }
      }

      closeTagModal();
      await fetchHandouts();
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Handout successfully tagged to ${selectedSections.length} section(s), affecting ${totalStudentsAffected} students!`,
      });

    } catch (error) {
      console.error("Unexpected error:", error);
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: 'An unexpected error occurred.',
      });
    } finally {
      setTagging(false);
    }
  };

  const handleUntagHandout = (tagId, sectionName) => {
    setConfirmModal({
      isOpen: true,
      message: `Are you sure you want to untag this handout from section "${sectionName}"? This will unassign it from all students in that section.`,
      onConfirm: () => executeUntag(tagId),
    });
  };

  const handleUntagCheckboxChange = (tagId) => {
    setSelectedTagsToUntag(prev =>
      prev.includes(tagId) ? prev.filter(id => id !== tagId) : [...prev, tagId]
    );
  };

  const handleConfirmUntag = async () => {
    if (selectedTagsToUntag.length === 0) {
      Swal.fire({
        icon: 'warning',
        title: 'No Selection',
        text: 'Please select at least one section to untag.',
      });
      return;
    }

    const untagPromises = selectedTagsToUntag.map(tagId => executeUntag(tagId, true));

    try {
      await Promise.all(untagPromises);
      Swal.fire({
        icon: 'success',
        title: 'Success!',
        text: `Successfully untagged from ${selectedTagsToUntag.length} section(s).`,
      });
      closeUntagModal();
      fetchHandouts(); 
    } catch (error) {
      Swal.fire({
        icon: 'error',
        title: 'Error',
        text: `An error occurred during untagging: ${error.message}`,
      });
    }
  };

  const executeUntag = async (tagId, silent = false) => {
    await supabase.from("handouts_list_student_under_tag_section").delete().eq("handouts_tag_section_id", tagId);
    const { error } = await supabase.from("handouts_tag_section").delete().eq("id", tagId);

    if (error) {
      if (!silent) {
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: `Failed to untag handout: ${error.message}`,
        });
      }
      throw error;
    }

    if (!silent) {
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: 'Handout successfully untagged.',
        });
        fetchHandouts(); 
    }
  };


  const handleLessonClick = (lessonId) => {
    navigate(`/lesson/${lessonId}`);
  };

  const paginate = (pageNumber) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const filteredHandouts = filterHandouts(handouts, searchTerm);
  const totalPages = Math.ceil(filteredHandouts.length / itemsPerPage);
  const indexOfLastItem = currentPage * itemsPerPage;
  const currentHandouts = filteredHandouts.slice(indexOfLastItem - itemsPerPage, indexOfLastItem);

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="dashboard-content">
        <div className="content">
          <h2 className="section-title">Handouts Management</h2>
          <div className="search-filter">
            <div className="search-container">
              <input
                type="text"
                placeholder="Search handouts by title, section, YouTube link, or file..."
                className="search-bar"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setSearchTerm(e.target.value.trim());
                }}
              />
              <button className="search-btn" onClick={handleSearch}>
                <FaSearch />
              </button>
        </div>
                  </div>


          {!user?.id && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'orange' }}>🔒 Please log in to view handouts.</p>
            </div>
          )}
          {user?.id && !teacherInfo?.id && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'orange' }}>Access denied. Only teachers can view handouts.</p>
            </div>
          )}
          {error && (
            <div style={{ textAlign: 'center', padding: '20px' }}>
              <p style={{ color: 'red' }}>Error loading handouts: {error}</p>
            </div>
          )}
          
          {searchTerm && (
            <div className="search-results-info">
              <p>
                Showing {filterHandouts(handouts, searchTerm).length} of {handouts.length} handouts 
                matching "{searchTerm}"
                <button 
                  className="clear-search-btn" 
                  onClick={() => {
                    setSearch('');
                    setSearchTerm('');
                  }}
                  title="Clear search"
                >
                  ✕ Clear
                </button>
              </p>
            </div>
          )}

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Title</th>
                  <th>YouTube Link</th>
                  <th>File Attachments</th>
                  <th>Status</th>
                  <th>Tagged Students</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  return currentHandouts.length > 0 ? (
                    currentHandouts.map((handout, index) => (
                      <tr key={handout.id}>
                        <td>{index + 1}</td>
                        <td>{handout.handouts_title}</td>
                        
                        <td>
                          {handout.youtube_link ? (
                            isValidYouTubeUrl(handout.youtube_link) ? (
                              <a href={handout.youtube_link} target="_blank" rel="noopener noreferrer">
                                View Video
                              </a>
                            ) : (
                              <span className="invalid-link" title="Invalid URL">
                                Invalid URL
                              </span>
                            )
                          ) : (
                            "No link"
                          )}
                        </td>
                        <td>
                          {handout.file_attachments ? (
                            <a href={handout.file_attachments} target="_blank" rel="noopener noreferrer">
                              Download
                            </a>
                          ) : (
                            "No file"
                          )}
                        </td>
                        <td>
                          {handout.taggedSections && handout.taggedSections.length > 0 ? (
                            <div className="status-tags">
                              {handout.taggedSections.map((ts, index) => (
                                <div key={ts.id} className="status-tag-wrapper">
                                  <span className="status-tag">
                                    {ts.sections.section_name}
                                  </span>                                  
                                  {index < handout.taggedSections.length - 1 && <span style={{ marginLeft: '4px' }}>,</span>}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="no-status">Not tagged</span>
                          )}
                        </td>
                        <td>
                          {handout.studentCount > 0 ? (
                            <span 
                              className="student-count clickable" 
                              onClick={() => openStudentsModal(handout.id)}
                              title="Click to view student details"
                            >
                              {`${handout.studentCount} student${handout.studentCount !== 1 ? 's' : ''}`}
                            </span>
                          ) : (
                            <span className="student-count">
                              0 students
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="lf-actions">
                            <button
                              className="tag-btn"
                              onClick={() => openTagModal(handout.id)}
                              disabled={handout.taggedSections?.length === sections.length && sections.length > 0}
                            >
                              Tag
                            </button>
                            {handout.taggedSections?.length > 0 && (
                            <button
                              className="tag-btn"
                              onClick={() => openUntagModal(handout)}
                              title="Untag from one or more sections"
                            >
                              Untag
                            </button>
                          
                          )}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="9" style={{ textAlign: "center", padding: "10px" }}>
                        {searchTerm ? `No handouts found matching "${searchTerm}"` : "No handouts found."}
                      </td>
                    </tr>
                  );
                })()}
              </tbody>
            </table>
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
          </div>
        </div>
      </main>

      {/* Modal for tagging handout to section */}
      {showTagModal && (
        <div className="modal-overlay" onClick={closeTagModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Tag Handout to Section</h3>
              <button className="modal-close" onClick={closeTagModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <label>Select Sections *</label>
                <div className="section-list-container">
                    {sections
                      .filter(s => {
                        const currentHandout = handouts.find(h => h.id === tagHandoutId);
                        return !currentHandout?.taggedSections.some(ts => ts.section_id === s.id);
                      })
                      .map((section) => (
                        <label key={section.id} className={`section-list-item ${selectedSections.includes(section.id) ? 'selected' : ''}`}>
                          <input
                            type="checkbox"
                            checked={selectedSections.includes(section.id)}
                            onChange={() => handleTagCheckboxChange(section.id)}
                          />{section.section_name}
                          
                        </label>
                      ))}
                      {sections.filter(s => !handouts.find(h => h.id === tagHandoutId)?.taggedSections.some(ts => ts.section_id === s.id)).length === 0 && (
                        <div className="no-sections-message">All available sections have been tagged.</div>
                      )}
                </div>
                {sections.length === 0 && (
                  <div className="no-sections-message">No sections found. Please create sections first.</div>
                )}
              </div>
              <div className="tag-info">
                <p>This will assign the handout to all students in the selected section.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={closeTagModal}>
                Cancel
              </button>
              <button 
                className="modal-btn submit-btn" 
                onClick={handleTagHandout}
                disabled={tagging || selectedSections.length === 0}
              >
                {tagging ? "Tagging..." : `Tag Selected (${selectedSections.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for untagging handout from sections */}
      {showUntagModal && untagHandout && (
        <div className="modal-overlay" onClick={closeUntagModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Untag Handout</h3>
              <button className="modal-close" onClick={closeUntagModal}>×</button>
            </div>
            <div className="modal-body">
              <p>Select sections to untag "<strong>{untagHandout.handouts_title}</strong>" from:</p>
              <div className="section-list-container">
                {untagHandout.taggedSections.map(ts => (
                  <label key={ts.id} className={`section-list-item ${selectedTagsToUntag.includes(ts.id) ? 'selected' : ''}`}>
                    <input
                      type="checkbox"
                      checked={selectedTagsToUntag.includes(ts.id)}
                      onChange={() => handleUntagCheckboxChange(ts.id)} 
                    />
                    {ts.sections.section_name}
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={closeUntagModal}>
                Cancel
              </button>
              <button
                className="modal-btn submit-btn untag-modal-submit"
                onClick={handleConfirmUntag}
                disabled={selectedTagsToUntag.length === 0}
              >
                {`Untag Selected (${selectedTagsToUntag.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="modal-overlay">
          <div className="confirmation-modal" style={{ maxWidth: '400px' }}>
            <p>{confirmModal.message}</p>
            <div className="confirmation-actions">
              <button className="modal-btn cancel-btn" onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}>
                Cancel
              </button>
              <button className="modal-btn submit-btn" onClick={() => {
                if (confirmModal.onConfirm) confirmModal.onConfirm();
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
              }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal for viewing student details */}
      {showStudentsModal && (
        <div className="modal-overlay" onClick={closeStudentsModal}>
          <div className="modal-content students-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Assigned Students</h3>
              <button className="modal-close" onClick={closeStudentsModal}>
                ×
              </button>
            </div>
            <div className="modal-body">
              {loadingStudents ? (
                <div className="loading-students">
                  <p>Loading student details...</p>
                </div>
              ) : selectedHandoutStudents.length > 0 ? (
                <div className="students-list">
                  <div className="students-header">
                    <p>Total Students: <strong>{selectedHandoutStudents.length}</strong></p>
                  </div>
                  <div className="students-table-container">
                    <table className="students-table">
                      <thead>
                        <tr>
                          <th>#</th>
                          <th>School ID</th>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Section</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedHandoutStudents.map((student, index) => (
                          <tr key={student.id}>
                            <td>{index + 1}</td>
                            <td>{student.school_id}</td>
                            <td>{`${student.first_name} ${student.last_name}`}</td>
                            <td>{student.email}</td>
                            <td>
                              <span className="section-badge">
                                {student.section_name}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="no-students">
                  <p>No students found for this handout.</p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="modal-btn cancel-btn" onClick={closeStudentsModal}>
                Close
              </button>
            </div>
          </div>
          </div>
        )}
    </div>
  );
};

export default Handouts;
