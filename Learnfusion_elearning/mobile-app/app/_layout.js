import { Stack, useRouter } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { CardStyleInterpolators } from "@react-navigation/stack";
import { ErrorBoundary } from "react-error-boundary";
import { View, Text, Button, StyleSheet } from "react-native";
import { useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";
import { supabase } from "../utils/supabaseClient";

function ErrorFallback({ error, resetErrorBoundary }) {
  return (
    <View style={styles.container}>
      <Text style={styles.errorTitle}>Something went wrong:</Text>
      <Text style={styles.errorMessage}>{error.message}</Text>
      <Button title="Try again" onPress={resetErrorBoundary} />
    </View>
  );
}

export default function Layout() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let presenceChannel = null;

    const setupPresence = async () => {
      const storedUser = await SecureStore.getItemAsync("user");
      if (storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setCurrentUser(parsedUser);

        // Fetch section_id for the student
        const { data: userData, error: userError } = await supabase
          .from("users")
          .select("section_id, profile_picture")
          .eq("id", parsedUser.id)
          .single();

        if (userError) {
          console.error("Error fetching user section for presence:", userError);
          // Optionally, handle error by redirecting or showing a message
          return;
        }

        const sectionId = userData?.section_id;
        const profilePicture = userData?.profile_picture;

        // Initialize and track presence
        presenceChannel = supabase.channel('online-users');
        
        presenceChannel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              user_id: parsedUser.id,
              first_name: parsedUser.first_name,
              last_name: parsedUser.last_name,
              role: parsedUser.role,
              section_id: sectionId, // Include section_id
              profile_picture: profilePicture, // Use the latest profile picture from the database
              online_at: new Date().toISOString(),
            });
          }
        });
      }
    };

    setupPresence();

    return () => {
      if (presenceChannel) {
        presenceChannel.untrack();
        supabase.removeChannel(presenceChannel);
      }
    };
  }, []); // Empty dependency array means it runs once on mount

  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
            gestureEnabled: false, // Disable gestures for a more controlled feel
            animationEnabled: true,
            animation: "fade",
            cardStyleInterpolator: CardStyleInterpolators.forFadeFromBottomAndroid,
            animationDuration: 250, // Fast and smooth
          }}
        />
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  errorTitle: { fontSize: 18, fontWeight: "bold", marginBottom: 10 },
  errorMessage: { marginBottom: 20, textAlign: "center" },
});
