import React, { useEffect, useState } from "react";
import "../styles/TeacherDashboard.css";
import Sidebar from "./Sidebar";
import { supabase } from "../utils/supabaseClient";
import defaultProfile from "/public/default_profile.png";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import { FiSearch } from "react-icons/fi";

const TeacherDashboard = () => {
  const { user } = useAuth();
  const [teacherData, setTeacherData] = useState(null);
  const [sections, setSections] = useState([]);
  const [students, setStudents] = useState([]);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectionFilter, setSectionFilter] = useState("all");
  const [scheduleItems, setScheduleItems] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const navigate = useNavigate();

  const calculateLeaderboardData = async (teacherId, sections) => {
    if (!sections || sections.length === 0) {
      setLeaderboardData([]);
      return;
    }
    try {
      const sectionIds = sections.map(s => s.id);

      const { data: students, error: studentsError } = await supabase
        .from('users')
        .select('id, first_name, last_name, section_id')
        .in('section_id', sectionIds)
        .eq('role', 'Student');
      if (studentsError) throw studentsError;

      const { data: assignedAssessments, error: assignedError } = await supabase
        .from('assigned_assessments')
        .select('id, section_id, assessment:assessments!inner(id, questions, type)')
        .in('section_id', sectionIds);
      if (assignedError) throw assignedError;

      const assignedAssessmentIds = assignedAssessments.map(a => a.id);
      if (assignedAssessmentIds.length === 0) {
        setLeaderboardData([]);
        return;
      }

      const { data: allAnswers, error: answersError } = await supabase
        .from('student_assessments_answer')
        .select('users_id, answer, student_assessments_take:student_assessments_take_id(assigned_assessments_id)')
        .in('student_assessments_take.assigned_assessments_id', assignedAssessmentIds);
      if (answersError) throw answersError;

      const sectionPoints = {};
      assignedAssessments.forEach(a => {
        const questions = a.assessment?.questions;
        const points = Array.isArray(questions) ? questions.length : 0;
        if (!sectionPoints[a.section_id]) sectionPoints[a.section_id] = 0;
        sectionPoints[a.section_id] += points;
      });

      const studentScores = students.map(student => {
        let totalScore = 0;
        const studentAnswers = allAnswers.filter(ans => ans.users_id === student.id);
        const studentSectionId = student.section_id;
        const assessmentsForStudentSection = assignedAssessments.filter(a => a.section_id === studentSectionId);

        assessmentsForStudentSection.forEach(assigned => {
          const assessment = assigned.assessment;
          if (assessment && assessment.questions && Array.isArray(assessment.questions)) {
            const answersForThisAssessment = studentAnswers.filter(ans => ans.student_assessments_take.assigned_assessments_id === assigned.id);
            answersForThisAssessment.forEach((answer, answerIndex) => {
              try {
                const answerData = JSON.parse(answer.answer);
                if (assessment.questions[answerData.questionIndex]?.correctAnswer === answerData.answer) totalScore++;
              } catch (e) {
                if (assessment.questions[answerIndex]?.correctAnswer === answer.answer) totalScore++;
              }
            });
          }
        });

        const totalPossiblePoints = sectionPoints[studentSectionId] || 0;
        const percentage = totalPossiblePoints > 0 ? (totalScore / totalPossiblePoints) * 100 : 0;
        const section = sections.find(s => s.id === studentSectionId);

        return {
          student: { id: student.id, first_name: student.first_name, last_name: student.last_name },
          section: { id: section?.id, section_name: section?.section_name || 'N/A' },
          percentage: isNaN(percentage) ? 0 : percentage,
        };
      });

      const qualifiedStudents = studentScores.filter(s => s.percentage >= 75);
      const sortedData = qualifiedStudents.sort((a, b) => b.percentage - a.percentage);
      setLeaderboardData(sortedData);
    } catch (error) {
      console.error("Error calculating leaderboard data:", error.message);
      setLeaderboardData([]);
    }
  };

  useEffect(() => {
    if (!user?.id) return;

    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        const { data: initialSections, error: sectionError } = await supabase
          .from("sections")
          .select("id, section_name")
          .eq("teacher_id", user.id)
          .order("section_name", { ascending: true });

        if (sectionError) throw sectionError;
        const fetchedSections = initialSections || [];
        setSections(fetchedSections);

        const { data: fetchedMessagesData, error: messagesError } = await supabase
          .from("messages")
          .select(`
            id, content, created_at, "read",
            sender:sender_id (id, first_name)
          `)
          .eq("receiver_id", user.id)
          .eq("read", false) 
          .order("created_at", { ascending: false })
          .limit(5);

        if (messagesError) throw messagesError;
        const currentMessages = fetchedMessagesData || [];
        setMessages(currentMessages);

        if (fetchedSections.length === 0) {
          setStudents([]);
          setLeaderboardData([]); 
          setSubmissions([]);
        }

        const sectionIds = fetchedSections.map((sec) => sec.id);

        const [
          studentsResponse,
          submissionsResponse,
        ] = await Promise.all([
          supabase
            .from("users") 
            .select("id, first_name, last_name, section_id")
            .in("section_id", sectionIds)
            .eq("role", "Student"),
          supabase
            .from("submissions")
            .select(`
              id, 
              student_id, 
              section_id, 
              submitted_at, 
              status,
              assessment:assessments (title) 
            `)
            .in("section_id", sectionIds)
            .order("submitted_at", { ascending: false })
            .limit(5),
        ]);

        const { data: fetchedStudentsData, error: studentError } = studentsResponse;
        if (studentError) throw studentError;
        const currentStudents = fetchedStudentsData || [];
        setStudents(currentStudents);

        const { data: fetchedSubmissionsData, error: submissionsError } = submissionsResponse;
        if (submissionsError) throw submissionsError;
        const currentSubmissions = fetchedSubmissionsData || [];
        setSubmissions(currentSubmissions);

        const notifList = [];

        currentMessages.forEach((msg) => {
          if (!msg.read && msg.sender) {
            notifList.push({
              type: "message",
              id: `msg-${msg.id}`,
              title: `New message from ${msg.sender.first_name}`,
              description: null,
              due_date: msg.created_at,
              related_id: msg.sender.id, 
            });
          }
        });

        if (fetchedSections.length > 0) {
          const [remindersForScheduleRes, assignedForScheduleRes] = await Promise.all([
            supabase
              .from("reminders")
              .select("id, title, description, due_date")
              .in("section_id", sectionIds)
              .gte('due_date', new Date().toISOString()), 
            supabase
              .from("assigned_assessments")
              .select(`id, deadline, section_id, assessment:assessments!inner(title)`)
              .in("section_id", sectionIds)
              .gte('deadline', new Date().toISOString()) 
          ]);

          const { data: remindersForSchedule, error: remindersScheduleErr } = remindersForScheduleRes;
          if (remindersScheduleErr) throw remindersScheduleErr;

          const { data: assignedForSchedule, error: assignedScheduleErr } = assignedForScheduleRes;
          if (assignedScheduleErr) throw assignedScheduleErr;

          const newScheduleItems = {};
          (remindersForSchedule || []).forEach(item => {
            const dateKey = new Date(item.due_date).toDateString();
            if (!newScheduleItems[dateKey]) newScheduleItems[dateKey] = [];
            newScheduleItems[dateKey].push({
              id: item.id, type: 'reminder', title: item.title, description: item.description
            });
          });

          (assignedForSchedule || []).forEach(item => {
            const dateKey = new Date(item.deadline).toDateString();
            if (!newScheduleItems[dateKey]) newScheduleItems[dateKey] = [];
            newScheduleItems[dateKey].push({
              id: item.id, type: 'assessment', title: item.assessment.title, description: 'Assessment Deadline', section_id: item.section_id
            });
          });
          setScheduleItems(newScheduleItems);


           const { data: fetchedRemindersData, error: remindersError } = await supabase
             .from("reminders")
             .select("id, title, description, due_date, section_id")
             .in("section_id", sectionIds)
             .order("due_date", { ascending: true });

           if (remindersError) throw remindersError;
           const allReminders = fetchedRemindersData || [];

           const upcomingReminders = allReminders.filter(reminder => {
          return new Date(reminder.due_date) >= new Date();
           });

        upcomingReminders.forEach((reminder) => {
          notifList.push({
            type: "reminder",
            id: `rem-${reminder.id}`,
            title: `Deadline: ${reminder.title}`,
            description: reminder.description,
            due_date: reminder.due_date,
            related_id: reminder.id,
          });
        });
        }

        currentSubmissions.forEach((submission) => {
          const assignmentTitle = submission.assessment?.title || "Unknown Assignment";
          const studentIdentifier = currentStudents.find(s => s.id === submission.student_id);
          notifList.push({
            type: "submission",
            id: `sub-${submission.id}`, 
            title: `New Submission: ${assignmentTitle}`,
            description: `From: ${studentIdentifier ? `${studentIdentifier.first_name} ${studentIdentifier.last_name}` : `Student ID: ${submission.student_id}`}`,
            due_date: submission.submitted_at,
            related_id: submission.id,
          });
        });


        await calculateLeaderboardData(user.id, fetchedSections);

        notifList.sort((a, b) => new Date(b.due_date || 0) - new Date(a.due_date || 0));
        setNotifications(notifList);
      } catch (error) {
        console.error("Error fetching dashboard data:", error.message);
        setSections([]);
        setMessages([]);
        setStudents([]);
        setLeaderboardData([]);
        setSubmissions([]);
        setScheduleItems({});
        setNotifications([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();

    const fetchTeacherInfo = async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, first_name, last_name, profile_picture")
        .eq("id", user.id)
        .eq("role", "Teacher")
        .single();

      if (error) {
        console.error("Error fetching teacher data:", error.message);
        setTeacherData(null);
      } else if (data) {
        setTeacherData(data);
      } else {
        console.error(`Teacher data not found for user ID: ${user.id}.`);
        setTeacherData(null);
      }
    };

    fetchTeacherInfo();
  }, [user?.id]);

  const handleProfileChange = async (event) => {
    const file = event.target.files[0];
    if (!file || !teacherData?.id) return;

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64ProfilePic = reader.result;

      const { error } = await supabase
        .from("users")
        .update({ profile_picture: base64ProfilePic })
        .eq("id", teacherData.id);

      if (error) {
        console.error("Error updating profile picture:", error.message);
      } else {
        setTeacherData((prev) => ({
          ...prev,
          profile_picture: base64ProfilePic,
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const fullName = teacherData
    ? `${teacherData.first_name} ${teacherData.last_name}`
    : "Teacher";

  const handleNotificationClick = (notification) => {
    if (notification.type === 'message' && notification.related_id) {
      navigate(`/messages/chat/${notification.related_id}`);
    } else if (notification.type === 'submission' && notification.related_id) {
      console.log("Clicked submission notification, ID:", notification.related_id);
    } else if (notification.type === 'reminder' && notification.related_id) {
      console.log("Clicked reminder notification, ID:", notification.related_id);
    }
  };
  
  const handleTaskClick = (task) => {
    if (task.type === 'assessment' && task.section_id) {
      navigate(`/manage-section/${task.section_id}`);
    } else if (task.type === 'reminder') {
      console.log(`Clicked reminder task, ID: ${task.id}. You could open a reminder detail modal.`);
    }
  };

  const handleSearchChange = (e) => {
    const term = e.target.value;
    setSearchTerm(term);

    if (term.trim() === "") {
      setSearchResults([]);
      return;
    }

    const lowerCaseTerm = term.toLowerCase();
    const foundStudents = students
      .filter(student => 
        `${student.first_name} ${student.last_name}`.toLowerCase().includes(lowerCaseTerm)
      )
      .map(student => ({
        id: `student-${student.id}`,
        name: `${student.first_name} ${student.last_name}`,
        type: 'Student',
        navId: student.section_id
      }));

    const foundSections = sections
      .filter(section => section.section_name.toLowerCase().includes(lowerCaseTerm))
      .map(section => ({
        id: `section-${section.id}`,
        name: section.section_name,
        type: 'Section',
        navId: section.id
      }));

    setSearchResults([...foundStudents, ...foundSections].slice(0, 10)); 
  };

  const handleSearchResultClick = (result) => {
    navigate(`/manage-section/${result.navId}`);
    setSearchTerm('');
    setSearchResults([]);
  };

  const getAwardIcon = (percentage) => {
    if (percentage >= 95) return "🥇";
    if (percentage >= 85) return "🥈";
    if (percentage >= 75) return "🥉";
    return "";
  };

  const filteredLeaderboard = sectionFilter === 'all'
    ? leaderboardData
    : leaderboardData.filter(entry => entry.section.id === sectionFilter);

  const sortedScheduleDates = Object.keys(scheduleItems).sort(
    (a, b) => new Date(a) - new Date(b)
  );


  return (
    <>
      <Sidebar />
      <div className="dashboard-container fade-in">
        <main className="main-content">
          <header className="dashboard-header slide-down">
            <div className="dashboard-title">
              <h1><span className="highlight">Dashboard</span></h1>
            </div>
            <div className="search-profile">
              <div className="search-container">
                <FiSearch className="search-icon" />
                <input 
                  type="text" 
                  placeholder="Search students, sections..." 
                  className="search-bar"
                  value={searchTerm}
                  onChange={handleSearchChange}
                />
                {searchResults.length > 0 && (
                  <div className="search-results">
                    {searchResults.map(result => (
                      <div key={result.id} className="search-result-item" onClick={() => handleSearchResultClick(result)}>
                        <span className="search-result-name">{result.name}</span>
                        <span className="search-result-type">{result.type}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="profile">
                <label htmlFor="profile-upload" className="profile-pic">
                  <img
                    className="profile-pic"
                    src={teacherData?.profile_picture || defaultProfile}
                    alt="Profile"
                    onError={(e) => (e.target.src = defaultProfile)}
                  />
                </label>
                <input
                  type="file"
                  id="profile-upload"
                  accept="image/*"
                  onChange={handleProfileChange}
                  style={{ display: "none" }}
                />
                <p className="profile-name">{fullName}</p>
              </div>
            </div>
          </header>

          {loading ? (
            <p className="loading-message">Loading dashboard...</p>
          ) : (
            <div className="dashboard-grid">

              <div className="card yellow leaderboard-card fade-in-up">
                <div className="leaderboard-header">
                  <div className="green-title">Leaderboard</div>
                  <select 
                    className="section-filter"
                    value={sectionFilter}
                    onChange={(e) => setSectionFilter(e.target.value)}
                  >
                    <option value="all">All Sections</option>
                    {sections.map(sec => (
                      <option key={sec.id} value={sec.id}>{sec.section_name}</option>
                    ))}
                  </select>
                </div>
                <div className="leaderboard-list">
                  {filteredLeaderboard.length > 0 ? (
                    filteredLeaderboard.map((entry, index) => (
                      <div className="leaderboard-entry" key={entry.student.id}>
                        <span className="rank">{index + 1}.</span>
                        <span className="student-name">{`${entry.student.first_name} ${entry.student.last_name}`}</span>
                        <span className="student-section">{entry.section.section_name}</span>
                        <span className="percentage">{`${entry.percentage.toFixed(0)}%`}</span>
                        <span className="awards">{getAwardIcon(entry.percentage)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="entry">No students meet (≥75%).</div>
                  )}
                </div>
              </div>

              <div className="card yellow notification-card fade-in-up">
                <div className="green-title">Notifications</div>
                {notifications.length > 0 ? (
                  notifications.map((notif, index) => (
                    <div 
                      className="entry clickable-notification" 
                      key={notif.id || index}
                      onClick={() => handleNotificationClick(notif)}
                    >
                      <strong>{notif.title}</strong>
                      {notif.type === 'message' && notif.due_date && (
                        <div className="notification-timestamp-message">
                          {new Date(notif.due_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </div>
                      )}
                      {notif.type !== 'message' && notif.due_date && (
                        <span className="notification-date">
                          {' - '}{new Date(notif.due_date).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}
                        </span>
                      )}
                      {notif.type !== 'message' && notif.description && (
                        <p>{notif.description}</p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="entry">No new notifications.</div>
                )}
              </div>

              <div className="card yellow section-card fade-in-up">
                <div className="green-title">Sections</div>
                {sections.length > 0 ? (
                  sections.map((sec) => (
                    <div className="entry clickable-notification" 
                    key={sec.id}
                    onClick={() => navigate(`/manage-section/${sec.id}`)}
                    >{sec.section_name}
                    </div>
                  ))
                ) : (
                  <div className="entry">No assigned sections.</div>
                )}
              </div>

              <div className="card yellow schedule-card fade-in-up">
                <div className="green-title">Deadlines Today</div>
                <div className="schedule-list">
                  {sortedScheduleDates.length > 0 ? (
                    sortedScheduleDates.map(dateKey => (
                      <div key={dateKey} className="schedule-date-group">
                        <div className="schedule-date-header">
                          {new Date(dateKey).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                        </div>
                        <div className="tasks-for-day-list">
                          {scheduleItems[dateKey].map(task => (
                            <div key={task.id} className={`task ${task.type}`} onClick={() => handleTaskClick(task)}>
                              <div className="task-title">{task.title}</div>
                              <div className="task-description">{task.description}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="entry">No upcoming deadlines.</div>
                  )}
                </div>
              </div>

            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default TeacherDashboard;