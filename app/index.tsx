import React, { useState } from "react";
import {
  ScrollView,
  Text,
  View,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Feather, FontAwesome5 } from "@expo/vector-icons"; 
import { router } from "expo-router"; // Expo Router
import supabase from "./supabaseClient"; 
import "../global.css";

const LoginPage = () => {
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [passwordVisible, setPasswordVisible] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  const handleLogin = async () => {
    try {
      setLoading(true);

      // Check if the email exists in the user table
      const { data: userData, error: fetchError } = await supabase
        .from("user")
        .select("email_id, pwd")
        .eq("email_id", email)
        .single();

      if (fetchError || !userData) {
        Alert.alert("Error", "Email not found. Please sign up.");
        return;
      }

      // Verify the password
      if (userData.pwd !== password) {
        Alert.alert("Error", "Incorrect password.");
        return;
      }

      // Sign in the user with Supabase Auth
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        Alert.alert("Error", signInError.message);
        return;
      }

      // Navigate to the parking screen
      router.replace("/parking");
    } catch (error) {
      console.error("Error during login:", error);
      Alert.alert("Error", "An error occurred during login.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignupNavigation = () => {
    router.push("/signup");
  };

  return (
    <SafeAreaView className="bg-primary h-full">
      <ScrollView>
        <View className="w-full justify-center h-full px-7 my-6">
          {/* Heading: ZKPark Provider */}
          <View className="mb-10">
            <Text className="text-4xl font-psemibold text-purple-400 text-center">
              ZKPark Provider
            </Text>
          </View>

          {/* Subheading */}
          <Text className="text-gray-400 mt-3 font-psemibold text-lg text-center">
            Sign in to your account
          </Text>

          <View className="mt-10">
            {/* Email Input */}
            <View className="mb-6">
              <Text className="text-xl text-gray-300 block mb-2 font-psemibold">
                Email
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                className="w-full bg-gray-800 border-2 border-gray-700 rounded-lg p-4 font-psemibold text-white"
                placeholder="your@email.com"
                keyboardType="email-address"
                placeholderTextColor="#6b7280"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <View className="mb-8 relative">
              <Text className="text-xl text-gray-300 block mb-2 font-psemibold">
                Password
              </Text>
              <View className="relative">
                <TextInput
                  value={password}
                  onChangeText={setPassword}
                  className="w-full bg-gray-800 border-2 border-gray-700 font-psemibold rounded-lg p-4 text-gray-100 pr-12"
                  placeholder="••••••••"
                  secureTextEntry={!passwordVisible}
                  placeholderTextColor="#6b7280"
                />
                <TouchableOpacity
                  className="absolute right-4 top-5"
                  onPress={() => setPasswordVisible(!passwordVisible)}
                >
                  <Feather
                    name={passwordVisible ? "eye-off" : "eye"}
                    size={24}
                    color="white"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Login Button */}
            <TouchableOpacity
              onPress={handleLogin}
              disabled={loading}
              className="w-full bg-purple-500 text-gray-900 py-4 rounded-lg font-semibold flex-row justify-center"
            >
              {loading ? (
                <ActivityIndicator size="small" color="#1F2937" />
              ) : (
                <Text className="text-center text-xl text-white font-pbold">
                  Login
                </Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Navigation */}
            <TouchableOpacity onPress={handleSignupNavigation} className="mt-4">
              <Text className="text-center text-gray-300 font-psemibold">
                Don't have an account?{" "}
                <Text className="text-purple-400">Sign Up</Text>
              </Text>
            </TouchableOpacity>
          </View>

          {/* Social Login Section */}
          <View className="mt-8">
            <View className="flex flex-row items-center gap-4 mb-6">
              <View className="flex-1 border-t border-gray-500" />
              <Text className="text-gray-400 font-pregular">
                or continue with
              </Text>
              <View className="flex-1 border-t border-gray-500" />
            </View>

            <View className="flex-row w-11/12 mx-auto justify-evenly">
              <TouchableOpacity className="flex-row basis-1/3 items-center justify-center gap-2 bg-gray-800 py-5 rounded-lg">
                <FontAwesome5 name="google" size={24} color="white" />
                <Text className="text-white font-psemibold text-lg">
                  Google
                </Text>
              </TouchableOpacity>
              <TouchableOpacity className="flex-row basis-1/3 items-center justify-center gap-2 bg-gray-800 py-5 rounded-lg">
                <FontAwesome5 name="apple" size={27} color="white" />
                <Text className="text-white font-psemibold text-lg">Apple</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

export default LoginPage;
