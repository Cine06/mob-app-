import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Linking, Modal, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { supabase } from '../utils/supabaseClient';
import * as FileSystem from "expo-file-system/legacy";
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from "expo-document-picker";
import DocumentModal from '../components/DocumentModal';
import { decode } from "base64-arraybuffer";
import * as WebBrowser from "expo-web-browser";



function MatchingQuestionAnswer({ question, questionIndex, onAnswerChange, answers, isCompleted, showCorrectAnswers }) {
  const { matchingPairs } = question;
  const prompts = matchingPairs.map(p => p.left);
  const correctChoices = matchingPairs.map(p => p.right);

  // `userAnswers` is an array of strings corresponding to the prompts
  const userAnswers = answers || Array(prompts.length).fill(null);

  // State for the currently selected choice from the pool
  const [selectedChoice, setSelectedChoice] = useState(null);

  useEffect(() => {
    // When the question changes, reset the selected choice
    setSelectedChoice(null);
  }, [questionIndex]);

  const handleSelectChoice = (choice) => {
    if (isCompleted) return;
    // If the choice is already used in an answer slot, do nothing
    if (userAnswers.includes(choice)) return;
    // Select or deselect the choice
    setSelectedChoice(prev => (prev === choice ? null : choice));
  };

  const handlePlaceAnswer = (slotIndex) => {
    if (isCompleted || !selectedChoice) return;

    const newAnswers = [...userAnswers];
    // If the slot is already filled, clear it first
    newAnswers[slotIndex] = selectedChoice;

    onAnswerChange(questionIndex, newAnswers);
    setSelectedChoice(null); // Deselect choice after placing it
  };

  const handleRemoveAnswer = (slotIndex) => {
    if (isCompleted) return;

    const newAnswers = [...userAnswers];
    newAnswers[slotIndex] = null; // Clear the slot
    onAnswerChange(questionIndex, newAnswers);
  };

  // Choices that are not yet placed in an answer slot
  const availableChoices = correctChoices.filter(choice => !userAnswers.includes(choice));

  return (
    <View style={styles.matchingContainer}>
      {/* Prompts and Slots */}
      <View style={styles.promptsContainer}>
        <Text style={styles.matchingHeader}>Prompts</Text>
        {prompts.map((prompt, index) => {
          const userAnswer = userAnswers[index];
          const isCorrect = showCorrectAnswers && userAnswer === correctChoices[index];
          let slotStyle = [styles.answerSlot];

          if (isCompleted && showCorrectAnswers) {
            slotStyle.push(isCorrect ? styles.correctChoice : styles.incorrectChoice);
          } else if (userAnswer) {
            slotStyle.push(styles.filledSlot);
          }

          return (
            <View key={index} style={styles.promptRow}>
              <Text style={styles.promptText}>{prompt}</Text>
              <TouchableOpacity
                style={slotStyle}
                onPress={() => userAnswer ? handleRemoveAnswer(index) : handlePlaceAnswer(index)}
                disabled={isCompleted}
              >
                <Text style={styles.slotText}>{userAnswer || 'Tap to place'}</Text>
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      {/* Choices Pool */}
      {!isCompleted && (
        <View style={styles.choicesPool}>
          <Text style={styles.matchingHeader}>Choices</Text>
          <View style={styles.choicesContainer}>
            {correctChoices.map((choice, index) => {
              const isUsed = userAnswers.includes(choice);
              const isSelected = selectedChoice === choice;
              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.choiceChip,
                    isUsed && styles.usedChoice,
                    isSelected && styles.selectedChoice,
                  ]}
                  onPress={() => handleSelectChoice(choice)}
                  disabled={isUsed}
                >
                  <Text style={styles.choiceChipText}>{choice}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
}

export default function AssignmentDetails() {
  const router = useRouter();
  const { assessmentId, assignedAssessmentId } = useLocalSearchParams();
  const [assignmentData, setAssignmentData] = useState(null);
  const [assignedData, setAssignedData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAnswers, setCompletedAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [documentViewerVisible, setDocumentViewerVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submissionScore, setSubmissionScore] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null); // For instructions/lessons
  const [attemptCount, setAttemptCount] = useState(0);
  const [viewingResults, setViewingResults] = useState(false);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [isGraded, setIsGraded] = useState(false);

  useEffect(() => {
    if (!assessmentId || !assignedAssessmentId) {
      setError('Missing assignment parameters.');
      setLoading(false);
      return;
    }
    
    const initialize = async () => {
      const currentUser = await getUserData();
      if (currentUser) {
        await fetchAssignmentData(currentUser);
      }
    };
    initialize();
  }, [assessmentId, assignedAssessmentId]);

  const closeDocumentViewer = () => {
    setDocumentViewerVisible(false);
    setViewingDocument(null);
  };

  const getUserData = async () => {
    try {
      const userData = await SecureStore.getItemAsync('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
      return JSON.parse(userData);
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  };

  const fetchAssignmentData = async (currentUser) => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: assessment, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .eq('type', 'Assignment')
        .single();

      if (assessmentError) throw assessmentError;
      if (!assessment) {
        setError('Assignment not found.');
        return;
      }

      const { data: assigned, error: assignedError } = await supabase
        .from('assigned_assessments') // Fetch allowed_attempts here
        .select('*')
        .eq('id', assignedAssessmentId)
        .single();

      if (assignedError) throw assignedError;
      if (!assigned) {
        setError('This assignment is not assigned.');
        return;
      }

      setAssignmentData(assessment);
      setAssignedData(assigned);
      setAllowedAttempts(assigned.allowed_attempts || 1);

      // Now that we have assignedData, check completion status
      await checkAssignmentCompletion(currentUser, assigned); // Pass both user and the newly fetched assigned data
    } catch (err) {
      console.error('Error fetching assignment data:', err);
      setError('Failed to load assignment data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAssignmentCompletion = async (currentUser, fetchedAssignedData) => {
    try {
      if (!currentUser || !currentUser.id || !assignedAssessmentId) return;

      // Use the freshly fetched assigned data if available, otherwise use state
      const currentAssignedData = fetchedAssignedData || assignedData;
      if (!currentAssignedData) {
        console.log("checkAssignmentCompletion: assignedData not available yet.");
        return;
      }

      const { data: takes, error: takesError } = await supabase
        .from('student_assessments_take')
        .select('id, score, created_at')
        .eq('assigned_assessments_id', assignedAssessmentId)
        .eq('users_id', currentUser.id)
        .order('created_at', { ascending: false });

      if (takesError) throw takesError;

      setAttemptCount(takes.length);

      if (takes.length === 0) return;

      const latestTake = takes[0];
      setSubmissionScore(latestTake.score);
      // If the latest take has a score, it means it has been graded.
      if (latestTake.score !== null) {
        setIsGraded(true);
      }

      const { data: answerData, error: answerError } = await supabase
        .from('student_assessments_answer')
        .select('answer')
        .eq('student_assessments_take_id', latestTake.id)
        .eq('users_id', currentUser.id);

      if (!answerError && answerData && answerData.length > 0) {
        setIsCompleted(takes.length >= (currentAssignedData.allowed_attempts || 1));
        setViewingResults(true); // If there's a submission, start in results view
        setCompletedAnswers(answerData.map(a => JSON.parse(a.answer)));
        const completedAnswersObj = {};
        answerData.forEach(a => {
          const parsedAnswer = JSON.parse(a.answer);
          completedAnswersObj[parsedAnswer.questionIndex] = parsedAnswer.answer;
        });
        setAnswers(completedAnswersObj);
      }
    } catch (error) {
      console.error('Error checking assignment completion:', error);
    }
  };

  const handleArrayAnswerChange = (questionIndex, newAnswers) => {
    if (!viewingResults) {
      setAnswers({ ...answers, [questionIndex]: newAnswers });
    }
  };

  const getCorrectAnswer = (question) => {
    if (!question) return null;
    
    switch (question.activityType) {
      case 'Multiple Choice':
      case 'True or False':
      case 'Short Answer':
      case 'Fill in the Blanks':
        return question.correctAnswer || question.answer;
      case 'Matching':
        if (question.matchingPairs) {
          return question.matchingPairs.map(pair => `${pair.left} → ${pair.right}`).join(', ');
        }
        return question.correctAnswer || question.answer;
      default:
        return question.correctAnswer || question.answer;
    }
  };

  const isAnswerCorrect = (question, questionIndex, userAnswer) => {
    const correctAnswer = getCorrectAnswer(question);
    if (!correctAnswer || !userAnswer) return false;

    // File submissions are manually graded, so they are never "correct" in this context.
    if (question.activityType === 'File Submission') return false;
    
    if (question.activityType === 'Matching') {
      if (!Array.isArray(userAnswer) || !question.matchingPairs) return false;
      return userAnswer.every((ans, index) => {
        const correctPair = question.matchingPairs[index];
        return correctPair && ans.toLowerCase().trim() === correctPair.right.toLowerCase().trim();
      });
    }
    
    return userAnswer.toString().toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  };

  const handleAnswerChange = (answer) => {
    if (!viewingResults) {
      setAnswers({ ...answers, [currentQuestionIndex]: answer });
    }
  };

  const handleSubmit = async () => {
    if (!user || !assignmentData || !assignedData) {
      Alert.alert('Error', 'Missing required data to submit.');
      return;
    }

    if (attemptCount >= allowedAttempts) {
      Alert.alert('No Attempts Left', 'You have used all your attempts for this assignment.');
      return;
    }

    const questions = parseQuestions();
    const unansweredQuestions = questions.filter((_, index) => {
      const answer = answers[index];
      const question = questions[index]; // Get the actual question object

      if (question.activityType === 'File Submission') {
        // For file submission, an answer is valid if there's at least one file uploaded
        return !answer || !Array.isArray(answer) || answer.length === 0;
      } else {
        if (!answer) return true;
        if (Array.isArray(answer)) return answer.some(a => !a || (typeof a === 'string' && a.trim() === ''));
        return answer.toString().trim() === '';
      }
    });

    if (unansweredQuestions.length > 0) {
      Alert.alert('Incomplete', 'Please provide an answer for all parts of the assignment before submitting.');
      return;
    }

    setIsSubmitting(true);
    try {
      const { data: takeData, error: takeError } = await supabase
        .from('student_assessments_take')
        .insert({
          assigned_assessments_id: assignedData.id,
          created_at: new Date().toISOString(),
          users_id: user.id
        })
        .select()
        .single();

      if (takeError) throw takeError;

      const isFileSubmissionOnly = questions.length === 1 && questions[0].activityType === 'File Submission';
      let answerPromises;

      if (isFileSubmissionOnly) {
        // For file submission, there's only one answer entry for question index 0
        const fileAnswer = answers[0];
        answerPromises = [
          supabase.from('student_assessments_answer').insert({
            student_assessments_take_id: takeData.id.toString(),
            users_id: user.id,
            answer: JSON.stringify({ questionIndex: 0, answer: fileAnswer })
          })
        ];
      } else {
        // For other or mixed types, loop through all answers
        answerPromises = Object.entries(answers).map(([questionIndex, answer]) => {
          return supabase.from('student_assessments_answer').insert({
            student_assessments_take_id: takeData.id.toString(),
            users_id: user.id,
            answer: JSON.stringify({ questionIndex: parseInt(questionIndex), answer: answer })
          });
        });
      }

      const answerResults = await Promise.all(answerPromises);
      const hasAnswerError = answerResults.some(result => result.error);

      if (hasAnswerError) throw new Error('Failed to save one or more answers.');

      // For file submissions, also create an entry in the 'submissions' table.
      // This is used by the TeacherDashboard for "Waiting for grade" notifications.
      const { error: submissionInsertError } = await supabase
        .from('submissions')
        .insert({
          student_id: user.id,
          section_id: assignedData.section_id,
          assessment_id: assignedData.assessment_id, // This is the ID from the 'assessments' table
          submitted_at: new Date().toISOString(),
          status: 'Pending', // Default status for awaiting grade
        });

      if (submissionInsertError) {
        console.error('Error inserting into submissions table:', submissionInsertError);
        throw submissionInsertError; // Re-throw to indicate submission failure
      }

      // Check if there are any auto-gradable questions
      const autoGradableQuestions = questions.filter(q => q.activityType !== 'File Submission');
      let message = "Your submission has been received and is waiting for grading.";

      if (autoGradableQuestions.length > 0) {
        const correctAnswersCount = autoGradableQuestions.filter((q, i) => isAnswerCorrect(q, i, answers[i])).length;
        const totalAutoGradable = autoGradableQuestions.length;
        message = `You scored ${correctAnswersCount}/${totalAutoGradable} on the auto-graded items. The rest of your submission is waiting for grading.`;
      }
      
      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      setIsCompleted(newAttemptCount >= allowedAttempts);
      setViewingResults(true);

      // Update the completedAnswers state locally to immediately show the submitted answers
      const submittedAnswersForReview = Object.entries(answers).map(([qIndex, ans]) => ({
        questionIndex: parseInt(qIndex),
        answer: ans,
      }));
      setCompletedAnswers(submittedAnswersForReview);

      setSubmissionScore(null); // Initially null until graded

      Alert.alert("Submission Successful!", message, [
        { text: "Review Answers" },
      ]);

    } catch (error) {
      console.error('Error submitting assignment:', error);
      Alert.alert('Submission Error', error.message || 'Failed to submit assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilePick = async () => {
    if (viewingResults) return;
  
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf', 
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 
          'text/x-java-source',
          '*/*' // Fallback to allow any file type to be selected
        ],
        copyToCacheDirectory: true,
        multiple: true, // Allow multiple files to be selected
      });
  
      if (result.canceled) return;
  
      const files = result.assets;
      const allowedTypes = ['.pdf', '.docx', '.java'];
      const MAX_SIZE_MB = 250;
  
      const currentFiles = answers[currentQuestionIndex] || [];
      let newFilesToUpload = [];
  
      for (const file of files) {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
        if (!allowedTypes.includes(fileExtension)) {
          Alert.alert('Invalid File Type', `File "${file.name}" has an unsupported type. Only .pdf, .docx, or .java are allowed.`);
          continue; // Skip this file
        }
  
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          Alert.alert('File Too Large', `File "${file.name}" exceeds the ${MAX_SIZE_MB}MB limit.`);
          continue; // Skip this file
        }
  
        newFilesToUpload.push(file);
      }
  
      if (newFilesToUpload.length === 0) return;
  
      setIsUploading(true);
  
      const uploadPromises = newFilesToUpload.map(async (file) => {
        const uniqueFileName = `${user.id}/${Date.now()}-${file.name}`;
        const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
        const fileData = decode(base64);
  
        const { data, error } = await supabase.storage
          .from('assignment-submissions')
          .upload(uniqueFileName, fileData, {
            contentType: file.mimeType,
            upsert: true,
          });
  
        if (error) throw error;
        return { path: data.path, name: file.name };
      });
  
      const uploadedFiles = await Promise.all(uploadPromises);
      
      // Append new files to existing ones
      handleAnswerChange([...currentFiles, ...uploadedFiles]);
  
      Alert.alert('Success', `${uploadedFiles.length} file(s) uploaded successfully.`);
    } catch (error) {
      console.error('Upload error:', error);
      Alert.alert('Upload Error', 'Failed to upload one or more files.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemoveFile = (fileToRemove) => {
    const updatedFiles = (answers[currentQuestionIndex] || []).filter(file => file.path !== fileToRemove.path);
    handleAnswerChange(updatedFiles);
  };


  const handleViewSubmittedFile = async (fileAnswer) => {
  if (!fileAnswer?.path) {
    Alert.alert('Error', 'File path not found.');
    return;
  }

  try {
    const { data, error } = await supabase.storage
      .from('assignment-submissions')
      .createSignedUrl(fileAnswer.path, 300);

    if (error) throw error;

    const signedUrl = data.signedUrl;

    await WebBrowser.openBrowserAsync(signedUrl);
  } catch (error) {
    console.error('Error opening submitted file:', error);
    Alert.alert('Error', 'Could not open the file.');
  }
};



  const parseQuestions = () => {
    if (!assignmentData?.questions) return [];
    try {
      return typeof assignmentData.questions === 'string' 
        ? JSON.parse(assignmentData.questions) 
        : assignmentData.questions;
    } catch (error) {
      console.error('Error parsing questions:', error);
      return [];
    }
  };

  const handleReattempt = () => {
    if (isGraded) {
      Alert.alert("Graded", "This assignment has already been graded and cannot be re-attempted.");
      return;
    }
    if (attemptCount >= allowedAttempts) {
      Alert.alert("No Attempts Left", "You have used all your available attempts.");
      return;
    }
    Alert.alert(
      "Start New Attempt?",
      "This will clear your previous answers and start a new attempt. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Yes, Start", onPress: () => {
            setViewingResults(false);
            setAnswers({});
            setCurrentQuestionIndex(0);
        }}
      ]
    )
  };

  const goToNextQuestion = () => {
    if (currentQuestionIndex < parseQuestions().length - 1) setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) setCurrentQuestionIndex(currentQuestionIndex - 1);
  };

  const isDeadlinePassed = () => {
    if (!assignedData?.deadline) return false;
    const now = new Date();
    const deadlineDate = new Date(assignedData.deadline);
    return now > deadlineDate;
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 18, color: '#666' }}>Loading Assignment...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centered}>
        <Text style={{ fontSize: 16, color: 'red', textAlign: 'center' }}>{error}</Text>
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 25, padding: 10, backgroundColor: '#046a38', borderRadius: 5 }}>
          <Text style={{ color: '#fff' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!assignmentData || !assignedData) {
    return <View style={styles.centered}><Text>Assignment not found.</Text></View>;
  }

  const questions = parseQuestions();
  const currentQuestion = questions[currentQuestionIndex];
  const hasAutoGradableQuestions = questions.some(q => q.activityType !== 'File Submission');
  const deadlinePassed = isDeadlinePassed();

  return (
    <>
      <Stack.Screen 
        options={{ headerShown: false }}
      />
      
      <View style={styles.container}>
        {/* Custom Header */}
        <View style={styles.customHeader}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="arrow-back" size={24} color="white" />
          </TouchableOpacity>
          <Text style={styles.customHeaderText} numberOfLines={1}>
            {assignmentData?.title || 'Assignment'}
          </Text>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>

        {/* Assignment Header */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>
              {assignmentData.title}
            </Text>
            {isCompleted && (
              <View style={styles.doneBadge}>
                <Text style={styles.doneBadgeText}>✓ DONE</Text>
              </View>
            )}
          </View>
          
          {assignmentData.description && (
            <Text style={styles.description}>{assignmentData.description}</Text>
          )}
          
          <View style={styles.detailsRow}>
            <Text style={styles.detailText}>Questions: {questions.length}</Text>
            {assignedData.deadline && (
              <Text style={[styles.detailText, deadlinePassed && styles.deadlineText]}>
                Deadline: {new Date(assignedData.deadline).toLocaleDateString()}
              </Text>
            )}
          </View>
          <View style={styles.detailsRow}>
            <Text style={styles.detailText}>
              Attempts: {attemptCount} / {allowedAttempts}
            </Text>

          </View>
          
          {viewingResults && hasAutoGradableQuestions && (
            <View style={styles.completedInfoBox}>
              <Text style={styles.completedInfoTitle}>
                {isCompleted ? 'Assignment Completed!' : 'Attempt Submitted!'}
              </Text>
              <Text style={styles.completedInfoText}>
                {isCompleted
                  ? 'You have used all your attempts. Your final submission is saved.'
                  : 'You have submitted this attempt. You can review your answers below or choose to re-attempt.'}
              </Text>
              {hasAutoGradableQuestions && (
                <TouchableOpacity
                  style={[styles.showAnswersButton, showCorrectAnswers && styles.showAnswersButtonActive]}
                  onPress={() => setShowCorrectAnswers(!showCorrectAnswers)}
                >
                  <Text style={styles.showAnswersButtonText}>
                    {showCorrectAnswers ? 'Show Correct Answers' : 'Hide Correct Answers'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>

        {/* Questions */}
        {currentQuestion && (
          <View style={styles.card}>
            <View style={styles.questionHeaderContainer}>
                {viewingResults && showCorrectAnswers && currentQuestion.activityType !== 'File Submission' && (
                    <Text style={[styles.feedbackIcon, isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) ? styles.correctIcon : styles.incorrectIcon]}>
                        {isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) ? '✓' : '✗'}
                    </Text>
                )}


              <Text style={styles.questionHeader}>
                Question {currentQuestionIndex + 1} of {questions.length} ({currentQuestion.activityType})
              </Text>
            </View>
            
            <Text style={styles.questionText}>{currentQuestion.question}</Text>
            
              {/* Multiple Choice */}
             {currentQuestion.activityType === 'Multiple Choice' && currentQuestion.choices && <>
               <View>
                  {currentQuestion.choices.map((choice, choiceIndex) => {
                    const isUserAnswer = answers[currentQuestionIndex] === choice;
                    const correctAnswer = getCorrectAnswer(currentQuestion);
                    const isCorrectChoice = correctAnswer === choice;
  
                    let choiceStyle = [styles.choiceButton];
                    if (viewingResults && showCorrectAnswers) {
                      if (isCorrectChoice) {
                        choiceStyle.push(styles.correctChoice);
                      } else if (isUserAnswer && !isCorrectChoice) {
                        choiceStyle.push(styles.incorrectChoice);
                      }
                    } else if (isUserAnswer || (viewingResults && isUserAnswer)) {
                      choiceStyle.push(styles.selectedChoice);
                    }
  
                    return (
                      <TouchableOpacity
                        key={choiceIndex}
                        style={[...choiceStyle, viewingResults && styles.disabledElement]}
                        onPress={() => handleAnswerChange(choice)}
                        disabled={viewingResults}
                      >
                        <View style={[styles.radioCircle, isUserAnswer && styles.selectedRadio]}>
                          {isUserAnswer && <View style={styles.radioInnerCircle} />}
                        </View>
                        <Text style={styles.choiceText}>{choice}</Text>
                        {viewingResults && showCorrectAnswers && isCorrectChoice && <Text style={styles.feedbackIconSmall}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {isCompleted && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerText}>{getCorrectAnswer(currentQuestion)}</Text>
                  </View>
                )}</>
            }

             {/* True or False */}
             {currentQuestion.activityType === 'True or False' && <>
               <View style={styles.trueFalseContainer}>
                  {['True', 'False'].map((option) => {
                    const isUserAnswer = answers[currentQuestionIndex] === option;
                    const correctAnswer = getCorrectAnswer(currentQuestion);
                    const isCorrectChoice = correctAnswer.toLowerCase() === option.toLowerCase();

                    let buttonStyle = [styles.trueFalseButton];
                    if (viewingResults && showCorrectAnswers) {
                      if (isCorrectChoice) {
                        buttonStyle.push(styles.correctChoice);
                      } else if (isUserAnswer && !isCorrectChoice) {
                        buttonStyle.push(styles.incorrectChoice);
                      }
                    } else if (isUserAnswer || (viewingResults && isUserAnswer)) {
                      buttonStyle.push(styles.selectedChoice);
                    }

                    return (
                      <TouchableOpacity
                        key={option}
                        style={[...buttonStyle, viewingResults && styles.disabledElement]}
                        onPress={() => handleAnswerChange(option)}
                        disabled={viewingResults}
                      >
                        <Text style={[styles.trueFalseText, isUserAnswer && styles.selectedTrueFalseText]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {isCompleted && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerText}>{getCorrectAnswer(currentQuestion)}</Text>
                  </View>
                )}</>
            }

              {/* Short Answer / Fill in the Blanks */}
            {(currentQuestion.activityType === 'Short Answer' || currentQuestion.activityType === 'Fill in the Blanks') && (() => {
              const isCorrect = isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]);
              const correctAnswer = getCorrectAnswer(currentQuestion);
              let inputStyle = [styles.textInput];
              if (viewingResults && showCorrectAnswers) {
                inputStyle.push(isCorrect ? styles.correctChoice : styles.incorrectChoice);
              }

              return (
                <>
                  <TextInput
                    style={[...inputStyle, (isCompleted || viewingResults) && styles.disabledElement]}
                    placeholder={isCompleted ? 'Answer submitted' : `Enter your ${currentQuestion.activityType.toLowerCase()}...`}
                    value={answers[currentQuestionIndex] || ''}
                    onChangeText={(text) => handleAnswerChange(text)}
                    multiline
                    numberOfLines={3}
                    editable={!viewingResults}
                  />
                  {viewingResults && showCorrectAnswers && !isCorrect && (
                    <View style={styles.correctAnswerBox}>
                      <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                      <Text style={styles.correctAnswerText}>{correctAnswer}</Text>
                    </View>
                  )}
                </>
              );
            })()}

            {/* Matching */}
            {currentQuestion.activityType === 'Matching' && currentQuestion.matchingPairs && (
              <MatchingQuestionAnswer
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                onAnswerChange={handleArrayAnswerChange}
                answers={answers[currentQuestionIndex]}
                isCompleted={viewingResults}
                showCorrectAnswers={showCorrectAnswers}
              />
            )}

            {/* File Submission */}
            {currentQuestion.activityType === 'File Submission' && (
                <>
                {currentQuestion.instructionFileUrl && (
                  <TouchableOpacity
                    style={styles.viewPdfButton}
                    onPress={() => { // Disable speech for instructions
                      setViewingDocument({
                        url: currentQuestion.instructionFileUrl,
                        title: 'Instructions',
                        showSpeechControls: false,
                      });
                      setDocumentViewerVisible(true);
                    }}
                  >
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />
                    <Text style={styles.viewPdfButtonText}>View PDF Instructions</Text>
                  </TouchableOpacity>
                )}
                <View>
                  {viewingResults ? ( // When viewing results of a submission
                    <View>
                      {/* List of submitted files */}
                      {(completedAnswers.find(a => a.questionIndex === currentQuestionIndex)?.answer || []).map((file, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.fileSubmissionContainer}
                          onPress={() => handleViewSubmittedFile(file)}
                        >
                          <MaterialCommunityIcons name="file-check" size={24} color="#4CAF50" />
                          <Text style={styles.fileSubmissionText} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <MaterialCommunityIcons name="eye-outline" size={24} color="#2E7D32" style={{ marginLeft: 'auto' }} />
                        </TouchableOpacity>
                      ))}

                      {/* Grading status below the files */}
                      {submissionScore !== null ? (
                        <View style={styles.gradeBox}>
                          <Text style={styles.gradeLabel}>Graded</Text>
                        </View>
                      ) : hasAutoGradableQuestions ? null : ( // Show "Waiting for grading" only if it's purely file submission
                        <View style={styles.waitingGradeBox}>
                          <Text style={styles.waitingGradeText}>Waiting for grading</Text>
                        </View>
                      )}
                    </View>
                  ) : ( // When user is actively answering/uploading
                    <> 
                      {(answers[currentQuestionIndex] || []).map((file, index) => ( // This part is for when user is actively uploading before first submission
                        <View key={index} style={styles.fileSubmissionContainer}>
                          <MaterialCommunityIcons name="file-document-outline" size={24} color="#046a38" />
                          <Text style={[styles.fileSubmissionText, {color: '#046a38'}]} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <TouchableOpacity onPress={() => handleRemoveFile(file)} style={{ marginLeft: 'auto', padding: 5 }}>
                            <MaterialCommunityIcons name="close-circle" size={24} color="#D32F2F" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {/* The upload button should always be visible if not completed, to allow adding more files */}
                        <TouchableOpacity style={[styles.uploadButton, viewingResults && styles.disabledButton]} onPress={handleFilePick} disabled={isUploading || viewingResults}>
                          <MaterialCommunityIcons name="upload" size={22} color="#fff" />
                          <Text style={styles.uploadButtonText}>{isUploading ? 'Uploading...' : 'Upload File'}</Text>
                        </TouchableOpacity>
                      
                      <Text style={styles.uploadHint}>Allowed files: .java, .docx, .pdf (Max 250MB)</Text>
                    </>
                  )} 
                </View>
                </>
              )}
          </View>
        )}

        {/* Navigation - Only show if not a File Submission */}
        {currentQuestion && currentQuestion.activityType !== 'File Submission' && (
          <View style={styles.navigationContainer}>
            <TouchableOpacity 
              onPress={goToPreviousQuestion} 
              disabled={currentQuestionIndex === 0}
              style={[styles.navButton, currentQuestionIndex === 0 && styles.disabledNavButton]}
            >
              <Text style={styles.navButtonText}>Previous</Text>
            </TouchableOpacity>
            
            <Text style={styles.navText}>
              {currentQuestionIndex + 1} / {questions.length}
            </Text>
            
            <TouchableOpacity
              onPress={goToNextQuestion}
              disabled={currentQuestionIndex === questions.length - 1}
              style={[styles.navButton, currentQuestionIndex === questions.length - 1 && styles.disabledNavButton]}
            >
              <Text style={styles.navButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        )}

        {viewingResults && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Results Summary</Text>
            {(() => {
              const autoGradableQuestions = questions.filter(q => q.activityType !== 'File Submission');
              const totalAutoGradable = autoGradableQuestions.length;
              const correctCount = autoGradableQuestions.filter((q, i) => isAnswerCorrect(q, i, answers[i])).length;

              let totalPossibleScore = 'N/A';
              if (questions.length > 0) {
                if (questions[0].activityType === 'File Submission' && questions[0].maxScore !== undefined) {
                  totalPossibleScore = questions[0].maxScore;
                } else {
                  totalPossibleScore = questions.length; // Default to 1 point per question for auto-graded
                }
              }

              return (
                <>
                  {totalAutoGradable > 0 && (
                    <>
                      <View style={styles.summaryStat}>
                        <Text style={styles.summaryLabel}>Auto-Graded Items:</Text>
                        <Text style={styles.summaryValue}>{correctCount} / {totalAutoGradable}</Text>
                      </View>
                    </>
                  )}
                  
                  {submissionScore !== null ? (
                    <View style={styles.scoreContainer}>
                      <Text style={styles.scoreText}>Final Grade: {submissionScore} / {totalPossibleScore}</Text>
                    </View>
                  ) : (
                     <View style={styles.waitingGradeBoxSummary}>
                        <Text style={styles.waitingGradeTextSummary}>Final grade is pending teacher review.</Text>
                      </View>
                  )}
                </>
              );
            })()}
          </View>
        )}

        {/* Action Buttons */}
        {viewingResults ? (
          isGraded ? (
            <View style={[styles.submitButton, styles.disabledButton, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.submitButtonText}>✓ Assignment Graded</Text>
            </View>
          ) : !isCompleted && attemptCount < allowedAttempts ? (
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#FFC107' }]}
              onPress={handleReattempt}
              disabled={isGraded || deadlinePassed}
            >
              <Text style={[styles.submitButtonText, { color: '#000' }]}>Re-attempt Assignment</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.submitButton, styles.disabledButton]}>
              <Text style={styles.submitButtonText}>✓ All Attempts Used</Text>
            </View>
          )
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || isUploading || viewingResults) && styles.disabledButton]}
            onPress={handleSubmit}
            disabled={isSubmitting || isUploading}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting 
                  ? 'Submitting...' 
                  : `Submit Assignment`
              }
            </Text>
          </TouchableOpacity>
        )}
        
        </ScrollView>

        {/* Uploading Modal */}
        <Modal
          transparent={true}
          animationType="none"
          visible={isUploading}>
          <View style={styles.uploadingOverlay}>
            <ActivityIndicator size="large" color="#fff" />
            <Text style={styles.uploadingText}>Uploading file, please wait...</Text>
          </View>
        </Modal>
      </View>

      {/* Document Viewer Modal for instructions */}
      <DocumentModal
        visible={documentViewerVisible}
        document={viewingDocument}
        onClose={closeDocumentViewer}
        showSpeechControls={false} 
      />
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 35 },
  customHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#046a38',
    paddingVertical: 12,
    paddingHorizontal: 15,
  },
  backButton: {
    paddingRight: 15,
  },
  customHeaderText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  scrollContent: { paddingHorizontal: 15, paddingBottom: 40 ,marginTop: 25},
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#046a38', flex: 1 ,paddingTop:5,},
  doneBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginLeft: 10 },
  doneBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  description: { fontSize: 16, color: '#666', marginBottom: 15, lineHeight: 24 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailText: { fontSize: 14, color: '#666' },
  deadlineText: { color: '#D32F2F', fontWeight: '500' },
  completedInfoBox: { backgroundColor: '#E8F5E8', padding: 15, borderRadius: 8, marginTop: 15, borderLeftWidth: 4, borderLeftColor: '#4CAF50', marginBottom: 10 },
  completedInfoTitle: { color: '#2E7D32', fontSize: 14, fontWeight: '600' },
  completedInfoText: { color: '#4CAF50', fontSize: 12, marginTop: 5 },
  questionHeader: { fontSize: 18, fontWeight: '600', color: '#046a38', marginBottom: 15 },
  questionHeaderContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 15 },
  feedbackIcon: { fontSize: 20, marginRight: 10 },
  feedbackIconSmall: { fontSize: 16, marginLeft: 10, color: '#4CAF50' },
  correctIcon: { color: '#4CAF50' },
  incorrectIcon: { color: '#D32F2F' },
  correctChoice: { backgroundColor: '#E8F5E8', borderColor: '#4CAF50', borderWidth: 2 },
  incorrectChoice: { backgroundColor: '#FFEBEE', borderColor: '#D32F2F', borderWidth: 2 },
  correctAnswerBox: { marginTop: 10, padding: 10, backgroundColor: '#f0f9ff', borderRadius: 6, borderWidth: 1, borderColor: '#b3e5fc' },
  correctAnswerLabel: { fontSize: 14, fontWeight: '600', color: '#0277bd' },
  correctAnswerText: { fontSize: 14, color: '#01579b', marginTop: 4 },
  questionText: { fontSize: 16, color: '#333', marginBottom: 20, lineHeight: 24 },
  choiceButton: { flexDirection: 'row', alignItems: 'center', padding: 15, borderWidth: 1, borderColor: '#ddd', borderRadius: 8, marginBottom: 10, backgroundColor: '#fff' },
  selectedChoice: { borderColor: '#046a38', backgroundColor: '#f0f9ff' },
  disabledElement: { opacity: 0.7 },
  radioCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#ddd', marginRight: 15, justifyContent: 'center', alignItems: 'center' },
  selectedRadio: { borderColor: '#046a38', backgroundColor: '#046a38' },
  radioInnerCircle: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' },
  choiceText: { fontSize: 16, color: '#333', flex: 1 },
  trueFalseContainer: { flexDirection: 'row', gap: 15 },
  trueFalseButton: { flex: 1, padding: 15, borderWidth: 2, borderColor: '#ddd', borderRadius: 8, backgroundColor: '#fff', alignItems: 'center' },
  trueFalseText: { fontSize: 16, fontWeight: '600', color: '#666' },
  selectedTrueFalseText: { color: '#046a38' },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, fontSize: 16, backgroundColor: '#fff', minHeight: 60, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#046a38', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  disabledButton: { backgroundColor: '#9E9E9E', opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  warningBox: { backgroundColor: '#FFF3E0', padding: 15, borderRadius: 8, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#FF9800' },
  warningTitle: { color: '#E65100', fontSize: 14, fontWeight: '600' },
  warningText: { color: '#F57C00', fontSize: 12, marginTop: 5 },
  matchingContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 5, marginBottom: 20 },
  matchingColumn: { flex: 1 },
  matchingHeader: { fontWeight: 'bold', marginBottom: 10, color: '#046a38', fontSize: 14, textAlign: 'center' },
  promptItem: { minHeight: 50, justifyContent: 'center', padding: 10, backgroundColor: '#f9f9f9', borderRadius: 4, marginBottom: 10, borderWidth: 1, borderColor: '#eee' },
  promptText: { fontSize: 14, color: '#333' },
  dropZone: { minHeight: 50, marginBottom: 10 },
  choiceItemDraggable: { minHeight: 50, justifyContent: 'center', padding: 10, backgroundColor: 'white', borderRadius: 4, borderWidth: 1, borderColor: '#ccc', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 1.41, elevation: 2 },
  correctAnswerItem: { backgroundColor: '#E8F5E8', borderColor: '#4CAF50' },
  correctAnswerTextReview: { fontSize: 14, color: '#2E7D32', fontWeight: '500' },
  showAnswersButton: { backgroundColor: '#046a38', padding: 10, borderRadius: 6, marginTop: 10, alignItems: 'center' },
  showAnswersButtonActive: { backgroundColor: '#4CAF50' },
  showAnswersButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  summaryCard: { backgroundColor: '#F3E5F5', padding: 20, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#9C27B0' },
  summaryTitle: { color: '#7B1FA2', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  summaryStat: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 16, color: '#4A148C' },
  summaryValue: { fontSize: 16, fontWeight: '600', color: '#4A148C' },
  scoreContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#CE93D8' },
  scoreText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#7B1FA2' },
  navigationContainer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  navButton: { backgroundColor: '#046a38', padding: 12, borderRadius: 8, minWidth: 100, alignItems: 'center' },
  disabledNavButton: { backgroundColor: '#ccc', opacity: 0.5 },
  navButtonText: { color: '#fff', fontWeight: 'bold' },
  navText: { color: '#046a38', fontSize: 16, fontWeight: 'bold'},
  uploadButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#046a38', padding: 15, borderRadius: 8, marginTop: 10 },
  uploadButtonText: { color: '#fff', fontSize: 16, fontWeight: '600', marginLeft: 10 },
  uploadHint: { fontSize: 12, color: '#666', textAlign: 'center', marginTop: 8 },
  fileSubmissionContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E8', padding: 15, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#ddd' },
  fileSubmissionText: { fontSize: 14, color: '#2E7D32', marginLeft: 10, flex: 1 },
  viewPdfButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: '#D32F2F', padding: 12, borderRadius: 8, marginBottom: 15 },
  viewPdfButtonText: { color: '#fff', fontSize: 15, fontWeight: '600', marginLeft: 10 },
  uploadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  uploadingText: {
    marginTop: 15,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  waitingGradeBox: { marginTop: 10, padding: 10, backgroundColor: '#FFF3E0', borderRadius: 6, alignItems: 'center' },
  waitingGradeText: { color: '#E65100', fontWeight: '500' },
  gradeBox: { marginTop: 10, padding: 10, backgroundColor: '#E8F5E9', borderRadius: 6, flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  gradeLabel: { color: '#2E7D32', fontWeight: 'bold', fontSize: 16 },
  gradeValue: { color: '#1B5E20', fontWeight: 'bold', fontSize: 18, marginLeft: 8 },
  waitingGradeBoxSummary: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#CE93D8', alignItems: 'center' },
  waitingGradeTextSummary: { fontSize: 16, color: '#7B1FA2', fontStyle: 'italic' },

});
