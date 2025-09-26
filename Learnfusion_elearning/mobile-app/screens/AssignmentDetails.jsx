import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { supabase } from "../utils/supabaseClient";
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
 
  const [choicesInPool] = useState(() => [...initialChoices]);
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
    <View style={styles.matchingContainer}>
      <View style={styles.matchingColumn}>
        <Text style={styles.matchingHeader}>Prompts</Text>
        {prompts.map((prompt, promptIndex) => (
          <View key={prompt.id} style={styles.promptItem}>
            <Text style={styles.promptText}>{prompt.content}</Text>
            <View style={[styles.dropSlot, slots[promptIndex] && styles.filledSlot, isCompleted && styles.disabledElement]}>
              {slots[promptIndex] ? (
                <TouchableOpacity
                  style={styles.slotChoice}
                  onPress={() => handleSlotChange(promptIndex, null)}
                  disabled={isCompleted}
                >
                  <Text style={styles.slotChoiceText}>{slots[promptIndex].content}</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.slotPlaceholder}>Select answer</Text>
              )}
            </View>
          </View>
        ))}
      </View>
 
      <View style={styles.matchingColumn}>
        <Text style={styles.matchingHeader}>Choices</Text>
        <View style={[styles.choicesPool, isCompleted && styles.disabledElement]}>
          {prompts.map((prompt, promptIndex) => (
            <TouchableOpacity
              key={prompt.id}
              style={styles.choiceItem}
              onPress={() => {
                if (isCompleted) return;
                const emptySlotIndex = slots.findIndex(slot => !slot);
                if (emptySlotIndex !== -1) {
                  handleSlotChange(emptySlotIndex, choicesInPool[promptIndex]);
                }
              }}
              disabled={isCompleted}
            >
              <Text style={styles.choiceText}>{choicesInPool[promptIndex].content}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
    </View>
  );
}
 
export default function AssignmentDetails() {
  const router = useRouter();
  const { assessmentId, assignedAssessmentId } = useLocalSearchParams();
  const [assignmentData, setAssignmentData] = useState(null);
  const [assignedData, setAssignedData] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [completedAnswers, setCompletedAnswers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(false);
  const [error, setError] = useState(null);
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!assessmentId || !assignedAssessmentId) {
      setError('Missing assignment parameters.');
      setLoading(false);
      return;
    }
    
    fetchAssignmentData();
    getUserData();
  }, [assessmentId, assignedAssessmentId]);

  useEffect(() => {
    if (assignmentData && assignedData && user) {
      checkAssignmentCompletion();
    }
  }, [assignmentData, assignedData, user]);

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
        setError('Assignment not found.');
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

      if (assessment.questions) {
        const questions = typeof assessment.questions === 'string'
          ? JSON.parse(assessment.questions)
          : assessment.questions;
        setAnswers(new Array(questions.length).fill(''));
      }

    } catch (err) {
      console.error('Error fetching assignment data:', err);
      setError('Failed to load assignment data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAssignmentCompletion = async () => {
    try {
      const { data: takes, error: takesError } = await supabase
        .from('student_assessments_take')
        .select('id')
        .eq('assigned_assessments_id', assignedData.id);

      if (takesError || !takes || takes.length === 0) return;

      const takeIds = takes.map(t => t.id);
      const { data: answersData, error: answersError } = await supabase
        .from('student_assessments_answer')
        .select('answer')
        .in('student_assessments_take_id', takeIds)
        .eq('users_id', user.id);

      if (!answersError && answersData && answersData.length > 0) {
        setIsCompleted(true);
        const finalAnswers = answersData.map(a => a.answer);
        setCompletedAnswers(finalAnswers);
        setAnswers(finalAnswers);
      }
    } catch (error) {
      console.error('Error checking assignment completion:', error);
    }
  };

  const handleAnswerChange = (questionIndex, value) => {
    const newAnswers = [...answers];
    newAnswers[questionIndex] = value;
    setAnswers(newAnswers);
  };

  const handleArrayAnswerChange = (questionIndex, newAnswers) => {
    const updatedAnswers = [...answers];
    updatedAnswers[questionIndex] = newAnswers;
    setAnswers(updatedAnswers);
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
          return question.matchingPairs.map(pair => pair.right);
        }
        return question.correctAnswer || question.answer;
      default:
        return question.correctAnswer || question.answer;
    }
  };

  const isAnswerCorrect = (question, userAnswer) => {
    const correctAnswer = getCorrectAnswer(question);
    if (correctAnswer === null || correctAnswer === undefined || userAnswer === null || userAnswer === undefined) return false;
    
    if (question.activityType === 'Matching') {
      if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
        if (userAnswer.length !== correctAnswer.length) return false;
        return userAnswer.every((ans, i) => ans.toLowerCase().trim() === correctAnswer[i].toLowerCase().trim());
      }
      return false;
    }
    return userAnswer.toString().toLowerCase().trim() === correctAnswer.toString().toLowerCase().trim();
  };

  const handleSubmit = async () => {
    if (!assignmentData || !assignedData) return;

    if (isCompleted) {
      Alert.alert(
        'Assignment Already Completed', 
        'You have already submitted this assignment. You cannot submit it again.',
        [{ text: 'OK' }]
      );
      return;
    }

    const unansweredQuestions = answers.filter(answer => 
      !answer || (Array.isArray(answer) && answer.some(a => !a))
    );

    if (unansweredQuestions.length > 0) {
      Alert.alert('Incomplete', 'Please answer all questions before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      if (!user || !user.id) {
        Alert.alert('Authentication Error', 'User data not found. Please log in again.');
        return;
      }

      const { data: takeData, error: takeError } = await supabase
        .from('student_assessments_take')
        .insert([{
          assigned_assessments_id: assignedData.id, 
        }])
        .select('id') 
        .single();

      if (takeError) {
        console.error('Error creating assessment take record:', takeError);
        Alert.alert('Error', 'Failed to create assessment record. Please try again.');
        return;
      }

      const answerRecords = answers.map((answer, index) => ({
        student_assessments_take_id: takeData.id, 
        users_id: user.id,
        answer: Array.isArray(answer) ? answer.join(', ') : answer,
      }));

      const { error: answersError } = await supabase
        .from('student_assessments_answer')
        .insert(answerRecords);

      if (answersError) {
        console.error('Error saving answers:', answersError);
        Alert.alert('Error', 'Failed to save answers. Please try again.');
        return;
      }

      Alert.alert('Success', 'Assignment submitted successfully!', [
        { text: 'OK', onPress: () => router.back() }
      ]);

    } catch (error) {
      console.error('Error submitting assignment:', error);
      Alert.alert('Error', 'Failed to submit assignment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
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
        <TouchableOpacity onPress={() => router.back()} style={{ marginTop: 20, padding: 10, backgroundColor: '#046a38', borderRadius: 5 }}>
          <Text style={{ color: '#fff' }}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }
 
  if (!assignmentData || !assignedData) {
    return <View style={styles.centered}><Text>Assignment not found.</Text></View>;
  }
 
  const questions = assignmentData.questions
    ? (typeof assignmentData.questions === 'string'
        ? JSON.parse(assignmentData.questions)
        : assignmentData.questions)
    : [];

  return (
    <>
      <Stack.Screen 
        options={{ 
          headerShown: true, 
          title: ' ',
          headerStyle: { backgroundColor: '#046a38' },
          headerTintColor: '#fff',
        }} 
      />
      
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
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
              <Text style={styles.deadlineText}>
                Deadline: {new Date(assignedData.deadline).toLocaleDateString()}
              </Text>
            )}
          </View>
          
          {isCompleted && (
            <View style={styles.completedInfoBox}>
              <Text style={styles.completedInfoTitle}>Assignment Completed!</Text>
              <Text style={styles.completedInfoText}>
                You have successfully submitted this assignment. Your answers are saved and cannot be modified.
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

        {/* Questions */}
        {questions.map((question, index) => (
          <View key={index} style={styles.card}>
            <View style={styles.questionHeaderContainer}>
              {isCompleted && showCorrectAnswers && (
                 <Text style={[styles.feedbackIcon, isAnswerCorrect(question, answers[index]) ? styles.correctIcon : styles.incorrectIcon]}>
                   {isAnswerCorrect(question, answers[index]) ? '✓' : '✗'}
                 </Text>
              )}
              <Text style={styles.questionHeader}>
                Question {index + 1} ({question.activityType})
              </Text>
            </View>
            
            <Text style={styles.questionText}>{question.question}</Text>

              {/* Multiple Choice */}
             {question.activityType === 'Multiple Choice' && question.choices && (
               <View>
                  {question.choices.map((choice, choiceIndex) => {
                    const isUserAnswer = answers[index] === choice;
                    const correctAnswer = getCorrectAnswer(question);
                    const isCorrectChoice = correctAnswer === choice;

                    let choiceStyle = [styles.choiceButton];
                    if (isCompleted && showCorrectAnswers) {
                      if (isCorrectChoice) {
                        choiceStyle.push(styles.correctChoice);
                      } else if (isUserAnswer && !isCorrectChoice) {
                        choiceStyle.push(styles.incorrectChoice);
                      }
                    } else if (isUserAnswer) {
                      choiceStyle.push(styles.selectedChoice);
                    }

                    return (
                      <TouchableOpacity
                        key={choiceIndex}
                        style={[...choiceStyle, isCompleted && styles.disabledElement]}
                        onPress={() => !isCompleted && handleAnswerChange(index, choice)}
                        disabled={isCompleted}
                      >
                        <View style={[styles.radioCircle, isUserAnswer && styles.selectedRadio]}>
                          {isUserAnswer && <View style={styles.radioInnerCircle} />}
                        </View>
                        <Text style={styles.choiceText}>{choice}</Text>
                        {isCompleted && showCorrectAnswers && isCorrectChoice && <Text style={styles.feedbackIconSmall}>✓</Text>}
                      </TouchableOpacity>
                    );
                  })}
                </View>
            )}

             {/* True or False */}
             {question.activityType === 'True or False' && (
               <View style={styles.trueFalseContainer}>
                  {['True', 'False'].map((option) => {
                    const isUserAnswer = answers[index] === option;
                    const correctAnswer = getCorrectAnswer(question);
                    const isCorrectChoice = correctAnswer === option;

                    let buttonStyle = [styles.trueFalseButton];
                    if (isCompleted && showCorrectAnswers) {
                      if (isCorrectChoice) {
                        buttonStyle.push(styles.correctChoice);
                      } else if (isUserAnswer && !isCorrectChoice) {
                        buttonStyle.push(styles.incorrectChoice);
                      }
                    } else if (isUserAnswer) {
                      buttonStyle.push(styles.selectedChoice);
                    }

                    return (
                      <TouchableOpacity
                        key={option}
                        style={[...buttonStyle, isCompleted && styles.disabledElement]}
                        onPress={() => !isCompleted && handleAnswerChange(index, option)}
                        disabled={isCompleted}
                      >
                        <Text style={[styles.trueFalseText, isUserAnswer && styles.selectedTrueFalseText]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
            )}

              {/* Short Answer / Fill in the Blanks */}
            {(question.activityType === 'Short Answer' || question.activityType === 'Fill in the Blanks') && (() => {
              const isCorrect = isAnswerCorrect(question, answers[index]);
              const correctAnswer = getCorrectAnswer(question);
              let inputStyle = [styles.textInput];
              if (isCompleted && showCorrectAnswers) {
                inputStyle.push(isCorrect ? styles.correctChoice : styles.incorrectChoice);
              }

              return (
                <>
                  <TextInput
                    style={[...inputStyle, isCompleted && styles.disabledElement]}
                    placeholder={isCompleted ? 'Answer submitted' : `Enter your ${question.activityType.toLowerCase()}...`}
                    value={answers[index] || ''}
                    onChangeText={(text) => !isCompleted && handleAnswerChange(index, text)}
                    multiline
                    numberOfLines={3}
                    editable={!isCompleted}
                  />
                  {isCompleted && showCorrectAnswers && !isCorrect && (
                    <View style={styles.correctAnswerBox}>
                      <Text style={styles.correctAnswerLabel}>Correct Answer:</Text>
                      <Text style={styles.correctAnswerText}>{correctAnswer}</Text>
                    </View>
                  )}
                </>
              );
            })()}

            {/* Matching */}
            {question.activityType === 'Matching' && question.matchingPairs && (
              <MatchingQuestionAnswer
                question={question}
                questionIndex={index}
                onAnswerChange={handleArrayAnswerChange}
                answers={answers[index]}
                isCompleted={isCompleted}
                showCorrectAnswers={showCorrectAnswers}
              />
            )}
          </View>
        ))}

        {isCompleted && showCorrectAnswers && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Results Summary</Text>
            {(() => {
              const totalQuestions = questions.length;
              const correctCount = questions.filter((q, i) => isAnswerCorrect(q, answers[i])).length;
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
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || isCompleted) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isSubmitting || isCompleted}
        >
          <Text style={styles.submitButtonText}>
            {isCompleted 
              ? '✓ Assignment Completed' 
              : isSubmitting 
                ? 'Submitting...' 
                : 'Submit Assignment'
            }
          </Text>
        </TouchableOpacity>
        
        {isCompleted && (
          <View style={styles.warningBox}>
            <Text style={styles.warningTitle}>Assignment Already Submitted</Text>
            <Text style={styles.warningText}>
              You cannot submit this assignment again. If you need to make changes, please contact your instructor.
            </Text>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  scrollContent: { padding: 20 },
  card: { backgroundColor: '#fff', padding: 20, borderRadius: 12, marginBottom: 20, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 4, elevation: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 15 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#046a38', flex: 1 ,paddingTop:5},
  doneBadge: { backgroundColor: '#4CAF50', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, marginLeft: 10 },
  doneBadgeText: { color: '#fff', fontSize: 12, fontWeight: 'bold' },
  description: { fontSize: 16, color: '#666', marginBottom: 15, lineHeight: 24 },
  detailsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  detailText: { fontSize: 14, color: '#666' },
  deadlineText: { fontSize: 14, color: '#D32F2F', fontWeight: '500' },
  completedInfoBox: { backgroundColor: '#E8F5E8', padding: 15, borderRadius: 8, marginTop: 15, borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
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
  matchingContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 20, marginBottom: 20 },
  matchingColumn: { flex: 1 },
  matchingHeader: { fontWeight: 'bold', marginBottom: 10, color: '#046a38', fontSize: 16 },
  promptItem: { marginBottom: 15 },
  promptText: { marginBottom: 5, fontSize: 14, color: '#333' },
  dropSlot: { borderWidth: 2, borderStyle: 'dashed', borderColor: '#cccccc', padding: 10, minHeight: 44, backgroundColor: '#f9f9f9', borderRadius: 4, justifyContent: 'center' },
  filledSlot: { backgroundColor: '#fffacd' },
  slotChoice: { padding: 8, borderWidth: 1, borderColor: '#cccccc', backgroundColor: 'white', borderRadius: 4 },
  slotChoiceText: { fontSize: 14 },
  slotPlaceholder: { color: '#aaaaaa', fontSize: 14 },
  choicesPool: { padding: 10, borderWidth: 2, borderStyle: 'dashed', borderColor: '#cccccc', minHeight: 120, backgroundColor: '#f9f9f9', borderRadius: 4, gap: 8 },
  choiceItem: { padding: 8, borderWidth: 1, borderColor: '#cccccc', backgroundColor: 'white', borderRadius: 4 },
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
});
