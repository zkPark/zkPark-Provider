import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import supabase from "./supabaseClient";
import { FontAwesome } from "@expo/vector-icons";

const HomePage = () => {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw error;
      }
      router.replace("/");
    } catch (error) {
      console.error("Error logging out:", error);
      alert("Failed to log out. Please try again.");
    }
  };

  return (
    <View className="flex-1 bg-gray-900 p-6">
      <View className="pt-16">
        <View className="flex-row justify-between items-center">
          <Text className="text-5xl font-bold text-yellow-400 font-pbold">
            ParkMiner
          </Text>
          <TouchableOpacity onPress={handleLogout}>
            <FontAwesome name="sign-out" size={24} color="#FBBF24" />
          </TouchableOpacity>
        </View>
        <Text className="text-xl mt-2 text-gray-300 font-psemibold">
          Share Parking & EV Charging Spots
        </Text>
      </View>

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          onPress={() => router.push("/parking")}
          style={styles.button}
          className="bg-blue-500 rounded-lg"
        >
          <Text className="text-center text-xl text-white font-pbold">
            Parking
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/charging")}
          style={styles.button}
          className="bg-green-500 rounded-lg"
        >
          <Text className="text-center text-xl text-white font-pbold">
            Charging
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => router.push("/wallet")}
          style={styles.button}
          className="bg-purple-500 rounded-lg"
        >
          <Text className="text-center text-xl text-white font-pbold">
            Wallet
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  buttonContainer: {
    flex: 1,
    justifyContent: "center",
    width: "100%",
  },
  button: {
    width: "100%",
    paddingVertical: 16,
    marginBottom: 32,
  },
});

export default HomePage;
