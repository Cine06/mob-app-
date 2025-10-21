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

  useEffect(() => {
    if (!assessmentId || !assignedAssessmentId) {
      setError('Missing quiz parameters');
      setLoading(false);
      return;
    }
    
    const initialize = async () => {
      const userData = await getUserData();
      await fetchQuizData();
      await checkQuizCompletion(userData);
    };
    initialize();
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

  const checkQuizCompletion = async (currentUser) => {
    try {
      if (!currentUser || !currentUser.id || !assignedAssessmentId) return;

      const { data: takeData, error: takeError } = await supabase
        .from('student_assessments_take')
        .select('id')
        .eq('assigned_assessments_id', assignedAssessmentId)
        .eq('users_id', currentUser.id)
        .single();

      if (takeError || !takeData) return; // No completion found, which is normal.
      
      const { data: answerData, error: answerError } = await supabase
        .from('student_assessments_answer')
        .select('answer')
        .eq('student_assessments_take_id', takeData.id)
        .eq('users_id', currentUser.id);

      if (!answerError && answerData && answerData.length > 0) {
        setIsCompleted(true);
        setCompletedAnswers(answerData.map(a => JSON.parse(a.answer)));
        const completedAnswersObj = {};
        answerData.forEach(a => {
          const parsedAnswer = JSON.parse(a.answer);
          completedAnswersObj[parsedAnswer.questionIndex] = parsedAnswer.answer;
        });
        setAnswers(completedAnswersObj);
      }
    } catch (error) {
      console.error('Error checking quiz completion:', error);
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
        setError('Failed to load assessment data: ' + assessmentError.message);
        return;
      }

      if (!assessmentData) {
        setError('Assessment not found');
        return;
      }

      const { data: assignedData, error: assignedError } = await supabase
        .from('assigned_assessments')
        .select('*')
        .eq('id', assignedAssessmentId)
        .single();

      if (assignedError) {
        console.error('Error fetching assigned assessment:', assignedError);
        setError('Failed to load assignment data: ' + assignedError.message);
        return;
      }

      if (!assignedData) {
        setError('Assignment not found');
        return;
      }

      setQuizData(assessmentData);
      setAssignedData(assignedData);
      
    } catch (error) {
      console.error('Error fetching quiz data:', error);
      setError('Failed to load quiz data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };
  
  const submitQuiz = async () => {
    if (!user || !quizData || !assignedData) {
      Alert.alert('Error', 'Missing required data');
      return;
    }

    if (isCompleted) {
      Alert.alert(
        'Assessment Already Completed', 
        'You have already submitted this assessment. You cannot submit it again.',
        [{ text: 'OK' }]
      );
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

      if (takeError) {
        console.error('Error creating take record:', takeError);
        Alert.alert('Error', 'Failed to submit quiz. Please try again.');
        return;
      }

      const answerPromises = Object.entries(answers).map(([questionIndex, answer]) => {
        return supabase
          .from('student_assessments_answer')
          .insert({
            student_assessments_take_id: takeData.id.toString(),
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
      const totalQuestions = questions.length;
      const correctAnswersCount = questions.filter((question, index) => 
        isAnswerCorrect(question, index, answers[index])
      ).length;

      // Update state to show completion UI
      setIsCompleted(true);

      Alert.alert(
        "Submission Successful!",
        `Your score: ${correctAnswersCount}/${totalQuestions}`,
        [{ text: "Review Answers" }]
      );
      
    } catch (error) {
      console.error('Error submitting quiz:', error);
      Alert.alert('Error', 'Failed to submit quiz. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAnswer = (answer) => {
    if (!isCompleted) {
      setAnswers({ ...answers, [currentQuestionIndex]: answer });
    }
  };

  const handleArrayAnswerChange = (questionIndex, newAnswers) => {
    if (!isCompleted) {
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
          
          {isCompleted && (
            <View style={styles.completedInfoBox}>
              <Text style={styles.completedInfoTitle}>
                Assessment Completed!
              </Text>
              <Text style={styles.completedInfoText}>
                You have successfully submitted this assessment. Your answers are saved and cannot be modified.
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
                {isCompleted && showCorrectAnswers && (
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
                  
                  if (isCompleted && showCorrectAnswers) {
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
                        opacity: isCompleted ? 0.7 : 1,
                      }}
                      onPress={() => handleAnswer(choice)}
                      disabled={isCompleted}
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
                
                {isCompleted && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
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
                  
                  if (isCompleted && showCorrectAnswers) {
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
                        opacity: isCompleted ? 0.7 : 1,
                      }}
                      onPress={() => handleAnswer(option)}
                      disabled={isCompleted}
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
                    isCompleted && styles.disabledElement,
                    isCompleted && showCorrectAnswers && (
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
                  editable={!isCompleted}
                />
                {isCompleted && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
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
                onAnswerChange={handleArrayAnswerChange}
                answers={answers}
                isCompleted={isCompleted}
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
        {isCompleted && showCorrectAnswers && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>
             Assessment Results Summary
            </Text>
            
            {(() => {
              const totalQuestions = questions.length;
              const correctCount = questions.filter((question, index) => 
                isAnswerCorrect(question, index, answers[index])
              ).length;
              const score = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
              
              return (
                <>
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Total Questions:</Text>
                    <Text style={styles.summaryValue}>{totalQuestions}</Text>
                  </View>
                  
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Correct Answers:</Text>
                    <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>{correctCount}</Text>
                  </View>
                  
                  <View style={styles.summaryStat}>
                    <Text style={styles.summaryLabel}>Incorrect Answers:</Text>
                    <Text style={[styles.summaryValue, { color: '#D32F2F' }]}>{totalQuestions - correctCount}</Text>
                  </View>
                  
                  <View style={styles.scoreContainer}>
                    <Text style={styles.scoreText}>Score: {score}%</Text>
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
        ) : (
          <TouchableOpacity
            style={{
              backgroundColor: isCompleted ? '#9E9E9E' : '#046a38',
              padding: 18,
              borderRadius: 12,
              alignItems: 'center',
              marginTop: 20,
              marginBottom: 40,
              opacity: (isSubmitting || isCompleted) ? 0.7 : 1,
            }}
            onPress={submitQuiz}
            disabled={isSubmitting || isCompleted}
          >
            <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600' }}>
              {isCompleted 
                ? '✓ Quiz Completed' 
                : isSubmitting 
                  ? 'Submitting...' 
                  : 'Submit Assessment'
              }
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
});

export default QuizDetails;