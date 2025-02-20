require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { 
  getProjectInfoByPlanningID, 
  getAllProjects, 
  getProjectsByCategory, 
  getProjectCategories,
  getProjectsByFilters
} = require('./api/building_api');

const app = express();
const PORT = 3001; // Set fixed port for development

// Configure CORS
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3002'], // Allow both ports
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Root route handler
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Project Info API' });
});

// Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    console.log('Fetching all projects');
    const projects = await getAllProjects();
    
    if (!projects) {
      throw new Error('No projects found');
    }

    res.json({
      status: "success",
      projects: Array.isArray(projects) ? projects : [projects]
    });
  } catch (error) {
    console.error("Error in /api/projects:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch projects"
    });
  }
});

// Get project by planning ID
app.get("/api/project/:planning_id", async (req, res) => {
  try {
    const { planning_id } = req.params;
    
    if (!planning_id) {
      return res.status(400).json({ 
        status: "error", 
        message: "Planning ID is required" 
      });
    }

    console.log(`Fetching project details for planning ID: ${planning_id}`);
    
    const projectInfo = await getProjectInfoByPlanningID(planning_id);
    
    if (!projectInfo) {
      return res.status(404).json({
        status: "error",
        message: "Project not found"
      });
    }

    res.json({
      status: "success",
      project: projectInfo
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch project details"
    });
  }
});

// Get all projects with pagination
app.get("/api/projects/paginated", async (req, res) => {
  try {
    const { page, limit } = req.query;
    
    let result;
    if (page && limit) {
      // If pagination parameters are provided
      result = await getAllProjectsWithPagination(parseInt(page), parseInt(limit));
      res.json({
        status: "success",
        data: result.projects,
        pagination: result.pagination
      });
    } else {
      // If no pagination parameters, get all projects
      result = await getAllProjects();
      if (!result || !Array.isArray(result)) {
        throw new Error('Invalid response format from API');
      }
      res.json({
        status: "success",
        data: result
      });
    }
  } catch (error) {
    console.error("Error in /api/projects/paginated:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Internal Server Error",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get available categories
app.get("/api/categories", async (req, res) => {
  try {
    // Define categories as we want to show them to users
    const categories = [
      'Residential',
      'Commercial & Retail',
      'Industrial',
      'Education',
      'Medical',
      'Civil',
      'Social',
      'Agriculture',
      'Supply & Services',
      'Self Build'
    ];

    // Define subcategories mapping using our user-friendly category names
    const subcategories = {
      'Residential': ['Houses', 'Apartments', 'Mixed Development'],
      'Commercial & Retail': ['Retail', 'Office', 'Service Station', 'Car Showroom', 'Hotel & Guesthouse', 'Bar & Restaurant'],
      'Industrial': ['Factory', 'Warehouse', 'Light Industrial'],
      'Education': ['School', 'University', 'Pre School'],
      'Medical': ['Hospital', 'Care Home', 'Medical Centre'],
      'Civil': ['Roads & Bridges', 'Water & Sewerage', 'Transport', 'Carpark', 'Power Generation', 'Quarry'],
      'Social': ['Sport & Leisure', 'Church & Community', 'Public Building'],
      'Agriculture': ['Agricultural Building'],
      'Supply & Services': ['Professional Services', 'Construction Supplies'],
      'Self Build': ['House', 'Extension', 'Alteration']
    };

    res.json({
      status: "success",
      categories: categories,
      subcategories: subcategories
    });
  } catch (error) {
    console.error("Error in /api/categories:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to fetch categories"
    });
  }
});

// Get projects by category with optional subcategory
app.get("/api/projects/category/:category", async (req, res) => {
  try {
    const category = decodeURIComponent(req.params.category);
    const subcategory = req.query.subcategory ? decodeURIComponent(req.query.subcategory) : null;
    
    console.log(`Fetching projects for category: ${category}, subcategory: ${subcategory}`);
    
    const projects = await getAllProjects();
    
    let filteredProjects = projects.filter(project => project.planning_category === category);
    
    if (subcategory) {
      filteredProjects = filteredProjects.filter(project => project.planning_subcategory === subcategory);
    }

    if (!filteredProjects.length) {
      return res.status(404).json({
        status: "error",
        message: subcategory 
          ? `No projects found for category ${category} and subcategory ${subcategory}`
          : `No projects found for category ${category}`
      });
    }

    res.json({
      status: "success",
      projects: filteredProjects
    });
  } catch (error) {
    console.error("Error fetching projects by category:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch projects"
    });
  }
});

// Get subcategories for a category
app.get("/api/subcategories/:category", async (req, res) => {
  try {
    const category = decodeURIComponent(req.params.category);
    console.log(`Fetching subcategories for category: ${category}`);
    
    const projects = await getAllProjects();
    
    const subcategories = [...new Set(
      projects
        .filter(project => project.planning_category === category)
        .map(project => project.planning_subcategory)
    )].filter(Boolean).sort();

    res.json({
      status: "success",
      subcategories
    });
  } catch (error) {
    console.error("Error fetching subcategories:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch subcategories"
    });
  }
});

// Get projects by category
app.get("/api/categories/:category", async (req, res) => {
  try {
    const { category } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 10; // Default limit of 10 projects

    console.log(`Fetching projects for category: ${category}`);
    const projects = await getProjectsByCategory(category, limit);
    
    if (!projects || projects.length === 0) {
      return res.status(404).json({ 
        status: "error", 
        message: `No projects found for category: ${category}` 
      });
    }

    res.json({ 
      status: "success", 
      category,
      count: projects.length,
      projects 
    });
  } catch (error) {
    console.error("Error in /api/categories/:category:", error);
    const errorMessage = error.message || "Internal Server Error";
    res.status(500).json({ 
      status: "error", 
      message: errorMessage,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get projects with multiple filters
app.get("/api/projects/filter", async (req, res) => {
  try {
    const filters = req.query;
    console.log('Received filters:', filters);
    
    const result = await getProjectsByFilters(filters);
    res.json(result);
  } catch (error) {
    console.error('Error in /api/projects/filter endpoint:', error);
    res.status(500).json({
      status: "error",
      message: error.message
    });
  }
});

// Get project by planning ID
app.get("/api/projects/:planningId", async (req, res) => {
  try {
    const planningId = req.params.planningId;
    
    if (!planningId) {
      return res.status(400).json({ 
        status: "error", 
        message: "Planning ID is required" 
      });
    }

    console.log(`Fetching project details for planning ID: ${planningId}`);
    
    const projectInfo = await getProjectInfoByPlanningID(planningId);
    
    if (!projectInfo) {
      return res.status(404).json({
        status: "error",
        message: "Project not found"
      });
    }

    res.json({
      status: "success",
      project: projectInfo
    });
  } catch (error) {
    console.error("Error fetching project details:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch project details" 
    });
  }
});

// Test endpoint to check API connection
app.get("/api/test", async (req, res) => {
  try {
    // Try to fetch a single project
    const response = await fetch(
      `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&more=limit 0,1`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    const responseData = {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: null
    };

    try {
      responseData.body = await response.json();
    } catch (e) {
      responseData.body = await response.text();
    }

    res.json({
      env: {
        apiKeyPresent: !!process.env.BUILDING_INFO_API_KEY,
        userKeyPresent: !!process.env.BUILDING_INFO_USER_KEY,
      },
      response: responseData
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint for category functionality
app.get("/api/test-category/:category", async (req, res) => {
  try {
    const { category } = req.params;
    console.log(`Testing category: ${category}`);

    // First, verify we can get projects for this category
    const projectsResponse = await fetch(
      `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_category=${encodeURIComponent(category)}&more=limit 0,5`,
      {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        }
      }
    );

    const responseData = {
      category,
      requestStatus: {
        status: projectsResponse.status,
        statusText: projectsResponse.statusText,
      },
      data: null,
      projectCount: 0
    };

    if (projectsResponse.ok) {
      const projectsData = await projectsResponse.json();
      responseData.data = projectsData;
      responseData.projectCount = Array.isArray(projectsData) ? projectsData.length : 0;
    } else {
      responseData.error = await projectsResponse.text();
    }

    res.json(responseData);
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Test endpoint to list all available categories and their project counts
app.get("/api/test-categories", async (req, res) => {
  try {
    const categories = [
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

    const results = [];
    
    // Test each category
    for (const category of categories) {
      console.log(`Testing category: ${category}`);
      const response = await fetch(
        `https://api12.buildinginfo.com/api/v2/bi/projects/t-projects?api_key=${process.env.BUILDING_INFO_API_KEY}&ukey=${process.env.BUILDING_INFO_USER_KEY}&planning_category=${encodeURIComponent(category)}&more=limit 0,1`,
        {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
          }
        }
      );

      const result = {
        category,
        status: response.status,
        hasProjects: false,
        projectCount: 0
      };

      if (response.ok) {
        const data = await response.json();
        result.hasProjects = Array.isArray(data) && data.length > 0;
        result.projectCount = Array.isArray(data) ? data.length : 0;
      }

      results.push(result);
    }

    res.json({
      status: "success",
      categories: results
    });
  } catch (error) {
    res.status(500).json({ 
      status: "error", 
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

// Test function
async function printResult() {
  try {
    // Test environment variables
    if (!process.env.BUILDING_INFO_API_KEY || !process.env.BUILDING_INFO_USER_KEY) {
      throw new Error("Missing required environment variables. Please check your .env file");
    }

    console.log("\n=== Testing API Endpoints ===");
    
    // Test get project by ID
    console.log("\n1. Testing get project by ID (7360):");
    try {
      const projectResult = await getProjectInfoByPlanningID('7360');
      console.log("Success! Project details:", projectResult);
    } catch (error) {
      console.error("Failed to get project:", {
        message: error.message,
        planningId: '7360'
      });
    }

    // Test get all projects
    console.log("\n2. Testing get all projects:");
    try {
      const allProjects = await getAllProjects();
      console.log(`Success! Total projects found: ${allProjects.length}`);
    } catch (error) {
      console.error("Failed to get all projects:", error.message);
    }
  } catch (error) {
    console.error("\nTest failed:", error.message);
    process.exit(1);
  }
}

// Only run tests if not in production
if (process.env.NODE_ENV !== 'production') {
  printResult();
}
