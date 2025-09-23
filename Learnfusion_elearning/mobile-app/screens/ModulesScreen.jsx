import { View, Text, TouchableOpacity, ScrollView, Image, Linking, Modal } from "react-native";
import { useState,useEffect } from "react";
import { useRouter, Stack, useLocalSearchParams } from "expo-router";
import BottomNav from "../components/BottomNav";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import { supabase } from "../utils/supabaseClient";
import styles from "../styles/modules";
import AsyncStorage from '@react-native-async-storage/async-storage';
import AwesomeAlert from 'react-native-awesome-alerts';
import { WebView } from "react-native-webview";
import { legacy as FileSystem } from 'expo-file-system';

export default function ELearningModules() {
  const router = useRouter();
  const { initialTab, itemId } = useLocalSearchParams();
  const [activeTab, setActiveTab] = useState("lessons"); 
  const [quizzes, setQuizzes] = useState([]);
  const [handouts, setHandouts] = useState([]);
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
    if (!url) {
      console.log('No URL provided');
      return null;
    }
    
    console.log('Extracting video ID from URL:', url);
    
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    
    if (match && match[2] && match[2].length === 11) {
      console.log('Extracted video ID:', match[2]);
      return match[2];
    }
    
    if (url.length === 11 && /^[a-zA-Z0-9_-]+$/.test(url)) {
      console.log('Using direct video ID:', url);
      return url;
    }
    
    const altPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/v\/([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    
    for (const pattern of altPatterns) {
      const altMatch = url.match(pattern);
      if (altMatch && altMatch[1] && altMatch[1].length === 11) {
        console.log('Extracted video ID with alt pattern:', altMatch[1]);
        return altMatch[1];
      }
    }
    
    console.log('Could not extract video ID from URL:', url);
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
  const [downloadedPages, setDownloadedPages] = useState({});

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

  const isCurrentPageCompleted = () => {
    const currentPageData = getCurrentPageData();
    return true;
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
      const user = JSON.parse(await AsyncStorage.getItem("user"));
      if (user) {
        const progressKey = `lesson_progress_${user.id}`;
        const currentProgress = await AsyncStorage.getItem(progressKey);
        const progress = currentProgress ? JSON.parse(currentProgress) : {};
        
        progress[currentLessonPage] = {
          completed: true,
          completedAt: new Date().toISOString()
        };
        
        await AsyncStorage.setItem(progressKey, JSON.stringify(progress));
        setLessonProgress(progress);
      }
    } catch (error) {
      console.error("Error updating lesson progress:", error);
    }
  };

  const handleDownloadPage = async (pageNumber) => {
    const pageData = getCurrentPageData();
    if (!pageData || !pageData.content || pageData.content.length === 0) {
      setAlertConfig({
        title: "Nothing to Download",
        message: "This page has no downloadable content.",
      });
      setShowAlert(true);
      return;
    }

    if (downloadedPages[pageNumber]) {
      setAlertConfig({
        title: "Already Downloaded",
        message: "This page is already saved for offline access.",
        showConfirmButton: true,
        confirmText: "OK",
        onConfirmPressed: () => setShowAlert(false),
      });
      setShowAlert(true);
      return;
    }
    
    setAlertConfig({
      title: "Download for Offline",
      message: "Do you want to save this page for offline access?",
      showCancelButton: true,
      showConfirmButton: true,
      confirmText: "Download",
      cancelText: "Cancel",
      onCancelPressed: () => setShowAlert(false),
      onConfirmPressed: () => {
        setShowAlert(false); 
        setTimeout(() => downloadAndSavePage(pageNumber, pageData), 200);
      },
    });
    setShowAlert(true);
  };

 const downloadAndSavePage = async (pageNumber, pageData) => {
    const pageDirectory = `${FileSystem.documentDirectory}offline_page_${pageNumber}/`;

    try {
      setShowAlert(true);
      setAlertConfig({ title: "Downloading...", message: "Please wait...", showProgress: true, showConfirmButton: false });

      const dirInfo = await FileSystem.getInfoAsync(pageDirectory);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(pageDirectory, { intermediates: true });
      }

      const offlineContentPromises = pageData.content.map(async (item) => {
        if (item.type === "file-section" && item.url) {
          const fileUri = item.url;
          const fileName = fileUri.split('/').pop().split('?')[0]; 
          const localUri = pageDirectory + fileName;

          const fileInfo = await FileSystem.getInfoAsync(localUri);
          if (fileInfo.exists) {
            return { ...item, localUrl: localUri };
          }

          await FileSystem.downloadAsync(fileUri, localUri);
          return { ...item, localUrl: localUri };
        }
        return item;
      });

      const offlineContent = await Promise.all(offlineContentPromises);
      const offlinePageData = { ...pageData, content: offlineContent };

      const user = JSON.parse(await AsyncStorage.getItem("user"));
      if (user) {
        const offlineKey = `offline_lesson_${user.id}_${pageNumber}`;
        await AsyncStorage.setItem(offlineKey, JSON.stringify(offlinePageData));

        const newDownloadedPages = { ...downloadedPages, [pageNumber]: true };
        setDownloadedPages(newDownloadedPages);

        const downloadedPagesKey = `downloaded_pages_${user.id}`;
        await AsyncStorage.setItem(downloadedPagesKey, JSON.stringify(newDownloadedPages));

        setAlertConfig({
          title: "Download Complete",
          message: "This page is now available for offline access.",
          confirmText: "Great!",
          showProgress: false,
          showConfirmButton: true,
          onConfirmPressed: () => setShowAlert(false),
        });
      }
    } catch (error) {
      console.error("Error downloading page:", error);
      setAlertConfig({
        title: "Download Failed",
        message: "Could not save the page for offline access. Please check your connection and storage.",
        confirmText: "OK",
        showProgress: false,
        showConfirmButton: true,
        onConfirmPressed: () => setShowAlert(false),
      });
    }
  };


  useEffect(() => {
    const loadLessonProgress = async () => {
      try {
        const user = JSON.parse(await AsyncStorage.getItem("user"));
        if (user) {
          const progressKey = `lesson_progress_${user.id}`;
          const progress = await AsyncStorage.getItem(progressKey);
          if (progress) {
            setLessonProgress(JSON.parse(progress));
          }
          const downloadedPagesKey = `downloaded_pages_${user.id}`;
          const downloaded = await AsyncStorage.getItem(downloadedPagesKey);
          if (downloaded) {
            setDownloadedPages(JSON.parse(downloaded));
          }
        }
      } catch (error) {
        console.error("Error loading lesson progress:", error);
      }
    };
    
    loadLessonProgress();
  }, []);

  const getCurrentPageData = () => {
    if (lessonHandouts && lessonHandouts.length > 0) {
      const handout = lessonHandouts[currentLessonPage - 1]; 
      if (handout) {
        return {
          id: currentLessonPage,
          title: handout.handouts_title || `Page ${currentLessonPage}`,
          content: parseHandoutContent(handout)
        };
      }
    }
    
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
  };


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
        const user = JSON.parse(await AsyncStorage.getItem("user"));

        if (user) {
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
               const combinedData = assignedData.map(assigned => {
                 const assessment = assessmentsData.find(a => a.id === assigned.assessment_id);
                 return {
                   id: assigned.id, 
                   assessment_id: assigned.assessment_id,
                   deadline: assigned.deadline,
                   assessment: assessment || {}
                 };
               }).filter(item => item.assessment.id); 
               
               
               assessmentsData.forEach((assessment, index) => {
                 console.log(`Assessment ${index}:`, {
                   id: assessment.id,
                   title: assessment.title,
                   type: assessment.type,
                   questions: assessment.questions,
                   questionsType: typeof assessment.questions
                 });
                 
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
               setHandouts(handoutsData || []);
              
              setLessonHandouts(handoutsData);
             }
          } else {
            setHandouts([]);
            setLessonHandouts([]);
          }
        }
      } catch (error) {
        console.error("Error fetching handouts:", error);
        setHandouts([]);
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

            <TouchableOpacity style={[styles.sideTabItem, activeTab === "handouts" && styles.activeTab]}
              onPress={() => setActiveTab("handouts")}>
              <Icon name="file-document" size={30} color={activeTab === "handouts" ? "#046a38" : "white"} />
            </TouchableOpacity>

          </View>

          <View style={{ flex: 1, backgroundColor: 'white' }}>
            <ScrollView style={[styles.mainContent, { flexGrow: 1 }]}>
              {activeTab === "lessons" && (
                <>
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
                <View style={styles.lessonHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 14, color: '#666', marginBottom: 4 }}>
                        Page {currentLessonPage} of {totalPages}
                    </Text>
                    <View style={styles.progressBar}>
                      <View style={[
                          styles.progressFill, 
                          { width: `${(currentLessonPage / totalPages) * 100}%` }
                        ]} />
                    </View>
                  </View>
                  
                  <View style={styles.lessonHeaderActions}>
                    <TouchableOpacity
                      style={styles.lessonActionButton}
                      onPress={() => handleDownloadPage(currentLessonPage)}
                    >
                      <Icon
                        name="download"
                        size={24}
                        color={downloadedPages[currentLessonPage] ? "#4CAF50" : "#046a38"}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Display the current page's title */}
                <Text style={styles.lessonSubtitle}>{getCurrentPageData().title}</Text>

                {/* Dynamic Content Area - Changed from ScrollView to View to avoid nested scrolling */}
                <View style={styles.lessonContentArea}>
                  {getCurrentPageData().content.map((item, index) => {
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
                                style={{ flex: 1 }}
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
                                    <TouchableOpacity
                                      style={styles.mediaErrorButton}
                                      onPress={() => Linking.openURL(item.url)}
                                    >
                                      <Icon name="youtube" size={20} color="#fff" />
                                      <Text style={styles.mediaErrorButtonText}>Open in YouTube</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              />
                            </View>
                          </View>
                        );
                      
                      case "file-section":
                        return (
                          <View key={index} style={[styles.contentCard, { marginBottom: 50 }]}>
                            <View style={styles.contentCardHeader}>
                              <Icon name="file-document-outline" size={24} color="#046a38" />
                              <Text style={styles.contentCardTitle}>{item.title}</Text>
                            </View>
                            <Text style={styles.contentCardDescription}>{item.description}</Text>
                            <View style={styles.mediaContainer}>
                              <WebView
                                style={{ flex: 1 }}
                                source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(item.url)}` }}
                                javaScriptEnabled={true}
                                domStorageEnabled={true}
                                startInLoadingState={true}
                                onError={(syntheticEvent) => console.warn('PDF WebView error: ', syntheticEvent.nativeEvent)}
                                renderError={(errorDomain, errorCode, errorDesc) => (
                                  <View style={styles.mediaErrorContainer}>
                                    <Icon name="alert-circle-outline" size={48} color="#666" />
                                    <Text style={styles.mediaErrorText}>File Preview Unavailable</Text>
                                    <TouchableOpacity
                                      style={styles.mediaErrorButton}
                                      onPress={() => handleFileOpen(item.url, item.title)}
                                    >
                                      <Icon name="open-in-new" size={20} color="#fff" />
                                      <Text style={styles.mediaErrorButtonText}>Open File</Text>
                                    </TouchableOpacity>
                                  </View>
                                )}
                              />
                            </View>
                          </View>
                        );
                      
                      default:
                        return null;
                    }
                  })}
                </View>

                </>
              )}

              {activeTab === "assignments" && (
                <>
                <Text style={styles.title}>ASSIGNMENTS</Text>
                {assignments.length > 0 ? (
                  assignments.map((assignment, index) => (
                                         <TouchableOpacity 
                       key={index} 
                       style={styles.assignmentItem} 
                       onPress={() => {
                         router.push({
                           pathname: "/assignmentDetails",
                           params: { 
                             assessmentId: assignment.assessment.id,
                             assignedAssessmentId: assignment.id,
                           }
                         });
                       }}
                     >
                      <View style={styles.assignmentContent}>
                        <Text style={styles.assignmentTitle}>{assignment.assessment.title || 'Untitled Assignment'}</Text>
                        <Text style={styles.assignmentDescription}>
                          {assignment.assessment.description || 'No description available'}
                        </Text>
                        <View style={styles.assignmentMeta}>
                          <Text style={styles.assignmentDeadline}>
                            Deadline: {assignment.deadline ? new Date(assignment.deadline).toLocaleDateString() : 'No deadline'}
                          </Text>
                        </View>
                      </View>
                      <Icon name="chevron-right" size={24} color="#046a38" />
                    </TouchableOpacity>
                  ))
                ) : (
                  <View style={styles.noAssignments}>
                    <Text style={styles.noAssignmentsText}>No assignments available or your section</Text>
                  </View>
                )}
              </>
              )}

              {activeTab === "quizzes" && (
                <>
                <Text style={styles.title}>QUIZZES</Text>
                {quizzes.length > 0 ? (
                  quizzes.map((quiz, index) => {
                    
                    let questionCount = 0;
                    if (quiz.assessment?.questions) {
                      try {
                        const questions = typeof quiz.assessment.questions === 'string' 
                          ? JSON.parse(quiz.assessment.questions) 
                          : quiz.assessment.questions;
                        questionCount = questions ? questions.length : 0;
                      } catch (e) {
                        console.error(`Error parsing questions for rendering:`, e);
                        questionCount = 0;
                      }
                    }
                    
                    return (
                    <TouchableOpacity
                      key={index}
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
                            {(() => {
                              try {
                                const questions = typeof quiz.assessment.questions === 'string' 
                                  ? JSON.parse(quiz.assessment.questions) 
                                  : quiz.assessment.questions;
                                const count = questions ? questions.length : 0;
                                return `${count} questions`;
                              } catch (e) {
                                return '0 questions';
                              }
                            })()}
                          </Text>
                        </View>
                        
                      </View>
                      <Icon name="chevron-right" size={24} color="#046a38" />
                    </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.noQuizzes}>
                    <Text style={styles.noQuizzesText}>No quizzes available for your section</Text>
                  </View>
                )}
                </>
              )}

              {activeTab === "handouts" && (
                <>
                 <Text style={styles.title}>HANDOUTS</Text>
                 {handouts.length > 0 ? (
                   handouts.map((handout, index) => (
                     <View key={index} style={styles.handoutCard}>
                       {/* Handout Header Card */}
                       <View style={styles.handoutItem}>
                         <View style={styles.handoutContent}>
                           <Text style={styles.handoutTitle}>{handout.handouts_title}</Text>
                           <Text style={styles.handoutDate}>
                             {new Date(handout.created_at).toLocaleDateString()}
                           </Text>
                           
                                                       {handout.youtube_link && (
                              <TouchableOpacity 
                                style={styles.handoutLink}
                                onPress={() => Linking.openURL(handout.youtube_link)}
                              >
                                <Icon name="youtube" size={16} color="#FF0000" />
                                <Text style={styles.handoutLinkText}>YouTube Video</Text>
                                <Text style={styles.handoutLinkText}>(Tap to watch)</Text>
                              </TouchableOpacity>
                            )}
                            
                            {handout.file_attachments && (
                              <TouchableOpacity 
                                style={styles.handoutLink}
                                onPress={() => handleFileOpen(handout.file_attachments, handout.handouts_title)}
                              >
                                <Icon name="file-pdf-box" size={16} color="#D32F2F" />
                                <Text style={styles.handoutLinkText}>File Attachment</Text>
                                <Text style={styles.handoutLinkText}>(Tap to open)</Text>
                              </TouchableOpacity>
                            )}
                         </View>
                         
                         <TouchableOpacity
                           onPress={() => {
                             if (handout.youtube_link) {
                               setActiveViewer({ type: 'youtube', url: handout.youtube_link, title: handout.handouts_title });
                             } else if (handout.file_attachments) {
                               setActiveViewer({ type: 'file', url: handout.file_attachments, title: handout.handouts_title });
                             }
                           }}
                         >
                           {/* <Icon name="chevron-right" size={24} color="#046a38" /> */}
                         </TouchableOpacity>
                       </View>

                       {/* Enhanced Viewer Card Below - Only show when active */}
                       {activeViewer && activeViewer.title === handout.handouts_title && (
                         <View style={styles.viewerCard}>
                           <View style={styles.viewerCardHeader}>
                             <View style={styles.viewerCardTitleSection}>
                               <Icon 
                                 name={activeViewer.type === 'youtube' ? 'youtube' : 'file-pdf-box'} 
                                 size={24} 
                                 color={activeViewer.type === 'youtube' ? '#FF0000' : '#D32F2F'} 
                               />
                                                               <Text style={styles.viewerCardTitle}>
                                  {activeViewer.type === 'youtube' ? '' : 'File Attachment Viewer'}
                                </Text>
                             </View>
                             <TouchableOpacity 
                               style={styles.closeViewerButton}
                               onPress={() => setActiveViewer(null)}
                             >
                               <Icon name="close" size={20} color="#666" />
                             </TouchableOpacity>
                           </View>
                           
                           <View style={styles.viewerCardContent}>
                             {activeViewer.type === 'youtube' ? (
                               <View style={styles.youtubeCard}>
                                 <View style={styles.videoPlayerContainer}>
                                                                       <WebView
                                      style={{ width: '100%', height: 220 }}
                                      source={{ 
                                        html: `
                                          <!DOCTYPE html>
                                          <html>
                                          <head>
                                              <meta name="viewport" content="width=device-width, initial-scale=1.0">
                                              <style>
                                                  body { margin: 0; padding: 0; background: #000; }
                                                  .video-container { width: 100%; height: 100vh; display: flex; align-items: center; justify-content: center; }
                                                  iframe { width: 100%; height: 100%; border: none; }
                                              </style>
                                          </head>
                                          <body>
                                              <div class="video-container">
                                                  <iframe 
                                                      src="https://www.youtube.com/embed/${extractYouTubeVideoId(activeViewer.url)}?rel=0&showinfo=0&controls=1&modestbranding=1"
                                                      allowfullscreen
                                                      allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                  ></iframe>
                                              </div>
                                          </body>
                                          </html>
                                        `
                                      }}
                                     allowsFullscreenVideo={true}
                                     mediaPlaybackRequiresUserAction={false}
                                     javaScriptEnabled={true}
                                     domStorageEnabled={true}
                                     startInLoadingState={true}
                                     onError={(syntheticEvent) => {
                                       const { nativeEvent } = syntheticEvent;
                                       console.warn('WebView error: ', nativeEvent);
                                     }}
                                     onLoadEnd={() => console.log('YouTube video loaded')}
                                     onMessage={(event) => console.log('WebView message:', event.nativeEvent.data)}
                                   />
                                 </View>
                                 
                                 <View style={styles.videoInfo}>
                                   <Text style={styles.videoUrl}>{activeViewer.url}</Text>
                                   <View style={styles.videoButtons}>
                                     <TouchableOpacity 
                                       style={styles.openInYouTubeButton}
                                       onPress={() => Linking.openURL(activeViewer.url)}
                                     >
                                       <Icon name="youtube" size={16} color="#fff" />
                                       <Text style={styles.openInYouTubeText}>Open in YouTube App</Text>
                                     </TouchableOpacity>
                                     
                                     <TouchableOpacity 
                                       style={styles.openInBrowserButton}
                                       onPress={() => Linking.openURL(`https://www.youtube.com/watch?v=${extractYouTubeVideoId(activeViewer.url)}`)}
                                     >
                                       <Icon name="open-in-new" size={16} color="#fff" />
                                       <Text style={styles.openInBrowserText}>Open in Browser</Text>
                                     </TouchableOpacity>
                                   </View>
                                 </View>
                               </View>
                             ) : (
                               <View style={styles.fileCard}>
                                 <View style={styles.fileInfo}>
                                   <Icon name="file-pdf-box" size={40} color="#D32F2F" />
                                   <Text style={styles.fileName}>{handout.handouts_title}</Text>
                                 </View>
                                 
                                 {/* Inline PDF Viewer */}
                                 <View style={styles.inlinePdfContainer}>
                                   <WebView
                                     style={styles.inlinePdfViewer}
                                     source={{ 
                                       uri: activeViewer.url,
                                       headers: {
                                         'Accept': 'application/pdf',
                                       }
                                     }}
                                     javaScriptEnabled={true}
                                     domStorageEnabled={true}
                                     startInLoadingState={true}
                                     onError={(syntheticEvent) => {
                                       const { nativeEvent } = syntheticEvent;
                                       console.warn('Inline PDF WebView error: ', nativeEvent);
                                     }}
                                     onLoadEnd={() => console.log('Inline PDF loaded successfully')}
                                     renderError={(errorDomain, errorCode, errorDesc) => (
                                       <View style={styles.inlinePdfErrorContainer}>
                                         <Icon name="file-pdf-box" size={40} color="#D32F2F" />
                                         <Text style={styles.inlinePdfErrorText}>PDF Preview Not Available</Text>
                                   <TouchableOpacity 
                                           style={styles.inlineFallbackButton}
                                     onPress={() => handleFileOpen(activeViewer.url, handout.handouts_title)}
                                   >
                                           <Icon name="open-in-new" size={16} color="#fff" />
                                           <Text style={styles.inlineFallbackButtonText}>Open in External App</Text>
                                   </TouchableOpacity>
                                       </View>
                                     )}
                                   />
                                 </View>
                               </View>
                             )}
                           </View>
                         </View>
                       )}
                     </View>
                   ))
                 ) : (
                   <View style={styles.noHandouts}>
                     <Text style={styles.noHandoutsText}>No handouts available for your section</Text>
                   </View>
                 )}
                </>
              )}
            </ScrollView>

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
          </View>
        </View>
      </View>

      <BottomNav />

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
