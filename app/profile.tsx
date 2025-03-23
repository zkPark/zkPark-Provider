import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Linking,
} from "react-native";
import { useRouter } from "expo-router";
import supabase from "./supabaseClient";
import { FontAwesome5, Feather } from "@expo/vector-icons";
import * as WebBrowser from "expo-web-browser";
import { Platform } from "react-native";

// Interface for user data
interface UserData {
  email_id: string;
  age: number | null;
  created_at: string;
  wallet_addr: string | null;
}

// Interface for Ethereum window object
declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (request: { method: string; params?: any[] }) => Promise<any>;
      on: (event: string, callback: (...args: any[]) => void) => void;
    };
  }
}

const Profile = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [connectingWallet, setConnectingWallet] = useState(false);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [fetchingBalance, setFetchingBalance] = useState(false);

  // Fetch user data from Supabase
  const fetchUserData = async () => {
    try {
      setLoading(true);

      // Get current user session
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError || !sessionData?.session) {
        throw new Error("No active session found");
      }

      const userEmail = sessionData.session.user.email;

      if (!userEmail) {
        throw new Error("User email not found in session");
      }

      // Fetch user details from 'user' table including wallet_addr
      const { data, error } = await supabase
        .from("user")
        .select("email_id, age, created_at, wallet_addr")
        .eq("email_id", userEmail)
        .single();

      if (error) {
        throw error;
      }

      setUserData(data);

      // Fetch token balance if wallet is connected
      if (data.wallet_addr) {
        fetchTokenBalance(data.wallet_addr);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
      Alert.alert("Error", "Failed to load profile data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Fetch ZKP2 token balance
  const fetchTokenBalance = async (walletAddress: string) => {
    try {
      setFetchingBalance(true);
      const response = await fetch(
        `https://zkpark-b3df457d7927.herokuapp.com/api/token/balance/${walletAddress}`
      );

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      setTokenBalance(data.balance || "0");
    } catch (error) {
      console.error("Error fetching token balance:", error);
      setTokenBalance("Error");
    } finally {
      setFetchingBalance(false);
    }
  };

  // Handle refresh token balance
  const handleRefreshBalance = () => {
    if (userData?.wallet_addr) {
      fetchTokenBalance(userData.wallet_addr);
    }
  };

  useEffect(() => {
    fetchUserData();
  }, []);

  // Update wallet address in Supabase
  const updateWalletAddress = async (walletAddress: string | null) => {
    try {
      if (!userData?.email_id) {
        throw new Error("User email not found");
      }

      const { error } = await supabase
        .from("user")
        .update({ wallet_addr: walletAddress })
        .eq("email_id", userData.email_id);

      if (error) {
        throw error;
      }

      // Update local state
      setUserData((prev) =>
        prev ? { ...prev, wallet_addr: walletAddress } : prev
      );

      // If wallet connected, fetch token balance
      if (walletAddress) {
        Alert.alert("Success", "MetaMask wallet connected successfully.");
        fetchTokenBalance(walletAddress);
      } else {
        // Clear token balance when wallet is disconnected
        setTokenBalance(null);
      }
    } catch (error) {
      console.error("Error updating wallet address:", error);
      Alert.alert(
        "Error",
        "Failed to update wallet address. Please try again."
      );
    }
  };

  // Connect MetaMask wallet
  const connectMetaMask = async () => {
    try {
      setConnectingWallet(true);

      // Web environment with MetaMask
      if (
        Platform.OS === "web" &&
        typeof window !== "undefined" &&
        window.ethereum?.isMetaMask
      ) {
        // Request account access
        const accounts = await window.ethereum.request({
          method: "eth_requestAccounts",
        });

        // Get the first account
        const walletAddress = accounts[0];
        await updateWalletAddress(walletAddress);
      }
      // Mobile environment
      else {
        // Define a specific deep link to connect wallet
        // Using universal link format with your app's scheme
        const appScheme = "ZKParkMiner://"; // Replace with your app's scheme
        const yourAppDomain = "ZKParkMiner.app"; // Replace with your app's domain

        // Deep link format that MetaMask mobile understands better
        const metamaskDeepLink = `metamask://dapp/${yourAppDomain}`;

        // Alternative - try direct wallet connect format
        const metamaskConnect =
          "https://metamask.app.link/dapp/" + yourAppDomain;

        try {
          // First try using WebBrowser which handles returns better
          const result = await WebBrowser.openAuthSessionAsync(
            metamaskConnect,
            appScheme
          );

          if (result.type === "success") {
            // If we have params in the URL, we could extract wallet address
            // This requires server-side setup for proper auth flow
            console.log("Auth session success:", result);

            // For now, just prompt the user to manually input their address
            Alert.prompt(
              "Enter Wallet Address",
              "Please paste your MetaMask wallet address:",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "OK",
                  onPress: (address) => {
                    if (address && address.startsWith("0x")) {
                      updateWalletAddress(address);
                    } else {
                      Alert.alert(
                        "Invalid Address",
                        "Please enter a valid Ethereum address starting with 0x"
                      );
                    }
                  },
                },
              ]
            );
          } else {
            // Fall back to regular deep linking
            const canOpenMetaMask = await Linking.canOpenURL(metamaskDeepLink);

            if (canOpenMetaMask) {
              await Linking.openURL(metamaskDeepLink);
              Alert.alert(
                "Connect in MetaMask",
                "Please connect your wallet in MetaMask, then return here and enter your wallet address.",
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Enter Address",
                    onPress: () => {
                      // Prompt user to enter their wallet address
                      Alert.prompt(
                        "Enter Wallet Address",
                        "Please paste your MetaMask wallet address:",
                        [
                          {
                            text: "Cancel",
                            style: "cancel",
                          },
                          {
                            text: "Connect",
                            onPress: (address) => {
                              if (address && address.startsWith("0x")) {
                                updateWalletAddress(address);
                              } else {
                                Alert.alert(
                                  "Invalid Address",
                                  "Please enter a valid Ethereum address starting with 0x"
                                );
                              }
                            },
                          },
                        ]
                      );
                    },
                  },
                ]
              );
            } else {
              // MetaMask not installed
              Alert.alert(
                "MetaMask Not Found",
                "Would you like to install MetaMask?",
                [
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                  {
                    text: "Install MetaMask",
                    onPress: () => {
                      Linking.openURL("https://metamask.io/download/");
                    },
                  },
                ]
              );
            }
          }
        } catch (error) {
          console.error("Deep linking error:", error);

          // Fall back to just opening MetaMask
          Linking.openURL("https://metamask.app.link");

          // Then prompt for wallet address
          setTimeout(() => {
            Alert.prompt(
              "Enter Wallet Address",
              "Please paste your MetaMask wallet address:",
              [
                {
                  text: "Cancel",
                  style: "cancel",
                },
                {
                  text: "Connect",
                  onPress: (address) => {
                    if (address && address.startsWith("0x")) {
                      updateWalletAddress(address);
                    } else {
                      Alert.alert(
                        "Invalid Address",
                        "Please enter a valid Ethereum address starting with 0x"
                      );
                    }
                  },
                },
              ]
            );
          }, 1000);
        }
      }
    } catch (error) {
      console.error("Error connecting to MetaMask:", error);
      Alert.alert("Error", "Failed to connect to MetaMask. Please try again.");
    } finally {
      setConnectingWallet(false);
    }
  };

  // Handle disconnect wallet
  const disconnectWallet = async () => {
    try {
      await updateWalletAddress(null);
      Alert.alert("Success", "Wallet disconnected successfully.");
    } catch (error) {
      console.error("Error disconnecting wallet:", error);
      Alert.alert("Error", "Failed to disconnect wallet. Please try again.");
    }
  };

  // Handle manual wallet connection
  const manuallyConnectWallet = () => {
    Alert.prompt(
      "Enter Wallet Address",
      "Please paste your MetaMask wallet address:",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Connect",
          onPress: (address) => {
            if (address && address.startsWith("0x")) {
              updateWalletAddress(address);
            } else {
              Alert.alert(
                "Invalid Address",
                "Please enter a valid Ethereum address starting with 0x"
              );
            }
          },
        },
      ]
    );
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      setLoading(true);

      // Sign out from Supabase Auth
      const { error } = await supabase.auth.signOut();

      if (error) {
        throw error;
      }

      // Navigate to login screen
      router.replace("/");
    } catch (error) {
      console.error("Error during logout:", error);
      Alert.alert("Error", "Failed to log out. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Mask wallet address for display
  const maskWalletAddress = (address: string) => {
    if (!address) return "";
    return `${address.substring(0, 6)}...${address.substring(
      address.length - 4
    )}`;
  };

  // Get display name from email
  const getDisplayName = (email: string) => {
    return email.split("@")[0] || "User";
  };

  // Get user initial from email
  const getUserInitial = (email: string) => {
    return email.charAt(0).toUpperCase();
  };

  if (loading) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <ActivityIndicator size="large" color="#FCD34D" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-gray-900">
      <View className="p-6">
        {/* Header */}
        <Text className="text-5xl font-bold text-purple-400 font-pbold">
          Profile
        </Text>
        <Text className="text-xl mt-2 text-gray-300 font-psemibold">
          Your account details
        </Text>

        {/* Profile Card */}
        <View className="mt-8 bg-gray-800 rounded-xl p-6">
          {/* Profile Header */}
          <View className="flex-row items-center">
            <View className="bg-blue-500 w-20 h-20 rounded-full justify-center items-center">
              <Text className="text-3xl text-white font-pbold">
                {userData?.email_id ? getUserInitial(userData.email_id) : "U"}
              </Text>
            </View>
            <View className="ml-4">
              <Text className="text-2xl text-white font-pbold">
                {userData?.email_id
                  ? getDisplayName(userData.email_id)
                  : "User"}
              </Text>
              <Text className="text-gray-400 font-psemibold">
                {userData?.email_id || "No email"}
              </Text>
            </View>
          </View>

          {/* Info Section */}
          <View className="mt-8">
            <Text className="text-xl text-white font-pbold mb-4">
              Account Information
            </Text>

            {/* Email */}
            <View className="flex-row items-center justify-between py-3 border-b border-gray-700">
              <View className="flex-row items-center">
                <Feather name="mail" size={20} color="#9CA3AF" />
                <Text className="ml-3 text-white font-psemibold">Email</Text>
              </View>
              <Text className="text-gray-400 font-psemibold">
                {userData?.email_id || "Not available"}
              </Text>
            </View>

            {/* Age */}
            <View className="flex-row items-center justify-between py-3 border-b border-gray-700">
              <View className="flex-row items-center">
                <Feather name="user" size={20} color="#9CA3AF" />
                <Text className="ml-3 text-white font-psemibold">Age</Text>
              </View>
              <Text className="text-gray-400 font-psemibold">
                {userData?.age || "Not specified"}
              </Text>
            </View>

            {/* Account Created */}
            <View className="flex-row items-center justify-between py-3 border-b border-gray-700">
              <View className="flex-row items-center">
                <Feather name="calendar" size={20} color="#9CA3AF" />
                <Text className="ml-3 text-white font-psemibold">Joined</Text>
              </View>
              <Text className="text-gray-400 font-psemibold">
                {userData?.created_at
                  ? new Date(userData.created_at).toLocaleDateString()
                  : "Not available"}
              </Text>
            </View>
          </View>

          {/* Wallet Section */}
          <View className="mt-8">
            <Text className="text-xl text-white font-pbold mb-4">Wallet</Text>

            {userData?.wallet_addr ? (
              <View className="bg-gray-700 rounded-lg p-4">
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center">
                    <FontAwesome5 name="ethereum" size={20} color="#9CA3AF" />
                    <Text className="ml-3 text-white font-psemibold">
                      Connected
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={disconnectWallet}
                    className="bg-red-500 px-3 py-1 rounded"
                  >
                    <Text className="text-white font-psemibold">
                      Disconnect
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text className="text-gray-400 font-psemibold mt-2 break-all">
                  {maskWalletAddress(userData.wallet_addr)}
                </Text>

                {/* Token Balance Section */}
                <View className="mt-4 pt-4 border-t border-gray-600">
                  <View className="flex-row justify-between items-center">
                    <View className="flex-row items-center">
                      <Text className="text-white font-psemibold">
                        ZKP2 Token Balance
                      </Text>
                    </View>
                    <TouchableOpacity
                      onPress={handleRefreshBalance}
                      disabled={fetchingBalance}
                      className="bg-gray-600 p-2 rounded-full"
                    >
                      <Feather
                        name="refresh-cw"
                        size={16}
                        color="#FFFFFF"
                        style={
                          fetchingBalance
                            ? { transform: [{ rotate: "45deg" }] }
                            : {}
                        }
                      />
                    </TouchableOpacity>
                  </View>

                  <View className="mt-2 flex-row items-center">
                    {fetchingBalance ? (
                      <ActivityIndicator size="small" color="#FCD34D" />
                    ) : (
                      <Text className="text-2xl text-green-400 font-pbold">
                        {tokenBalance !== null
                          ? tokenBalance
                          : "Error fetching balance"}
                      </Text>
                    )}
                  </View>
                </View>
              </View>
            ) : (
              <View className="bg-gray-700 rounded-lg p-4">
                <Text className="text-gray-400 font-psemibold mb-4">
                  No wallet connected
                </Text>
                <View className="flex-row">
                  <TouchableOpacity
                    onPress={connectMetaMask}
                    disabled={connectingWallet}
                    className="bg-blue-500 px-3 py-2 rounded mr-2 flex-1"
                  >
                    <Text className="text-center text-white font-psemibold">
                      {connectingWallet ? "Connecting..." : "Connect MetaMask"}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={manuallyConnectWallet}
                    className="bg-gray-600 px-3 py-2 rounded flex-1"
                  >
                    <Text className="text-center text-white font-psemibold">
                      Enter Address Manually
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Logout Button */}
        <TouchableOpacity
          onPress={handleLogout}
          className="mt-8 w-full bg-red-500 py-4 rounded-lg"
        >
          <Text className="text-center text-xl text-white font-pbold">
            Logout
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default Profile;
