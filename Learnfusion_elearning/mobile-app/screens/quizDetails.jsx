import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import BottomNav from '../components/BottomNav';
import { supabase } from '../utils/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

function MatchingQuestionAnswer({ question, questionIndex, onAnswerChange, answers, isCompleted }) {
  const prompts = question.matchingPairs.map((p, i) => ({
    id: `prompt-${questionIndex}-${i}`,
    content: p.left,
  }));

  const initialChoices = question.matchingPairs.map((p, i) => ({
    id: `choice-${questionIndex}-${i}-${p.right.replace(/\W/g, '')}`,
    content: p.right,
  }));

  const [choicesInPool, setChoicesInPool] = useState(() => [...initialChoices]);
  const [slots, setSlots] = useState(() => Array(prompts.length).fill(null));

  const handleSlotChange = (slotIndex, choice) => {
    if (isCompleted) return;
    
    const newSlots = [...slots];
    newSlots[slotIndex] = choice;
    setSlots(newSlots);
    
    const newAnswers = newSlots.map(slot => slot ? slot.content : '');
    onAnswerChange(questionIndex, newAnswers);
  };

  return (
    <View style={{ marginBottom: 20 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 20 }}>
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10, color: '#046a38' }}>Prompts:</Text>
          {prompts.map((prompt, promptIndex) => (
            <View key={prompt.id} style={{ marginBottom: 15 }}>
              <Text style={{ marginBottom: 5, fontSize: 14, color: '#333' }}>{prompt.content}</Text>
              <View style={{
                borderWidth: 2,
                borderStyle: 'dashed',
                borderColor: '#cccccc',
                padding: 10,
                minHeight: 44,
                backgroundColor: slots[promptIndex] ? '#fffacd' : '#f9f9f9',
                borderRadius: 4,
                justifyContent: 'center',
                opacity: isCompleted ? 0.7 : 1,
              }}>
                {slots[promptIndex] ? (
                  <TouchableOpacity
                    style={{
                      padding: 8,
                      borderWidth: 1,
                      borderColor: '#cccccc',
                      backgroundColor: 'white',
                      borderRadius: 4,
                    }}
                    onPress={() => handleSlotChange(promptIndex, null)}
                    disabled={isCompleted}
                  >
                    <Text>{slots[promptIndex].content}</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={{ color: '#aaaaaa', fontSize: 14 }}>Select answer</Text>
                )}
              </View>
            </View>
          ))}
        </View>

        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 10, color: '#046a38' }}>Choices:</Text>
          <View style={{
            padding: 10,
            borderWidth: 2,
            borderStyle: 'dashed',
            borderColor: '#cccccc',
            minHeight: 120,
            backgroundColor: '#f9f9f9',
            borderRadius: 4,
            gap: 8,
            opacity: isCompleted ? 0.7 : 1,
          }}>
            {choicesInPool.map((choice, choiceIndex) => (
              <TouchableOpacity
                key={choice.id}
                style={{
                  padding: 8,
                  borderWidth: 1,
                  borderColor: '#cccccc',
                  backgroundColor: 'white',
                  borderRadius: 4,
                }}
                onPress={() => {
                  if (isCompleted) return;
                  const emptySlotIndex = slots.findIndex(slot => !slot);
                  if (emptySlotIndex !== -1) {
                    handleSlotChange(emptySlotIndex, choice);
                  }
                }}
                disabled={isCompleted}
              >
                <Text>{choice.content}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      </View>
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
    
    fetchQuizData();
    getUserData();
  }, [assessmentId, assignedAssessmentId]);

  useEffect(() => {
    if (quizData && assignedData) {
      checkQuizCompletion();
    }
  }, [quizData, assignedData]);

  const getUserData = async () => {
    try {
      const userData = await AsyncStorage.getItem('user');
      if (userData) {
        setUser(JSON.parse(userData));
      }
    } catch (error) {
      console.error('Error getting user data:', error);
    }
  };

  const checkQuizCompletion = async () => {
    try {
      if (!user || !user.id) return;

      const { data: takeData, error: takeError } = await supabase
        .from('student_assessments_take')
        .select('id')
        .eq('assigned_assessments_id', assignedData.id)
        .single();

      if (takeError || !takeData) return;

      const { data: answerData, error: answerError } = await supabase
        .from('student_assessments_answer')
        .select('answer')
        .eq('student_assessments_take_id', takeData.id)
        .eq('users_id', user.id);

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
      if (Array.isArray(answer)) {
        return answer.some(a => !a || a.trim() === '');
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
          created_at: new Date().toISOString()
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
              answer: Array.isArray(answer) ? answer.join(', ') : answer
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

      Alert.alert('Success', 'Assessment submitted successfully!', [
        { text: 'OK', onPress: () => router.push('/lessons') }
      ]);
      
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
    
    if (question.activityType === 'Matching' && Array.isArray(userAnswer)) {
      const userAnswerString = userAnswer.join(', ');
      return userAnswerString.toLowerCase().trim() === correctAnswer.toLowerCase().trim();
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
            }}
            onPress={() => router.push('/lessons')}
          >
            <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600' }}>Back to Lessons</Text>
          </TouchableOpacity>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: quizData.title || 'Assessment',
          headerStyle: { backgroundColor: '#046a38' },
          headerTintColor: '#fff',
        }} 
      />
      
      <ScrollView style={{ flex: 1, backgroundColor: '#f5f5f5', padding: 20 }}>
        {/* Quiz Header */}
        <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 }}>
            <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#046a38', flex: 1 }}>
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
            <View style={{ 
              backgroundColor: '#E8F5E8', 
              padding: 15, 
              borderRadius: 8, 
              marginTop: 15,
              borderLeftWidth: 4,
              borderLeftColor: '#4CAF50'
            }}>
              <Text style={{ color: '#2E7D32', fontSize: 14, fontWeight: '600' }}>
                Assessment Completed!
              </Text>
              <Text style={{ color: '#4CAF50', fontSize: 12, marginTop: 5 }}>
                You have successfully submitted this assessment. Your answers are saved and cannot be modified.
              </Text>
              
              <TouchableOpacity
                style={{
                  backgroundColor: showCorrectAnswers ? '#4CAF50' : '#046a38',
                  padding: 10,
                  borderRadius: 6,
                  marginTop: 10,
                  alignItems: 'center',
                }}
                onPress={() => setShowCorrectAnswers(!showCorrectAnswers)}
              >
                <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
                  {showCorrectAnswers ? 'Hide Correct Answers' : 'Show Correct Answers'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {/* Current Question */}
        {currentQuestion && (
          <View style={{ backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 }}>
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
              {isCompleted && showCorrectAnswers && (
                <Text style={{ 
                  fontSize: 16, 
                  fontWeight: 'bold',
                  color: isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) ? '#4CAF50' : '#D32F2F'
                }}>
                  {isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) ? '1/1' : '0/1'}
                </Text>
              )}
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
                      {isCompleted && showCorrectAnswers && isCorrectAnswer && (
                        <Text style={{ color: '#4CAF50', fontSize: 14, fontWeight: 'bold', marginLeft: 10 }}>
                          ✓
                        </Text>
                      )}
                      {isCompleted && showCorrectAnswers && isUserAnswer && !isUserCorrect && (
                        <Text style={{ color: '#D32F2F', fontSize: 14, fontWeight: 'bold', marginLeft: 10 }}>
                          ✗
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                
                {/* Show correct answer section for incorrect answers */}
                {isCompleted && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={{
                    marginTop: 15,
                    padding: 15,
                    backgroundColor: '#f9f9f9',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#e0e0e0'
                  }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: '#333', 
                      marginBottom: 10 
                    }}>
                      Correct answer
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: '#fff',
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#4CAF50'
                    }}>
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: '#4CAF50',
                        backgroundColor: '#4CAF50',
                        marginRight: 15,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                      </View>
                      <Text style={{ fontSize: 16, color: '#333', flex: 1 }}>
                        {getCorrectAnswer(currentQuestion, currentQuestionIndex)}
                      </Text>
                    </View>
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
                      {isCompleted && showCorrectAnswers && isCorrectAnswer && (
                        <Text style={{ color: '#4CAF50', fontSize: 12, fontWeight: 'bold', marginTop: 5 }}>
                          ✓
                        </Text>
                      )}
                      {isCompleted && showCorrectAnswers && isUserAnswer && !isUserCorrect && (
                        <Text style={{ color: '#D32F2F', fontSize: 12, fontWeight: 'bold', marginTop: 5 }}>
                          ✗
                        </Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
                
                {/* Show correct answer section for incorrect answers */}
                {isCompleted && showCorrectAnswers && !isAnswerCorrect(currentQuestion, currentQuestionIndex, answers[currentQuestionIndex]) && (
                  <View style={{
                    marginTop: 15,
                    padding: 15,
                    backgroundColor: '#f9f9f9',
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: '#e0e0e0'
                  }}>
                    <Text style={{ 
                      fontSize: 14, 
                      fontWeight: '600', 
                      color: '#333', 
                      marginBottom: 10 
                    }}>
                      Correct answer
                    </Text>
                    <View style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      padding: 12,
                      backgroundColor: '#fff',
                      borderRadius: 6,
                      borderWidth: 1,
                      borderColor: '#4CAF50'
                    }}>
                      <View style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        borderWidth: 2,
                        borderColor: '#4CAF50',
                        backgroundColor: '#4CAF50',
                        marginRight: 15,
                        justifyContent: 'center',
                        alignItems: 'center',
                      }}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#fff' }} />
                      </View>
                      <Text style={{ fontSize: 16, color: '#333', flex: 1 }}>
                        {getCorrectAnswer(currentQuestion, currentQuestionIndex)}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Short Answer / Fill in the Blanks */}
            {(currentQuestion.activityType === 'Short Answer' || currentQuestion.activityType === 'Fill in the Blanks') && (
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#ddd',
                  borderRadius: 8,
                  padding: 15,
                  fontSize: 16,
                  backgroundColor: isCompleted ? '#f5f5f5' : '#fff',
                  minHeight: 60,
                  textAlignVertical: 'top',
                  opacity: isCompleted ? 0.7 : 1,
                  marginBottom: 20,
                }}
                placeholder={isCompleted ? 'Answer submitted' : `Enter your ${currentQuestion.activityType.toLowerCase()}...`}
                value={answers[currentQuestionIndex] || ''}
                onChangeText={(text) => !isCompleted && handleAnswer(text)}
                multiline
                numberOfLines={3}
                editable={!isCompleted}
              />
            )}

            {/* Matching */}
            {currentQuestion.activityType === 'Matching' && currentQuestion.matchingPairs && (
              <MatchingQuestionAnswer
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                onAnswerChange={handleArrayAnswerChange}
                answers={answers}
                isCompleted={isCompleted}
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
                ? '✓ Assessment Completed' 
                : isSubmitting 
                  ? 'Submitting...' 
                  : 'Submit Assessment'
              }
            </Text>
          </TouchableOpacity>
        )}
        
        {isCompleted && (
          <View style={{ 
            backgroundColor: '#FFF3E0', 
            padding: 15, 
            borderRadius: 8, 
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: '#FF9800'
          }}>
            <Text style={{ color: '#E65100', fontSize: 14, fontWeight: '600' }}>
              Assessment Already Submitted
            </Text>
            <Text style={{ color: '#F57C00', fontSize: 12, marginTop: 5 }}>
              You cannot submit this assessment again. If you need to make changes, please contact your instructor.
            </Text>
          </View>
        )}

        {/* Assessment Results Summary */}
        {isCompleted && showCorrectAnswers && (
          <View style={{ 
            backgroundColor: '#F3E5F5', 
            padding: 20, 
            borderRadius: 12, 
            marginBottom: 20,
            borderLeftWidth: 4,
            borderLeftColor: '#9C27B0'
          }}>
            <Text style={{ color: '#7B1FA2', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'center' }}>
             Assessment Results Summary
            </Text>
            
            {(() => {
              const totalQuestions = questions.length;
              const correctAnswers = questions.filter((question, index) => 
                isAnswerCorrect(question, index, answers[index])
              ).length;
              const percentage = totalQuestions > 0 ? Math.round((correctAnswers / totalQuestions) * 100) : 0;
              
              return (
                <View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ color: '#4A148C', fontSize: 16, fontWeight: '600' }}>Total Questions:</Text>
                    <Text style={{ color: '#4A148C', fontSize: 16, fontWeight: '600' }}>{totalQuestions}</Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                    <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '600' }}>Correct Answers:</Text>
                    <Text style={{ color: '#4CAF50', fontSize: 16, fontWeight: '600' }}>{correctAnswers}</Text>
                  </View>
                  
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 15 }}>
                    <Text style={{ color: '#D32F2F', fontSize: 16, fontWeight: '600' }}>Incorrect Answers:</Text>
                    <Text style={{ color: '#D32F2F', fontSize: 16, fontWeight: '600' }}>{totalQuestions - correctAnswers}</Text>
                  </View>
                  
                  <View style={{ 
                    backgroundColor: percentage >= 70 ? '#E8F5E8' : percentage >= 50 ? '#FFF3E0' : '#FFEBEE',
                    padding: 15,
                    borderRadius: 8,
                    borderLeftWidth: 4,
                    borderLeftColor: percentage >= 70 ? '#4CAF50' : percentage >= 50 ? '#FF9800' : '#D32F2F'
                  }}>
                    <Text style={{ 
                      color: percentage >= 70 ? '#2E7D32' : percentage >= 50 ? '#E65100' : '#C62828',
                      fontSize: 18,
                      fontWeight: 'bold',
                      textAlign: 'center'
                    }}>
                      Score: {percentage}%
                    </Text>
                    <Text style={{ 
                      color: percentage >= 70 ? '#4CAF50' : percentage >= 50 ? '#F57C00' : '#D32F2F',
                      fontSize: 14,
                      textAlign: 'center',
                      marginTop: 5
                    }}>
                      {percentage >= 70 ? 'Excellent!' : percentage >= 50 ? 'Good job!' : 'Keep studying!'}
                    </Text>
                  </View>
                </View>
              );
            })()}
          </View>
        )}
      </ScrollView>
    </>
  );
};


export default QuizDetails;