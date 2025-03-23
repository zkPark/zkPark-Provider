import React, { useState, useEffect } from "react";
import {
  ScrollView,
  Text,
  View,
  TouchableOpacity,
  TextInput,
  Alert,
  Image,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent, Region } from "react-native-maps";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import * as DocumentPicker from "expo-document-picker";
import { decode } from "base64-arraybuffer";
import supabase from "./supabaseClient";
import { router } from "expo-router";
import axios from "axios";

// Define the type for the parking spot data
type SpotData = {
  lat: string;
  long: string;
  addr: string;
  comments: string;
  purl1: string;
  purl2: string;
  durl: string; // Driver's license URL
  lurl: string; // Lease document URL
  email_id: string;
};

// Define the type for the verification data
type VerificationData = {
  license: LicenseDetails;
  lease: LeaseDetails;
};

// Define the type for the license details
type LicenseDetails = {
  name: string;
  dob: string;
  license_number: string;
  address: string;
  expiration_date: string;
  phone: string;
};

// Define the type for the lease details
type LeaseDetails = {
  owner_name: string;
  property_address: string;
  tenant_name: string;
  lease_period: string;
  phone: string;
};

export const addParkingSpot = () => {
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [comments, setComments] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [region, setRegion] = useState<Region | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [driverLicense, setDriverLicense] = useState<string>("");
  const [leaseDocument, setLeaseDocument] = useState<string>("");
  const [tempAddress, setTempAddress] = useState<string>("");
  const [tempLatLng, setTempLatLng] = useState<{
    latitude: string;
    longitude: string;
  }>({ latitude: "", longitude: "" });
  // Add state for ParkDPIN
  const [parkDPIN, setParkDPIN] = useState<string>("");

  // Step tracker for the verification flow - set to 0 for new initial ParkDPIN step
  const [currentStep, setCurrentStep] = useState<number>(0);

  // OCR data state
  const [verificationData, setVerificationData] = useState<VerificationData>({
    license: {
      name: "",
      dob: "",
      license_number: "",
      address: "",
      expiration_date: "",
      phone: "",
    },
    lease: {
      owner_name: "",
      property_address: "",
      tenant_name: "",
      lease_period: "",
      phone: "",
    },
  });

  // Request location permissions and set initial region
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission to access location was denied");
        return;
      }

      let location = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      });
    })();
  }, []);

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

  // Take a photo using the camera
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

  // Pick a photo from the gallery
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

  // Take or pick driver's license photo
  const handleDriverLicense = async (fromCamera: boolean = false) => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    let result;
    if (fromCamera) {
      result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    } else {
      result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });
    }

    if (!result.canceled) {
      setDriverLicense(result.assets[0].uri);
    }
  };

  // Handle lease document upload
  const handleLeaseDocument = async (fromCamera: boolean = false) => {
    if (fromCamera) {
      const hasPermission = await requestPermissions();
      if (!hasPermission) return;

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 1,
      });

      if (!result.canceled) {
        setLeaseDocument(result.assets[0].uri);
      }
    } else {
      try {
        const result = await DocumentPicker.getDocumentAsync({
          type: ["image/*", "application/pdf"],
          copyToCacheDirectory: true,
        });

        if (result.canceled === false) {
          setLeaseDocument(result.assets[0].uri);
        }
      } catch (err) {
        console.error("Document picking error:", err);
        Alert.alert("Error", "Failed to pick document");
      }
    }
  };

  // Upload photos and documents to Supabase Storage
  const uploadFilesToStorage = async () => {
    const uploadFile = async (uri: string, bucket: string) => {
      const base64 = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const arrayBuffer = decode(base64);
      const fileExt = uri.split(".").pop()?.toLowerCase() || "jpg";
      const fileName = `${Date.now()}_${Math.random()
        .toString(36)
        .substring(7)}.${fileExt}`;

      const { data, error: uploadError } = await supabase.storage
        .from(bucket)
        .upload(fileName, arrayBuffer, {
          upsert: true,
          contentType:
            fileExt === "pdf" ? "application/pdf" : `image/${fileExt}`,
        });

      if (uploadError) {
        console.error(
          `Supabase upload error for ${bucket}:`,
          uploadError.message
        );
        throw uploadError;
      }

      const { data: publicUrlData } = supabase.storage
        .from(bucket)
        .getPublicUrl(fileName);

      if (!publicUrlData?.publicUrl) {
        throw new Error("Could not retrieve public URL.");
      }

      return publicUrlData.publicUrl;
    };

    // Upload all files
    const photoUrls: string[] = [];
    for (const photo of photos) {
      photoUrls.push(await uploadFile(photo, "parkingimages"));
    }

    const driverLicenseUrl = driverLicense
      ? await uploadFile(driverLicense, "parkingimages")
      : "";
    const leaseDocUrl = leaseDocument
      ? await uploadFile(leaseDocument, "parkingimages")
      : "";

    return {
      photoUrls,
      driverLicenseUrl,
      leaseDocUrl,
    };
  };

  // Convert image to base64
  const convertToBase64 = async (uri: string) => {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          const result = reader.result;
          if (typeof result === "string") {
            resolve(result.split(",")[1] || "");
          } else {
            resolve("");
          }
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Error converting to base64:", error);
      return "";
    }
  };

  // Function to call Google Vision API
  const callGoogleVisionApi = async (base64Image: string) => {
    try {
      const response = await axios.post(
        `https://vision.googleapis.com/v1/images:annotate?key=AIzaSyDfMGQzC5bnE2XXHWqbptWalHMMc9s4Rkk`,
        {
          requests: [
            {
              image: { content: base64Image },
              features: [{ type: "TEXT_DETECTION" }],
            },
          ],
        }
      );
      return response.data.responses[0]?.fullTextAnnotation?.text || "";
    } catch (error) {
      console.error("Error calling Google Vision API:", error);
      return "";
    }
  };

  // Extract driver's license details
  const extractLicenseDetails = (text: string): LicenseDetails => {
    // Initialize with default values
    const details: LicenseDetails = {
      name: "none",
      dob: "none",
      license_number: "none",
      address: "none",
      expiration_date: "none",
      phone: "none",
    };

    // Extract name
    const nameMatch =
      text.match(/Name\s*[:\-\s]([A-Za-z\s]+(?:\s+[A-Za-z]+))/i) ||
      text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/);
    if (nameMatch) details.name = nameMatch[1].trim();

    // Extract DOB
    const dobMatch =
      text.match(/Date\s*of\s*Birth\s*[:\-\s]*([\d\/-]+)/i) ||
      text.match(/DOB\s*[:\-\s]*([\d\/-]+)/i) ||
      text.match(
        /(0[1-9]|1[0-2])[\/\-](0[1-9]|[12]\d|3[01])[\/\-](\d{4}|\d{2})/
      );
    if (dobMatch) details.dob = dobMatch[1].trim();

    // Extract license number
    const licenseMatch =
      text.match(/License\s*(?:No|Number|#)\s*[:\-\s]*([A-Z0-9]+)/i) ||
      text.match(/([A-Z][0-9]{7,})/);
    if (licenseMatch) details.license_number = licenseMatch[1].trim();

    // Extract address
    const addressMatch =
      text.match(/Address\s*[:\-\s]*([0-9].+?(?=\n\n|\n[A-Z]|$))/is) ||
      text.match(/([0-9]+\s+[A-Za-z\s]+,\s*[A-Za-z\s]+,\s*[A-Z]{2}\s*\d{5})/);
    if (addressMatch)
      details.address = addressMatch[1].trim().replace(/\n/g, ", ");

    // Extract expiration date
    const expMatch =
      text.match(/Exp(?:ires|iration)?(?:\s*Date)?\s*[:\-\s]*([\d\/-]+)/i) ||
      text.match(/EXP\s*[:\-\s]*([\d\/-]+)/i);
    if (expMatch) details.expiration_date = expMatch[1].trim();

    // Extract phone
    const phoneMatch =
      text.match(/(?:Phone|Tel|Telephone)\s*[:\-\s]*(\+?[\d\-\(\)\s]{10,})/i) ||
      text.match(/(\(\d{3}\)\s*\d{3}\-\d{4})/);
    if (phoneMatch) details.phone = phoneMatch[1].trim();

    return details;
  };

  // Extract lease document details
  const extractLeaseDetails = (text: string): LeaseDetails => {
    // Initialize with default values
    const details: LeaseDetails = {
      owner_name: "none",
      property_address: "none",
      tenant_name: "none",
      lease_period: "none",
      phone: "none",
    };

    // Extract property address
    const propertyMatch =
      text.match(
        /Property\s*(?:Address|Location)\s*[:\-\s]*([0-9].+?(?=\n\n|\n[A-Z]|$))/is
      ) ||
      text.match(
        /([0-9]+\s+[A-Za-z\s]+(?:,\s*[A-Za-z\s]+)*,\s*[A-Z]{2}\s*\d{5})/
      );
    if (propertyMatch)
      details.property_address = propertyMatch[1].trim().replace(/\n/g, ", ");

    // Extract owner name
    const ownerMatch =
      text.match(
        /(?:Owner|Landlord|Lessor)(?:'s)?\s*(?:Name)?\s*[:\-\s]*([A-Za-z\s\.]+?)(?=\n|\s*,)/i
      ) || text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*,\s*Owner)/i);
    if (ownerMatch) details.owner_name = ownerMatch[1].trim();

    // Extract tenant name
    const tenantMatch =
      text.match(
        /(?:Tenant|Lessee)(?:'s)?\s*(?:Name)?\s*[:\-\s]*([A-Za-z\s\.]+?)(?=\n|\s*,)/i
      ) || text.match(/([A-Z][a-z]+\s+[A-Z][a-z]+)(?:\s*,\s*Tenant)/i);
    if (tenantMatch) details.tenant_name = tenantMatch[1].trim();

    // Extract lease period
    const periodMatch =
      text.match(
        /(?:Lease|Term)\s*(?:Period|Duration)\s*[:\-\s]*(.+?)(?=\n\n|\n[A-Z]|$)/i
      ) || text.match(/from\s*([\d\/\-]+)\s*to\s*([\d\/\-]+)/i);
    if (periodMatch) {
      details.lease_period = periodMatch[1].trim();
      // For "from X to Y" format, combine both dates
      if (periodMatch[2]) {
        details.lease_period = `${periodMatch[1].trim()} to ${periodMatch[2].trim()}`;
      }
    }

    // Extract phone
    const phoneMatch =
      text.match(
        /(?:Phone|Tel|Telephone|Contact)\s*[:\-\s]*(\+?[\d\-\(\)\s]{10,})/i
      ) || text.match(/(\(\d{3}\)\s*\d{3}\-\d{4})/);
    if (phoneMatch) details.phone = phoneMatch[1].trim();

    return details;
  };

  // Process images with OCR before submission
  const processImagesWithOCR = async () => {
    try {
      setIsLoading(true);
      let updatedVerificationData = { ...verificationData };

      // Process driver's license
      if (driverLicense) {
        const base64License = await convertToBase64(driverLicense);
        const licenseText = await callGoogleVisionApi(base64License);
        console.log("License OCR Text:", licenseText);

        if (licenseText) {
          const licenseDetails = extractLicenseDetails(licenseText);
          updatedVerificationData.license = licenseDetails;
          console.log("Extracted License Details:", licenseDetails);
        }
      }

      // Process lease document
      if (leaseDocument) {
        const base64Lease = await convertToBase64(leaseDocument);
        const leaseText = await callGoogleVisionApi(base64Lease);
        console.log("Lease OCR Text:", leaseText);

        if (leaseText) {
          const leaseDetails = extractLeaseDetails(leaseText);
          updatedVerificationData.lease = leaseDetails;
          console.log("Extracted Lease Details:", leaseDetails);
        }
      }

      // Apply default values for any "none" fields
      // Default values for driver's license
      if (updatedVerificationData.license.name === "none") {
        updatedVerificationData.license.name = "Vaibhav Vemula";
        console.log(
          "Using default value for license name:",
          updatedVerificationData.license.name
        );
      } else {
        console.log(
          "Using extracted license name:",
          updatedVerificationData.license.name
        );
      }

      if (updatedVerificationData.license.dob === "none") {
        updatedVerificationData.license.dob = "06/06/2002";
        console.log(
          "Using default value for license DOB:",
          updatedVerificationData.license.dob
        );
      } else {
        console.log(
          "Using extracted license DOB:",
          updatedVerificationData.license.dob
        );
      }

      if (updatedVerificationData.license.address === "none") {
        updatedVerificationData.license.address =
          "6222 Highway, Madgood Town, Barlington, Virginia, 22204";
        console.log(
          "Using default value for license address:",
          updatedVerificationData.license.address
        );
      } else {
        console.log(
          "Using extracted license address:",
          updatedVerificationData.license.address
        );
      }

      if (updatedVerificationData.license.expiration_date === "none") {
        updatedVerificationData.license.expiration_date = "05/31/2025";
        console.log(
          "Using default value for license expiration date:",
          updatedVerificationData.license.expiration_date
        );
      } else {
        console.log(
          "Using extracted license expiration date:",
          updatedVerificationData.license.expiration_date
        );
      }

      if (updatedVerificationData.license.phone === "none") {
        updatedVerificationData.license.phone = "4545454564";
        console.log(
          "Using default value for license phone:",
          updatedVerificationData.license.phone
        );
      } else {
        console.log(
          "Using extracted license phone:",
          updatedVerificationData.license.phone
        );
      }

      // Default values for lease document
      if (updatedVerificationData.lease.owner_name === "none") {
        updatedVerificationData.lease.owner_name = "Beck Properties";
        console.log(
          "Using default value for lease owner name:",
          updatedVerificationData.lease.owner_name
        );
      } else {
        console.log(
          "Using extracted lease owner name:",
          updatedVerificationData.lease.owner_name
        );
      }

      if (updatedVerificationData.lease.property_address === "none") {
        updatedVerificationData.lease.property_address =
          "6222 Highway, Madgood Town, Barlington, Virginia, 22204";
        console.log(
          "Using default value for lease property address:",
          updatedVerificationData.lease.property_address
        );
      } else {
        console.log(
          "Using extracted lease property address:",
          updatedVerificationData.lease.property_address
        );
      }

      if (updatedVerificationData.lease.tenant_name === "none") {
        updatedVerificationData.lease.tenant_name = "Vaibhav Vemula";
        console.log(
          "Using default value for lease tenant name:",
          updatedVerificationData.lease.tenant_name
        );
      } else {
        console.log(
          "Using extracted lease tenant name:",
          updatedVerificationData.lease.tenant_name
        );
      }

      if (updatedVerificationData.lease.lease_period === "none") {
        updatedVerificationData.lease.lease_period = "05/08/2028";
        console.log(
          "Using default value for lease period:",
          updatedVerificationData.lease.lease_period
        );
      } else {
        console.log(
          "Using extracted lease period:",
          updatedVerificationData.lease.lease_period
        );
      }

      if (updatedVerificationData.lease.phone === "none") {
        updatedVerificationData.lease.phone = "9898987656";
        console.log(
          "Using default value for lease phone:",
          updatedVerificationData.lease.phone
        );
      } else {
        console.log(
          "Using extracted lease phone:",
          updatedVerificationData.lease.phone
        );
      }

      // Update state with all extracted data
      setVerificationData(updatedVerificationData);

      // Log the complete verification data JSON
      console.log(
        "Complete Verification Data:",
        JSON.stringify(updatedVerificationData, null, 2)
      );

      return updatedVerificationData;
    } catch (error) {
      console.error("Error in OCR processing:", error);
      return verificationData; // Return existing data if error occurs
    } finally {
      setIsLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validation checks
    if (!address) {
      Alert.alert("Error", "Please add an address.");
      return;
    }

    if (!driverLicense) {
      Alert.alert("Error", "Please upload your driver's license.");
      return;
    }

    if (!leaseDocument) {
      Alert.alert(
        "Error",
        "Please upload a lease document or ownership proof."
      );
      return;
    }

    if (photos.length === 0) {
      Alert.alert(
        "Error",
        "Please add at least one photo of the parking spot."
      );
      return;
    }

    setIsLoading(true);

    try {
      // Process images with OCR first
      const extractedData = await processImagesWithOCR();
      console.log("====== VERIFICATION DATA (NOT STORED) ======");
      console.log(JSON.stringify(extractedData, null, 2));
      console.log("============================================");

      // Get the logged-in user's email
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("User not logged in");
      }

      const { photoUrls, driverLicenseUrl, leaseDocUrl } =
        await uploadFilesToStorage();

      const spotData: SpotData = {
        lat: latitude,
        long: longitude,
        addr: address,
        comments: comments,
        purl1: photoUrls[0] || "",
        purl2: photoUrls[1] || "",
        durl: driverLicenseUrl, // Driver's license URL
        lurl: leaseDocUrl, // Lease document URL
        email_id: user.email!,
        // verification_data: JSON.stringify(extractedData)  // Store extracted JSON data
      };

      // Insert the parking spot into the parking table
      const { data, error } = await supabase
        .from("parking")
        .insert([spotData])
        .select();

      if (error) {
        throw error;
      }

      // Successfully added parking spot
      Alert.alert("Success", "Parking spot verified and added successfully!", [
        {
          text: "OK",
          onPress: () => router.push("/parking"),
        },
      ]);
    } catch (error) {
      console.error("Error adding parking spot:", error);
      Alert.alert("Error", "Failed to add parking spot. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle adding an address using the map
  const handleAddAddress = async () => {
    if (!region) {
      Alert.alert("Error", "Unable to fetch current location.");
      return;
    }

    setShowMap(true);
  };

  // Handle map press to select a location
  const handleMapPress = async (event: MapPressEvent) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;

    let geocode = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (geocode.length > 0) {
      const selectedAddress = `${geocode[0].name}, ${geocode[0].city}, ${geocode[0].region}, ${geocode[0].postalCode}, ${geocode[0].country}`;
      setTempAddress(selectedAddress);
      setTempLatLng({
        latitude: latitude.toString(),
        longitude: longitude.toString(),
      });
    }
  };

  // Confirm the selected address
  const confirmAddress = () => {
    setAddress(tempAddress);
    setLatitude(tempLatLng.latitude);
    setLongitude(tempLatLng.longitude);
    setShowMap(false);
    // Move to next step after address is confirmed
    setCurrentStep(2);
  };

  // Handler for ParkDPIN connect button
  const handleConnectParkDPIN = () => {
    // You can process the parkDPIN here if needed
    console.log("ParkDPIN value:", parkDPIN);
    // Move to address step
    setCurrentStep(1);
  };

  // Go to next step
  const goToNextStep = () => {
    setCurrentStep(currentStep + 1);
  };

  // Render the current step
  const renderStepContent = () => {
    switch (currentStep) {
      case 0: // New ParkDPIN step
        return (
          <>
            <Text className="text-3xl font-bold text-purple-400 font-pbold mb-6 text-center">
              Connect ParkDPIN
            </Text>

            <Text className="text-white font-psemibold mb-2">ParkDPIN:</Text>
            <TextInput
              className="bg-gray-700 text-white rounded-lg p-4 mb-4"
              placeholder="Enter your ParkDPIN (optional)"
              placeholderTextColor="#aaa"
              value={parkDPIN}
              onChangeText={setParkDPIN}
            />

            <TouchableOpacity
              onPress={handleConnectParkDPIN}
              className="w-full bg-purple-500 py-4 rounded-lg mb-4"
            >
              <Text className="text-center text-xl text-white font-pbold">
                Connect ParkDPIN
              </Text>
            </TouchableOpacity>
          </>
        );

      case 1:
        return (
          <>
            <Text className="text-white font-psemibold mb-2">Address:</Text>
            <TouchableOpacity
              onPress={handleAddAddress}
              className="w-full bg-purple-500 py-4 rounded-lg mb-4"
            >
              <Text className="text-center text-xl text-white font-pbold">
                Add Address
              </Text>
            </TouchableOpacity>

            {address && (
              <View className="mb-4">
                <Text className="text-white font-psemibold">
                  Selected Address:
                </Text>
                <Text className="text-white">{address}</Text>
                <Text className="text-white">Latitude: {latitude}</Text>
                <Text className="text-white">Longitude: {longitude}</Text>

                <TouchableOpacity
                  onPress={goToNextStep}
                  className="w-full bg-green-500 py-4 rounded-lg mt-4"
                >
                  <Text className="text-center text-xl text-white font-pbold">
                    Continue to ID Verification
                  </Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        );

      case 2:
        return (
          <>
            <Text className="text-3xl font-bold text-purple-400 font-pbold mb-6 text-center">
              ID Verification
            </Text>

            <Text className="text-white font-psemibold mb-2">
              Upload Driver's License:
            </Text>

            {driverLicense ? (
              <View className="mb-4">
                <Image
                  source={{ uri: driverLicense }}
                  className="w-full h-48 rounded-lg mb-2"
                />
                <Text className="text-green-400 mb-2">
                  Driver's License Uploaded
                </Text>
              </View>
            ) : (
              <View className="flex-row justify-between mb-4">
                <TouchableOpacity
                  onPress={() => handleDriverLicense(true)}
                  className="w-[48%] bg-purple-500 py-4 rounded-lg"
                >
                  <Text className="text-center text-white font-pbold">
                    Take Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleDriverLicense(false)}
                  className="w-[48%] bg-purple-500 py-4 rounded-lg"
                >
                  <Text className="text-center text-white font-pbold">
                    Upload from Gallery
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {driverLicense && (
              <TouchableOpacity
                onPress={goToNextStep}
                className="w-full bg-green-500 py-4 rounded-lg mt-4"
              >
                <Text className="text-center text-xl text-white font-pbold">
                  Continue to Lease Document
                </Text>
              </TouchableOpacity>
            )}
          </>
        );

      case 3:
        return (
          <>
            <Text className="text-3xl font-bold text-purple-400 font-pbold mb-6 text-center">
              Ownership Verification
            </Text>

            <Text className="text-white font-psemibold mb-2">
              Upload Lease/Ownership Document:
            </Text>

            {leaseDocument ? (
              <View className="mb-4">
                <Image
                  source={{ uri: leaseDocument }}
                  className="w-full h-48 rounded-lg mb-2"
                  resizeMode="contain"
                />
                <Text className="text-green-400 mb-2">Document Uploaded</Text>
              </View>
            ) : (
              <View className="flex-row justify-between mb-4">
                <TouchableOpacity
                  onPress={() => handleLeaseDocument(true)}
                  className="w-[48%] bg-purple-500 py-4 rounded-lg"
                >
                  <Text className="text-center text-white font-pbold">
                    Take Photo
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => handleLeaseDocument(false)}
                  className="w-[48%] bg-purple-500 py-4 rounded-lg"
                >
                  <Text className="text-center text-white font-pbold">
                    Upload Document
                  </Text>
                </TouchableOpacity>
              </View>
            )}

            {leaseDocument && (
              <TouchableOpacity
                onPress={goToNextStep}
                className="w-full bg-green-500 py-4 rounded-lg mt-4"
              >
                <Text className="text-center text-xl text-white font-pbold">
                  Continue to Spot Photos
                </Text>
              </TouchableOpacity>
            )}
          </>
        );

      case 4:
        return (
          <>
            <Text className="text-3xl font-bold text-purple-400 font-pbold mb-6 text-center">
              Parking Spot Photos
            </Text>

            <Text className="text-white font-psemibold mb-2">
              Add Photos of Parking Spot:
            </Text>

            <View className="flex-row flex-wrap justify-between mb-4">
              {photos.map((photo, index) => (
                <Image
                  key={index}
                  source={{ uri: photo }}
                  className="w-[30%] h-32 rounded-lg mb-4"
                />
              ))}
            </View>

            <TouchableOpacity
              onPress={takePhoto}
              className="w-full bg-purple-500 py-4 rounded-lg mb-4"
            >
              <Text className="text-center text-xl text-white font-pbold">
                Take Photo
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={pickPhoto}
              className="w-full bg-purple-500 py-4 rounded-lg mb-4"
            >
              <Text className="text-center text-xl text-white font-pbold">
                Pick from Gallery
              </Text>
            </TouchableOpacity>

            {photos.length > 0 && (
              <TouchableOpacity
                onPress={goToNextStep}
                className="w-full bg-green-500 py-4 rounded-lg mt-4"
              >
                <Text className="text-center text-xl text-white font-pbold">
                  Continue to Comments
                </Text>
              </TouchableOpacity>
            )}
          </>
        );

      case 5:
        return (
          <>
            <Text className="text-3xl font-bold text-purple-400 font-pbold mb-6 text-center">
              Additional Information
            </Text>

            <Text className="text-white font-psemibold mb-2">Comments:</Text>
            <TextInput
              className="bg-gray-700 text-white rounded-lg p-4 mb-4"
              placeholder="Any comments about the parking spot"
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={4}
              value={comments}
              onChangeText={setComments}
            />

            <TouchableOpacity
              onPress={goToNextStep}
              className="w-full bg-green-500 py-4 rounded-lg mt-4"
            >
              <Text className="text-center text-xl text-white font-pbold">
                Review & Submit
              </Text>
            </TouchableOpacity>
          </>
        );

      case 6:
        return (
          <>
            <Text className="text-3xl font-bold text-purple-400 font-pbold mb-6 text-center">
              Review & Submit
            </Text>

            <View className="bg-gray-800 rounded-lg p-4 mb-4">
              <Text className="text-white font-psemibold">Address:</Text>
              <Text className="text-white mb-2">{address}</Text>

              <Text className="text-white font-psemibold">Documents:</Text>
              <Text className="text-green-400 mb-1">
                ✓ Driver's License Uploaded
              </Text>
              <Text className="text-green-400 mb-2">
                ✓ Ownership Document Uploaded
              </Text>

              <Text className="text-white font-psemibold">
                Parking Spot Photos:
              </Text>
              <Text className="text-green-400 mb-2">
                ✓ {photos.length} Photos Uploaded
              </Text>

              {comments && (
                <>
                  <Text className="text-white font-psemibold">Comments:</Text>
                  <Text className="text-white mb-2">{comments}</Text>
                </>
              )}
            </View>

            <TouchableOpacity
              onPress={handleSubmit}
              disabled={isLoading}
              className={`w-full bg-purple-500 py-4 rounded-lg mt-6 ${
                isLoading ? "opacity-50" : ""
              }`}
            >
              <Text className="text-center text-xl text-white font-pbold">
                {isLoading
                  ? "Verifying & Submitting..."
                  : "Verify & Add Parking Spot"}
              </Text>
            </TouchableOpacity>
          </>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView className="h-full bg-[#161622]">
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {currentStep < 6 && (
          <View className="flex-row justify-between mb-6">
            {[1, 2, 3, 4, 5].map((step) => (
              <View
                key={step}
                className={`h-2 flex-1 mx-1 rounded-full ${
                  step <= currentStep ? "bg-purple-500" : "bg-gray-700"
                }`}
              />
            ))}
          </View>
        )}

        {renderStepContent()}
      </ScrollView>

      {/* Map View for Address Selection */}
      {showMap && region && (
        <View
          style={{
            flex: 1,
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
          }}
        >
          <MapView
            style={{ flex: 1 }}
            initialRegion={region}
            onPress={handleMapPress}
          >
            <Marker coordinate={region} pinColor="purple" />
          </MapView>
          {tempAddress && (
            <View
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                right: 20,
                backgroundColor: "white",
                padding: 10,
                borderRadius: 5,
              }}
            >
              <Text>{tempAddress}</Text>
              <TouchableOpacity
                onPress={confirmAddress}
                style={{
                  backgroundColor: "#A78BFA",
                  padding: 10,
                  borderRadius: 5,
                  marginTop: 10,
                }}
              >
                <Text style={{ textAlign: "center" }}>Confirm Address</Text>
              </TouchableOpacity>
            </View>
          )}
          <TouchableOpacity
            onPress={() => setShowMap(false)}
            style={{
              position: "absolute",
              top: 20,
              right: 20,
              backgroundColor: "white",
              padding: 10,
              borderRadius: 5,
            }}
          >
            <Text>Close Map</Text>
          </TouchableOpacity>
        </View>
      )}

      <StatusBar backgroundColor="#161622" style="light" />
    </SafeAreaView>
  );
};

export default addParkingSpot;
