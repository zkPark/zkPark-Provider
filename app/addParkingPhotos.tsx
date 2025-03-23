import React, { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Image,
  ScrollView,
  Alert,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { decode } from "base64-arraybuffer";
import { SafeAreaView } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import supabase from "./supabaseClient"; // Import Supabase client

const AddParkingPhotos = () => {
  const [photos, setPhotos] = useState<string[]>([]); // Array to store photo URIs
  const [isLoading, setIsLoading] = useState(false);

  // Request camera and gallery permissions
  const requestPermissions = async () => {
    const { status: cameraStatus } =
      await ImagePicker.requestCameraPermissionsAsync();
    const { status: galleryStatus } =
      await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (cameraStatus !== "granted" || galleryStatus !== "granted") {
      Alert.alert(
        "Permission required",
        "Please allow access to camera and gallery."
      );
      return false;
    }
    return true;
  };

  // Handle taking a photo
  const takePhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // Handle picking a photo from the gallery
  const pickPhoto = async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  };

  // Upload photos to Supabase Storage using ArrayBuffer
  const uploadPhotos = async () => {
    if (photos.length === 0) {
      Alert.alert("Error", "Please add at least one photo.");
      return;
    }

    setIsLoading(true);

    try {
      const uploadedUrls: string[] = [];

      for (const photo of photos) {
        try {
          // Read the photo as a Base64 string
          const base64 = await FileSystem.readAsStringAsync(photo, {
            encoding: FileSystem.EncodingType.Base64,
          });

          // Decode the Base64 string to ArrayBuffer
          const arrayBuffer = decode(base64);

          // Generate a unique filename
          const fileName = `${Date.now()}_${Math.random()
            .toString(36)
            .substring(7)}.jpg`;

          // Upload the photo to Supabase Storage
          const { data, error: uploadError } = await supabase.storage
            .from("parking_images")
            .upload(fileName, arrayBuffer, {
              upsert: true, // Optional, if you want to overwrite the file
              contentType: "image/jpeg", // Adjust based on your image type
            });

          if (uploadError) {
            console.error("Supabase upload error:", uploadError.message);
            throw uploadError;
          }

          // Get the public URL of the uploaded photo
          const { data: publicUrlData } = supabase.storage
            .from("parking_images")
            .getPublicUrl(fileName);

          if (!publicUrlData || !publicUrlData.publicUrl) {
            console.error("Failed to get public URL for the uploaded image.");
            throw new Error("Could not retrieve public URL.");
          }

          uploadedUrls.push(publicUrlData.publicUrl);
        } catch (err) {
          console.error("Error processing photo:", err);
          Alert.alert("Error", "Could not process one of the images.");
        }
      }

      Alert.alert("Success", "Photos uploaded successfully!", [
        {
          text: "OK",
          onPress: () => {
            router.push("/");
          },
        },
      ]);
    } catch (error) {
      console.error("Error uploading photos:", error);
      Alert.alert("Error", "Failed to upload photos. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView className="h-full bg-[#161622]">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text className="text-3xl font-bold text-yellow-400 font-pbold mb-6 text-center">
          Add Parking Photos
        </Text>

        {/* Display selected photos */}
        <View className="flex-row flex-wrap justify-between">
          {photos.map((photo, index) => (
            <Image
              key={index}
              source={{ uri: photo }}
              className="w-[30%] h-32 rounded-lg mb-4"
            />
          ))}
        </View>

        {/* Buttons to add photos */}
        <TouchableOpacity
          onPress={takePhoto}
          className="w-full bg-yellow-400 py-4 rounded-lg mb-4"
        >
          <Text className="text-center text-xl text-gray-900 font-pbold">
            Take Photo
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={pickPhoto}
          className="w-full bg-yellow-400 py-4 rounded-lg mb-4"
        >
          <Text className="text-center text-xl text-gray-900 font-pbold">
            Pick from Gallery
          </Text>
        </TouchableOpacity>

        {/* Upload button */}
        <TouchableOpacity
          onPress={uploadPhotos}
          disabled={isLoading || photos.length === 0}
          className={`w-full bg-yellow-400 py-4 rounded-lg ${
            isLoading || photos.length === 0 ? "opacity-50" : ""
          }`}
        >
          <Text className="text-center text-xl text-gray-900 font-pbold">
            {isLoading ? "Uploading..." : "Upload Photos"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
      <StatusBar backgroundColor="#161622" style="light" />
    </SafeAreaView>
  );
};

export default AddParkingPhotos;
