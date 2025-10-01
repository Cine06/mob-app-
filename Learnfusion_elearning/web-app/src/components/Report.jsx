import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable"; 
import Swal from 'sweetalert2';
import Sidebar from "./Sidebar";
import { supabase } from "../utils/supabaseClient"; 
import { useAuth } from "../context/AuthContext";
import iccLogo from "/icclogo.png";
import "../styles/report.css"; 

const Report = () => {
  const { sectionName, lessonName } = useParams(); 
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reportData, setReportData] = useState([]);
  const [classAverage, setClassAverage] = useState({ progress: 0, status: 'N/A' });
  const [quizHeaders, setQuizHeaders] = useState([]);
  const [assignmentHeaders, setAssignmentHeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionId, setSectionId] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const totalPages = Math.ceil(reportData.length / itemsPerPage);

  useEffect(() => {
    if (sectionName && lessonName && user) {
      fetchReportData();
    } else {
      setReportData([]);
      setLoading(false);
    }
  }, [sectionName, lessonName, user]); 

  const calculateScore = (studentAnswers, assessmentQuestions) => {
    if (!studentAnswers || !assessmentQuestions || !Array.isArray(assessmentQuestions)) {
      return { correct: 0, total: 0 };
    }
    let correctCount = 0;
    const totalQuestions = assessmentQuestions.length;

    studentAnswers.forEach((answer, answerIndex) => {
      try {
        const answerData = JSON.parse(answer.answer);
        const questionIndex = answerData.questionIndex;
        const studentAnswer = answerData.answer;

        if (questionIndex !== undefined && assessmentQuestions[questionIndex]?.correctAnswer === studentAnswer) {
          correctCount++;
        }
      } catch (e) {
        if (assessmentQuestions[answerIndex]?.correctAnswer === answer.answer) {
          correctCount++;
        }
      }
    });
    return { correct: correctCount, total: totalQuestions };
  };

  const fetchReportData = async () => {
    setLoading(true);
    try {
      const { data: sectionData, error: sectionError } = await supabase
        .from("sections")
        .select("id, teacher_id")
        .eq("section_name", sectionName)
        .eq("teacher_id", user.id)
        .single();

      if (sectionError || !sectionData) {
        const errorMessage = sectionError?.message || "Section not found or you don't have permission to view it.";
        console.error("Error fetching section:", errorMessage);
        Swal.fire({
          icon: 'error',
          title: 'Error',
          text: errorMessage,
        });
        setReportData([]);
        setLoading(false);
        return;
      }
      const currentSectionId = sectionData.id;
      setSectionId(currentSectionId);

      const { data: students, error: studentsError } = await supabase
        .from("users")
        .select("id, first_name, last_name")
        .eq("section_id", currentSectionId)
        .eq("role", "Student");
      if (studentsError) throw studentsError;
      if (!students || students.length === 0) {
        setReportData([]); setLoading(false); return;
      }

      const { data: handoutData, error: handoutError } = await supabase
        .from("handouts")
        .select("id")
        .eq("handouts_title", lessonName)
        .single();

      if (handoutError || !handoutData) throw new Error("Lesson/Handout not found.");
      const handoutId = handoutData.id;

      const { data: assignedAssessments, error: assignedError } = await supabase
        .from("assigned_assessments")
        .select(`id, assessment:assessments!inner(id, title, type, questions, handout_id)`)
        .eq("section_id", currentSectionId)
        .eq("assessment.handout_id", handoutId);

      if (assignedError) throw assignedError;

      const lessonAssessments = assignedAssessments.map(a => ({ ...a.assessment, assigned_assessment_id: a.id }));
      setQuizHeaders(lessonAssessments.filter(a => a.type === 'Quiz').map(a => a.title));
      setAssignmentHeaders(lessonAssessments.filter(a => a.type === 'Assignment').map(a => a.title));

      const assignedAssessmentIds = assignedAssessments.map(a => a.id);
      const { data: allAnswers, error: answersError } = await supabase
        .from("student_assessments_answer")
        .select("users_id, answer, student_assessments_take:student_assessments_take_id(assigned_assessments_id)")
        .in("student_assessments_take.assigned_assessments_id", assignedAssessmentIds);

      if (answersError) throw answersError;

      const finalReportData = students.map(student => {
        let totalStudentCorrect = 0;
        let totalStudentPossible = 0;
        const scores = {};

        lessonAssessments.forEach(assessment => {
          const studentAnswersForAssessment = allAnswers.filter(
            ans => ans.users_id === student.id && ans.student_assessments_take.assigned_assessments_id === assessment.assigned_assessment_id
          );

          let questions = [];
          try {
            questions = typeof assessment.questions === 'string' ? JSON.parse(assessment.questions) : (assessment.questions || []);
          } catch (e) {
            console.error("Error parsing questions for assessment:", assessment.id, e);
          }

          const { correct, total } = calculateScore(studentAnswersForAssessment, questions);
          scores[assessment.title] = `${correct}/${total}`;
          totalStudentCorrect += correct;
          totalStudentPossible += total;
        });

        const progress = totalStudentPossible > 0 ? (totalStudentCorrect / totalStudentPossible) * 100 : 0;
        const status = progress >= 75 ? 'Passed' : 'Failed';

        return {
          id: student.id,
          name: `${student.first_name} ${student.last_name}`,
          scores,
          progress: progress.toFixed(2),
          status,
        };
      });

      if (finalReportData.length > 0) {
        const totalProgress = finalReportData.reduce((sum, student) => sum + parseFloat(student.progress), 0);
        const avgProgress = totalProgress / finalReportData.length;
        setClassAverage({
          progress: avgProgress.toFixed(2),
          status: avgProgress >= 75 ? 'Passed' : 'Failed',
        });
      }

      setReportData(finalReportData);
    } catch (error) {
      console.error("Failed to fetch report data:", error.message);
      Swal.fire({
        icon: 'error',
        title: 'Failed to fetch report data',
        text: error.message,
      });
      setReportData([]);
    } finally {
      setLoading(false);
    }
  };

  const paginate = (pageNumber) => {
    setCurrentPage(pageNumber);
  };

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentItems = reportData.slice(indexOfFirstItem, indexOfLastItem);

  const generatePDF = async () => {
    const doc = new jsPDF('landscape');
    const pageWidth = doc.internal.pageSize.getWidth();
    const schoolName = "Interface Computer College";
    const reportTitle = `Report for '${lessonName}' - Section: ${sectionName}`;
    const logoColor = [5, 100, 45]; 
    
    try {
      doc.addImage(iccLogo, 'PNG', 10, 10, 30, 30);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(...logoColor);
      doc.text(schoolName, pageWidth / 2, 20, { align: 'center' });

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(14);
      doc.setTextColor(0, 0, 0);
      doc.text(reportTitle, pageWidth / 2, 30, { align: 'center' });

      const tableColumn = ["#", "Student Name", ...quizHeaders, ...assignmentHeaders, "Progress", "Status"];
      const tableRows = reportData.map((student, idx) => [
          idx + 1,
          student.name,
          ...quizHeaders.map(header => student.scores[header] || '0/0'),
          ...assignmentHeaders.map(header => student.scores[header] || '0/0'),
          `${student.progress}%`,
          student.status,
      ]);

      const averageRow = [
        { content: 'Class Average', colSpan: 2 + quizHeaders.length + assignmentHeaders.length, styles: { halign: 'right', fontStyle: 'bold' } },
        { content: `${classAverage.progress}%`, styles: { fontStyle: 'bold' } },
        { content: classAverage.status, styles: { fontStyle: 'bold' } }
      ];
      tableRows.push(averageRow);

      autoTable(doc, {
        startY: 45,
        head: [tableColumn],
        body: tableRows,
        headStyles: { fillColor: logoColor },
      });

      doc.save(`${lessonName}-${sectionName}-Report.pdf`);
    } catch (error) {
      console.error("Error loading logo for PDF:", error);
      Swal.fire('Error', 'Could not generate PDF. The logo might be missing.', 'error');
    }
  };
  

  return (
    <div className="report-dashboard-container">
      <Sidebar />
      <main className="report-dashboard-content">
        <h2>Report for '{lessonName}' - Section: {sectionName}</h2>
        {loading ? (
          <p className="loading-message">Loading report data...</p>
        ) : (
        <>
        <div className="report-table-container">
          <table className="report-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Student Name</th>
                {quizHeaders.map(h => <th key={h}>{h}</th>)}
                {assignmentHeaders.map(h => <th key={h}>{h}</th>)}
                <th>Progress (%)</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {currentItems.length > 0 ? currentItems.map((student, idx) => (
                <tr key={student.id}>
                  <td>{indexOfFirstItem + idx + 1}</td>
                  <td>{student.name}</td>
                  {quizHeaders.map(h => <td key={`${student.id}-${h}`}>{student.scores[h] || '0/0'}</td>)}
                  {assignmentHeaders.map(h => <td key={`${student.id}-${h}`}>{student.scores[h] || '0/0'}</td>)}
                  <td>{student.progress}%</td>
                  <td>
                    <span className={student.status === 'Passed' ? "report-status-pass" : "report-status-fail"}>
                      {student.status}
                    </span>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4 + quizHeaders.length + assignmentHeaders.length}>No students in this section.</td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr style={{ backgroundColor: '#f0f9ff', fontWeight: 'bold' }}>
                <td colSpan={1 + quizHeaders.length + assignmentHeaders.length} style={{ textAlign: 'right' }}>Class Average</td>
                <td>{classAverage.progress}%</td>
                <td>
                  <span className={classAverage.status === 'Passed' ? "report-status-pass" : "report-status-fail"}>
                    {classAverage.status}
                  </span>
                </td>
              </tr>
            </tfoot>
          </table>

          <div className="footer-controls">
            <button className="back" onClick={() => navigate(`/manage-section/${sectionId}`)} disabled={!sectionId}>Back</button>
            <div className="pagination">
              <button
                onClick={() => paginate(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </button>
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => paginate(i + 1)}
                  className={currentPage === i + 1 ? "active" : ""}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => paginate(currentPage + 1)}
                disabled={currentPage === totalPages || totalPages === 0}
              >
                Next
              </button>
            </div>
            <button className="back" onClick={generatePDF} disabled={loading}>Download PDF</button>
          </div>
        </div>
        </>
        )}
      </main>
    </div>
  );
};

export default Report;
