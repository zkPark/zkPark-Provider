import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  Alert,
  Image,
  Modal,
} from "react-native";
import { useRouter } from "expo-router";
import MapView, { Marker } from "react-native-maps";
import * as Location from "expo-location";
import supabase from "./supabaseClient";
import { Feather } from "@expo/vector-icons"; // Import Feather for profile icon

const ParkingPage = () => {
  const router = useRouter();
  const [parkingSpots, setParkingSpots] = useState<
    {
      id: string;
      latitude: number;
      longitude: number;
      address: string;
      parking_image1_url: string;
      email_id: string;
    }[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [userLocation, setUserLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedSpot, setSelectedSpot] = useState<{
    address: string;
    parking_image1_url: string;
    email_id: string;
  } | null>(null);

  // Fetch the user's current location
  const fetchUserLocation = async () => {
    try {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setErrorMsg("Permission to access location was denied");
        Alert.alert(
          "Permission Denied",
          "Please enable location access to use this feature."
        );
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });
    } catch (error) {
      console.error("Error fetching user location:", error);
      Alert.alert("Error", "Failed to fetch your location.");
    }
  };

  // Fetch all parking spots from the database
  const fetchParkingSpots = async () => {
    try {
      const { data, error } = await supabase
        .from("parking")
        .select("parking_id, lat, long, addr, purl1, email_id");

      if (error) {
        throw error;
      }

      // Convert latitude and longitude to numbers
      const spots = data.map((spot) => ({
        id: spot.parking_id,
        latitude: parseFloat(spot.lat),
        longitude: parseFloat(spot.long),
        address: spot.addr,
        parking_image1_url: spot.purl1,
        email_id: spot.email_id,
      }));

      setParkingSpots(spots);
    } catch (error) {
      console.error("Error fetching parking spots:", error);
      Alert.alert("Error", "Failed to fetch parking spots.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserLocation();
    fetchParkingSpots();
  }, []);

  // Navigate to Profile page
  const goToProfile = () => {
    router.push("/profile");
  };

  // Handle direct navigation to add parking spot
  const handleAddParkingSpot = () => {
    router.push("/addParkingSpot");
  };

  // Handle marker press
  const handleMarkerPress = (spot: {
    address: string;
    parking_image1_url: string;
    email_id: string;
  }) => {
    setSelectedSpot(spot);
  };

  // Close the image modal
  const closeImageModal = () => {
    setSelectedSpot(null);
  };

  // Render custom parking spot markers
  const renderParkingMarker = (spot: {
    id: string;
    latitude: number;
    longitude: number;
    address: string;
    parking_image1_url: string;
    email_id: string;
  }) => {
    return (
      <Marker
        key={spot.id}
        coordinate={{ latitude: spot.latitude, longitude: spot.longitude }}
        title={spot.address}
        description="Tap to view details"
        onPress={() => handleMarkerPress(spot)}
      >
        <View className="bg-purple-500 p-1 rounded-full border border-white w-8 h-8 justify-center items-center">
          <Text className="text-white font-bold">P</Text>
        </View>
      </Marker>
    );
  };

  if (errorMsg) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white text-lg">{errorMsg}</Text>
      </View>
    );
  }

  if (!userLocation || loading) {
    return (
      <View className="flex-1 bg-gray-900 justify-center items-center">
        <Text className="text-white text-lg">Loading...</Text>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-900 p-6">
      {/* Header with Profile Button */}
      <View className="flex-row justify-between items-center">
        <View>
          <Text className="text-5xl font-bold text-purple-400 font-pbold">
            Parking
          </Text>
          <Text className="text-xl mt-2 text-gray-300 font-psemibold">
            Find and share parking spots.
          </Text>
        </View>

        {/* Profile Button */}
        <TouchableOpacity
          onPress={goToProfile}
          className="bg-gray-800 p-3 rounded-full"
        >
          <Feather name="user" size={24} color="#A78BFA" />
        </TouchableOpacity>
      </View>

      {/* Map View */}
      <View className="flex-1 mt-8">
        <MapView
          style={{ flex: 1 }}
          initialRegion={{
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.0922,
            longitudeDelta: 0.0421,
          }}
        >
          {/* User's Current Location Marker */}
          <Marker
            coordinate={{
              latitude: userLocation.latitude,
              longitude: userLocation.longitude,
            }}
            pinColor="purple"
          />

          {/* Parking Spot Markers (only if parkingSpots is not empty) */}
          {parkingSpots.length > 0 &&
            parkingSpots.map((spot) => renderParkingMarker(spot))}
        </MapView>
      </View>

      {/* Button Row: Add Parking */}
      <View className="mt-8 flex-row space-x-4">
        <TouchableOpacity
          onPress={handleAddParkingSpot}
          className="flex-1 bg-purple-500 py-4 rounded-lg"
        >
          <Text className="text-center text-xl text-white font-pbold">
            Add Parking Spot
          </Text>
        </TouchableOpacity>
      </View>

      {/* Image Modal */}
      <Modal
        visible={!!selectedSpot}
        transparent={true}
        animationType="slide"
        onRequestClose={closeImageModal}
      >
        <View className="flex-1 justify-center items-center bg-black/80">
          <View className="bg-white p-4 rounded-lg w-11/12">
            {selectedSpot && (
              <>
                <Text className="text-lg font-bold mb-2">
                  Address: {selectedSpot.address}
                </Text>
                <Text className="text-gray-600 mb-4">
                  Added by: {selectedSpot.email_id}
                </Text>
                <Image
                  source={{ uri: selectedSpot.parking_image1_url }}
                  className="w-full h-64 rounded-lg"
                  resizeMode="cover"
                />
                <TouchableOpacity
                  onPress={closeImageModal}
                  className="mt-4 bg-purple-500 py-2 rounded-lg"
                >
                  <Text className="text-center text-white font-bold">
                    Close
                  </Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ParkingPage;
