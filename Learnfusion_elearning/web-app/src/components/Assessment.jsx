import React, { useState, useEffect } from 'react';
import { FiPlus, FiTrash2, FiEdit } from 'react-icons/fi';
import '../styles/Assessment.css';
import Sidebar from './Sidebar';
import { supabase } from '../utils/supabaseClient';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';
import AssessmentPreview from './AssessmentPreview';

export default function Assessment() {
  const { user } = useAuth();
  const [selectedTab, setSelectedTab] = useState('Quiz');
  const [selectedTaskToAssign, setSelectedTaskToAssign] = useState(null);
  const [selectedTaskToPreview, setSelectedTaskToPreview] = useState(null);
  const [selectedHandoutTab, setSelectedHandoutTab] = useState(null);
  const [selectedSection, setSelectedSection] = useState('');
  const [deadline, setDeadline] = useState('');
  const [time, setTime] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPreviewOverlay, setShowPreviewOverlay] = useState(false);
  const [givenTasks, setGivenTasks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [title, setTitle] = useState('');
  const [questionType, setQuestionType] = useState('Multiple Choice');
  const [sections, setSections] = useState([]);
  const [handouts, setHandouts] = useState([]);
  const [tasks, setTasks] = useState({ Quiz: [], Assignment: [] });
  const [description, setDescription] = useState('');
  const [editingTask, setEditingTask] = useState(null);
  const [selectedForBulkDelete, setSelectedForBulkDelete] = useState([]);

  const [confirmModal, setConfirmModal] = useState({ isOpen: false, message: '', onConfirm: null });

  useEffect(() => {
    if (!user) return;
    const fetchSections = async () => {
      const { data, error } = await supabase
        .from('sections')
        .select('*')
        .eq('teacher_id', user.id)
        .order("section_name", { ascending: true });
      if (error) console.error('Error fetching sections:', error);
      else setSections(data);

      const { data: handoutsData, error: handoutsError } = await supabase
        .from('handouts')
        .select('id, handouts_title')
        .order('created_at', { ascending: false });

      if (handoutsError) console.error('Error fetching handouts:', handoutsError);
      else setHandouts(handoutsData || []);

      if (handoutsData && handoutsData.length > 0) {
        setSelectedHandoutTab(handoutsData[0].id);
      }
    };

    fetchSections();
  }, [user]);


  useEffect(() => {
    if (!user) return;
    const fetchAssessments = async () => {
      const { data, error } = await supabase
        .from('assessments')
        .select('*')
        .eq('teacher_id', user.id);
      if (error) console.error('Error fetching assessments:', error);
      else {
        setTasks({
          Quiz: data.filter(d => d.type === 'Quiz'),
          Assignment: data.filter(d => d.type === 'Assignment'),
        });
        setSelectedTaskToAssign(null);
        setSelectedTaskToPreview(null);
      }
    };
    fetchAssessments();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const fetchAssigned = async () => {
      const taskIds = [...tasks.Quiz, ...tasks.Assignment].map(t => t.id);
      if (taskIds.length === 0) {
        setGivenTasks([]);
        return;
      }
      const { data, error } = await supabase
        .from('assigned_assessments')
        .select('assessment_id, section_id')
        .in('assessment_id', taskIds);
      if (error) console.error('Error fetching assigned assessments:', error);
      else {
        const keys = data.map(({ assessment_id, section_id }) => `${assessment_id}-${section_id}`);
        setGivenTasks(keys);
      }
    };
    fetchAssigned();
  }, [tasks, user, sections]);

  const handleGive = async () => {
    if (!selectedTaskToAssign || !selectedSection || !deadline || !time) {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Please complete all fields' });
      return;
    }

    const secObj = sections.find(s => s.section_name === selectedSection);
    if (!secObj) return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Invalid section selected' });

    const key = `${selectedTaskToAssign.id}-${secObj.id}`;
    if (givenTasks.includes(key)) {
      Swal.fire({ icon: 'info', title: 'Info', text: 'Already assigned' });
      return;
    }

    const { error } = await supabase.from('assigned_assessments').insert([{
      assessment_id: selectedTaskToAssign.id,
      section_id: secObj.id,
      deadline: `${deadline}T${time}`,
    }]);

    if (error) {
      Swal.fire({ icon: 'error', title: 'Error', text: error.message });
      return;
    }

    setGivenTasks(prev => [...prev, key]);
    Swal.fire({ icon: 'success', title: 'Success!', text: 'Assessment assigned!' });
  };

  const handleUngive = async () => {
    if (!selectedTaskToAssign || !selectedSection) {
      Swal.fire({ icon: 'error', title: 'Oops...', text: 'Select task and section to unassign' });
      return;
    }

    const secObj = sections.find(s => s.section_name === selectedSection);
    if (!secObj) return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Invalid section selected' });

    const { error } = await supabase.from('assigned_assessments')
      .delete()
      .eq('assessment_id', selectedTaskToAssign.id)
      .eq('section_id', secObj.id);

    if (error) return Swal.fire({ icon: 'error', title: 'Error', text: error.message });

    setGivenTasks(prev => prev.filter(k => k !== `${selectedTaskToAssign.id}-${secObj.id}`));
    Swal.fire({ icon: 'success', title: 'Success!', text: 'Assessment unassigned!' });
  };

  const handleDeleteTask = async (id) => {
    setConfirmModal({
      isOpen: true,
      message: 'Are you sure you want to permanently delete this task?',
      onConfirm: () => executeDeleteTask(id),
    });
  };

  const executeDeleteTask = async (id) => {
    const { data: assigned, error: assignedError } = await supabase
      .from('assigned_assessments')
      .select('id')
      .eq('assessment_id', id);

    if (assignedError) {
      return Swal.fire({ icon: 'error', title: 'Error', text: `Failed to get assignments for deletion: ${assignedError.message}` });
    }

    if (assigned && assigned.length > 0) {
      const assignedIds = assigned.map(a => a.id);
      const { error: takesError } = await supabase
        .from('student_assessments_take')
        .delete()
        .in('assigned_assessments_id', assignedIds);
      
      if (takesError) {
        return Swal.fire({ icon: 'error', title: 'Error', text: `Failed to delete student attempts: ${takesError.message}` });
      }
    }
    const { error } = await supabase.from('assessments').delete().eq('id', id);    if (error) return Swal.fire({ icon: 'error', title: 'Error', text: error.message });

    setTasks(prev => ({
      ...prev,
      [selectedTab]: prev[selectedTab].filter(t => t.id !== id),
    }));

    if (selectedTaskToPreview?.id === id) {
      setSelectedTaskToPreview(null);
      setShowPreviewOverlay(false);
    }

    Swal.fire({ icon: 'success', title: 'Deleted!', text: 'Task deleted!' });
  };

  const handleDeleteAllForHandout = () => {
    const tasksToDelete = [...tasks.Quiz, ...tasks.Assignment].filter(task => task.handout_id === selectedHandoutTab);
    if (tasksToDelete.length === 0) return;

    setConfirmModal({
      isOpen: true,
      message: `Are you sure you want to delete all ${tasksToDelete.length} assessments for this handout? This action cannot be undone.`,
      onConfirm: () => executeDeleteAllForHandout(tasksToDelete),
    });
  };

  const executeDeleteAllForHandout = async (tasksToDelete) => {
    const taskIds = tasksToDelete.map(t => t.id);
    const { error } = await supabase.from('assessments').delete().in('id', taskIds);
    if (error) return Swal.fire({ icon: 'error', title: 'Error', text: error.message });

    setTasks(prev => ({
      Quiz: prev.Quiz.filter(t => !taskIds.includes(t.id)),
      Assignment: prev.Assignment.filter(t => !taskIds.includes(t.id)),
    }));

    setSelectedTaskToPreview(null);
    Swal.fire({ icon: 'success', title: 'Deleted!', text: `Successfully deleted ${taskIds.length} assessments.` });
  };

  const handleBulkDelete = () => {
    if (selectedForBulkDelete.length === 0) return;
    setConfirmModal({
      isOpen: true,
      message: `Are you sure you want to permanently delete ${selectedForBulkDelete.length} selected task(s)?`,
      onConfirm: () => executeBulkDelete(),
    });
  };

  const executeBulkDelete = async () => {
    const { error } = await supabase.from('assessments').delete().in('id', selectedForBulkDelete);
    if (error) return Swal.fire({ icon: 'error', title: 'Error', text: error.message });

    setTasks(prev => ({
      Quiz: prev.Quiz.filter(t => !selectedForBulkDelete.includes(t.id)),
      Assignment: prev.Assignment.filter(t => !selectedForBulkDelete.includes(t.id)),
    }));
    setSelectedForBulkDelete([]);
    Swal.fire({ icon: 'success', title: 'Deleted!', text: `${selectedForBulkDelete.length} task(s) deleted!` });
  };

  const openPreview = (task) => {
    setSelectedTaskToPreview(task);
    setShowPreviewOverlay(true);
  };

  const updateQuestion = (qIndex, field, value) => {
    setQuestions(prevQuestions => {
      const newQuestions = [...prevQuestions];
      const questionToUpdate = { ...newQuestions[qIndex] };
      questionToUpdate[field] = value;
      newQuestions[qIndex] = questionToUpdate;
      return newQuestions;
    });
  };

  const handleRemoveQuestion = (qIndex) => {
    setQuestions(prevQuestions => prevQuestions.filter((_, index) => index !== qIndex));
  };

  const openEditModal = (task) => {
    setEditingTask(task);
    setTitle(task.title);
    setDescription(task.description || '');
    setQuestions(task.questions || []);
    setSelectedTab(task.type);
    setShowCreateModal(true);
  };

  const handleToggleBulkDelete = (taskId) => {
    setSelectedForBulkDelete(prev =>
      prev.includes(taskId)
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    );
  };


  const handleAddQuestion = () => {
  let newQuestion;

  if (questionType === 'Matching') {
    newQuestion = {
      question: '',
      activityType: 'Matching',
      matchingPairs: [{ left: '', right: '' }],
    };
  } else if (questionType === 'True or False') {
    newQuestion = {
      question: '',
      activityType: 'True or False',
      choices: ['True', 'False'],
      correctAnswer: '', 
    };
  } else {
    newQuestion = {
      question: '',
      activityType: questionType, 
      correctAnswer: '',
    };
    if (questionType === 'Multiple Choice') {
      newQuestion.choices = ['', '', '', ''];
    } else {
      delete newQuestion.choices; 
    }
  }

  setQuestions(prev => [...prev, newQuestion]);
};
const addMatchingPair = (qIndex) => {
  setQuestions(prev => {
    const newQs = [...prev];
    newQs[qIndex].matchingPairs.push({ left: '', right: '' });
    return newQs;
  });
};

const removeMatchingPair = (qIndex, pairIndex) => {
  setQuestions(prev => {
    const newQs = [...prev];
    newQs[qIndex].matchingPairs.splice(pairIndex, 1);
    return newQs;
  });
};

const updateMatchingPair = (qIndex, pairIndex, field, value) => {
  setQuestions(prev => {
    const newQs = [...prev];
    newQs[qIndex].matchingPairs[pairIndex][field] = value;
    return newQs;
  });
};

  const updateChoice = (qIndex, choiceIndex, value) => {
    setQuestions(prev => {
      const newQuestions = [...prev];
      const questionToUpdate = { ...newQuestions[qIndex] };

      if (questionToUpdate.choices) {
        if (questionToUpdate.correctAnswer === questionToUpdate.choices[choiceIndex]) {
          questionToUpdate.correctAnswer = value;
        }
        questionToUpdate.choices[choiceIndex] = value;
        newQuestions[qIndex] = questionToUpdate;
      }
      return newQuestions;
    });
  };

  const saveAssessment = async () => {
    if (questions.length === 0) return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Add at least one question.' });
    if (!title.trim()) {
      return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Title is required.' });
    }



    const handoutId = document.getElementById('assessment-handout-select')?.value;
    if (!handoutId) {
      return Swal.fire({ icon: 'error', title: 'Oops...', text: 'Please select a handout to associate with this assessment.' });
    }

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      if (!q.question.trim()) {
        Swal.fire({ icon: 'error', title: 'Oops...', text: `Question ${i + 1} text cannot be empty.` });
        return;
      }

      if (q.activityType === 'Multiple Choice') {
        if (!q.choices || q.choices.some(choice => !choice.trim())) {
          Swal.fire({ icon: 'error', title: 'Oops...', text: `All choices for Question ${i + 1} (Multiple Choice) must be filled.` });
          return;
        }
        if (!q.correctAnswer.trim()) {
          Swal.fire({ icon: 'error', title: 'Oops...', text: `Correct answer for Question ${i + 1} (Multiple Choice) must be set.` });
          return;
        }
        if (!q.choices.includes(q.correctAnswer)) {
            Swal.fire({ icon: 'error', title: 'Oops...', text: `Correct answer for Question ${i + 1} must be one of the choices.` });
            return;
        }
      } else if (q.activityType === 'Matching') {
        if (!q.matchingPairs || q.matchingPairs.some(pair => !pair.left.trim() || !pair.right.trim())) {
          Swal.fire({ icon: 'error', title: 'Oops...', text: `All items must be filled.` });
          return;
        }
      } else if (q.activityType === 'True or False') {
        if (q.correctAnswer !== 'True' && q.correctAnswer !== 'False') {          Swal.fire({ icon: 'error', title: 'Oops...', text: `Correct answer for Question ${i + 1} (True or False) must be selected.` });
          return;
        }
      } else { 
        if (!q.correctAnswer || !q.correctAnswer.trim()) {          Swal.fire({ icon: 'error', title: 'Oops...', text: `Correct answer for Question ${i + 1} (${q.activityType}) must be filled.` });
          return;
        }
      }
    }

    const assessmentPayload = {
      title,
      description,
      teacher_id: user.id,
      type: selectedTab,
      questions,
      handout_id: handoutId,
    };

    if (editingTask) {
      const { data, error } = await supabase
        .from('assessments')
        .update(assessmentPayload)
        .eq('id', editingTask.id)
        .select();

      if (error) return Swal.fire({ icon: 'error', title: 'Error', text: error.message });

      setTasks(prev => ({
        ...prev,
        [selectedTab]: prev[selectedTab].map(t => t.id === editingTask.id ? data[0] : t),
      }));
      Swal.fire({ icon: 'success', title: 'Success!', text: 'Assessment updated!' });
    } else {
      const { data, error } = await supabase
        .from('assessments')
        .insert([assessmentPayload])
        .select();

      if (error) return Swal.fire({ icon: 'error', title: 'Error', text: error.message });

      setTasks(prev => ({
        ...prev,
        [selectedTab]: [...prev[selectedTab], data[0]],
      }));
      Swal.fire({ icon: 'success', title: 'Success!', text: 'Assessment saved!' });
    }

    setShowCreateModal(false);
    setEditingTask(null);
    setQuestions([]);
    setDescription('');
    setTitle('');
  };

  const isTaskAssignedToSection = (taskId, sectionName) => {
    if (!taskId || !sectionName) return false;
    const secObj = sections.find(s => s.section_name === sectionName);
    return secObj ? givenTasks.includes(`${taskId}-${secObj.id}`) : false;
  };

  return (
    <div className="assessment-container">
      <Sidebar />
      <div className="assessment-header">Activities</div>
 
      <div className="tab-toggle">
        <div className="tabs-container">
          {['Quiz', 'Assignment'].map(tab => (
            <button
              key={tab}
              className={`tab-btn ${selectedTab === tab ? 'active' : ''}`}
              onClick={() => {
                setSelectedTab(tab);
                setSelectedTaskToAssign(null);
                setEditingTask(null);
                setSelectedForBulkDelete([]);
                const checkboxes = document.querySelectorAll('.task-list-checkbox');
                checkboxes.forEach(cb => cb.checked = false);

                setShowPreviewOverlay(false);
              }}
            >
              {tab}
            </button>
          ))}
        </div>
        <button className="add-btn" onClick={() => { setEditingTask(null); setShowCreateModal(true); }}>
          <FiPlus /> Add {selectedTab}
        </button>
      </div>

      <div className="assessment-upper-section">
        <div className="task-list" style={{ flex: 1 }}>
          <div className="list-header">
            <h3>Assign {selectedTab}</h3>
            {selectedForBulkDelete.length > 0 && (
              <button className="bulk-delete-btn" onClick={handleBulkDelete}>
                <FiTrash2 /> Delete ({selectedForBulkDelete.length})
              </button>
            )}
          </div>
          <div className="task-scroll-container">
            {tasks[selectedTab].length === 0 ? (
              <div>No {selectedTab.toLowerCase()} found.</div>
            ) : (
              tasks[selectedTab].map(task => (
                <div
                  key={task.id}
                  className={`task-item ${selectedTaskToAssign?.id === task.id ? 'selected' : ''} ${selectedForBulkDelete.includes(task.id) ? 'bulk-selected' : ''}`}
                  title={task.title}
                  onClick={() => setSelectedTaskToAssign(task)}
                > 
                  <div className="task-item-left">
                    <input
                      type="checkbox"
                      className="task-list-checkbox"
                      checked={selectedForBulkDelete.includes(task.id)}
                      onChange={() => handleToggleBulkDelete(task.id)}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <span className="task-title-text">
                      {task.title}
                    </span>
                  </div>
                  {isTaskAssignedToSection(task.id, selectedSection) && (
                    <span className="assigned-badge">Assigned</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="section-container">
          <div className="section-header">Section</div>
          <select
            className="section-select"
            value={selectedSection}
            onChange={e => setSelectedSection(e.target.value)}
            disabled={!selectedTaskToAssign}
          >
            <option value="">Select Section</option>
            {sections.map(s => (
              <option key={s.id} value={s.section_name}>{s.section_name}</option>
            ))}
          </select>
        </div>

        <div className="calendar-container">
          <div className="calendar-header">Set Deadline</div>
          <input
            className="date-input"
            type="date"
            value={deadline}
            disabled={!selectedTaskToAssign}
            onChange={e => setDeadline(e.target.value)}
          />
          <input
            className="time-input"
            type="time"
            value={time}
            disabled={!selectedTaskToAssign}
            onChange={e => setTime(e.target.value)}
          />
          <button 
            className="give-button" 
            onClick={handleGive}
            disabled={!selectedTaskToAssign || isTaskAssignedToSection(selectedTaskToAssign?.id, selectedSection)}
          >
            {isTaskAssignedToSection(selectedTaskToAssign?.id, selectedSection) ? 'Already Assigned' : 'Give'}
          </button>
          <button
            className="give-button"
            style={{ backgroundColor: '#ef4444', marginTop: '10px' }}
            onClick={handleUngive}
            disabled={!selectedTaskToAssign || !selectedSection}
          >
            Ungive
          </button>
        </div>
      </div>

      <div className="assessment-lower-section">
        <div className="lower-section-header">
          <h3>Preview Assessments by Handout</h3>
          <button 
            className="delete-all-btn"
            onClick={handleDeleteAllForHandout}
            disabled={[...tasks.Quiz, ...tasks.Assignment].filter(task => task.handout_id === selectedHandoutTab).length === 0}
          >
            <FiTrash2 /> Delete All
          </button>
        </div>
        <div className="handout-tabs-container">
          {handouts.map(h => (
            <button
              key={h.id}
              className={`handout-tab ${selectedHandoutTab === h.id ? 'active' : ''}`}
              onClick={() => setSelectedHandoutTab(h.id)}
            >
              {h.handouts_title}
            </button>
          ))}
        </div>
        <div className="assessment-list-by-handout">
          {[...tasks.Quiz, ...tasks.Assignment]
            .filter(task => task.handout_id === selectedHandoutTab)
            .map(task => (
              <div
                key={task.id}
                className="task-item"
                onClick={() => openPreview(task)}
                title={task.title}
              >
                <span className={`task-type-badge ${task.type}`}>{task.type}</span>
                <span className="task-title-text-preview">{task.title}</span>
                <div className="task-item-actions">
                  <button
                    className="edit-task-btn"
                    onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
                    title="Edit Task"
                  >
                    <FiEdit />
                  </button>
                  <button
                    className="delete-task-btn"
                    onClick={e => { e.stopPropagation(); handleDeleteTask(task.id); }}
                    title="Delete Task"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            ))
          }
          {[...tasks.Quiz, ...tasks.Assignment].filter(task => task.handout_id === selectedHandoutTab).length === 0 && (
            <div className="preview-empty">No assessments found for this handout.</div>
          )}
        </div>
      </div>

      {showPreviewOverlay && selectedTaskToPreview && (
        <div className="overlay" onClick={() => setShowPreviewOverlay(false)}>
          <div className="preview-content" onClick={e => e.stopPropagation()}>
            <button onClick={() => setShowPreviewOverlay(false)} className="close-modal-btn">
              &times;
            </button>
            <AssessmentPreview task={selectedTaskToPreview} onDelete={handleDeleteTask} />
          </div>
        </div>
      )}

      {confirmModal.isOpen && (
        <div className="overlay">
          <div className="confirmation-modal">
            <p>{confirmModal.message}</p>
            <div className="confirmation-actions">
              <button className="cancel-btn" onClick={() => setConfirmModal({ isOpen: false, message: '', onConfirm: null })}>
                Cancel
              </button>
              <button className="confirm-btn" onClick={() => {
                if (confirmModal.onConfirm) confirmModal.onConfirm();
                setConfirmModal({ isOpen: false, message: '', onConfirm: null });
              }}>
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}


      {showCreateModal && (
        <div
          className="overlay"
          onClick={() => { setShowCreateModal(false); setEditingTask(null); }}
          style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.7)',
            display: 'flex',
            justifyContent: 'center',
            marginLeft: 250,
            alignItems: 'center',
            zIndex: 100,
          }}
        >
          <div
            className="modal-content"
            onClick={e => e.stopPropagation()}
            style={{
              background: '#fff',
              borderRadius: '8px',
              padding: '20px',
              maxWidth: '700px',
              maxHeight: '80vh',
              overflowY: 'auto',
              width: '90%',
            }}
          >
           <h2>{editingTask ? `Edit ${selectedTab}` : `Create ${selectedTab}`}</h2>
            <label>Title:</label>
            <input
              type="text"
              style={{ width: '100%', marginBottom: '10px' }}
              value={title}
              onChange={e => setTitle(e.target.value)}
            />
            <label>Description:</label>
            <textarea
              style={{ width: '100%', marginBottom: '10px', height: '80px' }}
              value={description}
              onChange={e => setDescription(e.target.value)}
            />
            <div>
              <label htmlFor="assessment-handout-select">Associate with Handout *</label>
              <select
                id="assessment-handout-select"
                style={{ width: '100%', marginBottom: '10px' }}
                defaultValue={editingTask ? editingTask.handout_id : ""}
              >
                <option value="" disabled>Select a handout...</option>
                {handouts.length > 0 ? (
                  handouts.map(h => <option key={h.id} value={h.id}>{h.handouts_title}</option>)
                ) : (
                  <option disabled>No handouts found. Please create one first.</option>
                )}
              </select>
            </div>

            <div className="questions-container" style={{ marginTop: '20px' }}>

              {questions.map((q, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid #ccc',
                    padding: '15px',
                    marginBottom: '10px',
                    borderRadius: '5px',
                    position: 'relative',
                  }}
                >
                  <button
                    onClick={() => handleRemoveQuestion(idx)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '10px',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'red',
                      fontSize: '18px',
                    }}
                    title="Remove Question"
                  >
                    <FiTrash2 />
                  </button>

                  <div>
                    <label>
                      Question:
                      <input
                        type="text"
                        value={q.question}
                        onChange={e => updateQuestion(idx, 'question', e.target.value)}
                        style={{ width: '97%' , marginTop: '15px'}}
                      />
                    </label>
                  </div>

                  {q.activityType === 'Multiple Choice' && (
                    <div>
                      <label>Choices (select the correct answer):</label>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '5px' }}>
                        {q.choices.map((choice, i) => (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <input
                              type="radio"
                              name={`correct-answer-${idx}`}
                              checked={q.correctAnswer === choice && choice !== ''}
                              onChange={() => updateQuestion(idx, 'correctAnswer', choice)}
                              style={{ cursor: 'pointer', width: '18px', height: '18px', flexShrink: 0 }}
                              disabled={!choice.trim()}
                            />
                            <input
                              type="text"
                              value={choice}
                              placeholder={`Choice ${i + 1}`}
                              onChange={e => updateChoice(idx, i, e.target.value)}
                              style={{ 
                                flex: 1, 
                                padding: '8px', 
                                border: '1px solid #ccc', 
                                borderRadius: '4px' 
                              }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {q.activityType === 'Matching' && (
                  <div>
                    <label style={{ display: 'block', marginBottom: '5px' }}>Matching Pairs (Prompt and its Correct Answer):</label>
                    {q.matchingPairs.map((pair, i) => (
                      <div key={i} style={{ display: 'flex', gap: '10px', marginBottom: '5px' }}>
                        <input
                          type="text"
                          value={pair.left}
                          placeholder="Item"
                          onChange={e => updateMatchingPair(idx, i, 'left', e.target.value)}
                          style={{ width: '45%' }}
                        />
                        <input
                          type="text"
                          value={pair.right}
                          placeholder="Match"
                          onChange={e => updateMatchingPair(idx, i, 'right', e.target.value)}
                          style={{ width: '45%' }}
                        />
                        <button type="button" onClick={() => removeMatchingPair(idx, i)} title="Remove Pair" style={{ background: 'transparent', border: 'none', color: 'red', cursor: 'pointer' }}><FiTrash2 /></button>
                      </div>
                    ))}
                    <button type="button" onClick={() => addMatchingPair(idx)} style={{ marginTop: '5px', padding: '5px 10px' }}>
                      <FiPlus /> Add Pair
                    </button>
                  </div>
                )}

                {q.activityType === 'True or False' && (
                  <div>
                    <p style={{ marginTop: '10px' }}>Correct Answer:</p>
                    <button
                      style={{
                        backgroundColor: q.correctAnswer === 'True' ? '#4CAF50' : '#ccc',
                        color: '#fff',
                        marginRight: '5px',
                        padding: '5px 10px',
                        borderRadius: '3px',
                      }}
                      onClick={() => updateQuestion(idx, 'correctAnswer', 'True')}
                    >
                      True
                    </button>
                    <button
                      style={{
                        backgroundColor: q.correctAnswer === 'False' ? '#f44336' : '#ccc',
                        color: '#fff',
                        padding: '5px 10px',
                        borderRadius: '3px',
                      }}
                      onClick={() => updateQuestion(idx, 'correctAnswer', 'False')}
                    >
                      False
                    </button>
                  </div>
                )}

                  {q.activityType !== 'Matching' && q.activityType !== 'True or False' && q.activityType !== 'Multiple Choice' && (
                    <label>
                      Correct Answer:
                      <input
                        type="text"
                        value={q.correctAnswer}
                        onChange={e => updateQuestion(idx, 'correctAnswer', e.target.value)}
                        style={{ width: '97%' }}
                      />
                    </label>
                  )}
                </div>
              ))}
              <div style={{ marginTop: '20px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '5px' ,marginTop: '22px'}}>
                  Type:
                  <select
                    value={questionType}
                    onChange={e => setQuestionType(e.target.value)}
                  >
                    <option>Multiple Choice</option>
                    <option>Short Answer</option>
                    <option>Matching</option>
                    <option>True or False</option>
                    <option>Fill in the Blanks</option>
                  </select>
                </label>
                <button
                  onClick={handleAddQuestion}
                  style={{ color: 'white', padding: '10px 15px', borderRadius: '5px', display: 'flex', alignItems: 'center', gap: '5px' }}
                >
                  <FiPlus /> Add Question
                </button>
              </div>
            </div>

            <div style={{ marginTop: '20px', textAlign: 'right' }}>
              <button
                onClick={() => { setShowCreateModal(false); setEditingTask(null); }}
                style={{ marginRight: '10px', padding: '8px 16px' }}
              >
                Cancel
              </button>
              <button
                onClick={saveAssessment}
                style={{ padding: '8px 16px', color: 'white' }}
              >
                {editingTask ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
