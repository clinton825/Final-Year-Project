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
    
    // Check the structure of the data
    console.log('API Response:', data);

    // Handle different possible response structures
    if (Array.isArray(data)) {
      return data.find(project => project.planning_id === planning_id) || null;
    } else if (data && typeof data === 'object') {
      // If data is an object, return it directly or check for a specific property
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