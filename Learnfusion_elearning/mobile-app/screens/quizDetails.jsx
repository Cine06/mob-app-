import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../utils/supabaseClient';
import * as SecureStore from 'expo-secure-store';

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

const QuizDetails = () => {
  const router = useRouter();
  const { assessmentId, assignedAssessmentId } = useLocalSearchParams();
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [quizData, setQuizData] = useState(null);
  const [assignedData, setAssignedData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAnswers, setCompletedAnswers] = useState([]);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [attemptCount, setAttemptCount] = useState(0);
  const [viewingResults, setViewingResults] = useState(false);
  const [allowedAttempts, setAllowedAttempts] = useState(1);
  const [timeLeft, setTimeLeft] = useState(null);
  const timerRef = React.useRef(null);
  const [hasStarted, setHasStarted] = useState(false);
  const [activeTake, setActiveTake] = useState(null);
  const [showChoiceScreen, setShowChoiceScreen] = useState(false);

  useEffect(() => {
    if (!assessmentId || !assignedAssessmentId) {
      setError('Missing quiz parameters');
      setLoading(false);
      return;
    }
    
    const initialize = async () => {
      const userData = await getUserData();
      if (userData) {
        // Fetch quiz data first, then check status which depends on it
        const fetchedData = await fetchQuizData();
        if (fetchedData) await checkQuizStatus(userData, fetchedData.assignedData);
      }
    };
    initialize();

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [assessmentId, assignedAssessmentId]);

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

  const checkQuizStatus = async (currentUser, fetchedAssignedData) => {
    try {
      if (!currentUser || !currentUser.id || !assignedAssessmentId) return;
  
      const currentAssignedData = fetchedAssignedData || assignedData;
      if (!currentAssignedData) {
        console.log("checkQuizStatus: assignedData not available yet.");
        return;
      }

      const { data: takes, error: takesError } = await supabase
        .from('student_assessments_take')
        .select('id, created_at, started_at, score')
        .eq('assigned_assessments_id', assignedAssessmentId)
        .eq('users_id', currentUser.id)
        .order('created_at', { ascending: false });
  
      if (takesError) throw takesError;

      const isTimed = currentAssignedData.time_limit > 0;

      // Check for an in-progress timed attempt first
      for (const take of takes) {
        if (isTimed && take.started_at && take.score === null) {
          const endTime = new Date(take.started_at).getTime() + currentAssignedData.time_limit * 60 * 1000;
          // If score is null and time is not up, it's in-progress
          if (Date.now() < endTime) {
            setActiveTake(take);
            setHasStarted(true); // This is an active, unfinished attempt
            startTimer(take.started_at, currentAssignedData.time_limit);
            return; // Exit the function immediately to resume the attempt
          }
        }
      }

      // If no in-progress attempt was found, proceed to count completed takes
      const completedTakes = takes.filter(take => take.score !== null || (take.started_at && new Date(take.started_at).getTime() + currentAssignedData.time_limit * 60 * 1000 < Date.now()));
      setAttemptCount(completedTakes.length);

      // If there are completed takes and they can re-attempt, show choice screen.
      if (completedTakes.length > 0 && completedTakes.length < (currentAssignedData.allowed_attempts || 1)) {
        setShowChoiceScreen(true);
      }

      // If there are any takes (completed or not), load the latest one for viewing.
      if (takes.length > 0) {
        const latestTake = takes[0];
        const { data: answerData, error: answerError } = await supabase
          .from('student_assessments_answer')
          .select('answer')
          .eq('student_assessments_take_id', latestTake.id)
          .eq('users_id', currentUser.id);
        if (!answerError && answerData && answerData.length > 0) {
          setIsCompleted(takes.length >= (currentAssignedData.allowed_attempts || 1));
          setCompletedAnswers(answerData.map(a => JSON.parse(a.answer)));
          const completedAnswersObj = {};
          answerData.forEach(a => {
            const parsedAnswer = JSON.parse(a.answer);
            completedAnswersObj[parsedAnswer.questionIndex] = parsedAnswer.answer;
          });
          setAnswers(completedAnswersObj);
          // Only go to results view if there are no more attempts or no choice screen
          if (completedTakes.length >= (currentAssignedData.allowed_attempts || 1)) {
            setViewingResults(true);
          }
        }
      }
    } catch (error) {
      console.error('Error checking quiz status:', error);
    }
  };

  const fetchQuizData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const { data: assessmentData, error: assessmentError } = await supabase
        .from('assessments')
        .select('*')
        .eq('id', assessmentId)
        .single();

      if (assessmentError) {
        console.error('Error fetching assessment:', assessmentError);
        throw assessmentError;
      }

      if (!assessmentData) {
        setError('Assessment not found');
        return null;
      }

      const { data: fetchedAssignedData, error: assignedError } = await supabase
        .from('assigned_assessments')
        .select('*')
        .eq('id', assignedAssessmentId)
        .single();

      if (assignedError) {
        throw assignedError;
      }

      if (!fetchedAssignedData) {
        setError('Assignment not found');
        return null;
      }

      setQuizData(assessmentData);
      setAssignedData(fetchedAssignedData);
      setAllowedAttempts(fetchedAssignedData.allowed_attempts || 1);
      return { assessmentData, assignedData: fetchedAssignedData };
    } catch (error) {
      console.error('Error fetching quiz data:', error);
      setError('Failed to load quiz data: ' + error.message);
      return null;
    } finally {
      setLoading(false);
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
        Alert.alert("Time's Up!", "Your time for this quiz has expired. Your answers will be submitted automatically.", [
          { text: "OK", onPress: () => submitQuiz(true) } // Pass true to indicate auto-submission
        ]);
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);
  };

  useEffect(() => {
    const isTimed = assignedData?.time_limit > 0;

    if (isTimed && !viewingResults && attemptCount < allowedAttempts) {
      if (activeTake?.started_at) {
        // An active attempt is already in progress, start the timer immediately
        setHasStarted(true);
        startTimer(activeTake.started_at, assignedData.time_limit);
      } else if (hasStarted) {
        // This is a new attempt being started, handled by startNewTimedAttempt
      }
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [assignedData, viewingResults, hasStarted, activeTake]);

  const startNewTimedAttempt = async () => {
    if (!user || !assignedData) return;

    try {
      const startTime = new Date().toISOString();
      const { data: newTake, error: takeError } = await supabase
        .from('student_assessments_take')
        .insert({
          assigned_assessments_id: assignedData.id,
          users_id: user.id,
          started_at: startTime,
          // Score is initially null
        })
        .select()
        .single();

      if (takeError) throw takeError;

      setActiveTake(newTake);
      setHasStarted(true);
      startTimer(startTime, assignedData.time_limit);
    } catch (error) {
      console.error('Error starting new timed attempt:', error);
      Alert.alert('Error', 'Could not start the quiz. Please try again.');
      router.back();
    }
  };

  const handleQuizSubmit = () => {
    if (!user || !quizData || !assignedData) return;

    if (attemptCount >= allowedAttempts) {
      Alert.alert('No Attempts Left', 'You have used all your attempts for this quiz.');
      return;
    }

    const questions = parseQuestions();
    const unansweredQuestions = questions.filter((_, index) => {
      const answer = answers[index];
      if (!answer) return true;
      if (Array.isArray(answer)) { // For matching questions
        return answer.some(a => !a || (typeof a === 'string' && a.trim() === ''));
      }
      return answer.toString().trim() === '';
    });

    if (unansweredQuestions.length > 0) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    Alert.alert(
      "Confirm Submission",
      "Are you sure you want to submit your answers?",
      [{ text: "Cancel", style: "cancel" }, { text: "Submit", onPress: () => submitQuiz(false) }]
    );
  };

  const submitQuiz = async (isAutoSubmit = false) => {
    setIsSubmitting(true);

    try {
      let takeId = activeTake?.id;

      if (!takeId) {
        const { data: newTake, error: takeError } = await supabase
          .from('student_assessments_take')
          .insert({ assigned_assessments_id: assignedData.id, users_id: user.id })
          .select('id').single();
        if (takeError) throw takeError;
        takeId = newTake.id;
      }

      const answerPromises = Object.entries(answers).map(([questionIndex, answer]) => {
        return supabase
          .from('student_assessments_answer')
          .insert({
            student_assessments_take_id: takeId,
            users_id: user.id,
            answer: JSON.stringify({
              questionIndex: parseInt(questionIndex),
              answer: answer // Save the answer as is (string or array)
            })
          });
      });

      const answerResults = await Promise.all(answerPromises);
      const hasAnswerError = answerResults.some(result => result.error);

      if (hasAnswerError) {
        console.error('Error saving answers:', answerResults);
        Alert.alert('Error', 'Failed to save answers. Please try again.');
        return;
      }

      // Calculate score
      const totalPossiblePoints = questions.reduce((total, q) => total + (q.points || 0), 0);
      const userScore = questions.reduce((totalScore, question, index) => {
        if (isAnswerCorrect(question, index, answers[index])) {
          return totalScore + (question.points || 0); // Use points, default to 0
        }
        return totalScore;
      }, 0);

      // Update the take record with the score and submission time
      const { error: updateTakeError } = await supabase
        .from('student_assessments_take')
        .update({
          score: userScore,
          created_at: new Date().toISOString() // created_at now acts as submitted_at
        })
        .eq('id', takeId);

      if (updateTakeError) throw updateTakeError;

      // Re-fetch takes to accurately calculate the new attempt count, same as checkQuizStatus
      const { data: allTakes, error: takesError } = await supabase
        .from('student_assessments_take')
        .select('id, created_at, started_at, score')
        .eq('assigned_assessments_id', assignedAssessmentId)
        .eq('users_id', user.id);

      if (takesError) throw takesError;

      const isTimed = assignedData.time_limit > 0;
      const completedTakes = allTakes.filter(take => {
        if (isTimed && take.started_at && take.score === null) {
          const endTime = new Date(take.started_at).getTime() + assignedData.time_limit * 60 * 1000;
          // Only count it if the time is up
          return Date.now() >= endTime;
        }
        return true; // Always count non-timed or already scored takes
      });

      // Update state to show completion UI
      const newAttemptCount = completedTakes.length;
      setAttemptCount(newAttemptCount); // Set the accurate count
      setIsCompleted(newAttemptCount >= allowedAttempts); // Check against allowed attempts
      setViewingResults(true);

      Alert.alert(
        "Submission Successful!",
        `Your score: ${userScore}/${totalPossiblePoints}`,
        [{ text: "Review Answers" }]
      );
      
    } catch (error) {
      console.error('Error submitting quiz:', error);
      Alert.alert('Error', 'Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReattempt = () => {
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
          text: "Yes, Start", onPress: () => {
              setViewingResults(false);
              setAnswers({});
              setCurrentQuestionIndex(0);
              const isTimed = assignedData?.time_limit > 0;
              // For non-timed quizzes, start immediately. For timed, show the start screen.
              setActiveTake(null); // Clear the previous take record
              setShowChoiceScreen(false); // Hide the choice screen to proceed
              setHasStarted(!isTimed);
          }}
      ]
    )
  };
  const handleAnswer = (answer) => {
    if (!isCompleted) {
      setAnswers({ ...answers, [currentQuestionIndex]: answer });
    }
  };

  const handleArrayAnswerChange = (questionIndex, newAnswers) => {
    if (!viewingResults) {
      setAnswers({ ...answers, [questionIndex]: newAnswers });
    }
  };

  const parseQuestions = () => {
    if (!quizData?.questions) return [];
    try {
      return typeof quizData.questions === 'string' 
        ? JSON.parse(quizData.questions) 
        : quizData.questions;
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
    
    if (question.activityType === 'Matching') {
      if (!Array.isArray(userAnswer) || !question.matchingPairs) return false;
      // Check if every user answer matches the correct pair's right side
      return userAnswer.every((ans, index) => {
        const correctPair = question.matchingPairs[index];
        return correctPair && ans.toLowerCase().trim() === correctPair.right.toLowerCase().trim();
      });
    }
    
    return userAnswer.toString().toLowerCase().trim() === correctAnswer.toLowerCase().trim();
  };

  const questions = parseQuestions();

  const goToNextQuestion = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const goToPreviousQuestion = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const isDeadlinePassed = () => {
    if (!assignedData?.deadline) return false; 
    const now = new Date();
    const deadlineDate = new Date(assignedData.deadline);
    return now > deadlineDate;
  };

  const deadlinePassed = isDeadlinePassed();
  const currentQuestion = questions[currentQuestionIndex];

  if (showChoiceScreen) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>You have {allowedAttempts - attemptCount} attempt(s) remaining.</Text>
            <TouchableOpacity style={styles.startButton} onPress={() => {
              setShowChoiceScreen(false);
              setViewingResults(true);
            }}>
              <Text style={styles.startButtonText}>View Last Attempt</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startCancelButton} onPress={handleReattempt}>
              <Text style={styles.startCancelButtonText}>Start New Attempt</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  if (assignedData?.time_limit > 0 && !hasStarted && !viewingResults && attemptCount < allowedAttempts) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centered}>
          <View style={styles.startCard}>
            <Text style={styles.startTitle}>Start Timed Quiz?</Text>
            <Text style={styles.startDescription}>
              This quiz has a time limit of <Text style={{fontWeight: 'bold'}}>{assignedData.time_limit} minutes</Text>. 
              The timer will begin as soon as you start.
            </Text>
            <TouchableOpacity style={styles.startButton} onPress={startNewTimedAttempt}>
              <Text style={styles.startButtonText}>Start Quiz</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.startCancelButton} onPress={() => router.back()}>
              <Text style={styles.startCancelButtonText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </>
    );
  }

  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' }}>
        <Text style={{ fontSize: 18, color: '#666' }}>Loading Quiz...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true, 
            title: 'Error',
            headerStyle: { backgroundColor: '#046a38' },
            headerTintColor: '#fff',
            headerTitleAlign: 'center',
          }} 
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#046a38', marginBottom: 20 }}>Error</Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 }}>{error}</Text>
          <TouchableOpacity 
            style={{
              backgroundColor: '#046a38',
              padding: 15,
              borderRadius: 8,
              alignItems: 'center',
              minWidth: 200,
              paddingTop:100,
            }}
            onPress={() => router.push('/lessons')}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Back to Lessons</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (!quizData || !assignedData) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true, 
            title: 'Quiz Not Found',
            headerStyle: { backgroundColor: '#046a38' },
            headerTintColor: '#fff',
            headerTitleAlign: 'center',
          }} 
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#046a38', marginBottom: 20 }}>Quiz Not Found</Text>
          <TouchableOpacity 
            style={{
              backgroundColor: '#046a38',
              padding: 15,
              borderRadius: 8,
              alignItems: 'center',
              minWidth: 200,
            }}
            onPress={() => router.push('/lessons')}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Back to Lessons</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  if (!questions || questions.length === 0) {
    return (
      <>
        <Stack.Screen 
          options={{ 
            headerShown: true, 
            title: quizData.title || 'Quiz',
            headerStyle: { backgroundColor: '#046a38' },
            headerTintColor: '#fff',
            headerTitleAlign: 'center',
          }} 
        />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 }}>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#046a38', marginBottom: 20 }}>{quizData.title}</Text>
          <Text style={{ fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 30 }}>No questions available for this quiz</Text>
          <TouchableOpacity 
            style={{
              backgroundColor: '#046a38',
              padding: 15,
              borderRadius: 8,
              alignItems: 'center',
              minWidth: 200,
              marginTop:100,
            }}
            onPress={() => router.push('/lessons')}
          >
          </TouchableOpacity>
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
            {quizData?.title || 'Assessment'}
          </Text>
        </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Quiz Header */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
            <Text style={styles.title}>
              {quizData.title}
            </Text>
            {isCompleted && (
              <View style={{ 
                backgroundColor: '#4CAF50', 
                paddingHorizontal: 12, 
                paddingVertical: 6, 
                borderRadius: 20,
                marginLeft: 10
              }}>
                <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                  ✓ DONE
                </Text>
              </View>
            )}
          </View>
          
          {quizData.description && (
            <Text style={{ fontSize: 16, color: '#666', marginBottom: 15, lineHeight: 24 }}>
              {quizData.description}
            </Text>
          )}
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 14, color: '#666' }}>
              Questions: {questions.length}
            </Text>
            {assignedData.deadline && (
              <Text style={{ fontSize: 14, color: deadlinePassed ? '#D32F2F' : '#666', fontWeight: '500' }}>
                Deadline: {new Date(assignedData.deadline).toLocaleDateString()}
              </Text>
            )}
          </View>
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontSize: 14, color: '#666' }}>Attempts: {attemptCount} / {allowedAttempts}</Text>
          </View>
          
          {timeLeft !== null && !viewingResults && (
            <View style={{ 
              marginTop: 15, 
              padding: 10, 
              backgroundColor: timeLeft < 60000 ? '#FFEBEE' : '#E3F2FD', 
              borderRadius: 8, 
              alignItems: 'center' 
            }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: timeLeft < 60000 ? '#D32F2F' : '#1E88E5' }}>
                Time Left: {Math.floor(timeLeft / 60000)}:{(Math.floor(timeLeft / 1000) % 60).toString().padStart(2, '0')}
              </Text>
            </View>
          )}

          {viewingResults && (
            <View style={styles.completedInfoBox}>
              <Text style={styles.completedInfoTitle}>
                {isCompleted ? 'Assessment Completed!' : 'Attempt Submitted!'}
              </Text>
              <Text style={styles.completedInfoText}>
                {isCompleted
                  ? 'You have used all your attempts. Your final answers are saved.'
                  : 'You have submitted this attempt. You can review your answers below or choose to re-attempt.'}
              </Text>
              
              <TouchableOpacity
                style={[styles.showAnswersButton, showCorrectAnswers && styles.showAnswersButtonActive]}
                onPress={() => setShowCorrectAnswers(!showCorrectAnswers)}
              >
                <Text style={styles.showAnswersButtonText}>
                  {showCorrectAnswers ? 'Hide Correct Answers' : 'Show Correct Answers'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Current Question */}
        {currentQuestion && (
          <View style={styles.card}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 15 }}>
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
                  Question {currentQuestionIndex + 1} of {questions.length} 
                  {currentQuestion.points ? ` (${currentQuestion.points} ${currentQuestion.points === 1 ? 'pt' : 'pts'})` : ''}
                </Text>
              </View>
            </View>
            
            <Text style={{ fontSize: 16, color: '#333', marginBottom: 20, lineHeight: 24 }}>
              {currentQuestion.question}
            </Text>

            {/* Multiple Choice */}
            {currentQuestion.activityType === 'Multiple Choice' && currentQuestion.choices && (
              <View style={{ marginBottom: 20 }}>
                {currentQuestion.choices.map((choice, index) => {
                  const isUserAnswer = answers[currentQuestionIndex] === choice;
                  const isCorrectAnswer = getCorrectAnswer(currentQuestion, currentQuestionIndex) === choice;
                  const isUserCorrect = isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]);
                  
                  let borderColor = '#ddd';
                  let borderWidth = 1;
                  let backgroundColor = '#fff';
                  
                  if (viewingResults && showCorrectAnswers) {
                    if (isCorrectAnswer) {
                      borderColor = '#4CAF50'; 
                      borderWidth = 3;
                      backgroundColor = '#E8F5E8';
                    } else if (isUserAnswer && !isUserCorrect) {
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
                      onPress={() => handleAnswer(choice)}
                      disabled={viewingResults}
                    >
                      <View style={{
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
                        {isUserAnswer && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                        )}
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
                {['True', 'False'].map((option) => {
                  const isUserAnswer = answers[currentQuestionIndex] === option;
                  const isCorrectAnswer = getCorrectAnswer(currentQuestion, currentQuestionIndex) === option;
                  const isUserCorrect = isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]);
                  
                  let borderColor = '#ddd';
                  let borderWidth = 2;
                  let backgroundColor = '#fff';
                  
                  if (viewingResults && showCorrectAnswers) {
                    if (isCorrectAnswer) {
                      borderColor = '#4CAF50'; 
                      borderWidth = 3;
                      backgroundColor = '#E8F5E8';
                    } else if (isUserAnswer && !isUserCorrect) {
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
                      onPress={() => handleAnswer(option)}
                      disabled={viewingResults}
                    >
                      <Text style={{ 
                        fontSize: 16, 
                        fontWeight: '600',
                        color: isUserAnswer ? '#046a38' : '#666' 
                      }}>
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
                    viewingResults && showCorrectAnswers && (
                      isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex])
                        ? styles.correctChoice
                        : styles.incorrectChoice
                    )
                  ]}
                  placeholder={isCompleted ? 'Answer submitted' : `Enter your ${currentQuestion.activityType.toLowerCase()}...`}
                  value={answers[currentQuestionIndex] || ''}
                  onChangeText={(text) => handleAnswer(text)}
                  multiline
                  numberOfLines={3}
                  editable={!viewingResults}
                />
                {viewingResults && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={styles.correctAnswerBox}>
                    <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                    <Text style={styles.correctAnswerText}>
                      {getCorrectAnswer(currentQuestion, currentQuestionIndex)}
                    </Text>
                  </View>
                )}
              </>
            )}

            {/* Matching */}
            {currentQuestion.activityType === 'Matching' && currentQuestion.matchingPairs && (
              <MatchingQuestionAnswer
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                onAnswerChange={handleArrayAnswerChange} // This needs to be fixed
                answers={answers[currentQuestionIndex]}
                isCompleted={viewingResults}
                showCorrectAnswers={showCorrectAnswers}
              />
            )}
          </View> 
        )}
        
        {/* Navigation */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <TouchableOpacity 
            onPress={goToPreviousQuestion} 
            disabled={currentQuestionIndex === 0}
            style={{
              backgroundColor: currentQuestionIndex === 0 ? '#ccc' : '#046a38',
              padding: 12,
              borderRadius: 8,
              minWidth: 100,
              alignItems: 'center',
              opacity: currentQuestionIndex === 0 ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Previous</Text>
          </TouchableOpacity>
          
          <Text style={{ color: '#046a38', fontSize: 16, fontWeight: 'bold' }}>
            {currentQuestionIndex + 1} / {questions.length}
          </Text>
          
          <TouchableOpacity
            onPress={goToNextQuestion}
            disabled={currentQuestionIndex === questions.length - 1}
            style={{
              backgroundColor: currentQuestionIndex === questions.length - 1 ? '#ccc' : '#046a38',
              padding: 12,
              borderRadius: 8,
              minWidth: 100,
              alignItems: 'center',
              opacity: currentQuestionIndex === questions.length - 1 ? 0.5 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: 'bold' }}>Next</Text>
          </TouchableOpacity>
        </View>

        {/* Assessment Results Summary */}
        {viewingResults && showCorrectAnswers && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
             Assessment Results Summary
            </Text>
            
            {(() => {
              const totalPossiblePoints = questions.reduce((total, q) => total + (q.points || 0), 0);
              const userScore = questions.reduce((score, question, index) => {
                if (isAnswerCorrect(question, index, answers[index])) {
                  return score + (question.points || 0);
                }
                return score;
              }, 0);
              const scorePercentage = totalPossiblePoints > 0 ? Math.round((userScore / totalPossiblePoints) * 100) : 0;
              
              return (
                <>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Your Score:</Text>
                    <Text style={[styles.summaryValue, { color: '#4A148C' }]}>
                      {userScore} / {totalPossiblePoints}
                    </Text>
                  </View>
                  
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>Final Score: {scorePercentage}%</Text>
                  </View>
                </>
              );
            })()}
          </View>
        )}
        {/* Submit Button */}
        {deadlinePassed ? (
          <View style={{ 
            backgroundColor: '#FFEBEE', 
            padding: 15, 
            borderRadius: 8, 
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: '#D32F2F'
          }}>
            <Text style={{ color: '#D32F2F', fontSize: 16, fontWeight: '600', textAlign: 'center' }}>
              ⚠️ Deadline Passed
            </Text>
            <Text style={{ color: '#C62828', fontSize: 14, marginTop: 5, textAlign: 'center' }}>
              The deadline for this quiz has passed. You can no longer submit your answers.
            </Text>
          </View>
        ) : viewingResults ? (
          isCompleted ? (
            <View style={[styles.submitButton, styles.disabledButton]}>
              <Text style={styles.submitButtonText}>✓ All Attempts Used</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.submitButton, { backgroundColor: '#FFC107' }]}
              onPress={handleReattempt}
            >
              <Text style={[styles.submitButtonText, { color: '#000' }]}>Re-attempt Quiz</Text>
            </TouchableOpacity>
          )
        ) : (
          <TouchableOpacity
            style={[
              styles.submitButton,
              isSubmitting && styles.disabledButton
            ]}
            onPress={handleQuizSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Submitting...' : `Submit Quiz `}
            </Text>
          </TouchableOpacity>
        )} 
        
      </ScrollView>
      </View>
    </>
  );
};
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5', paddingTop: 35 },
  submitButton: { backgroundColor: '#046a38', padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 40, justifyContent: 'center' },
  submitButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  disabledButton: { backgroundColor: '#9E9E9E' },
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
  scrollContent: { paddingHorizontal: 15, paddingBottom: 40, marginTop: 25 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  summaryCard: { backgroundColor: '#F3E5F5', padding: 20, borderRadius: 12, marginBottom: 20, borderLeftWidth: 4, borderLeftColor: '#9C27B0' },
  summaryTitle: { color: '#7B1FA2', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' },
  summaryStat: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  summaryLabel: { fontSize: 16, color: '#4A148C' },
  summaryValue: { fontSize: 16, fontWeight: '600', color: '#4A148C' },
  scoreContainer: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#CE93D8' },
  scoreText: { fontSize: 20, fontWeight: 'bold', textAlign: 'center', color: '#7B1FA2' },
  completedInfoBox: { backgroundColor: '#E8F5E8', padding: 15, borderRadius: 8, marginTop: 15, borderLeftWidth: 4, borderLeftColor: '#4CAF50', marginBottom: 10 },
  completedInfoTitle: { color: '#2E7D32', fontSize: 14, fontWeight: '600' },
  completedInfoText: { color: '#4CAF50', fontSize: 12, marginTop: 5 },
  showAnswersButton: { backgroundColor: '#046a38', padding: 10, borderRadius: 6, marginTop: 10, alignItems: 'center' },
  showAnswersButtonActive: { backgroundColor: '#4CAF50' },
  showAnswersButtonText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  textInput: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 15, fontSize: 16, backgroundColor: '#fff', minHeight: 60, textAlignVertical: 'top', marginBottom: 20 },
  disabledElement: { opacity: 0.7 },
  correctChoice: { backgroundColor: '#E8F5E8', borderColor: '#4CAF50', borderWidth: 2 },
  incorrectChoice: { backgroundColor: '#FFEBEE', borderColor: '#D32F2F', borderWidth: 2 },
  correctAnswerBox: { marginTop: 10, padding: 10, backgroundColor: '#f0f9ff', borderRadius: 6, borderWidth: 1, borderColor: '#b3e5fc', marginBottom: 20 },
  correctAnswerLabel: { fontSize: 14, fontWeight: '600', color: '#0277bd' },
  correctAnswerText: { fontSize: 14, color: '#01579b', marginTop: 4 },
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
  // End Matching Type Styles
  title: { fontSize: 24, fontWeight: 'bold', color: '#046a38', flex: 1 ,paddingTop:5,},
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5' },

  // Start Screen Styles
  startCard: { backgroundColor: '#fff', padding: 30, borderRadius: 15, margin: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  startTitle: { fontSize: 22, fontWeight: 'bold', color: '#046a38', marginBottom: 15, textAlign: 'center' },
  startDescription: { fontSize: 16, color: '#555', textAlign: 'center', marginBottom: 20, lineHeight: 24 },
  startButton: { backgroundColor: '#046a38', paddingVertical: 15, paddingHorizontal: 40, borderRadius: 10, marginBottom: 10, width: '100%' },
  startButtonText: { color: '#fff', fontSize: 18, fontWeight: '600', textAlign: 'center' },
  startCancelButton: { paddingVertical: 12, paddingHorizontal: 40, borderRadius: 10, width: '100%' },
  startCancelButtonText: { color: '#666', fontSize: 16, fontWeight: '500', textAlign: 'center' },
});

export default QuizDetails;