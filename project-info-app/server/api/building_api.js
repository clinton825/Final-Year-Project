const fetch = require('node-fetch');

// Utility function to retry failed requests
async function fetchWithRetry(url, options, maxRetries = 3, delay = 1000) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      console.log(`Attempt ${attempt} of ${maxRetries} for URL: ${url}`);
      const response = await fetch(url, options);
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

const getProjectInfoByPlanningID = async (planning_id) => {
  try {
    const response = await fetchWithRetry(`https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_id=${planning_id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Log the exact structure of the response
    console.log('Raw API Response for planning_id:', planning_id);
    console.log(JSON.stringify(data, null, 2));

    // Handle different possible response structures
    if (Array.isArray(data)) {
      const project = data.find(project => project.planning_id === planning_id);
      console.log('Found project:', project);
      return project || null;
    } else if (data && typeof data === 'object') {
      console.log('Single project data:', data);
      return data;
    } else {
      throw new Error('Unexpected API response format');
    }
  } catch (error) {
    console.error("Detailed error fetching project info:", {
      message: error.message,
      planningId: planning_id
    });
    if (error.code === 'ETIMEDOUT') {
      throw new Error("The request timed out. Please try again.");
    }
    throw error;
  }
};

const getAllProjects = async () => {
  try {
    // Remove the limit to get all projects
    const url = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}`;
    
    console.log('Making API request for all projects');
    
    const response = await fetchWithRetry(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      },
      timeout: 10000 // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log(`Received ${data.data?.count || 0} total projects`);
    
    if (data.status === "OK" && data.data && data.data.rows) {
      return {
        status: "success",
        total: data.data.count,
        projects: data.data.rows
      };
    } else {
      throw new Error("Invalid API response structure");
    }
  } catch (error) {
    console.error('Error fetching all projects:', error);
    if (error.code === 'ETIMEDOUT') {
      throw new Error("The request timed out. Please try again.");
    }
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

module.exports = {
  getProjectInfoByPlanningID,
  getAllProjects,
  getProjectsByCategory,
  getProjectsByFilters,
  getProjectCategories
};
