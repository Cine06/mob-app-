import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";
import * as Speech from "expo-speech";
import Icon from "react-native-vector-icons/MaterialCommunityIcons";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import Constants from "expo-constants";
import axios from "axios";

const { API_URL } = Constants.expoConfig?.extra || {};
const CACHE_DIR = FileSystem.cacheDirectory + "docs/";

export default function DocumentModal({ visible, document, onClose, showSpeechControls = true }) {
  const [loading, setLoading] = useState(false);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const [isYouTubeVideo, setIsYouTubeVideo] = useState(false);
  const [isTextFile, setIsTextFile] = useState(false);
  const [textContent, setTextContent] = useState(null);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentTextPosition, setCurrentTextPosition] = useState(0);
  const [speechInterval, setSpeechInterval] = useState(null);
  const webviewRef = useRef(null);

  /** 🔹 Extract YouTube video ID **/
  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    const regExp =
      /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return match && match[2].length === 11 ? match[2] : null;
  };

  useEffect(() => {
    if (visible) {
      // Reset states on open
      setIsYouTubeVideo(false);
      setIsTextFile(false);
      setTextContent(null);
      setPages([]);

      const videoId = getYouTubeVideoId(document?.url);
      const isJavaFile = document?.url.toLowerCase().includes('.java');

      if (videoId) {
        setIsYouTubeVideo(true);
      } else if (isJavaFile) {
        setIsTextFile(true);
        // If it's a local file, read it directly. Otherwise, fetch it.
        if (document.url.startsWith('file://')) {
          FileSystem.readAsStringAsync(document.url)
            .then(setTextContent)
            .catch(err => {
              console.error("Failed to read local file content:", err);
              setTextContent("Error: Could not read local file.");
            });
        } else {
          axios.get(document.url, { transformResponse: [(data) => data] })
            .then(response => setTextContent(response.data))
            .catch(err => {
              console.error("Failed to fetch remote text content:", err);
              setTextContent("Error: Could not load file content.");
            });
        }
      } else {
        // Only extract text if speech controls are needed
        if (showSpeechControls) {
          loadOrExtract(document);
        } else {
          setPages([]); // Ensure pages are cleared if not extracting
        }
      }
    }
    return () => stopSpeech();
  }, [visible, document?.url, showSpeechControls]);

  /** 🔹 Ensure cache folder **/
  const ensureCacheDir = async () => {
    const dirInfo = await FileSystem.getInfoAsync(CACHE_DIR);
    if (!dirInfo.exists) {
      await FileSystem.makeDirectoryAsync(CACHE_DIR, { intermediates: true });
    }
  };

  /** 🔹 Cleanup old cache **/
  const cleanupOldCache = async () => {
    try {
      const files = await FileSystem.readDirectoryAsync(CACHE_DIR);
      if (files.length <= 5) return;
      const fileInfos = await Promise.all(
        files.map(async (file) => {
          const info = await FileSystem.getInfoAsync(CACHE_DIR + file);
          return { name: file, modTime: info.modificationTime || 0 };
        })
      );
      const sorted = fileInfos.sort((a, b) => a.modTime - b.modTime);
      const oldFiles = sorted.slice(0, files.length - 5);
      for (const file of oldFiles) {
        await FileSystem.deleteAsync(CACHE_DIR + file, { idempotent: true });
      }
    } catch (e) {
      console.warn("Cache cleanup error:", e);
    }
  };

  /** 🔹 Load or extract **/
  const loadOrExtract = async (doc) => {
    if (!doc?.url) return;
    setLoading(true);
    await ensureCacheDir();

    const safeFileName = doc.url.replace(/[^a-zA-Z0-9._-]/g, "_");
    const cacheFile = `${CACHE_DIR}${safeFileName}.json`;

    try {
      const cacheInfo = await FileSystem.getInfoAsync(cacheFile);
      if (cacheInfo.exists) {
        const cached = await FileSystem.readAsStringAsync(cacheFile);
        setPages(JSON.parse(cached));
        setLoading(false);
        cleanupOldCache();
        return;
      }
    } catch {
      console.warn("⚠️ Cache missing or corrupted, refetching...");
    }

    try {
      const { data } = await axios.post(`${API_URL}/extract`, { url: doc.url });
      if (data.pages?.length > 0) {
        setPages(data.pages);
        await FileSystem.writeAsStringAsync(cacheFile, JSON.stringify(data.pages));
        cleanupOldCache();
      } else {
        Alert.alert("No text found", "This document might not contain readable text.");
      }
    } catch (err) {
      console.error("Text extraction failed:", err);
      Alert.alert("Extraction Error", "Could not extract text. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  /** 🎧 Adaptive Speech System **/
  const startSpeech = async (pageIndex = 0, startPos = 0) => {
    if (!pages?.length) {
      Alert.alert("No Text", "No readable text found in this document.");
      return;
    }

    if (pageIndex >= pages.length || pageIndex < 0) {
      setIsSpeaking(false);
      return;
    }

    const speaking = await Speech.isSpeakingAsync();
    if (speaking) await Speech.stop();

    const fullText = pages[pageIndex];
    const remainingText = fullText.slice(startPos);
    const words = remainingText.split(/\s+/);

    setIsSpeechLoading(true);
    setIsPaused(false);
    setIsSpeaking(true);
    setCurrentPage(pageIndex);
    setCurrentTextPosition(startPos);

    let spokenChars = 0;

    if (speechInterval) clearInterval(speechInterval);
    const interval = setInterval(() => {
      // Estimate per-word time based on average 4.5 chars per word, 180 wpm
      const avgCharsPerSecond = 13.5;
      spokenChars += avgCharsPerSecond;
      setCurrentTextPosition((prev) => prev + avgCharsPerSecond);
    }, 1000);
    setSpeechInterval(interval);

    Speech.speak(remainingText, {
      language: "en-US",
      rate: 1.0,
      onStart: () => {
        setIsSpeechLoading(false);
      },
      onDone: () => {
        clearInterval(interval);
        setSpeechInterval(null);
        setCurrentTextPosition(0);
        if (pageIndex < pages.length - 1) {
          startSpeech(pageIndex + 1);
        } else {
          stopSpeech();
        }
      },
      onError: (err) => {
        console.error("Speech error:", err);
        clearInterval(interval);
        setSpeechInterval(null);
        setIsSpeaking(false);
        setIsPaused(false);
        setIsSpeechLoading(false);
      },
    });
  };

  const pauseSpeech = async () => {
    if (isSpeaking) {
      await Speech.stop();
      if (speechInterval) clearInterval(speechInterval);
      setSpeechInterval(null);
      setIsPaused(true);
      setIsSpeaking(false);
    }
  };

  const resumeSpeech = () => {
    if (isPaused) {
      startSpeech(currentPage, currentTextPosition);
      setIsPaused(false);
    }
  };

  const stopSpeech = async () => {
    await Speech.stop();
    if (speechInterval) clearInterval(speechInterval);
    setSpeechInterval(null);
    setIsPaused(false);
    setIsSpeaking(false);
    setCurrentTextPosition(0);
    setCurrentPage(0);
  };

  /** 📄 Download **/
  const handleFileDownload = async () => {
    if (!document?.url) {
      Alert.alert("Error", "Document URL is missing.");
      return;
    }

    const fileName =
      document?.title?.replace(/[^a-z0-9]/gi, "_") || "LearnFusion_Document";
    const fileUri = FileSystem.documentDirectory + `${fileName}.pdf`;

    try {
      Alert.alert("Downloading...", `Downloading "${fileName}"`);
      const downloadResult = await FileSystem.downloadAsync(document.url, fileUri);
      Alert.alert("Download Complete", `"${fileName}" has been saved.`, [
        { text: "OK" },
        {
          text: "Open File",
          onPress: async () => {
            if (await Sharing.isAvailableAsync()) {
              await Sharing.shareAsync(downloadResult.uri);
            }
          },
        },
      ]);
    } catch (e) {
      console.error("Download error:", e);
      Alert.alert("Download Failed", "Could not download the file.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="chevron-down" size={32} color="#046a38" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>
            {document?.title || "Document"}
          </Text>
          <TouchableOpacity
            onPress={handleFileDownload}
            style={styles.downloadButton}
            disabled={isYouTubeVideo}
          >
            <Icon
              name="download-outline"
              size={28}
              color={isYouTubeVideo ? "#ccc" : "#046a38"}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.webviewContainer}>
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            allowFileAccess={true}
            source={
              isYouTubeVideo
                ? { uri: `https://www.youtube.com/embed/${getYouTubeVideoId(document?.url)}` }
                : isTextFile
                ? {
                    html: `
                      <html>
                        <head>
                          <meta name="viewport" content="width=device-width, initial-scale=1.0">
                          <style>
                            body { font-family: monospace; white-space: pre-wrap; word-wrap: break-word; padding: 10px; font-size: 14px; }
                          </style>
                        </head>
                        <body>
                          <pre>${textContent || 'Loading file content...'}</pre>
                        </body>
                      </html>`,
                  }
                : document?.url.startsWith('file://')
                ? { uri: document.url }
                : { uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(document?.url)}` }
            }
            allowsFullscreenVideo
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            style={styles.webview}
          />
          {webViewLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#046a38" />
              <Text style={styles.loadingText}>Loading Document...</Text>
            </View>
          )}
        </View>

        {!isYouTubeVideo && showSpeechControls && (
          <View style={styles.controlsContainer}>
            {loading ? (
              <ActivityIndicator color="#046a38" size="large" />
            ) : (
              <>
                <View style={styles.playbackControls}>
                  <TouchableOpacity
                    onPress={() => {
                      if (currentPage > 0) {
                        stopSpeech();
                        startSpeech(currentPage - 1);
                      }
                    }}
                    disabled={currentPage === 0 || isSpeaking}
                  >
                    <Icon
                      name="skip-previous"
                      size={32}
                      color={currentPage === 0 || isSpeaking ? "#aaa" : "#343a40"}
                    />
                  </TouchableOpacity>

                  {isSpeechLoading ? (
                    <ActivityIndicator color="#046a38" />
                  ) : isSpeaking && !isPaused ? (
                    <TouchableOpacity onPress={pauseSpeech}>
                      <Icon name="pause-circle" size={48} color="#046a38" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      onPress={isPaused ? resumeSpeech : () => startSpeech(currentPage)}
                      disabled={pages.length === 0}
                    >
                      <Icon
                        name="play-circle"
                        size={48}
                        color={pages.length === 0 ? "#aaa" : "#046a38"}
                      />
                    </TouchableOpacity>
                  )}

                  {(isSpeaking || isPaused) && (
                    <TouchableOpacity onPress={stopSpeech}>
                      <Icon name="stop-circle-outline" size={28} color="#dc3545" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => {
                      if (currentPage < pages.length - 1) {
                        stopSpeech();
                        startSpeech(currentPage + 1);
                      }
                    }}
                    disabled={currentPage >= pages.length - 1 || isSpeaking}
                  >
                    <Icon
                      name="skip-next"
                      size={32}
                      color={
                        currentPage >= pages.length - 1 || isSpeaking
                          ? "#aaa"
                          : "#343a40"
                      }
                    />
                  </TouchableOpacity>
                </View>

                <Text style={styles.pageIndicator}>
                  {pages.length > 0
                    ? `Page ${currentPage + 1} of ${pages.length}`
                    : "No Pages"}
                </Text>
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/** 🎨 Styles **/
const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: "#f0f2f5", marginTop: 25 },
  header: {
    height: 60,
    paddingHorizontal: 15,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#e9ecef",
    flexDirection: "row",
    alignItems: "center",
  },
  closeButton: { paddingRight: 15 },
  title: { flex: 1, fontWeight: "600", fontSize: 18, color: "#343a40" },
  downloadButton: { paddingLeft: 15 },
  webviewContainer: { flex: 1, backgroundColor: "#e9ecef" },
  webview: { flex: 1 },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(255,255,255,0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: { marginTop: 10, fontSize: 16, color: "#333" },
  controlsContainer: {
    height: 120,
    backgroundColor: "#fff",
    borderTopWidth: 1,
    borderTopColor: "#e9ecef",
    paddingHorizontal: 20,
    justifyContent: "center",
  },
  playbackControls: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 5,
  },
  pageIndicator: { textAlign: "center", fontSize: 14, color: "#6c757d" },
});
