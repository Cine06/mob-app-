import React, { useState, useEffect } from "react";
import { Dimensions, TouchableOpacity, Image, View, Text, Modal, StyleSheet } from "react-native";
import Animated, { useSharedValue,  useAnimatedStyle,  withSpring,  FadeIn,  FadeOut,} from "react-native-reanimated";
import { GestureDetector, Gesture } from "react-native-gesture-handler";
import { Ionicons } from "@expo/vector-icons";
import Fusionbot from "./FusionBot";
import styles from "../styles/fchatbot";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");
const INITIAL_X = width - 80;
const INITIAL_Y = height - 180;

export default function FloatingChatbot() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isChatOpen, setIsChatOpen] = useState(false);

  const x = useSharedValue(INITIAL_X);
  const y = useSharedValue(INITIAL_Y);
  const offsetX = useSharedValue(INITIAL_X);
  const offsetY = useSharedValue(INITIAL_Y);

  useEffect(() => {
    const fetchUser = async () => {
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) {
        setCurrentUser(JSON.parse(userStr));
      }
    };
    fetchUser();
  }, []);

  const dragGesture = Gesture.Pan()
    .enabled(!isChatOpen)
    .onStart(() => {
      offsetX.value = x.value;
      offsetY.value = y.value;
    })
    .onUpdate((event) => {
      x.value = offsetX.value + event.translationX;
      y.value = offsetY.value + event.translationY;
    })
    .onEnd(() => {
      const maxX = width - 70;
      const maxY = height - 100;
      x.value = withSpring(Math.max(10, Math.min(x.value, maxX)));
      y.value = withSpring(Math.max(10, Math.min(y.value, maxY)));
    });

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value }, { translateY: y.value }],
  }));

  return (
    <>
      {!isChatOpen && (
        <GestureDetector gesture={dragGesture}>
          <Animated.View style={[styles.container, animatedStyle]}>
            <TouchableOpacity onPress={() => setIsChatOpen(true)} style={styles.fab}>
              <Image source={require("../assets/chatbot-icon.png")} style={styles.fabImage} />
            </TouchableOpacity>
          </Animated.View>
        </GestureDetector>
      )}

      <Modal
        animationType="fade"
        transparent={true}
        visible={isChatOpen}
        onRequestClose={() => setIsChatOpen(false)}
      >
        <View style={modalStyles.centeredView}>
          <View style={modalStyles.modalView}>
              <View style={styles.chatHeader}>
                <View style={styles.headerLeft}>
                  <Image source={require("../assets/chatbot-icon.png")} style={styles.headerIcon} />
                  <Text style={styles.headerTitle}>FusionBot</Text>
                </View>
                <TouchableOpacity onPress={() => setIsChatOpen(false)}>
                  <Ionicons name="close" size={22} color="#fff" />
                </TouchableOpacity>
              </View>
              <Fusionbot currentUser={currentUser} />
          </View>
        </View>
      </Modal>
    </>
  );
}

const modalStyles = StyleSheet.create({
  centeredView: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalView: {
    width: '90%',
    height: '80%',
    backgroundColor: "white",
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2
    },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5
  },
});
