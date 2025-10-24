import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet, Modal, ActivityIndicator, BackHandler } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons'; // Keep MaterialCommunityIcons
import { supabase } from '../utils/supabaseClient';
import * as SecureStore from 'expo-secure-store';
import * as DocumentPicker from "expo-document-picker";
import DocumentModal from '../components/DocumentModal';
import { decode } from "base64-arraybuffer";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from 'expo-file-system/legacy';

function MatchingQuestionAnswer({ question, questionIndex, onAnswerChange, answers, isCompleted, showCorrectAnswers }) {
  const { matchingPairs } = question;
  const prompts = matchingPairs.map(p => p.left);
  const correctChoices = matchingPairs.map(p => p.right);

  // `userAnswers` is an array of strings corresponding to the prompts
  const userAnswers = answers[questionIndex] || Array(prompts.length).fill(null);

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
  const { assessmentId, assignedAssessmentId, takeId: navTakeId } = useLocalSearchParams();
  const [assignmentData, setAssignmentData] = useState(null);
  const [assignedData, setAssignedData] = useState(null);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);
  const [documentViewerVisible, setDocumentViewerVisible] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [submissionScore, setSubmissionScore] = useState(null);
  const [viewingDocument, setViewingDocument] = useState(null); 
  const [attemptCount, setAttemptCount] = useState(0);
  const [viewingResults, setViewingResults] = useState(false);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [isGraded, setIsGraded] = useState(false);
  const [showChoiceScreen, setShowChoiceScreen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = React.useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTake, setActiveTake] = useState(null);

  useEffect(() => {
    if (!assessmentId || !assignedAssessmentId) {
      setError('Missing assignment parameters.');
      setLoading(false);
      return;
    }
    
    const initialize = async () => {
      const currentUser = await getUserData();
      if (currentUser) {
        const fetchedDataResult = await fetchAssignmentData();
        if (fetchedDataResult) await checkAssignmentStatus(currentUser, fetchedDataResult);
      }
    };
    initialize();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [assessmentId, assignedAssessmentId]);

  useEffect(() => {
    const backAction = () => {
      router.back();
      return true; // This prevents the default back action
    };

    const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);

    return () => backHandler.remove();
  }, [router]);

  useEffect(() => {
    const questions = parseQuestions();
    const isFileSub = questions.length > 0 && questions[0]?.activityType === 'File Submission';
    const isTimed = assignedData?.time_limit > 0 && !isFileSub;

    if (isTimed && !viewingResults && attemptCount < allowedAttempts) {
      if (activeTake?.started_at) {
        setHasStarted(true);
        startTimer(activeTake.started_at, assignedData.time_limit);
      } else if (hasStarted) {
        // New attempt started by startNewTimedAttempt
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [assignedData, viewingResults, hasStarted, activeTake]);

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

  const fetchAssignmentData = async () => {
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
        setError('File Submission Assignment not found.');
        return;
      }

      const { data: assigned, error: assignedError } = await supabase
        .from('assigned_assessments') 
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
      return { assessmentData: assessment, assignedData: assigned };
    } catch (err) {
      console.error('Error fetching assignment data:', err);
      setError('Failed to load assignment data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAssignmentStatus = async (currentUser, fetchedData) => {
    try {
      if (!currentUser || !currentUser.id || !assignedAssessmentId) return;

      const currentAssignedData = fetchedData.assignedData || assignedData;
      if (!currentAssignedData) {
        console.log("checkAssignmentStatus: assignedData not available yet.");
        return;
      }

      const isFileSub = parseQuestions(fetchedData.assessmentData).some(q => q.activityType === 'File Submission');
      const isTimed = currentAssignedData.time_limit > 0 && !isFileSub;

      // If a takeId is passed via navigation, prioritize fetching that specific take.
      // Otherwise, fetch all takes for the user and assignment.
      const query = supabase
        .from('student_assessments_take')
        .select('id, score, created_at, started_at');

      if (navTakeId) {
        query.eq('id', navTakeId);
      } else {
        query.eq('assigned_assessments_id', assignedAssessmentId)
             .eq('users_id', currentUser.id)
             .order('created_at', { ascending: false });
      }

      const { data: takes, error: takesError } = await query;

      if (takesError) throw takesError;

      // Check for an in-progress timed attempt first
      for (const take of takes) {
        if (isTimed && take.started_at && take.score === null) {
          const endTime = new Date(take.started_at).getTime() + currentAssignedData.time_limit * 60 * 1000;
          if (Date.now() < endTime) {
            setActiveTake(take);
            setHasStarted(true);
            startTimer(take.started_at, currentAssignedData.time_limit);
            return;
          }
        }
      }

      const completedTakes = takes.filter(take => {
        // For file submissions, any take is a completed take.
        if (isFileSub) return true; 
        // For timed assessments, a take is complete if time is up, even without a score.
        if (isTimed && take.started_at && take.score === null) {
          const endTime = new Date(take.started_at).getTime() + currentAssignedData.time_limit * 60 * 1000;
          return Date.now() >= endTime;
        }
        return take.score !== null; // For standard quizzes, a score means it's complete.
      });

      setAttemptCount(completedTakes.length);

      // If there's any take for a timed quiz, it means the user has started.
      if (isTimed && takes.length > 0) {
        setHasStarted(true);
      }

      // If there are completed takes and they can re-attempt, show choice screen (but not for file submissions).
      if (!isFileSub && completedTakes.length > 0 && completedTakes.length < (currentAssignedData.allowed_attempts || 1)) {
        setShowChoiceScreen(true);
      } else if (completedTakes.length > 0) {
        setViewingResults(true);
      }

      if (takes.length > 0) {
        const latestTake = takes[0];
        setSubmissionScore(latestTake.score);
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
          const completedAnswersObj = {};
          answerData.forEach(a => {
            const parsedAnswer = JSON.parse(a.answer);
            completedAnswersObj[parsedAnswer.questionIndex] = parsedAnswer.answer;
          });
          setAnswers(completedAnswersObj); // Set answers for viewing
          if (completedTakes.length >= (currentAssignedData.allowed_attempts || 1)) {
            setViewingResults(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking assignment completion:', error);
    }
  };

  const startTimer = (startTime, timeLimitMinutes) => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = new Date(startTime).getTime() + timeLimitMinutes * 60 * 1000;

    timerRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = endTime - now;

      if (remaining <= 0) {
        clearInterval(timerRef.current);
        setTimeLeft(0);
        Alert.alert("Time's Up!", "Your time for this assignment has expired. Your answers will be submitted automatically.", [
          { text: "OK", onPress: () => submitAssignment(true) }
        ]);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
  };

  const startNewTimedAttempt = async () => {
    if (!user || !assignedData) return;
    try {
      const startTime = new Date().toISOString();
      const { data: newTake, error: takeError } = await supabase
        .from('student_assessments_take')
        .insert({ assigned_assessments_id: assignedData.id, users_id: user.id, started_at: startTime })
        .select().single();

      if (takeError) throw takeError;

      setActiveTake(newTake);
      setHasStarted(true);
      startTimer(startTime, assignedData.time_limit);
    } catch (error) {
      Alert.alert('Error', 'Could not start the assignment. Please try again.');
    }
  };

  const parseQuestions = (data = assignmentData) => {
    if (!data?.questions) return [];
    try {
      return typeof data.questions === 'string' 
        ? JSON.parse(data.questions) 
        : data.questions;
    } catch (error) {
      console.error('Error parsing questions:', error);
      return [];
    }
  };

  const getCorrectAnswer = (question, questionIndex) => {
    if (!question) return null;
    
    switch (question.activityType) {
      case 'Multiple Choice':
        return question.correctAnswer || question.answer;
      case 'True or False':
        return question.correctAnswer || question.answer;
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
    const correctAnswer = getCorrectAnswer(question, questionIndex);
    if (!correctAnswer || !userAnswer) return false;

    if (question.activityType === 'File Submission') return false; // Manually graded

    if (question.activityType === 'Matching') {
      if (!Array.isArray(userAnswer) || !question.matchingPairs) return false;
      // Check if every user answer matches the correct pair's right side
      return userAnswer.every((ans, index) => {
        const correctPair = question.matchingPairs[index];
        return correctPair && ans && ans.toLowerCase().trim() === correctPair.right.toLowerCase().trim();
      });
    }
    return userAnswer.toString().toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  };

  const handleAnswerChange = (answer) => {
    if (!viewingResults) {
      setAnswers({ ...answers, [currentQuestionIndex]: answer });
    }
  };

  const handleConfirmSubmit = () => {
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
      const question = questions[index];
      const answer = answers[index];
  
      if (question.activityType === 'File Submission') {
        return !answer || !Array.isArray(answer) || answer.length === 0;
      }
      if (Array.isArray(answer)) { // For matching questions
        return answer.some(a => !a || (typeof a === 'string' && a.trim() === ''));
      }
      return !answer || answer.toString().trim() === '';
    });
  
    if (unansweredQuestions.length > 0) {
      const message = questions.some(q => q.activityType === 'File Submission') ? 'Please upload at least one file and answer all questions before submitting.' : 'Please answer all questions before submitting.';
      Alert.alert('Incomplete', message);
      return;
    }

    Alert.alert("Confirm Submission", "Are you sure you want to submit your files?", [
      { text: "Cancel", style: "cancel" },
      { text: "Submit", onPress: () => submitAssignment() }
    ]);
  };

  const submitAssignment = async (isAutoSubmit = false) => {
    setIsSubmitting(true);
    try {
      let takeId = activeTake?.id;

      if (!takeId) {
        const { data: newTake, error: takeError } = await supabase
          .from('student_assessments_take')
          .insert({
            assigned_assessments_id: assignedData.id,
            users_id: user.id,
          })
          .select('id').single();
        if (takeError) throw takeError;
        takeId = newTake.id;
      }
      
      const answerPromises = Object.entries(answers).map(([questionIndex, answer]) => {
        return supabase.from('student_assessments_answer').insert({
            student_assessments_take_id: takeId,
            users_id: user.id,
            answer: JSON.stringify({ questionIndex: parseInt(questionIndex), answer: answer })
        });
      });

      const answerResults = await Promise.all(answerPromises);
      const hasAnswerError = answerResults.some(result => result.error);

      if (hasAnswerError) throw new Error('Failed to save one or more answers.');

      const questions = parseQuestions();
      const isFileSubmissionOnly = questions.every(q => q.activityType === 'File Submission');
      let finalScore = null;

      if (isFileSubmissionOnly) {
        // File submissions are not auto-graded. Score remains null.
        finalScore = null;
      } else {
        // Auto-grade any non-file submission questions
        const autoGradedQuestions = questions.filter(q => q.activityType !== 'File Submission');
        const correctAnswersCount = autoGradedQuestions.filter(question => 
          isAnswerCorrect(question, questions.indexOf(question), answers[questions.indexOf(question)])
        ).length;
        finalScore = correctAnswersCount;
      }

      const { error: updateTakeError } = await supabase
        .from('student_assessments_take')
        .update({ 
          score: finalScore, 
          // Only update created_at if it's not a timed quiz, to mark submission time.
          // For timed quizzes, created_at is the start time.
          ...(!activeTake && { created_at: new Date().toISOString() })
        })
        .eq('id', takeId);

      if (updateTakeError) throw updateTakeError;

      const newAttemptCount = attemptCount + 1;
      setAttemptCount(newAttemptCount);
      setIsCompleted(newAttemptCount >= allowedAttempts);
      setViewingResults(true);

      // Update answers state to reflect the submission for review
      const submittedAnswersObj = {};
      Object.entries(answers).forEach(([qIndex, ans]) => {
        submittedAnswersObj[qIndex] = ans;
      });
      setAnswers(submittedAnswersObj);

      setSubmissionScore(finalScore);

      let alertMessage = "Your submission was successful!";
      if (isFileSubmissionOnly) {
        alertMessage = "Your files have been submitted and are waiting for grading.";
      } else if (finalScore !== null) {
        const totalAutoGradable = questions.filter(q => q.activityType !== 'File Submission').length;
        alertMessage = `Your score: ${finalScore}/${totalAutoGradable}`;
      }
      Alert.alert("Submission Successful!", alertMessage, [{ text: "Review Answers" }]);
  
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
          'text/plain', // for .java
          '*/*' 
        ],
        copyToCacheDirectory: true,
        multiple: true, 
      });
  
      if (result.canceled) return;
  
      const files = result.assets;
      const allowedTypes = ['.pdf', '.docx', '.java', '.txt'];
      const MAX_SIZE_MB = 250;
  
      const currentFiles = answers[currentQuestionIndex] || [];
      let newFilesToUpload = [];
  
      for (const file of files) {
        const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  
        if (!allowedTypes.includes(fileExtension)) {
          Alert.alert('Invalid File Type', `File "${file.name}" has an unsupported type. Only ${allowedTypes.join(', ')} are allowed.`);
          continue; 
        }
  
        if (file.size > MAX_SIZE_MB * 1024 * 1024) {
          Alert.alert('File Too Large', `File "${file.name}" exceeds the ${MAX_SIZE_MB}MB limit.`);
          continue;
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

  const handleArrayAnswerChange = (questionIndex, newAnswers) => {
    if (!viewingResults) {
      setAnswers({ ...answers, [questionIndex]: newAnswers });
    }
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

  const handleReattempt = () => {
    const questions = parseQuestions();
    const isFileSubmissionOnly = questions.every(q => q.activityType === 'File Submission');

    if (isGraded && isFileSubmissionOnly) {
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
        {
          text: "Yes, Start", 
          onPress: () => {
              setViewingResults(false);
              setAnswers({});
              const isTimed = assignedData?.time_limit > 0 && !questions.some(q => q.activityType === 'File Submission');
              setCurrentQuestionIndex(0);
              setShowChoiceScreen(false);
              setActiveTake(null);
              setHasStarted(!isTimed);
              // No need to manage hasStarted or activeTake for file submissions
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
  const isFileSub = questions.length > 0 && questions[0]?.activityType === 'File Submission';
  const hasAutoGradableQuestions = questions.some(q => q.activityType !== 'File Submission');
  const deadlinePassed = isDeadlinePassed();
  const isTimed = assignedData.time_limit > 0 && !questions.some(q => q.activityType === 'File Submission');
  
  if (isTimed && !hasStarted && !viewingResults && attemptCount < allowedAttempts) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>Start Timed Assignment?</Text>
            <Text style={styles.startDescription}>
              This assignment has a time limit of <Text style={{fontWeight: 'bold'}}>{assignedData.time_limit} minutes</Text>. 
              The timer will begin as soon as you start.
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={startNewTimedAttempt}>
              <Text style={styles.startButtonText}>Start Assignment</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startCancelButton} onPress={() => router.back()}>
              <Text style={styles.startCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  if (showChoiceScreen) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>You have {allowedAttempts - attemptCount} attempt(s) remaining.</Text>
            {isFileSub ? (
              <TouchableOpacity style={styles.startButton} onPress={handleReattempt}>
                <Text style={styles.startButtonText}>Start New Attempt</Text>
              </TouchableOpacity>
            ) : (
              <>
                <TouchableOpacity style={styles.startButton} onPress={() => {
                  setShowChoiceScreen(false);
                  setViewingResults(true);
                }}>
                  <Text style={styles.startButtonText}>View Last Attempt</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.startCancelButton} onPress={handleReattempt}>
                  <Text style={styles.startCancelButtonText}>Start New Attempt</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </>
    );
  }

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
          
          {timeLeft !== null && !viewingResults && (
            <View style={{ marginTop: 15, padding: 10, backgroundColor: timeLeft < 60000 ? '#FFEBEE' : '#E3F2FD', borderRadius: 8, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: timeLeft < 60000 ? '#D32F2F' : '#1E88E5' }}>
                Time Left: {Math.floor(timeLeft / 60000)}:{(Math.floor(timeLeft / 1000) % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}

          {viewingResults && (
            <View style={styles.completedInfoBox}>
              <Text style={styles.completedInfoTitle}>
                {isCompleted ? 'Assignment Completed!' : 'Attempt Submitted!'}
              </Text>
              <Text style={styles.completedInfoText}>
                {isCompleted
                  ? 'You have used all your attempts. Your final submission is saved for grading.'
                  : 'You have submitted this attempt. You can review your submission below or choose to re-attempt if allowed.'}
              </Text>

              {hasAutoGradableQuestions && (
                <TouchableOpacity
                  style={[styles.showAnswersButton, showCorrectAnswers && styles.showAnswersButtonActive]}
                  onPress={() => setShowCorrectAnswers(!showCorrectAnswers)}
                >
                  <Text style={styles.showAnswersButtonText}>
                    {showCorrectAnswers ? 'Hide Correct Answers' : 'Show Correct Answers'}
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
              <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                {viewingResults && showCorrectAnswers && (
                  <View style={{ marginRight: 10 }}>
                    {isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) ? (
                      <Text style={{ color: '#4CAF50', fontSize: 20 }}>✓</Text>
                    ) : (
                      <Text style={{ color: '#D32F2F', fontSize: 20 }}>✗</Text>
                    )}
                  </View>
                )}
                <Text style={{ fontSize: 18, fontWeight: '600', color: '#046a38', flex: 1 }}>
                  Question {currentQuestionIndex + 1} of {questions.length} ({currentQuestion.activityType})
                </Text>
              </View>
            </View>
            
            <Text style={styles.questionText}>{currentQuestion.question}</Text>

            {/* RENDER QUESTION TYPES */}

            {/* File Submission */}
            {currentQuestion.activityType === 'File Submission' && (
              <>
                {currentQuestion.instructionFileUrl && (
                  <TouchableOpacity
                    style={styles.viewPdfButton}
                    onPress={() => {
                      setViewingDocument({
                        url: currentQuestion.instructionFileUrl,
                        title: 'Instructions',
                        showSpeechControls: false,
                      });
                      setDocumentViewerVisible(true);
                    }}>
                    <MaterialCommunityIcons name="file-pdf-box" size={20} color="#fff" />
                    <Text style={styles.viewPdfButtonText}>View PDF Instructions</Text>
                  </TouchableOpacity>
                )}
                <View>
                  {viewingResults ? (
                    <View>
                      {/* List of submitted files from the 'answers' state */}
                      {(answers[currentQuestionIndex] || []).map((file, index) => (
                        <TouchableOpacity
                          key={index}
                          style={styles.fileSubmissionContainer}
                          onPress={() => handleViewSubmittedFile(file)}>
                          <MaterialCommunityIcons name="file-check" size={24} color="#4CAF50" />
                          <Text style={styles.fileSubmissionText} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <MaterialCommunityIcons
                            name="eye-outline"
                            size={24}
                            color="#2E7D32"
                            style={{ marginLeft: 'auto' }}
                          />
                        </TouchableOpacity>
                      ))}

                      {/* Grading status below the files */}
                      {submissionScore !== null ? (
                        <View style={styles.gradeBox}>
                          <Text style={styles.gradeLabel}>Graded</Text>
                        </View>
                      ) : (
                        <View style={styles.waitingGradeBox}>
                          <Text style={styles.waitingGradeText}>Waiting for grading</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {(answers[currentQuestionIndex] || []).map((file, index) => (
                        <View key={index} style={styles.fileSubmissionContainer}>
                          <MaterialCommunityIcons name="file-document-outline" size={24} color="#046a38" />
                          <Text style={[styles.fileSubmissionText, { color: '#046a38' }]} numberOfLines={1}>
                            {file.name}
                          </Text>
                          <TouchableOpacity onPress={() => handleRemoveFile(file)} style={{ marginLeft: 'auto', padding: 5 }}>
                            <MaterialCommunityIcons name="close-circle" size={24} color="#D32F2F" />
                          </TouchableOpacity>
                        </View>
                      ))}
                      {/* The upload button should always be visible if not completed, to allow adding more files */}
                      <TouchableOpacity
                        style={[styles.uploadButton, viewingResults && styles.disabledButton]}
                        onPress={handleFilePick}
                        disabled={isUploading || viewingResults}>
                        <MaterialCommunityIcons name="upload" size={22} color="#fff" />
                        <Text style={styles.uploadButtonText}>{isUploading ? 'Uploading...' : 'Upload File'}</Text>
                      </TouchableOpacity>

                      <Text style={styles.uploadHint}>Allowed files: .java, .docx, .pdf (Max 250MB)</Text>
                    </>
                  )}
                </View>
              </>
            )}

            {/* Multiple Choice */}
            {currentQuestion.activityType === 'Multiple Choice' && currentQuestion.choices && (
              <View style={{ marginBottom: 20 }}>
                {currentQuestion.choices.map((choice, index) => {
                  const isUserAnswer = answers[currentQuestionIndex] === choice;
                  const isCorrectAnswer = getCorrectAnswer(currentQuestion, currentQuestionIndex) === choice;

                  let borderColor = '#ddd';
                  let borderWidth = 1;
                  let backgroundColor = '#fff';

                  if (viewingResults && showCorrectAnswers) {
                    if (isCorrectAnswer) {
                      borderColor = '#4CAF50';
                      borderWidth = 3;
                      backgroundColor = '#E8F5E8';
                    } else if (isUserAnswer && !isCorrectAnswer) {
                      borderColor = '#D32F2F';
                      borderWidth = 3;
                      backgroundColor = '#FFEBEE';
                    }
                  } else if (isUserAnswer) {
                    borderColor = '#046a38';
                    backgroundColor = '#f0f9ff';
                  }

                  return (
                    <TouchableOpacity
                      key={index}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: 15,
                        borderWidth: borderWidth,
                        borderColor: borderColor,
                        borderRadius: 8,
                        marginBottom: 10,
                        backgroundColor: backgroundColor,
                        opacity: viewingResults ? 0.7 : 1,
                      }}
                      onPress={() => handleAnswerChange(choice)}
                      disabled={viewingResults}>
                      <View
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          borderWidth: 2,
                          borderColor: isUserAnswer ? '#046a38' : '#ddd',
                          backgroundColor: isUserAnswer ? '#046a38' : '#fff',
                          marginRight: 15,
                          justifyContent: 'center',
                          alignItems: 'center',
                        }}>
                        {isUserAnswer && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />}
                      </View>
                      <Text style={{ fontSize: 16, color: '#333', flex: 1 }}>{choice}</Text>
                    </TouchableOpacity>
                  );
                })}

                {viewingResults && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerText}>{getCorrectAnswer(currentQuestion, currentQuestionIndex)}</Text>
                  </View>
                )}
              </View>
            )}

            {/* True or False */}
            {currentQuestion.activityType === 'True or False' && (
              <View style={{ flexDirection: 'row', gap: 15, marginBottom: 20 }}>
                {['True', 'False'].map(option => {
                  const isUserAnswer = answers[currentQuestionIndex] === option;
                  const isCorrectAnswer = getCorrectAnswer(currentQuestion, currentQuestionIndex) === option;

                  let borderColor = '#ddd';
                  let borderWidth = 2;
                  let backgroundColor = '#fff';

                  if (viewingResults && showCorrectAnswers) {
                    if (isCorrectAnswer) {
                      borderColor = '#4CAF50';
                      borderWidth = 3;
                      backgroundColor = '#E8F5E8';
                    } else if (isUserAnswer && !isCorrectAnswer) {
                      borderColor = '#D32F2F';
                      borderWidth = 3;
                      backgroundColor = '#FFEBEE';
                    }
                  } else if (isUserAnswer) {
                    borderColor = '#046a38';
                    backgroundColor = '#f0f9ff';
                  }

                  return (
                    <TouchableOpacity
                      key={option}
                      style={{
                        flex: 1,
                        padding: 15,
                        borderWidth: borderWidth,
                        borderColor: borderColor,
                        borderRadius: 8,
                        backgroundColor: backgroundColor,
                        alignItems: 'center',
                        opacity: viewingResults ? 0.7 : 1,
                      }}
                      onPress={() => handleAnswerChange(option)}
                      disabled={viewingResults}>
                      <Text style={{ fontSize: 16, fontWeight: '600', color: isUserAnswer ? '#046a38' : '#666' }}>
                        {option}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* Short Answer / Fill in the Blanks */}
            {(currentQuestion.activityType === 'Short Answer' || currentQuestion.activityType === 'Fill in the Blanks') && (
              <>
                <TextInput
                  style={[
                    styles.textInput,
                    viewingResults && styles.disabledElement,
                    viewingResults &&
                      showCorrectAnswers &&
                      (isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex])
                        ? styles.correctChoice
                        : styles.incorrectChoice),
                  ]}
                  placeholder={`Enter your ${currentQuestion.activityType.toLowerCase()}...`}
                  value={answers[currentQuestionIndex] || ''}
                  onChangeText={text => handleAnswerChange(text)}
                  multiline
                  numberOfLines={3}
                  editable={!viewingResults}
                />
                {viewingResults && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerText}>{getCorrectAnswer(currentQuestion, currentQuestionIndex)}</Text>
                  </View>
                )}
              </>
            )}

            {/* Matching */}
            {currentQuestion.activityType === 'Matching' && currentQuestion.matchingPairs && (
              <MatchingQuestionAnswer
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                onAnswerChange={handleArrayAnswerChange}
                answers={answers}
                isCompleted={viewingResults}
                showCorrectAnswers={showCorrectAnswers}
              />
            )}
          </View>
        )}

        {/* Navigation */}
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

        {viewingResults && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Results Summary</Text>
            {(() => {
              const isFileSubmissionOnly = questions.every(q => q.activityType === 'File Submission');
              const autoGradedQuestions = questions.filter(q => q.activityType !== 'File Submission');
              const totalAutoGradable = autoGradedQuestions.length;
              const correctCount = autoGradedQuestions.filter((q, index) => 
                isAnswerCorrect(q, questions.findIndex(origQ => origQ === q), answers[questions.findIndex(origQ => origQ === q)])
              ).length;
              const scorePercentage = totalAutoGradable > 0 ? Math.round((correctCount / totalAutoGradable) * 100) : 0;

              if (isFileSubmissionOnly) {
                let totalPossibleScore = 'N/A';
                if (questions.length > 0 && questions[0].maxScore !== undefined) {
                    totalPossibleScore = questions[0].maxScore;
                }
                return (
                  <>
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
              }

              // For mixed or auto-graded only
              return (
                <>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Total Questions:</Text>
                    <Text style={styles.summaryValue}>{totalAutoGradable}</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Correct Answers:</Text>
                    <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{correctCount}</Text>
                  </View>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Incorrect Answers:</Text>
                    <Text style={[styles.summaryValue, { color: '#D32F2F' }]}>{totalAutoGradable - correctCount}</Text>
                  </View>
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>Score: {scorePercentage}%</Text>
                  </View>
                  {questions.some(q => q.activityType === 'File Submission') && (
                    <View style={styles.waitingGradeBoxSummary}>
                      <Text style={styles.waitingGradeTextSummary}>File submission part is pending teacher review.</Text>
                    </View>
                  )}
                </>
              );
            })()}
          </View>
        )}

        {/* Action Buttons */}
        {deadlinePassed ? (
          <View style={{ backgroundColor: '#FFEBEE', padding: 15, borderRadius: 8, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#D32F2F' }}>
            <Text style={{ color: '#D32F2F', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>⚠️ Deadline Passed</Text>
            <Text style={{ color: '#C62828', fontSize: 14, marginTop: 5, textAlign: 'center' }}>The deadline for this assignment has passed. You can no longer submit answers.</Text>
          </View>
        ) : viewingResults ? (
          (() => {
            const isFileSubmissionOnly = questions.every(q => q.activityType === 'File Submission');
            if (isGraded && isFileSubmissionOnly) {
              return (
            <View style={[styles.submitButton, styles.disabledButton, { backgroundColor: '#4CAF50' }]}>
              <Text style={styles.submitButtonText}>✓ Assignment Graded</Text>
            </View>);
            } else if (isCompleted) {
              return (
                <View style={[styles.submitButton, styles.disabledButton]}>
                  <Text style={styles.submitButtonText}>✓ All Attempts Used</Text>
                </View>);
            } else {
              const buttonText = isFileSubmissionOnly ? 'Re-attempt Assignment' : 'Re-attempt Quiz';
              return (
                <TouchableOpacity style={[styles.submitButton, { backgroundColor: '#FFC107' }]} onPress={handleReattempt}>
                  <Text style={[styles.submitButtonText, { color: '#000' }]}>{buttonText}</Text>
                </TouchableOpacity>
              );
            }
          })()
        ) : (
          <TouchableOpacity
            style={[styles.submitButton, (isSubmitting || isUploading) && styles.disabledButton]}
            onPress={handleConfirmSubmit}
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
  questionHeader: { fontSize: 18, fontWeight: '600', color: '#046a38', flex: 1 },
  questionHeaderContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 },
  correctChoice: { backgroundColor: '#E8F5E8', borderColor: '#4CAF50', borderWidth: 2 },
  incorrectChoice: { backgroundColor: '#FFEBEE', borderColor: '#D32F2F', borderWidth: 2 },
  correctAnswerBox: { marginTop: 10, padding: 10, backgroundColor: '#f0f9ff', borderRadius: 6, borderWidth: 1, borderColor: '#b3e5fc' },
  correctAnswerLabel: { fontSize: 14, fontWeight: '600', color: '#0277bd' },
  correctAnswerText: { fontSize: 14, color: '#01579b', marginTop: 4 },
  questionText: { fontSize: 16, color: '#333', marginBottom: 20, lineHeight: 24 },
  disabledElement: { opacity: 0.7 },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, fontSize: 16, backgroundColor: '#fff', minHeight: 60, textAlignVertical: 'top' },
  submitButton: { backgroundColor: '#046a38', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 40 },
  disabledButton: { backgroundColor: '#9E9E9E', opacity: 0.7 },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
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

  // Start Screen Styles
  startCard: { backgroundColor: '#fff', padding: 30, borderRadius: 15, margin: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  startTitle: { fontSize: 22, fontWeight: 'bold', color: '#046a38', marginBottom: 15, textAlign: 'center' },
  startDescription: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  startButton: { backgroundColor: '#046a38', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10, marginBottom: 10, width: '100%' },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  startCancelButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10, width: '100%' },
  startCancelButtonText: { color: '#666', fontSize: 16, fontWeight: '500', textAlign: 'center' },

  // Matching Type Styles
  matchingContainer: { marginBottom: 20 },
  promptsContainer: { marginBottom: 20 },
  matchingHeader: { fontSize: 16, fontWeight: '600', color: '#046a38', marginBottom: 10 },
  promptRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  promptText: { flex: 1, fontSize: 15, color: '#333' },
  answerSlot: { flex: 1, borderWidth: 2, borderStyle: 'dashed', borderColor: '#ccc', borderRadius: 8, padding: 12, alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  filledSlot: { borderColor: '#046a38', backgroundColor: '#f0f9ff' },
  slotText: { fontSize: 15, color: '#666' },
  choicesPool: { marginTop: 10, borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 15 },
  choicesContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceChip: { backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#046a38' },
  choiceChipText: { color: '#046a38', fontWeight: '500' },
  selectedChoice: { backgroundColor: '#046a38', borderColor: '#023c1e' },
  usedChoice: { backgroundColor: '#e0e0e0', borderColor: '#bdbdbd', opacity: 0.6 },

});
