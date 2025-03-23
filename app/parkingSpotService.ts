import supabase from "./supabaseClient";

type SpotData = {
  type: string;
  status: string;
  address: string;
  latitude: string;
  longitude: string;
  email_id: string;
  parkingspot_image1_url: string;
  parkingspot_image2_url: string;
  parkingspot_image3_url: string;
  comments: string;
  provider_account_addr: string; // Add provider_account_addr
  provider_evm_addr: string; // Add provider_evm_addr
};

export const parkingSpotService = async (spotData: SpotData) => {
  const {
    type,
    status,
    address,
    latitude,
    longitude,
    email_id,
    parkingspot_image1_url,
    parkingspot_image2_url,
    parkingspot_image3_url,
    comments,
    provider_account_addr,
    provider_evm_addr,
  } = spotData;

  const { data, error } = await supabase.from("Parking").insert([
    {
      type,
      status,
      address,
      latitude,
      longitude,
      email_id,
      parkingspot_image1_url: parkingspot_image1_url || "",
      parkingspot_image2_url: parkingspot_image2_url || "",
      parkingspot_image3_url: parkingspot_image3_url || "",
      comments,
      provider_account_addr, // Include provider_account_addr
      provider_evm_addr, // Include provider_evm_addr
    },
  ]);

  if (error) {
    console.error("Error creating parking spot:", error);
    throw error;
  }

  // Return a success message if data is inserted successfully
  return { success: true, message: "Parking spot added successfully!" };
};
