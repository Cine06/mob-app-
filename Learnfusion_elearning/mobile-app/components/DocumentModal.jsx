import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebView } from 'react-native-webview';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_URL } from '@env';

export default function DocumentModal({ visible, document, onClose }) {
  const [loading, setLoading] = useState(false);
  const [documentText, setDocumentText] = useState('');
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isSpeechLoading, setIsSpeechLoading] = useState(false);
  const [isYouTubeVideo, setIsYouTubeVideo] = useState(false);
  const [pages, setPages] = useState([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [currentTextPosition, setCurrentTextPosition] = useState(0);
  const webviewRef = useRef(null);

  const getYouTubeVideoId = (url) => {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  };

  useEffect(() => {
    if (visible) {
      const videoId = getYouTubeVideoId(document?.url);
      if (videoId) {
        setIsYouTubeVideo(true);
        setDocumentText('');
      } else {
        setIsYouTubeVideo(false);
        loadOrExtract(document);
      }
    }

    // Cleanup function to stop speech when the modal is closed or the document changes.
    return () => {
      if (isSpeaking || isPaused) {
        stopSpeech();
      }
    };
  }, [visible, document?.url]);

  // Effect to handle modal closing specifically
  useEffect(() => { if (!visible) { stopSpeech(); } }, [visible]);

  async function loadOrExtract(doc) {
    if (!doc?.url) return;
    setLoading(true);

    // By changing the cache key, we invalidate all old, incorrectly formatted cache entries.
    const cacheKey = `extract-v2:${doc.url}`;
    const cached = await AsyncStorage.getItem(cacheKey);

    if (cached) {
      try {
        const cachedPages = JSON.parse(cached);
        setPages(cachedPages);
        setDocumentText(cachedPages.join('\n\n'));
        setLoading(false);
        return;
      } catch (e) {
        console.log("Failed to parse cached data, it might be stale. Fetching fresh data.");
        await AsyncStorage.removeItem(cacheKey); // Remove stale cache
      }
    }


    try {
      const resp = await fetch(`${API_URL}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: doc.url }),
      });
      if (!resp.ok) throw new Error(`Extraction failed with status: ${resp.status}`);
      const { pages } = await resp.json();

      if (pages && pages.length > 0) {
        setPages(pages);
        setDocumentText(pages.join('\n\n'));
        await AsyncStorage.setItem(cacheKey, JSON.stringify(pages));
      } else {
        Alert.alert("No text found", "The document might be image-based or empty.");
      }
    } catch (err) {
      console.error(`Text extraction failed:`, err);
      Alert.alert('Extraction Error', 'Could not extract text from the document. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  /** SPEECH CONTROL **/
  const startSpeech = async (pageIndex = 0, startPos = 0) => {
    if (!pages || pages.length === 0) {
      Alert.alert("No Text", "No readable text found in this document.");
      return;
    }

    if (pageIndex >= pages.length || pageIndex < 0) {
      setIsSpeaking(false);
      return;
    }

    await Speech.stop();

    const textToSpeak = pages[pageIndex].slice(startPos);
    setIsSpeechLoading(true);
    setIsPaused(false);

    Speech.speak(textToSpeak, {
      language: "en-US",
      rate: 1.0,
      onStart: () => {
        setIsSpeechLoading(false);
        setIsSpeaking(true);
        setCurrentPage(pageIndex);
      },
      onBoundary: (event) => {
        setCurrentTextPosition(startPos + event.charIndex);
      },
      onDone: () => {
        setCurrentTextPosition(0);
        if (pageIndex < pages.length - 1) { startSpeech(pageIndex + 1); } else { stopSpeech(); }
      },
      onError: (err) => {
        console.error("Speech error:", err);
        setIsSpeaking(false);
        setIsPaused(false);
        setIsSpeechLoading(false);
      },
    });
  };

  const pauseSpeech = async () => {
    if (!isSpeaking) return;
    await Speech.stop(); // stop() is used for pausing as there's no pause method
    setIsPaused(true);
    setIsSpeaking(false);
  };

  const resumeSpeech = () => { if (isPaused) { startSpeech(currentPage, currentTextPosition); } };

  const stopSpeech = async () => {
    await Speech.stop();
    setIsPaused(false);
    setIsSpeaking(false);
    setCurrentTextPosition(0);
    setCurrentPage(0);
  };

  /** FILE DOWNLOAD **/
  const handleFileDownload = async () => {
    if (!document?.url || !document?.title) {
      Alert.alert("Error", "Document information is missing.");
      return;
    }

    const { url: fileUrl, title: fileName } = document;
    const sanitizedFileName = `${fileName.replace(/[^a-z0-9]/gi, '_')}.pdf`;
    const fileUri = FileSystem.documentDirectory + sanitizedFileName;

    Alert.alert("Downloading...", `Downloading "${fileName}"`);

    try {
      const { uri } = await FileSystem.downloadAsync(fileUrl, fileUri);
      Alert.alert(
        "Download Complete",
        `"${fileName}" has been downloaded.`,
        [
          { text: "OK" },
          {
            text: "Open File",
            onPress: async () => {
              if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri);
              }
            },
          },
        ]
      );
    } catch (e) {
      console.error(e);
      Alert.alert("Download Failed", "Could not download the file. Please check your connection and try again.");
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="chevron-down" size={32} color="#046a38" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1}>{document?.title || 'Document'}</Text>
          <TouchableOpacity onPress={handleFileDownload} style={styles.downloadButton} disabled={isYouTubeVideo}>
            <Icon name="download-outline" size={28} color={isYouTubeVideo ? '#ccc' : '#046a38'} />
          </TouchableOpacity>
        </View>

        <View style={styles.webviewContainer}>
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            source={{ uri: isYouTubeVideo
              ? `https://www.youtube.com/embed/${getYouTubeVideoId(document?.url)}`
              : `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(document?.url)}`
            }}
            allowsFullscreenVideo
            style={styles.webview}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
          />
          {webViewLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#046a38" />
              <Text style={styles.loadingText}>Loading Document...</Text>
            </View>
          )}
        </View>

        {!isYouTubeVideo && (
          <View style={styles.controlsContainer}>
            {loading ? (
              <ActivityIndicator color="#046a38" size="large" />
            ) : (
              <>
                {/*-- Playback Controls --*/}
                <View style={styles.playbackControls}>
                  <TouchableOpacity
                    onPress={() => { if (currentPage > 0) { stopSpeech(); startSpeech(currentPage - 1); } }}
                    style={styles.iconButton}
                    disabled={currentPage === 0 || isSpeaking}
                  >
                    <Icon name="skip-previous" size={32} color={currentPage === 0 || isSpeaking ? '#aaa' : '#343a40'} />
                  </TouchableOpacity>

                  {isSpeechLoading ? (
                    <ActivityIndicator style={styles.iconButton} color="#046a38" />
                  ) : isSpeaking && !isPaused ? (
                    <TouchableOpacity onPress={pauseSpeech} style={styles.iconButton}>
                      <Icon name="pause-circle" size={48} color="#046a38" />
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity onPress={isPaused ? resumeSpeech : () => startSpeech(currentPage)} style={styles.iconButton} disabled={pages.length === 0}>
                      <Icon name="play-circle" size={48} color={pages.length === 0 ? '#aaa' : '#046a38'} />
                    </TouchableOpacity>
                  )}
                  {(isSpeaking || isPaused) && ( // Only show stop button if speech is active or paused
                    <TouchableOpacity onPress={stopSpeech} style={styles.iconButton}>
                      <Icon name="stop-circle-outline" size={28} color="#dc3545" />
                    </TouchableOpacity>
                  )}

                  <TouchableOpacity
                    onPress={() => { if (currentPage < pages.length - 1) { stopSpeech(); startSpeech(currentPage + 1); } }}
                    style={styles.iconButton}
                    disabled={currentPage >= pages.length - 1 || isSpeaking}
                  >
                    <Icon name="skip-next" size={32} color={currentPage >= pages.length - 1 || isSpeaking ? '#aaa' : '#343a40'} />
                  </TouchableOpacity>

                  
                </View>

                {/*-- Page Navigation --*/}
                <View style={styles.pageNavControls}>
                  <Text style={styles.pageIndicator}>
                    {pages.length > 0 ? `Page ${currentPage + 1} of ${pages.length}` : 'No Pages'}
                  </Text>
                </View>
              </>
            )}
          </View>
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f0f2f5', marginTop: 25 },
  header: { height: 60, paddingHorizontal: 15, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef', flexDirection: 'row', alignItems: 'center' },
  closeButton: { paddingRight: 15 },
  title: { flex: 1, fontWeight: '600', fontSize: 18, color: '#343a40' },
  downloadButton: { paddingLeft: 15 },
  webviewContainer: { flex: 1, backgroundColor: '#e9ecef' },
  webview: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#333' },
  controlsContainer: { height: 120, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e9ecef', paddingHorizontal: 20, justifyContent: 'center' },
  playbackControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginBottom: 5 },
  pageNavControls: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  iconButton: { padding: 8, marginHorizontal: 15 },
  pageIndicator: { fontSize: 14, color: '#6c757d' },
});
