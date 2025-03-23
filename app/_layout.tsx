import { Stack } from "expo-router";

export default function Layout() {
  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{ title: "Login", headerShown: false }}
      />
      <Stack.Screen
        name="signup"
        options={{ title: "Sign Up", headerShown: false }}
      />
      <Stack.Screen
        name="home"
        options={{ title: "Home", headerShown: false }}
      />
      <Stack.Screen
        name="parking"
        options={{ title: "Parking", headerShown: false }}
      />
      <Stack.Screen
        name="charging"
        options={{ title: "Charging", headerShown: false }}
      />
      <Stack.Screen
        name="wallet"
        options={{ title: "Wallet", headerShown: false }}
      />
    </Stack>
  );
}
