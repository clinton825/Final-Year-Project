// Import fetch directly
const fetch = require('node-fetch');

// Add timeout to fetch requests
const fetchWithTimeout = (url, options = {}) => {
  const { timeout = 10000, ...fetchOptions } = options;
  
  return Promise.race([
    fetch(url, fetchOptions),
    new Promise((_, reject) => 
      setTimeout(() => reject(new Error(`Request timed out after ${timeout}ms`)), timeout)
    )
  ]);
};

// Utility function to retry failed requests
async function fetchWithRetry(url, options, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries} for URL: ${url}`);
      const response = await fetchWithTimeout(url, options);
      return response;
    } catch (error) {
      if (attempt === maxRetries) {
        throw error;
      }
      console.log(`Attempt ${attempt} failed, retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      // Increase delay for next attempt
      delay *= 2;
    }
  }
}

// Convert pound values to euro values (assuming a fixed exchange rate for simplicity)
const convertToEuros = (poundValue) => {
  if (!poundValue) return null;
  // Remove the pound symbol and any commas
  const numericValue = parseFloat(poundValue.replace(/[£,]/g, ''));
  if (isNaN(numericValue)) return null;
  
  // Use current exchange rate (this is simplified, you might want to use a real exchange rate API)
  const exchangeRate = 1.17; // Example rate: 1 GBP = 1.17 EUR
  const euroValue = numericValue * exchangeRate;
  
  // Format with euro symbol and thousands separators
  return euroValue.toLocaleString('en-IE', { 
    style: 'currency', 
    currency: 'EUR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
};

const getProjectInfoByPlanningID = async (planning_id) => {
  try {
    const response = await fetchWithRetry(`https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_id=${planning_id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // If data is an array, find the matching project
    if (Array.isArray(data)) {
      return data[0];
    }
    
    // If data is an object with a data property containing rows
    if (data && data.data && Array.isArray(data.data.rows)) {
      return data.data.rows[0];
    }
    
    // If data is a single object
    if (data && typeof data === 'object') {
      return data;
    }

    throw new Error('No project data found');
  } catch (error) {
    console.error('Error fetching project:', error);
    throw error;
  }
};

const getAllProjects = async () => {
  try {
    const url = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}`;
    
    console.log('Making API request for all projects');
    console.log('API Key length:', process.env.BUILDING_INFO_API_KEY?.length);
    console.log('User Key length:', process.env.BUILDING_INFO_USER_KEY?.length);
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Project-Info-App/1.0'
      },
      timeout: 15000
    });

    if (!response.ok) {
      console.error(`API responded with status: ${response.status} - ${response.statusText}`);
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('API Response Status:', response.status);
    console.log('API Response Content Type:', response.headers.get('content-type'));
    console.log('API Response Data Type:', typeof data);
    
    if (data) {
      console.log('API Response First Level Keys:', Object.keys(data));
    }

    // Check if data has the expected structure
    let projectsArray;
    if (Array.isArray(data)) {
      console.log('Data is an array with length:', data.length);
      projectsArray = data;
    } else if (data && data.data && Array.isArray(data.data)) {
      console.log('Data has a data property that is an array with length:', data.data.length);
      projectsArray = data.data;
    } else if (data && data.data && data.data.rows && Array.isArray(data.data.rows)) {
      console.log('Data has a data.rows property that is an array with length:', data.data.rows.length);
      projectsArray = data.data.rows;
    } else if (data && typeof data === 'object') {
      console.log('Data is a non-array object, treating as single project');
      projectsArray = [data];
    } else {
      console.error('Unexpected API response format:', typeof data);
      throw new Error('Unexpected API response format');
    }

    // Convert all pound values to euros
    const projectsWithEuros = projectsArray.map(project => ({
      ...project,
      planning_value: convertToEuros(project.planning_value)
    }));

    return projectsWithEuros;
  } catch (error) {
    console.error('Error fetching all projects:', error);
    // Log additional diagnostic information
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    console.error('Error stack:', error.stack);
    throw error;
  }
};

const getProjectsByCategory = async (category) => {
  try {
    // Map the display categories to API categories
    const categoryMapping = {
      'Residential': 'Residential',
      'Commercial & Retail': 'Commercial & Retail',
      'Industrial': 'Industrial',
      'Education': 'Education & Training',  
      'Medical': 'Health & Medical',
      'Civil': 'Transport & Infrastructure',
      'Social': 'Community & Culture',
      'Agriculture': 'Agriculture & Farming',
      'Supply & Services': 'Supply & Services',
      'Self Build': 'Self Build'
    };

    const apiCategory = categoryMapping[category] || category;
    const encodedCategory = encodeURIComponent(apiCategory.trim());
    const url = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_category=${encodedCategory}`;
    
    console.log(`Making API request for category "${apiCategory}" (original: "${category}")`);
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`API Error for category "${apiCategory}":`, {
        status: response.status,
        statusText: response.statusText,
        error: errorText
      });
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`API Response for category "${apiCategory}":`, data);
    
    // Check if the response has the expected structure
    if (data.status === "OK" && data.data && data.data.rows) {
      const result = {
        status: "success",
        total: data.data.count,
        projects: data.data.rows
      };
      console.log(`Returning ${result.projects.length} projects for category "${apiCategory}"`);
      return result;
    } else if (data.status === "OK" && Array.isArray(data)) {
      // Handle case where API returns array directly
      const result = {
        status: "success",
        total: data.length,
        projects: data
      };
      console.log(`Returning ${result.projects.length} projects for category "${apiCategory}"`);
      return result;
    } else {
      console.error("Unexpected API response structure:", data);
      throw new Error("Invalid API response structure");
    }
  } catch (error) {
    console.error(`Error fetching projects for category "${category}":`, error);
    if (error.code === 'ETIMEDOUT') {
      throw new Error("The request timed out. Please try again.");
    }
    throw error;
  }
};

const getProjectsByFilters = async (filters = {}) => {
  try {
    // Build query parameters
    const queryParams = new URLSearchParams();
    
    // Add API keys
    queryParams.append('api_key', process.env.BUILDING_INFO_API_KEY);
    queryParams.append('ukey', process.env.BUILDING_INFO_USER_KEY);
    
    // Add filters if they exist and ensure exact matches for known values
    if (filters.planning_category) {
      queryParams.append('planning_category', filters.planning_category);
    }
    if (filters.planning_type) {
      queryParams.append('planning_type', filters.planning_type);
    }
    if (filters.planning_stage) {
      queryParams.append('planning_stage', filters.planning_stage);
    }
    if (filters.planning_region) {
      queryParams.append('planning_region', filters.planning_region);
    }
    if (filters.planning_county) {
      queryParams.append('planning_county', filters.planning_county);
    }
    if (filters.planning_value_min) {
      queryParams.append('planning_value_min', filters.planning_value_min);
    }
    if (filters.planning_value_max) {
      queryParams.append('planning_value_max', filters.planning_value_max);
    }
    if (filters.planning_application_date_from) {
      queryParams.append('planning_application_date_from', filters.planning_application_date_from);
    }
    if (filters.planning_application_date_to) {
      queryParams.append('planning_application_date_to', filters.planning_application_date_to);
    }

    const url = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?${queryParams.toString()}`;
    console.log('Fetching projects with URL:', url);

    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    
    if (data.status === "OK" && data.data && data.data.rows) {
      return {
        status: "success",
        total: data.data.count,
        projects: data.data.rows
      };
    } else {
      console.error("Unexpected API response structure:", data);
      throw new Error("Invalid API response structure");
    }
  } catch (error) {
    console.error('Error fetching filtered projects:', error);
    if (error.code === 'ETIMEDOUT') {
      throw new Error("The request timed out. Please try again.");
    }
    throw error;
  }
};

// Function to get available project categories
const getProjectCategories = async () => {
  try {
    // Define known categories in the Building Info system
    const predefinedCategories = [
      'Commercial & Retail',
      'Education',
      'Healthcare',
      'Industrial',
      'Infrastructure',
      'Leisure',
      'Mixed Use Development',
      'Public Buildings',
      'Residential',
      'Sports & Recreation'
    ];

    // Test one category to verify API connection
    const testCategory = 'Commercial & Retail';
    const response = await fetchWithRetry(
      `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_category=${encodeURIComponent(testCategory)}&more=limit 0,1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    // If we can connect to the API, return all predefined categories
    return {
      status: "success",
      categories: predefinedCategories,
      total: predefinedCategories.length
    };
  } catch (error) {
    console.error("Error fetching project categories:", error);
    if (error.code === 'ETIMEDOUT') {
      throw new Error("The request timed out. Please try again.");
    }
    throw error;
  }
};

// Add function to get available counties
const getAvailableCounties = async () => {
  try {
    // Define known counties in the Building Info system with Waterford now available
    const predefinedCounties = [
      'Dublin',
      'Cork',
      'Galway',
      'Waterford',  // New addition
      'Limerick',
      'Wexford',
      'Donegal',
      'Kerry',
      'Kildare',
      'Mayo'
    ];

    // Verify API connection with a simple request
    const response = await fetchWithRetry(
      `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&limit=1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        timeout: 10000
      }
    );

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    // If we can connect to the API, return all predefined counties
    return {
      status: "success",
      counties: predefinedCounties,
      total: predefinedCounties.length
    };
  } catch (error) {
    console.error("Error fetching available counties:", error);
    if (error.code === 'ETIMEDOUT') {
      throw new Error("The request timed out. Please try again.");
    }
    throw error;
  }
};

/**
 * Get recently updated projects based on a period parameter
 * @param {string} period - The period to check for updates.
 *                          '3' for today, '-1.1' for yesterday, 
 *                          '-7.1' for last 7 days, '-30.1' for last 30 days
 * @returns {Array} Array of updated projects with is_major_update flag
 */
const getProjectUpdates = async (period = '3') => {
  try {
    console.log(`Fetching project updates for period: ${period}`);
    
    // Ensure environment variables are set
    if (!process.env.BUILDING_INFO_API_KEY || !process.env.BUILDING_INFO_USER_KEY) {
      console.error('Missing API credentials: BUILDING_INFO_API_KEY or BUILDING_INFO_USER_KEY not set in environment variables');
      throw new Error('API credentials not configured. Please set BUILDING_INFO_API_KEY and BUILDING_INFO_USER_KEY environment variables.');
    }
    
    // Get both major updates and minor updates in parallel
    const [majorUpdatesResponse, allUpdatesResponse] = await Promise.all([
      // Major updates (_updated parameter)
      fetchWithRetry(`https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&more=limit%200,50&_updated=${period}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Project-Info-App/1.0'
        },
        timeout: 15000
      }),
      
      // All updates (_apion parameter)
      fetchWithRetry(`https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&more=limit%200,50&_apion=${period}`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'Project-Info-App/1.0'
        },
        timeout: 15000
      })
    ]);
    
    // Log response status for debugging
    console.log(`Major updates API status: ${majorUpdatesResponse.status}`);
    console.log(`All updates API status: ${allUpdatesResponse.status}`);
    
    if (!majorUpdatesResponse.ok) {
      console.error(`Major updates API responded with status: ${majorUpdatesResponse.status}`);
    }
    
    if (!allUpdatesResponse.ok) {
      console.error(`All updates API responded with status: ${allUpdatesResponse.status}`);
    }
    
    // Process responses
    const [majorUpdatesData, allUpdatesData] = await Promise.all([
      majorUpdatesResponse.ok ? majorUpdatesResponse.json() : { projects: [] },
      allUpdatesResponse.ok ? allUpdatesResponse.json() : { projects: [] }
    ]);
    
    // Log raw responses for debugging
    console.log('Major updates data structure:', Object.keys(majorUpdatesData));
    console.log('All updates data structure:', Object.keys(allUpdatesData));
    
    // Extract projects array from responses
    let majorUpdates = [];
    let allUpdates = [];
    
    // Handle different response formats
    if (majorUpdatesData && majorUpdatesData.data && majorUpdatesData.data.rows) {
      // API response format: { status: 'OK', data: { count: N, rows: [...] } }
      majorUpdates = majorUpdatesData.data.rows;
      console.log(`Found ${majorUpdates.length} major updates in data.rows format`);
    } else if (majorUpdatesData && majorUpdatesData.projects) {
      majorUpdates = majorUpdatesData.projects;
      console.log(`Found ${majorUpdates.length} major updates in projects format`);
    } else if (Array.isArray(majorUpdatesData)) {
      majorUpdates = majorUpdatesData;
      console.log(`Found ${majorUpdates.length} major updates in array format`);
    }
    
    if (allUpdatesData && allUpdatesData.data && allUpdatesData.data.rows) {
      // API response format: { status: 'OK', data: { count: N, rows: [...] } }
      allUpdates = allUpdatesData.data.rows;
      console.log(`Found ${allUpdates.length} all updates in data.rows format`);
    } else if (allUpdatesData && allUpdatesData.projects) {
      allUpdates = allUpdatesData.projects;
      console.log(`Found ${allUpdates.length} all updates in projects format`);
    } else if (Array.isArray(allUpdatesData)) {
      allUpdates = allUpdatesData;
      console.log(`Found ${allUpdates.length} all updates in array format`);
    }
    
    console.log(`Found ${majorUpdates.length} major updates and ${allUpdates.length} total updates`);
    
    // Combine updates and mark major ones
    const projectMap = new Map();
    
    // Add major updates first (they take precedence)
    majorUpdates.forEach(project => {
      // Use existing API dates if available, or get from planning_updated or planning_public_updated
      const updateDate = project.api_date || 
                        project._updated || 
                        project.planning_updated || 
                        project.planning_public_updated || 
                        new Date().toISOString();
                        
      projectMap.set(project.planning_id, {
        ...project,
        is_major_update: true,
        api_date: updateDate
      });
    });
    
    // Add all other updates
    allUpdates.forEach(project => {
      if (!projectMap.has(project.planning_id)) {
        // Use existing API dates if available, or get from planning_updated or planning_public_updated
        const updateDate = project.api_date || 
                          project._updated || 
                          project.planning_updated || 
                          project.planning_public_updated || 
                          new Date().toISOString();
                          
        projectMap.set(project.planning_id, {
          ...project,
          is_major_update: false,
          api_date: updateDate
        });
      }
    });
    
    // Convert map to array
    const combinedUpdates = Array.from(projectMap.values());
    
    // Convert currency values from pounds to euros
    const updatesWithEuros = combinedUpdates.map(project => {
      if (project.planning_value) {
        project.planning_value_eur = convertToEuros(`£${project.planning_value}`);
      }
      return project;
    });
    
    return updatesWithEuros;
  } catch (error) {
    console.error('Error fetching project updates:', error);
    throw error;
  }
};

module.exports = {
  getProjectInfoByPlanningID,
  getAllProjects,
  getProjectsByCategory,
  getProjectCategories,
  getProjectsByFilters,
  getAvailableCounties,
  getProjectUpdates
};
