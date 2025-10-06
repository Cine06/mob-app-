import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Modal, Alert } from 'react-native';
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
  const [pages, setPages] = useState(null);
  const [webViewLoading, setWebViewLoading] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const webviewRef = useRef(null);

  useEffect(() => {
    if (visible) {
      loadOrExtract(document);
    } else {
      Speech.stop();
      setIsSpeaking(false);
      setPages(null);
    }
  }, [visible, document?.url]);

  useEffect(() => {
    const checkSpeakingStatus = setInterval(async () => {
      const speaking = await Speech.isSpeakingAsync();
      setIsSpeaking(speaking);
    }, 500);
    return () => clearInterval(checkSpeakingStatus);
  }, []);


  async function loadOrExtract(doc) {
    if (!doc?.url) return;
    setLoading(true);

    const cacheKey = `extract:${doc.url}`;
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      setPages(JSON.parse(cached));
      setLoading(false);
      return;
    }

    try {
      const resp = await fetch(`${API_URL}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: doc.url }),
      });
      if (!resp.ok) throw new Error(`Extraction failed with status: ${resp.status}`);
      const json = await resp.json();
      setPages(json.pages || []);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(json.pages || []));
    } catch (err) {
      console.warn('extract error', err);
      alert('Could not extract text from the document. Please try again later.');
    } finally {
      setLoading(false);
    }
  }

  function speakDocument() {
    const text = (pages || []).join(' ');
    if (!text || text.trim().length === 0) {
      alert('No selectable text found in this document. OCR may be required.');
      return;
    }
    Speech.speak(text, { language: 'en-US', rate: 1.0, onDone: () => setIsSpeaking(false), onStopped: () => setIsSpeaking(false) });
    setIsSpeaking(true);
  }

  function stopSpeech() {
    Speech.stop();
    setIsSpeaking(false);
  }

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
      console.log('Finished downloading to ', uri);

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
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="chevron-down" size={30} color="#046a38" />
          </TouchableOpacity>
          <Text style={styles.title} numberOfLines={1} ellipsizeMode="tail">
            {document?.title || 'Document'}
          </Text>
          <View style={styles.controls}>
            {loading ? <ActivityIndicator color="#046a38" /> : (
              isSpeaking ? (
                <TouchableOpacity onPress={stopSpeech} style={styles.iconButton}>
                  <Icon name="stop-circle-outline" size={26} color="#046a38" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity onPress={speakDocument} style={styles.iconButton} disabled={!pages}>
                  <Icon name="play-circle-outline" size={26} color={!pages ? "#ccc" : "#046a38"} />
                </TouchableOpacity>
              )
            )}
            <TouchableOpacity onPress={handleFileDownload} style={styles.iconButton}>
              <Icon name="download-outline" size={26} color="#046a38" />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.webviewContainer}>
          <WebView
            ref={webviewRef}
            originWhitelist={["*"]}
            source={{ uri: `https://docs.google.com/gview?embedded=true&url=${encodeURIComponent(document?.url)}` }}
            style={styles.webview}
            onLoadStart={() => setWebViewLoading(true)}
            onLoadEnd={() => setWebViewLoading(false)}
            onError={(syntheticEvent) => {
              const { nativeEvent } = syntheticEvent;
              console.warn('WebView error: ', nativeEvent);
              setWebViewLoading(false);
            }}
            renderError={(errorDomain, errorCode, errorDesc) => (
              <View style={styles.errorContainer}>
                <Icon name="alert-circle-outline" size={48} color="#666" />
                <Text style={styles.errorText}>Could not load document preview.</Text>
                <Text style={styles.errorDescription}>Please check your internet connection or try downloading the file.</Text>
              </View>
            )}
          />
          {webViewLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#046a38" />
              <Text style={styles.loadingText}>Loading Document...</Text>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f8f9fa',marginTop: 25 },
  header: { height: 60, paddingHorizontal: 10, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e9ecef', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  closeButton: { padding: 5 },
  title: { flex: 1, textAlign: 'center', fontWeight: '600', fontSize: 18, color: '#343a40', marginHorizontal: 10 },
  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  iconButton: { padding: 8, marginLeft: 8 },
  webviewContainer: { flex: 1, backgroundColor: '#e9ecef' },
  webview: { flex: 1 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255, 255, 255, 0.8)', justifyContent: 'center', alignItems: 'center' },
  loadingText: { marginTop: 10, fontSize: 16, color: '#333' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20, backgroundColor: '#f8f9fa' },
  errorText: { marginTop: 15, fontSize: 18, fontWeight: 'bold', color: '#333' },
  errorDescription: { marginTop: 5, fontSize: 14, color: '#666', textAlign: 'center' },
});
