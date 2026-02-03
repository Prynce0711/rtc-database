// API configuration
let API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000";

export const getApiUrl = () => API_URL;

export const setApiUrl = (url: string) => {
  API_URL = url;
  console.log("📡 API URL updated to:", url);

  // Dynamically import to avoid circular dependency
  import("./auth-client").then(({ reinitializeAuthClient }) => {
    reinitializeAuthClient();
  });
};

export const ENDPOINTS = {
  get CASES() {
    return `${API_URL}/cases`;
  },
};
