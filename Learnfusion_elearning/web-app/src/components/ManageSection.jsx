import React, { useState, useEffect, useCallback } from "react";
import { FaArchive, FaSearch, FaUserEdit, FaUserMinus } from "react-icons/fa";
import { supabase } from "../utils/supabaseClient";
import Sidebar from "./Sidebar";
import { useParams, useNavigate } from "react-router-dom";
import Swal from 'sweetalert2';
import "sweetalert2/dist/sweetalert2.min.css";
import "../styles/sections.css";
import "../styles/Handouts.css";
import { archiveRecord } from "../utils/archiveService";
import { PieChart, Pie, Cell, Tooltip, Legend } from "recharts";
import { useAuth } from "../context/AuthContext";
import bcrypt from "bcryptjs";

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884D8", "#82CA9D"];
const defaultProgressData = [
  { name: "Completed", value: 70 },
  { name: "In Progress", value: 20 },
  { name: "Not Started", value: 10 },
];

const UpdateStudentModal = ({ student, onClose, onUpdate }) => {
  const [formData, setFormData] = useState({
    first_name: '',
    middle_name: '',
    last_name: '',
    email: '',
    contact_number: '',
    password: ''
  });

  useEffect(() => {
    if (student) {
      setFormData({
        first_name: student.first_name || '',
        middle_name: student.middle_name || '',
        last_name: student.last_name || '',
        email: student.email || '',
        contact_number: student.contact_number || '',
        password: '' 
      });
    }
  }, [student]);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await onUpdate(formData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  if (!student) return null;

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>Update Student: {student.first_name} {student.last_name}</h3>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
        </div>
        <div className="modal-body">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="first-name">First Name *</label>
              <input
                id="first-name"
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                className="modal-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="middle-name">Middle Name</label>
              <input
                id="middle-name"
                type="text"
                name="middle_name"
                value={formData.middle_name}
                onChange={handleChange}
                className="modal-input"
              />
            </div>
            <div className="form-group">
              <label htmlFor="last-name">Last Name *</label>
              <input
                id="last-name"
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                className="modal-input"
                required
              />
            </div>
            <div className="form-group">
              <label htmlFor="email">Email *</label>
              <input
                id="email"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className="modal-input"
                required
              />
            </div>
                         <div className="form-group">
               <label htmlFor="contact-number">Contact Number</label>
               <input
                 id="contact-number"
                 type="text"
                 name="contact_number"
                 value={formData.contact_number}
                 onChange={handleChange}
                 className="modal-input"
               />
             </div>
             <div className="form-group">
               <label htmlFor="password">New Password (Optional)</label>
               <input
                 id="password"
                 type="password"
                 name="password"
                 value={formData.password}
                 onChange={handleChange}
                 className="modal-input"
                 placeholder="Leave empty to keep current password"
               />
               <small className="file-help-text">
                 Only fill this if you want to change the student's password
               </small>
             </div>
          </form>
        </div>
        <div className="modal-footer">
          <button 
            className="modal-btn cancel-btn" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="modal-btn submit-btn" 
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Updating...' : 'Update Student'}
          </button>
        </div>
      </div>
    </div>
  );
};

const StudentProgressModal = ({ student, onClose, sectionName }) => {
  const [studentProgress, setStudentProgress] = useState({
    assessments: [],
    quizProgress: { completed: 0, total: 0 },
    assignmentProgress: { completed: 0, total: 0 },
    overallProgress: { completed: 0, total: 0 }
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (student && sectionName) {
      fetchStudentProgress();
    }
  }, [student, sectionName]);

  const fetchStudentProgress = async () => {
    if (!student || !sectionName) return;
    
    setLoading(true);
    try {
      const { data: sectionData } = await supabase
        .from("sections")
        .select("id, teacher_id")
        .eq("section_name", sectionName)
        .single();

      if (!sectionData) return;

      const { data: assignedAssessments } = await supabase
        .from("assigned_assessments")
        .select("id, assessment_id, deadline")
        .eq("section_id", sectionData.id);

      if (!assignedAssessments) return;

      const assessmentIds = assignedAssessments.map(a => a.assessment_id);
      const { data: assessmentDetails, error: assessmentError } = await supabase
          .from("assessments")
          .select("id, title, type, questions")
          .in("id", assessmentIds);
      if (assessmentError) throw assessmentError;

      const assignedAssessmentIds = assignedAssessments.map(a => a.id);
      const { data: studentAnswers, error: answersError } = await supabase
          .from("student_assessments_answer")
          .select("answer, created_at, student_assessments_take:student_assessments_take_id(id, created_at, assigned_assessments_id)")
          .eq("users_id", student.id)
          .in("student_assessments_take.assigned_assessments_id", assignedAssessmentIds);
      if (answersError) throw answersError;

      const assessmentProgress = assignedAssessments.map(assigned => {
        const assessment = assessmentDetails.find(ad => ad.id === assigned.assessment_id);
        
        const answersForThisAssessment = studentAnswers.filter(
          ans => ans.student_assessments_take?.assigned_assessments_id === assigned.id
        );

        const hasAnswered = answersForThisAssessment.length > 0;
        const studentTake = hasAnswered ? answersForThisAssessment[0].student_assessments_take : null;
        
        let score = "N/A";
        if (hasAnswered && assessment && assessment.questions) {
          try {
            const questions = Array.isArray(assessment.questions)
              ? assessment.questions
              : JSON.parse(assessment.questions || '[]');
            
            if (Array.isArray(questions) && questions.length > 0) {
              let correctCount = 0;
              
              const answersByQuestion = {};
              answersForThisAssessment.forEach(answer => {
                try {
                  const answerData = JSON.parse(answer.answer);
                  if (answerData.questionIndex !== undefined) {
                    answersByQuestion[answerData.questionIndex] = answerData.answer;
                  }
                } catch (e) {}
              });
              
              questions.forEach((question, index) => {
                const studentAnswer = answersByQuestion[index];
                if (studentAnswer !== undefined) {
                  if (String(studentAnswer).toLowerCase().trim() === String(question.correctAnswer).toLowerCase().trim()) {
                    correctCount++;
                  }
                }
              });
              
              const wrongCount = questions.length - correctCount;
              score = `Correct: ${correctCount} | Wrong: ${wrongCount}`;
            }
          } catch (e) {
            console.error("Error calculating score:", e);
          }
        }

        return {
          title: assessment ? assessment.title : "Unknown Assessment",
          type: assessment ? assessment.type : "Unknown",
          deadline: assigned.deadline,
          hasAnswered,
          score,
          answeredAt: studentTake ? new Date(studentTake.created_at).toLocaleString() : null
        };
      });

      const totalAssessments = assignedAssessments.length;
      const completedAssessments = assessmentProgress.filter(a => a.hasAnswered).length;
      const quizAssessments = assessmentProgress.filter(a => a.type.toLowerCase() === 'quiz');
      const assignmentAssessments = assessmentProgress.filter(a => a.type.toLowerCase() === 'assignment');
      const completedQuizzes = quizAssessments.filter(a => a.hasAnswered).length;
      const completedAssignments = assignmentAssessments.filter(a => a.hasAnswered).length;

      setStudentProgress({
        assessments: assessmentProgress,
        quizProgress: { completed: completedQuizzes, total: quizAssessments.length },
        assignmentProgress: { completed: completedAssignments, total: assignmentAssessments.length },
        overallProgress: { completed: completedAssessments, total: totalAssessments }
      });

    } catch (error) {
      console.error("Error fetching student progress:", error);
    } finally {
      setLoading(false);
    }
  };

  if (!student) return null;

  const createProgressData = (completed, total) => {
    const notStarted = total - completed;
    return [
      { name: "Completed", value: completed },
      { name: "Not Started", value: notStarted }
    ];
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3>{student.first_name} {student.middle_name} {student.last_name}</h3>
        <p className="student-info">
          <span className="info-label">School ID:</span>
          <span className="info-value">{student.school_id}</span>

          <span className="info-label">Email:</span>
          <span className="info-value">{student.email}</span>

          <span className="info-label">Contact:</span>
          <span className="info-value">{student.contact_number}</span>
        </p>

        <hr />
        
        {loading ? (
          <p>Loading progress data...</p>
        ) : (
          <>
            <div className="progress-charts">
              <div>
                <h5>Quiz Progress ({studentProgress.quizProgress.completed}/{studentProgress.quizProgress.total})</h5>
                <PieChart width={200} height={200}>
                  <Pie data={createProgressData(studentProgress.quizProgress.completed, studentProgress.quizProgress.total)} 
                       cx="50%" cy="50%" outerRadius={60} fill="#8884d8" dataKey="value" label>
                    {createProgressData(studentProgress.quizProgress.completed, studentProgress.quizProgress.total).map((entry, index) => (
                      <Cell key={`quiz-cell-${index}`} fill={index === 0 ? "#00C49F" : "#FF8042"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </div>
              
              <div>
                <h5>Assignment Progress ({studentProgress.assignmentProgress.completed}/{studentProgress.assignmentProgress.total})</h5>
                <PieChart width={200} height={200}>
                  <Pie data={createProgressData(studentProgress.assignmentProgress.completed, studentProgress.assignmentProgress.total)} 
                       cx="50%" cy="50%" outerRadius={60} fill="#8884d8" dataKey="value" label>
                    {createProgressData(studentProgress.assignmentProgress.completed, studentProgress.assignmentProgress.total).map((entry, index) => (
                      <Cell key={`assignment-cell-${index}`} fill={index === 0 ? "#0088FE" : "#FFBB28"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </div>
              
              <div>
                <h5>Overall Progress ({studentProgress.overallProgress.completed}/{studentProgress.overallProgress.total})</h5>
                <PieChart width={200} height={200}>
                  <Pie data={createProgressData(studentProgress.overallProgress.completed, studentProgress.overallProgress.total)} 
                       cx="50%" cy="50%" outerRadius={60} fill="#8884d8" dataKey="value" label>
                    {createProgressData(studentProgress.overallProgress.completed, studentProgress.overallProgress.total).map((entry, index) => (
                      <Cell key={`overall-cell-${index}`} fill={index === 0 ? "#8884D8" : "#82CA9D"} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </div>
            </div>
          </>
        )}
        
        <button className="modal-close-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  );
};


const ManageSection = () => {
  const { sectionId } = useParams();
  const navigate = useNavigate();
  const [students, setStudents] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [teacherName, setTeacherName] = useState("Loading...");
  const [sectionName, setSectionName] = useState("");
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [studentToUpdate, setStudentToUpdate] = useState(null);
  const [reportableHandouts, setReportableHandouts] = useState([]);
  const [showAssessmentsModal, setShowAssessmentsModal] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedStudents, setSelectedStudents] = useState([]);

  const [selectedHandout, setSelectedHandout] = useState("");

 const studentsPerPage = 10;
const totalPages = Math.max(1, Math.ceil(filteredStudents.length / studentsPerPage)); 
const indexOfLastStudent = currentPage * studentsPerPage;
const indexOfFirstStudent = indexOfLastStudent - studentsPerPage;
const currentStudents = filteredStudents.slice(indexOfFirstStudent, indexOfLastStudent);

const paginate = (pageNumber) => {
  if (pageNumber < 1 || pageNumber > totalPages) return;
  setCurrentPage(pageNumber);
};

 const { user } = useAuth();  

 const fetchSectionDetails = useCallback(async () => {
    const { data: sectionData, error: sectionError } = await supabase
      .from("sections")
      .select("id, section_name, teacher_id")
      .eq("id", sectionId)
      .single();

    if (sectionError || !sectionData) {
      console.error("Error fetching section:", sectionError?.message);
      if (sectionError?.code === 'PGRST116') { 
        Swal.fire({
          icon: 'error',
          title: 'Not Found',
          text: 'Section not found or you do not have access.',
        }).then(() => {
          navigate("/section");
        });
      }
      return;
    }

    if (sectionData.teacher_id !== user.id) {
      Swal.fire({
        icon: 'error',
        title: 'Unauthorized',
        text: 'You are not authorized to manage this section.',
      }).then(() => {
        navigate("/section");
      });
      return;
    }

    setSectionName(sectionData.section_name);

    const { data: teacherData } = await supabase
      .from("users")
      .select("first_name, last_name")
      .eq("id", user.id)
      .single();

    setTeacherName(`${teacherData.first_name} ${teacherData.last_name}`);

    const { data: studentData, error: studentError } = await supabase
      .from("users")
      .select("id, school_id, first_name, middle_name, last_name, email, contact_number")
      .eq("section_id", sectionData.id)
      .eq("role", "Student");

    if (studentError) {
      console.error("Error fetching students:", studentError.message);
      return;
    }

    setStudents(studentData);
    setFilteredStudents(studentData);
    setCurrentPage(1);

    await fetchReportableHandouts(sectionData.id);

 }, [sectionId, user, navigate]);

 useEffect(() => {
  if (user?.id) {
    fetchSectionDetails();
  }
}, [user?.id, fetchSectionDetails]);


  const fetchReportableHandouts = async (sectionId) => {
    try {
      const { data: assignedAssessments, error } = await supabase
        .from("assigned_assessments")
        .select(`
          assessment:assessments!inner(
            handout:handouts(id, handouts_title)
          )
        `)
        .eq("section_id", sectionId);

      if (error) throw error;

      const handoutMap = new Map();
      assignedAssessments.forEach(item => {
        if (item.assessment && item.assessment.handout) {
          handoutMap.set(item.assessment.handout.id, item.assessment.handout);
        }
      });
      const uniqueHandouts = Array.from(handoutMap.values());

      setReportableHandouts(uniqueHandouts);
    } catch (error) {
      console.error("Error fetching reportable handouts:", error);
      setReportableHandouts([]); 
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
  

  const handleUpdateStudent = (student) => {
    setStudentToUpdate(student);
    setShowUpdateModal(true);
  };

  const handleUpdateStudentSubmit = async (formData) => {
    try {
      const updateData = {
        first_name: formData.first_name,
        middle_name: formData.middle_name,
        last_name: formData.last_name,
        email: formData.email,
        contact_number: formData.contact_number
      };

      if (formData.password && formData.password.trim() !== '') {
        const hashedPassword = bcrypt.hashSync(formData.password, 10);
        updateData.password = hashedPassword;
      }

      const { error } = await supabase
        .from("users")
        .update(updateData)
        .eq("id", studentToUpdate.id);

      if (error) {
        console.error("Error updating student:", error);
        Swal.fire({
          icon: 'error',
          title: 'Update Failed',
          text: 'Error updating student. Please try again.',
        });
      } else {
        let message = "Student updated successfully!";
        if (formData.password && formData.password.trim() !== '') {
          message += ` The new password has been set.`;
        }
        Swal.fire({
          icon: 'success',
          title: 'Success!',
          text: message,
        });
        setShowUpdateModal(false);
        setStudentToUpdate(null);
        fetchSectionDetails();
      }
    } catch (error) {
      console.error("Error updating student:", error);
      Swal.fire({
        icon: 'error',
        title: 'Update Failed',
        text: 'An unexpected error occurred. Please try again.',
      });
    }
  };

  const handleRemoveStudent = async (studentId) => {
    const result = await Swal.fire({
      title: 'Are you sure?',
      text: "This will remove the student from this section.",
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#d33',
      cancelButtonColor: '#3085d6',
      confirmButtonText: 'Yes, remove them!'
    });

    if (result.isConfirmed) {
      const { error } = await supabase
        .from("users")
        .update({ section_id: null })
        .eq("id", studentId);

      if (error) {
        console.error("Error removing student:", error.message);
        Swal.fire('Error!', 'Failed to remove the student from the section.', 'error');
      } else {
        Swal.fire('Removed!', 'The student has been removed from the section.', 'success');
        fetchSectionDetails();
      }
    }
  };

  const handleArchiveStudent = async (student) => {
    const result = await Swal.fire({
      title: "Are you sure you want to remove this student?",
      text: "This will remove their account, and they will no longer be accessible in the system.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove student!",
    });

    if (result.isConfirmed) {
      const { success: archiveSuccess, error: archiveError } = await archiveRecord("users", student, user.id);

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

  const handleArchiveSelected = async () => {
    if (selectedStudents.length === 0) {
      Swal.fire("No students selected", "Please select students to remove.", "info");
      return;
    }

    const result = await Swal.fire({
      title: `Are you sure?`,
      text: `You want to remove these ${selectedStudents.length} students? Their accounts will be removed.`,
      icon: "warning",
      showCancelButton: true,
      confirmButtonColor: "#d33",
      cancelButtonColor: "#3085d6",
      confirmButtonText: "Yes, remove them!",
    });

    if (!result.isConfirmed) return;

    const studentsToArchive = students.filter(student => selectedStudents.includes(student.id));
    for (const student of studentsToArchive) {
      await archiveRecord("users", student, user.id);
    }
    await supabase.from("users").delete().in("id", selectedStudents);
    Swal.fire("Removed!", `${selectedStudents.length} students have been removed.`, "success");
    fetchSectionDetails();
    setIsSelectionMode(false);
  };

  return (
    <div className="dashboard-container">
      <Sidebar />
      <main className="dashboard-content">
        <h2 className="section-title">Manage Section: {sectionName}</h2>
        <div className="search-filter-ms">
          <div className="search-container">
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
          </div>
          <button
            onClick={() => sectionName && navigate(`/assign-students/${encodeURIComponent(sectionName)}`)}
            className="assign-btn"
          >
            Assign Students
          </button>
          <button
            className="select-multiple-btn"
            onClick={toggleSelectionMode}
          >
            {isSelectionMode ? 'Cancel' : 'Remove'}
          </button>
          {isSelectionMode && selectedStudents.length > 0 && (
            <button
              className="archive-btn"
              onClick={handleArchiveSelected}
            >
              <FaArchive /> ({selectedStudents.length})
            </button>
          )}
          <div className="lesson-report-controls">
            <select 
              className="lesson-dropdown"
              value={selectedHandout}
              onChange={(e) => setSelectedHandout(e.target.value)}
            >
              <option value="">Select Handout</option>
              {reportableHandouts.map((handout) => (
                <option key={handout.id} value={handout.handouts_title}>
                  {handout.handouts_title}
                </option>
              ))}
            </select>
            <button
              className="generate-report-btn"
              disabled={!selectedHandout}
              onClick={() => navigate(`/report/${sectionName}/${encodeURIComponent(selectedHandout)}`)}
            >
              Generate Report
            </button>
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
                      checked={currentStudents.length > 0 && selectedStudents.length === currentStudents.length}
                    />
                  </th>
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
              {filteredStudents.length > 0 ? (
                currentStudents.map((student, index) => (
                  <tr key={student.id} onClick={() => setSelectedStudent(student)} style={{ cursor: "pointer" }}>
                    {isSelectionMode && (
                      <td>
                        <input type="checkbox" checked={selectedStudents.includes(student.id)} onChange={(e) => {
                          e.stopPropagation();
                          handleSelectStudentCheckbox(student.id);
                        }} />
                      </td>
                    )}
                    <td>{indexOfFirstStudent + index + 1}</td>
                    <td>{student.school_id}</td>
                    <td>{student.first_name}</td>
                    <td>{student.middle_name || "N/A"}</td>
                    <td>{student.last_name}</td>
                    <td>{student.email}</td>
                    <td>{student.contact_number}</td>
                    <td>
                      <button className="edit-btn" onClick={(e) => {
                        e.stopPropagation();
                        handleUpdateStudent(student);
                      }}>
                        <FaUserEdit />
                      </button>{' '}
                      <button className="remove-btn" onClick={(e) => { e.stopPropagation(); handleRemoveStudent(student.id); }} title="Remove from Section">
                        <FaUserMinus />
                      </button>{' '}
                      <button className="archive-btn" onClick={(e) => { e.stopPropagation(); handleArchiveStudent(student); }} title="Remove Student Account">
                        <FaArchive />
                      </button>                      
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
          <div className="footer-controls">
  <div className="footer-left">
    <button onClick={() => navigate("/section")} className="back">Back</button>
  </div>
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


        </div>

        <UpdateStudentModal
          student={studentToUpdate}
          onClose={() => {
            setShowUpdateModal(false);
            setStudentToUpdate(null);
          }}
          onUpdate={handleUpdateStudentSubmit}
        />
        
        <StudentProgressModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          sectionName={sectionName}
        />
      </main>
    </div>
  );
};

export default ManageSection;