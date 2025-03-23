import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://ecavttggdhfsaxxehboa.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjYXZ0dGdnZGhmc2F4eGVoYm9hIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDI2MDc0ODMsImV4cCI6MjA1ODE4MzQ4M30.SyfBHD1DXZCMC6ejRKKJ69ZuSVBXpb-nLq7Cd-hGegs";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
