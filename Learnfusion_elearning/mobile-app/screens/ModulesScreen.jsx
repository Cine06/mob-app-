import { View, Text, TouchableOpacity, ScrollView, Image, Linking, Modal, Animated, KeyboardAvoidingView, Platform, FlatList } from "react-native";
import { useState, useEffect, useRef } from "react";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import BottomNav from "../components/BottomNav";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../utils/supabaseClient";
import styles from "../styles/modules";
import DocumentModal from "../components/DocumentModal";
import AwesomeAlert from 'react-native-awesome-alerts';
import * as SecureStore from "expo-secure-store";
import { WebView } from "react-native-webview";;

export default function ELearningModules() {
  const router = useRouter();
  const { initialTab, itemId } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState("lessons"); 
  const [quizzes, setQuizzes] = useState([]);
  const [userSection, setUserSection] = useState(null);
  const [activeViewer, setActiveViewer] = useState(null);
  const [showAlert, setShowAlert] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    showConfirmButton: true,
    confirmText: "OK",
    onConfirmPressed: () => setShowAlert(false),
    showCancelButton: false,
  });


  const extractYouTubeVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    if (match && match[2] && match[2].length === 11) {
      return match[2];
    }
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      return url;
    }
    return null; 
  };


  const [assignments, setAssignments] = useState([]);
  const [currentLessonPage, setCurrentLessonPage] = useState(1);
  const [lessonProgress, setLessonProgress] = useState({});
  const [lessonNotes, setLessonNotes] = useState({});
  const [bookmarkedPages, setBookmarkedPages] = useState(new Set());
  const [lessonTimeSpent, setLessonTimeSpent] = useState({});
  const [currentPageStartTime, setCurrentPageStartTime] = useState(Date.now());
  const [showLessonSummary, setShowLessonSummary] = useState(false);
  const [lessonHandouts, setLessonHandouts] = useState([]);
  const [currentPageData, setCurrentPageData] = useState(null);
  const [documentViewerVisible, setDocumentViewerVisible] = useState(false);
  const [viewingDocument, setViewingDocument] = useState(null);


  const totalPages = lessonHandouts.length > 0 ? lessonHandouts.length : 1;


  const handlePreviousPage = () => {
    if (currentLessonPage > 1) {
      trackTimeSpent();
      setCurrentLessonPage(currentLessonPage - 1);
      setCurrentPageStartTime(Date.now());
    }
  };

  const handleNextPage = () => {
    if (currentLessonPage < totalPages) {
      if (isCurrentPageCompleted()) {
        trackTimeSpent();
        setCurrentLessonPage(currentLessonPage + 1);
        setCurrentPageStartTime(Date.now());

        if (!lessonProgress[currentLessonPage]?.completed) {
          updateLessonProgress(currentLessonPage);
        }
      } else {
        setAlertConfig({
          title: "Incomplete Page",
          message: "Please complete all interactive elements on this page before proceeding to the next page.",
          showConfirmButton: true,
          confirmText: "OK",
        });
        setShowAlert(true);
      }
    } else {
      setShowLessonSummary(true);
    }
  };

  const handlePageJump = (pageNumber) => {
    trackTimeSpent();
    setCurrentLessonPage(pageNumber);
    setCurrentPageStartTime(Date.now());
  };


  const trackTimeSpent = () => {
    const timeSpent = Date.now() - currentPageStartTime;
    setLessonTimeSpent(prev => ({
      ...prev,
      [currentLessonPage]: (prev[currentLessonPage] || 0) + timeSpent
    }));
  };

  const updateLessonProgress = async (pageNumber) => {
    try {
      const userJson = await SecureStore.getItemAsync("user");
      if (userJson) {
        const user = JSON.parse(userJson);
        const progressKey = `lesson_progress_${user.id}`;
        const currentProgress = await SecureStore.getItemAsync(progressKey);
        const progress = currentProgress ? JSON.parse(currentProgress) : {};

        progress[currentLessonPage] = {
          completed: true,
          completedAt: new Date().toISOString()
        };

        await SecureStore.setItemAsync(progressKey, JSON.stringify(progress));
        setLessonProgress(progress);
      }
    } catch (error) {
      console.error("Error updating lesson progress:", error);
    }
  };


  useEffect(() => {
    const loadLessonProgress = async () => {
      try {
        const userJson = await SecureStore.getItemAsync("user");
        if (userJson) {
          const user = JSON.parse(userJson);
          const progressKey = `lesson_progress_${user.id}`;
          const progress = await SecureStore.getItemAsync(progressKey);
          if (progress) {
            setLessonProgress(JSON.parse(progress));
          }
        }
      } catch (error) {
        console.error("Error loading lesson progress:", error);
      }
    };

    loadLessonProgress();
  }, []);

  const isCurrentPageCompleted = () => {
    return true;
  };




  const getCurrentPageData = async () => {
  const handout = lessonHandouts[currentLessonPage - 1];
  const userJson = await SecureStore.getItemAsync("user");
  const user = userJson ? JSON.parse(userJson) : null;

  if (!handout || !user) {
    return {
      id: currentLessonPage,
      title: `Page ${currentLessonPage}`,
      content: [{
        type: "section",
        iconName: "information",
        iconColor: "#666",
        title: "No Content Available",
        content: ["This page has no content available."]
      }]
    };
  }

  return {
    id: currentLessonPage,
    title: handout.handouts_title || `Page ${currentLessonPage}`,
    content: parseHandoutContent(handout)
  };
};

  const loadingAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (alertConfig.showProgress) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(loadingAnimation, {
            toValue: 1,
            duration: 1500,
            useNativeDriver: false,
          }),
          Animated.timing(loadingAnimation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      loadingAnimation.stopAnimation();
      loadingAnimation.setValue(0);
    }
  }, [alertConfig.showProgress]);

  useEffect(() => {
    const loadPageData = async () => {
      if (lessonHandouts.length > 0) {
        const data = await getCurrentPageData();
        setCurrentPageData(data);
      }
    };
    loadPageData();
  }, [currentLessonPage, lessonHandouts]);

  const parseHandoutContent = (handout) => {
  const content = [];

  if (handout.youtube_link) {
    content.push({
      type: "youtube-video",
      url: handout.youtube_link,
      title: "Instructional Video",
      description: "Watch this video to learn more about the topic."
    });
  }

  if (handout.file_attachments) {
    content.push({
      type: "file-section",
      url: handout.file_attachments,
      title: "Attached Document",
      description: "Please review the attached document for more details."
    });
  }

  if (!handout.youtube_link && !handout.file_attachments) {
    content.push({
      type: "section",
      iconName: "information-outline",
      iconColor: "#666",
      title: "No Content",
      content: ["This lesson page does not have any materials attached yet."]
    });
  }

  return content;
};


  useEffect(() => {
    const fetchQuizzes = async () => {
       try {
        const userJson = await SecureStore.getItemAsync("user");

        if (userJson) {
          const user = JSON.parse(userJson);
          const { data: userData, error: userError } = await supabase
            .from("users")
            .select("section_id")
            .eq("id", user.id)
            .single();

          if (userError) {
            console.error("Error fetching user section:", userError);
            return;
          }

          setUserSection(userData.section_id);
           const { data: assignedData, error: assignedError } = await supabase
             .from("assigned_assessments")
             .select("id, assessment_id, section_id, deadline")
             .eq("section_id", userData.section_id);

           if (assignedError) {
             console.error("Error fetching assigned assessments:", assignedError);
             return;
           }

           if (assignedData && assignedData.length > 0) {
             const assessmentIds = assignedData.map(item => item.assessment_id);
             const { data: assessmentsData, error: assessmentsError } = await supabase
               .from("assessments")
               .select("*")
               .in("id", assessmentIds)
               .eq("type", "Quiz");

             if (assessmentsError) {
               console.error("Error fetching assessments:", assessmentsError);
             } else {
               const combinedData = assignedData.filter(assigned => assessmentsData.some(a => a.id === assigned.assessment_id)).map(assigned => {
                 const assessment = assessmentsData.find(a => a.id === assigned.assessment_id);
                 const questions = assessment?.questions ? (typeof assessment.questions === 'string' ? JSON.parse(assessment.questions) : assessment.questions) : [];
                 assessment.questionCount = questions.length;
                 return { id: assigned.id, assessment_id: assigned.assessment_id, deadline: assigned.deadline, assessment };
               });


               assessmentsData.forEach((assessment, index) => {

                 if (assessment.questions) {
                   try {
                     const parsedQuestions = typeof assessment.questions === 'string'
                       ? JSON.parse(assessment.questions)
                       : assessment.questions;
                   } catch (e) {
                     console.error(`Error parsing questions for ${assessment.title}:`, e);
                   }
                 }
               });

               setQuizzes(combinedData);
             }
           } else {
             setQuizzes([]);
           }
        }
      } catch (error) {
        console.error("Error fetching assigned quizzes, falling back to all quizzes:", error);

        const { data, error: fallbackError } = await supabase.from("assessments").select("*").eq("type", "Quiz");

        if (fallbackError) {
          console.error("Error fetching fallback quizzes:", fallbackError);
        } else {
          setQuizzes(data);
        }
      }
    };


    const fetchAssignments = async () => {
      if (!userSection) return;
      try {
        const { data, error } = await supabase
          .from('assessments')
          .select(`
            id,
            title,
            description,
            type,
            questions,
            assigned_assessments (
              id,
              deadline,
              section_id
            )
          `)
          .eq('type', 'Assignment')
          .eq('assigned_assessments.section_id', userSection);

        if (error) {
          console.error("Error fetching assignments with join:", error);
          setAssignments([]);
          return;
        }

        const formattedAssignments = data
          .filter(assessment => assessment.assigned_assessments.length > 0)
          .map(assessment => {
            const assignedInfo = assessment.assigned_assessments[0];
            return {
              id: assignedInfo.id,
              assessment_id: assessment.id,
              deadline: assignedInfo.deadline,
              section_id: assignedInfo.section_id,
              assessment: { ...assessment, assigned_assessments: undefined }
            };
          });

        setAssignments(formattedAssignments);
      } catch (error) {
        console.error("Error fetching assigned assignments:", error);
        setAssignments([]);
      }
    };

    const fetchHandouts = async () => {
      if (!userSection) return;
      try {
        if (userSection) {
          const { data: taggedHandouts, error: tagError } = await supabase
            .from("handouts_tag_section")
            .select("handouts_id, section_id")
            .eq("section_id", userSection);

          if (tagError) {
            console.error("Error fetching tagged handouts:", tagError);
            return;
          }

          if (taggedHandouts && taggedHandouts.length > 0) {
            const handoutIds = taggedHandouts.map(tag => tag.handouts_id);
            const { data: handoutsData, error: handoutsError } = await supabase
              .from("handouts")
              .select("id, handouts_title, youtube_link, file_attachments, created_at")
              .in("id", handoutIds)
              .order("created_at", { ascending: true });

                         if (handoutsError) {
               console.error("Error fetching handouts:", handoutsError);
             } else {
               setLessonHandouts(handoutsData || []);
             }
          } else {
            setLessonHandouts([]);
          }
        }
      } catch (error) {
        console.error("Error fetching handouts:", error);
        setLessonHandouts([]);
      }
    };

    fetchQuizzes();
    fetchAssignments();
    fetchHandouts();
  }, [userSection]);

  useEffect(() => {
    if (initialTab) {
      setActiveTab(initialTab);
    }
    if (initialTab === 'lessons' && itemId && lessonHandouts.length > 0) {
      const pageIndex = lessonHandouts.findIndex(h => h.id.toString() === itemId);
      if (pageIndex !== -1) {
        setCurrentLessonPage(pageIndex + 1);
      }
    }
  }, [initialTab, itemId, lessonHandouts]);

  const handleFileOpen = async (fileUrl, fileName) => {
    try {
      console.log('Attempting to open file:', fileUrl);

      if (!fileUrl || fileUrl.trim() === '') {
        setAlertConfig({
          title: "Invalid URL",
          message: "The file URL is invalid or empty.",
        });
        setShowAlert(true);
        return;
      }

      const supported = await Linking.canOpenURL(fileUrl);
      if (supported) {
        await Linking.openURL(fileUrl);
      } else {
        setAlertConfig({
          title: "Cannot Open File",
          message: `Cannot open ${fileName} directly. The file may need to be downloaded first or you may need a specific app to view it.`,
        });
        setShowAlert(true);
      }
    } catch (error) {
      console.error('Error opening file:', error);
      setAlertConfig({
        title: `Error opening ${fileName}`,
        message: error.message,
      });
      setShowAlert(true);
    }
  };

  const closeDocumentViewer = () => {
    setDocumentViewerVisible(false);
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.container}>
        <View style={styles.header}>
          <Image source={require("../assets/icclogo.png")} style={styles.logo} />
          <Text style={styles.headerText}>INTERFACE COMPUTER COLLEGE</Text>
        </View>

        <View style={styles.contentWrapper}>
          <View style={styles.sideTab}>
            <TouchableOpacity style={[styles.sideTabItem, activeTab === "lessons" && styles.activeTab]}
              onPress={() => setActiveTab("lessons")}>
              <Icon name="book-open-variant" size={30} color={activeTab === "lessons" ? "#046a38" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sideTabItem, activeTab === "assignments" && styles.activeTab]}
              onPress={() => setActiveTab("assignments")}>
              <Icon name="clipboard-text" size={30} color={activeTab === "assignments" ? "#046a38" : "white"} />
            </TouchableOpacity>

            <TouchableOpacity style={[styles.sideTabItem, activeTab === "quizzes" && styles.activeTab]}
              onPress={() => setActiveTab("quizzes")}>
              <Icon name="trophy" size={30} color={activeTab === "quizzes" ? "#046a38" : "white"} />
            </TouchableOpacity>

          </View>

          <KeyboardAvoidingView 
            style={{ flex: 1, backgroundColor: 'white' }}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            keyboardVerticalOffset={Platform.OS === "ios" ? 64 : 0}
          >
            <View style={[styles.mainContent, { flex: 1 }]}>
              {activeTab === "lessons" && (
                <ScrollView contentContainerStyle={{ paddingBottom: 80 }} keyboardShouldPersistTaps="handled">

                <Text style={styles.title}>LESSONS</Text>

                {/* Show message if no handouts available */}
                {lessonHandouts.length === 0 && (
                  <View style={styles.noHandoutsMessage}>
                    <Icon name="information" size={40} color="#046a38" />
                    <Text style={styles.noHandoutsTitle}>No Handouts Available</Text>
                    <Text style={styles.noHandoutsDescription}>
                      There are no handouts available for this lesson yet.
                      Please contact your teacher to add lesson content.
                    </Text>
                  </View>
                )}
                
                {/* Lesson content is now integrated directly into the main view for a cleaner, larger appearance. */}
                
                {/* Enhanced Lesson Header with Progress */}
                {lessonHandouts.length > 0 && <>
                <View style={styles.lessonHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                        Page {currentLessonPage} of {totalPages}
                    </Text>
                    {alertConfig.showProgress ? (
                      <View style={styles.progressBar}>
                        <Animated.View style={[
                            styles.progressFill,
                            {
                              width: '100%',
                              transform: [{
                                translateX: loadingAnimation.interpolate({
                                  inputRange: [0, 1],
                                  outputRange: ['-100%', '100%'],
                                })
                              }],
                            }]}
                          />
                      </View>
                    ) : (
                      <View style={styles.progressBar}>
                        <View style={[ styles.progressFill, { width: `${(currentLessonPage / totalPages) * 100}%` }]} />
                      </View>
                    )}
                  </View>
                  
                  <View style={styles.lessonHeaderActions}>
                    {/* Download buttons were here */}
                  </View>

                </View>

                {/* Display the current page's title */}
                <Text style={styles.lessonSubtitle}>{currentPageData?.title || 'Loading...'}</Text>

                {/* Dynamic Content Area - Changed from ScrollView to View to avoid nested scrolling */}
                <View style={styles.lessonContentArea}>
                  {currentPageData?.content?.map((item, index) => {
                    switch (item.type) {
                        case "youtube-video":
                        return (
                          <View key={index} style={styles.contentCard}>
                            <View style={styles.contentCardHeader}>
                              <Icon name="youtube" size={24} color="#FF0000" />
                              <Text style={styles.contentCardTitle}>{item.title}</Text>
                            </View>
                            <Text style={styles.contentCardDescription}>{item.description}</Text>
                            <View style={styles.mediaContainer}>
                              <WebView
                                style={{ flex: 1, backgroundColor: '#000' }}
                                source={{
                                  html: `
                                    <!DOCTYPE html>
                                    <html>
                                    <head>
                                      <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
                                      <style>
                                        * { margin: 0; padding: 0; box-sizing: border-box; }
                                        body { background: #000; display: flex; align-items: center; justify-content: center; height: 100vh; overflow: hidden; }
                                        iframe { width: 100%; height: 100%; border: none; }
                                      </style>
                                    </head>
                                    <body>
                                      <iframe 
                                        src="https://www.youtube.com/embed/${extractYouTubeVideoId(item.url)}?rel=0&showinfo=0&controls=1&modestbranding=1"
                                        allowfullscreen
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                      ></iframe>
                                    </body>
                                    </html>
                                  `
                                }}
                                allowsFullscreenVideo={true}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}
                                onError={(syntheticEvent) => console.warn('YouTube WebView error: ', syntheticEvent.nativeEvent)}
                                renderError={(errorDomain, errorCode, errorDesc) => (
                                  <View style={styles.mediaErrorContainer}>
                                    <Icon name="alert-circle-outline" size={48} color="#666" />
                                    <Text style={styles.mediaErrorText}>Video Preview Unavailable</Text>
                                  </View>
                                )}
                              />
                            </View>
                            <TouchableOpacity
                              style={styles.mediaErrorButton}
                              onPress={() => Linking.openURL(item.url)}
                            >
                              <Icon name="youtube" size={20} color="#fff" />
                              <Text style={styles.mediaErrorButtonText}>Watch on YouTube</Text>
                            </TouchableOpacity>
                          </View>
                        );
                      
                      case "file-section":
                        const fileName = item.url.split('/').pop().split('?')[0];
                        return (
                          <TouchableOpacity
                          key={index}
                          style={[styles.contentCard, { marginBottom: 50 }]}
                          onPress={() => {
                            setViewingDocument({ ...item, title: currentPageData?.title });
                            setDocumentViewerVisible(true);
                          }}
                          >
                          <View style={[styles.contentCardHeader]}>
                            <Icon name="file-document-outline" size={24} color="#046a38" />
                            <Text style={styles.contentCardTitle}>{currentPageData?.title} </Text>
                          </View>
                          <Text style={styles.contentCardDescription}>{item.description}</Text>
                          <Text style={styles.viewFileText}>Tap to view: {currentPageData?.title}</Text>
                          </TouchableOpacity>
                        );
                      
                      default:
                        return null;
                    }
                  })}
                </View>
                </>}
                </ScrollView>
              )}

              {activeTab === "assignments" && (
                <>
                <Text style={styles.title}>ASSIGNMENTS</Text>
                  <FlatList
                    data={assignments}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        style={styles.assignmentItem}
                        onPress={() => {
                          router.push({
                            pathname: "/assignmentDetails",
                            params: {
                              assessmentId: item.assessment.id,
                              assignedAssessmentId: item.id,
                            }
                          });
                        }}
                      >
                        <View style={styles.assignmentContent}>
                          <Text style={styles.assignmentTitle}>{item.assessment.title || 'Untitled Assignment'}</Text>
                          <Text style={styles.assignmentDescription}>
                            {item.assessment.description || 'No description available'}
                          </Text>
                          <View style={styles.assignmentMeta}>
                            <Text style={styles.assignmentDeadline}>
                              Deadline: {item.deadline ? new Date(item.deadline).toLocaleDateString() : 'No deadline'}
                            </Text>
                          </View>
                        </View>
                        <Icon name="chevron-right" size={24} color="#046a38" />
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={() => (
                      <View style={styles.noAssignments}>
                        <Icon name="clipboard-check-outline" size={48} color="#ccc" />
                        <Text style={[styles.noAssignmentsText, { marginTop: 16 }]}>You're all caught up!
No assignments are currently available for your section.</Text>
                      </View>
                    )}
                  />
              </>
              )}

              {activeTab === "quizzes" && (
                <>
                <Text style={styles.title}>QUIZZES</Text>
                  <FlatList
                    data={quizzes}
                    contentContainerStyle={{ paddingBottom: 80 }}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={({ item: quiz }) => (
                      <TouchableOpacity
                        style={styles.quizItem}
                        onPress={() => {
                          router.push({
                            pathname: "/quizDetails",
                            params: {
                              assessmentId: quiz.assessment.id,
                              assignedAssessmentId: quiz.id
                            }
                          });
                        }}
                      >
                        <View style={styles.quizContent}>
                          <Text style={styles.quizTitle}>{quiz.assessment.title || 'Untitled Quiz'}</Text>
                          <Text style={styles.quizDescription}>
                            {quiz.assessment.description || 'No description available'}
                          </Text>
                          <View style={styles.quizMeta}>
                            <Text style={styles.quizDeadline}>
                              Deadline: {quiz.deadline ? new Date(quiz.deadline).toLocaleDateString() : 'No deadline'}
                            </Text>
                            <Text style={styles.quizType}>
                              {quiz.assessment.questionCount || 0} questions
                            </Text>
                          </View>
                        </View>
                        <Icon name="chevron-right" size={24} color="#046a38" />
                      </TouchableOpacity>
                    )}
                    ListEmptyComponent={() => (
                      <View style={styles.noQuizzes}>
                        <Icon name="trophy-outline" size={48} color="#ccc" />
                        <Text style={[styles.noQuizzesText, { marginTop: 16 }]}>No quizzes are available right now.
Check back later!</Text>
                      </View>
                    )}
                  />
                </>
              )}
            </View>

            {activeTab === "lessons" && lessonHandouts.length > 0 && (
              <View style={[styles.lessonNavigation, { paddingBottom: 75,paddingTop: 5, borderTopWidth: 1, borderTopColor: '#e9ecef' }]}>
                <TouchableOpacity
                  style={[styles.navButton, currentLessonPage === 1 && styles.disabledButton, {marginLeft: 10}]}
                  onPress={handlePreviousPage}
                  disabled={currentLessonPage === 1}
                >
                  <Icon name="chevron-left" size={24} color={currentLessonPage === 1 ? "#ccc" : "#fff"} />
                  <Text style={[styles.navButtonText, currentLessonPage === 1 && styles.disabledText]}></Text>
                </TouchableOpacity>

                <View style={styles.pageControls}>
                  {(() => {
                    const renderPageButton = (pageNumber) => (
                      <TouchableOpacity
                        key={pageNumber}
                        style={[
                          pageNumber === currentLessonPage ? styles.currentPage : styles.pageButton,
                          lessonProgress[pageNumber]?.completed && styles.completedPage
                        ]}
                        onPress={() => handlePageJump(pageNumber)}
                      >
                        <Text style={[
                          pageNumber === currentLessonPage ? styles.currentPageText : styles.pageButtonText,
                          lessonProgress[pageNumber]?.completed && styles.completedPageText
                        ]}>
                          {pageNumber}
                        </Text>
                      </TouchableOpacity>
                    );

                    if (totalPages <= 7) {
                      return Array.from({ length: totalPages }, (_, i) => renderPageButton(i + 1));
                    }

                    const pages = new Set([1, totalPages, currentLessonPage]);
                    if (currentLessonPage > 1) pages.add(currentLessonPage - 1);
                    if (currentLessonPage < totalPages) pages.add(currentLessonPage + 1);

                    const pageNumbers = Array.from(pages).sort((a, b) => a - b);
                    const renderedPages = [];
                    let lastPage = 0;
                    for (const page of pageNumbers) {
                      if (lastPage + 1 < page) renderedPages.push(<Text key={`ellipsis-${lastPage}`} style={styles.pageButtonText}>...</Text>);
                      renderedPages.push(renderPageButton(page));
                      lastPage = page;
                    }
                    return renderedPages;
                  })()}
                </View>

                <TouchableOpacity style={[styles.navButton, currentLessonPage === totalPages && styles.disabledButton, {marginRight:10}]} onPress={handleNextPage} disabled={currentLessonPage === totalPages}>
                  <Text style={[styles.navButtonText, currentLessonPage === totalPages && styles.disabledText]}></Text>
                  <Icon name="chevron-right" size={24} color={currentLessonPage === totalPages ? "#ccc" : "#fff"} />
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </View>

      <BottomNav />

      {/* Document Viewer Modal */}
      <DocumentModal
        visible={documentViewerVisible}
        document={viewingDocument}
        onClose={closeDocumentViewer}
      />

      {/* Lesson Summary Modal */}
      <Modal
        visible={showLessonSummary}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowLessonSummary(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.lessonSummaryModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}> Lesson Completed!</Text>
              <TouchableOpacity
                style={styles.closeModalButton}
                onPress={() => setShowLessonSummary(false)}
              >
                <Icon name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.summarySection}>
                <Text style={styles.summaryTitle}> Lesson Statistics</Text>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Pages:</Text>
                  <Text style={styles.statValue}>{totalPages}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Completed Pages:</Text>
                  <Text style={styles.statValue}>{Object.keys(lessonProgress).length}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Bookmarked Pages:</Text>
                  <Text style={styles.statValue}>{bookmarkedPages.size}</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Total Time Spent:</Text>
                  <Text style={styles.statValue}>
                    {Math.round(Object.values(lessonTimeSpent).reduce((a, b) => a + b, 0) / 1000 / 60)} minutes
                  </Text>
                </View>
              </View>

              <View style={styles.summarySection}>
                <Text style={styles.summaryTitle}>📝 Your Notes</Text>
                {Object.keys(lessonNotes).length > 0 ? (
                  Object.entries(lessonNotes).map(([page, note]) => (
                    <View key={page} style={styles.noteItem}>
                      <Text style={styles.notePage}>Page {page}:</Text>
                      <Text style={styles.noteText}>{note}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={styles.noNotesText}>No notes added yet</Text>
                )}
              </View>

              <View style={styles.summarySection}>
                <Text style={styles.summaryTitle}> Bookmarked Pages</Text>
                {bookmarkedPages.size > 0 ? (
                  <View style={styles.bookmarkList}>
                    {Array.from(bookmarkedPages).map(page => (
                      <View key={page} style={styles.bookmarkItem}>
                        <Icon name="bookmark" size={16} color="#ffc107" />
                        <Text style={styles.bookmarkText}>Page {page}</Text>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.noBookmarksText}>No pages bookmarked</Text>
                )}
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalButton}
                onPress={() => {
                  setShowLessonSummary(false);
                  setCurrentLessonPage(1);
                }}
              >
                <Text style={styles.modalButtonText}>Restart Lesson</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.primaryButton]}
                onPress={() => {
                  setShowLessonSummary(false);
                  router.push("/quizDetails");
                }}
              >
                <Text style={[styles.modalButtonText, styles.primaryButtonText]}>Take Quiz</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <AlertComponent
        showAlert={showAlert}
        setShowAlert={setShowAlert}
        alertConfig={alertConfig}
      />
    </>
  );
}

const AlertComponent = ({ showAlert, setShowAlert, alertConfig }) => (
  <AwesomeAlert
    show={showAlert}
    showProgress={alertConfig.showProgress || false}
    title={alertConfig.title}
    message={alertConfig.message}
    closeOnTouchOutside={!alertConfig.showProgress}
    closeOnHardwareBackPress={false}
    showCancelButton={alertConfig.showCancelButton || false}
    showConfirmButton={alertConfig.showConfirmButton === false ? false : true}
    cancelText={alertConfig.cancelText || "Cancel"}
    confirmText={alertConfig.confirmText || "OK"}
    confirmButtonColor="#046a38"
    onCancelPressed={alertConfig.onCancelPressed || (() => setShowAlert(false))}
    onConfirmPressed={alertConfig.onConfirmPressed || (() => setShowAlert(false))}
  />
);
