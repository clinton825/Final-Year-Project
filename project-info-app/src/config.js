// API configuration
const API_URL = process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' ? 
    'http://localhost:8080' : 
    'https://infrastructure-tracker-api.onrender.com');

// BuildingInfo API keys - must be provided via environment variables
const BUILDINGINFO_API_KEY = process.env.REACT_APP_BUILDINGINFO_API_KEY;
const BUILDINGINFO_UKEY = process.env.REACT_APP_BUILDINGINFO_UKEY;

// Direct API endpoints for fallback
const DIRECT_API_ENABLED = true; // Toggle to enable/disable direct API fallback
const DIRECT_API_URL = "https://api12.buildinginfo.com/api/v2/bi";

// Export configuration
const config = {
  API_URL,
  BUILDINGINFO_API_KEY,
  BUILDINGINFO_UKEY,
  DIRECT_API_ENABLED,
  DIRECT_API_URL,
  PRODUCTION: window.location.hostname !== 'localhost',
  VERSION: '1.0.0'
};

// Log configuration on startup (excluding sensitive values)
console.log('App configuration loaded:', {
  API_URL: config.API_URL,
  DIRECT_API_ENABLED: config.DIRECT_API_ENABLED,
  PRODUCTION: config.PRODUCTION,
  VERSION: config.VERSION
});

export default config;
