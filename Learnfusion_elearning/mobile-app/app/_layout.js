import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { ErrorBoundary } from "react-error-boundary";
import { View, Text, Button, StyleSheet } from "react-native";

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
  return (
    <ErrorBoundary FallbackComponent={ErrorFallback}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Stack
          screenOptions={{
            headerShown: false,
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
