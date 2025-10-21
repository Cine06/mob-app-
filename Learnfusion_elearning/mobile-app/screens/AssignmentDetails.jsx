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

  useEffect(() => {
    if (!assessmentId || !assignedAssessmentId) {
      setError('Missing assignment parameters.');
      setLoading(false);
      return;
    }
    
    const initialize = async () => {
      const userData = await getUserData();
      await fetchAssignmentData();
      await checkAssignmentCompletion(userData);
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
    } catch (err) {
      console.error('Error fetching assignment data:', err);
      setError('Failed to load assignment data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const checkAssignmentCompletion = async (currentUser) => {
    try {
      if (!currentUser || !currentUser.id || !assignedAssessmentId) return;

      const { data: takeData, error: takeError } = await supabase
        .from('student_assessments_take')
        .select('id, score')
        .eq('assigned_assessments_id', assignedAssessmentId)
        .eq('users_id', currentUser.id)
        .single();

      if (takeError || !takeData) return;

      setSubmissionScore(takeData.score);

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
      console.error('Error checking assignment completion:', error);
    }
  };

  const handleArrayAnswerChange = (questionIndex, newAnswers) => {
    if (!isCompleted) {
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
    if (!isCompleted) {
      setAnswers({ ...answers, [currentQuestionIndex]: answer });
    }
  };

  const handleSubmit = async () => {
    if (!user || !assignmentData || !assignedData) {
      Alert.alert('Error', 'Missing required data to submit.');
      return;
    }

    if (isCompleted) {
      Alert.alert('Assignment Already Completed', 'You have already submitted this assignment.');
      return;
    }

    const questions = parseQuestions();
    const unansweredQuestions = questions.filter((_, index) => {
      const answer = answers[index];
      if (!answer) return true;
      if (Array.isArray(answer)) return answer.some(a => !a || a.trim() === '');
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

      if (takeError) throw takeError;

      const answerPromises = Object.entries(answers).map(([questionIndex, answer]) => {
        return supabase.from('student_assessments_answer').insert({
          student_assessments_take_id: takeData.id.toString(),
          users_id: user.id,
          answer: JSON.stringify({
            questionIndex: parseInt(questionIndex),
            answer: answer
          })
        });
      });

      const answerResults = await Promise.all(answerPromises);
      const hasAnswerError = answerResults.some(result => result.error);

      if (hasAnswerError) throw new Error('Failed to save one or more answers.');

      // Check if there are any auto-gradable questions
      const autoGradableQuestions = questions.filter(q => q.activityType !== 'File Submission');
      let message = "Your submission has been received and is waiting for grading.";

      if (autoGradableQuestions.length > 0) {
        const correctAnswersCount = autoGradableQuestions.filter((q, i) => isAnswerCorrect(q, i, answers[i])).length;
        const totalAutoGradable = autoGradableQuestions.length;
        message = `You scored ${correctAnswersCount}/${totalAutoGradable} on the auto-graded items. The rest of your submission is waiting for grading.`;
      }
      
      setIsCompleted(true);
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
  if (isCompleted) return;

  try {
    const result = await DocumentPicker.getDocumentAsync({
      type: ['application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/x-java-source', 'text/plain'],
      copyToCacheDirectory: true,
    });

    if (result.canceled) return;

    const file = result.assets[0];
    const allowedTypes = ['.pdf', '.docx', '.java'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();

    if (!allowedTypes.includes(fileExtension)) {
      Alert.alert('Invalid File Type', 'Only .pdf, .docx, or .java allowed.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      Alert.alert('File Too Large', 'Max 5MB.');
      return;
    }

    setIsUploading(true);

    // ✅ Generate unique file name
    const uniqueFileName = `${user.id}/${Date.now()}-${file.name}`;

    // ✅ Read and upload
    const base64 = await FileSystem.readAsStringAsync(file.uri, { encoding: 'base64' });
    const fileData = decode(base64);

    const { data, error } = await supabase.storage
      .from('assignment-submissions')
      .upload(uniqueFileName, fileData, {
        contentType: file.mimeType,
        upsert: true,
      });

    if (error) throw error;

    handleAnswerChange({ path: data.path, name: file.name });

    Alert.alert('Success', `File "${file.name}" uploaded successfully.`);
  } catch (error) {
    console.error('Upload error:', error);
    Alert.alert('Upload Error', 'Failed to upload file.');
  } finally {
    setIsUploading(false);
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
          
          {isCompleted && hasAutoGradableQuestions && (
            <View style={styles.completedInfoBox}>
              <Text style={styles.completedInfoTitle}>Assignment Completed!</Text>
              <Text style={styles.completedInfoText}>
                You have successfully submitted this assignment. Your answers are saved and cannot be modified.
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
              {isCompleted && showCorrectAnswers && currentQuestion.activityType !== 'File Submission' && (
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
                        onPress={() => handleAnswerChange(choice)}
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
                        onPress={() => handleAnswerChange(option)}
                        disabled={isCompleted}
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
              if (isCompleted && showCorrectAnswers) {
                inputStyle.push(isCorrect ? styles.correctChoice : styles.incorrectChoice);
              }

              return (
                <>
                  <TextInput
                    style={[...inputStyle, isCompleted && styles.disabledElement]}
                    placeholder={isCompleted ? 'Answer submitted' : `Enter your ${currentQuestion.activityType.toLowerCase()}...`}
                    value={answers[currentQuestionIndex] || ''}
                    onChangeText={(text) => handleAnswerChange(text)}
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
            {currentQuestion.activityType === 'Matching' && currentQuestion.matchingPairs && (
              <MatchingQuestionAnswer
                question={currentQuestion}
                questionIndex={currentQuestionIndex}
                onAnswerChange={handleArrayAnswerChange}
                answers={answers[currentQuestionIndex]}
                isCompleted={isCompleted}
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
                  {isCompleted ? (
                    <View>
                      <TouchableOpacity 
                        style={styles.fileSubmissionContainer}
                        onPress={() => handleViewSubmittedFile(answers[currentQuestionIndex])}
                      >
                        <MaterialCommunityIcons name="file-check" size={24} color="#4CAF50" />
                        <Text style={styles.fileSubmissionText} numberOfLines={1}>
                          Submitted: {answers[currentQuestionIndex]?.name || 'File record not found.'}
                        </Text>
                        <MaterialCommunityIcons name="eye-outline" size={24} color="#2E7D32" style={{ marginLeft: 'auto' }} />
                      </TouchableOpacity>
                      {submissionScore !== null ? (
                        <View style={styles.gradeBox}>
                          <Text style={styles.gradeLabel}>Grade:</Text>
                          <Text style={styles.gradeValue}>{submissionScore}</Text>
                        </View>
                      ) : (
                        <View style={styles.waitingGradeBox}>
                          <Text style={styles.waitingGradeText}>Waiting for grading</Text>
                        </View>
                      )}
                    </View>
                  ) : (
                    <>
                      {answers[currentQuestionIndex]?.path ? (
                        <View style={styles.fileSubmissionContainer}>
                          <MaterialCommunityIcons name="file-check" size={24} color="#4CAF50" />
                          <Text style={styles.fileSubmissionText}>
                            Uploaded: {answers[currentQuestionIndex]?.name}
                          </Text>
                        </View>
                      ) : (
                        <TouchableOpacity style={styles.uploadButton} onPress={handleFilePick} disabled={isUploading}>
                          <MaterialCommunityIcons name="upload" size={22} color="#fff" />
                          <Text style={styles.uploadButtonText}>{isUploading ? 'Uploading...' : 'Upload File'}</Text>
                        </TouchableOpacity>
                      )}
                      <Text style={styles.uploadHint}>Allowed files: .java, .docx, .pdf (Max 5MB)</Text>
                    </>
                  )}
                </View>
                </>
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

        {isCompleted && (
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Results Summary</Text>
            {(() => {
              const autoGradableQuestions = questions.filter(q => q.activityType !== 'File Submission');
              const totalAutoGradable = autoGradableQuestions.length;
              const correctCount = autoGradableQuestions.filter((q, i) => isAnswerCorrect(q, i, answers[i])).length;

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
                      <Text style={styles.scoreText}>Final Grade: {submissionScore}</Text>
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

        {/* Submit Button */}
        <TouchableOpacity
          style={[styles.submitButton, (isSubmitting || isCompleted || isUploading) && styles.disabledButton]}
          onPress={handleSubmit}
          disabled={isSubmitting || isCompleted || isUploading}
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
  fileSubmissionContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#E8F5E8', padding: 15, borderRadius: 8, marginTop: 10 },
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
