import fetch from "node-fetch";

export const getProjectInfoByPlanningID = async (planning_id) => {
  try {
    const response = await fetch(`https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_id=${planning_id}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
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
    throw error;
  }
};

export const getAllProjects = async () => {
  try {
    const response = await fetch(`https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&more=limit 0,10`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}, message: ${response.statusText}`);
    }

    const data = await response.json();
    console.log('Raw API Response for all projects:', JSON.stringify(data, null, 2));

    // Return the data in the expected structure
    return {
      status: "success",
      data: [{
        data: Array.isArray(data) ? data : [data]
      }]
    };
  } catch (error) {
    console.error("Detailed error fetching all projects:", {
      message: error.message
    });
    throw error;
  }
};

export const getProjectsByCategory = async (category, limit = 10) => {
  try {
    const encodedCategory = encodeURIComponent(category);
    const url = `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_category=${encodedCategory}&more=limit 0,${limit}`;
    
    console.log('Fetching projects with URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error response:', errorText);
      throw new Error(`HTTP error! status: ${response.status}, message: ${response.statusText}`);
    }

    const data = await response.json();
    console.log(`Raw API Response for category ${category}:`, JSON.stringify(data, null, 2));

    // Return the data in the expected structure
    return {
      status: "success",
      data: [{
        data: Array.isArray(data) ? data : [data]
      }]
    };
  } catch (error) {
    console.error("Detailed error fetching projects by category:", {
      message: error.message,
      category: category
    });
    throw error;
  }
};

// Function to get available project categories
export const getProjectCategories = async () => {
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
    const response = await fetch(
      `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_category=${encodeURIComponent(testCategory)}&more=limit 0,1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
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
    throw error;
  }
};
