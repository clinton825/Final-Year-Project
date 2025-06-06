require('dotenv').config();
const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
const userRoutes = require('./routes/users');
const path = require('path');
const { swaggerUi, swaggerSpec } = require('./swagger');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
  }),
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET
});

const { 
  getProjectInfoByPlanningID, 
  getAllProjects, 
  getProjectsByCategory, 
  getProjectCategories,
  getProjectsByFilters,
  getAvailableCounties,
  getProjectUpdates
} = require('./api/building_api');

const {
  trackProject,
  untrackProject,
  getTrackedProjects,
  addNotification,
  getNotifications,
  clearNotifications
} = require('./api/user_tracking');

const app = express();
const PORT = process.env.PORT || 8080;

// Configure CORS with more permissive settings
app.use(cors({
  origin: '*',  // Allow requests from any origin
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Swagger documentation route
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  swaggerOptions: {
    persistAuthorization: true,
    docExpansion: 'none',
    filter: true,
    tryItOutEnabled: true
  }
}));

// Serve static files from the uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

/**
 * @swagger
 * tags:
 *   - name: Projects
 *     description: Infrastructure project management
 *   - name: Categories
 *     description: Project categories and subcategories
 *   - name: Project Tracking
 *     description: Track and manage projects for users
 *   - name: Notifications
 *     description: User notification management
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     TrackedProject:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: Firebase user ID
 *         projectId:
 *           type: string
 *           description: Project planning ID
 *         addedAt:
 *           type: string
 *           format: date-time
 *           description: When the project was tracked
 *         notes:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               id:
 *                 type: string
 *               content:
 *                 type: string
 *               timestamp:
 *                 type: string
 *                 format: date-time
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         userId:
 *           type: string
 *         projectId:
 *           type: string
 *         type:
 *           type: string
 *           enum: [update, status_change, value_change]
 *         message:
 *           type: string
 *         read:
 *           type: boolean
 *         timestamp:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: Welcome message
 *     description: Returns a welcome message for the API
 *     responses:
 *       200:
 *         description: Successful response
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Welcome to the Project Info API
 */
// Root route handler
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Project Info API' });
});

/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: Get all infrastructure projects
 *     description: Retrieves a list of all infrastructure projects from the Building Info API
 *     tags: [Projects]
 *     responses:
 *       200:
 *         description: A list of projects
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *       404:
 *         description: No projects found
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
// Get all projects
app.get("/api/projects", async (req, res) => {
  try {
    // Validate environment variables
    if (!process.env.BUILDING_INFO_API_KEY || !process.env.BUILDING_INFO_USER_KEY) {
      console.error('Missing required API credentials in environment variables');
      return res.status(500).json({ 
        status: "error", 
        message: "Server configuration error: Missing API credentials"
      });
    }
    
    console.log('Fetching all projects');
    const projects = await getAllProjects();
    
    if (!projects) {
      console.error('No projects returned from API');
      return res.status(404).json({
        status: "error",
        message: "No projects found"
      });
    }
    
    // Check if we got a valid projects array
    if (!Array.isArray(projects)) {
      console.error('API did not return an array:', typeof projects);
      return res.status(500).json({
        status: "error",
        message: "Unexpected API response format"
      });
    }
    
    console.log(`Successfully retrieved ${projects.length} projects`);
    res.json({
      status: "success",
      projects: projects
    });
  } catch (error) {
    console.error("Error in /api/projects:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch projects",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

/**
 * @swagger
 * /api/project/{planning_id}:
 *   get:
 *     summary: Get project details by planning ID
 *     description: Retrieves detailed information about a specific project using its planning ID
 *     tags: [Projects]
 *     parameters:
 *       - in: path
 *         name: planning_id
 *         required: true
 *         schema:
 *           type: string
 *         description: The planning ID of the project
 *     responses:
 *       200:
 *         description: Project details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 project:
 *                   type: object
 *                   properties:
 *                     planning_id:
 *                       type: string
 *                     title:
 *                       type: string
 *                     description:
 *                       type: string
 *                     location:
 *                       type: string
 *                     county:
 *                       type: string
 *                     value:
 *                       type: number
 *                     category:
 *                       type: string
 *                     stage:
 *                       type: string
 *                     last_updated:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Planning ID is required
 *       404:
 *         description: Project not found
 *       500:
 *         description: Server error
 */
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

/**
 * @swagger
 * /api/categories:
 *   get:
 *     summary: Get available project categories
 *     description: Retrieves a list of all available project categories and their subcategories
 *     tags: [Categories]
 *     responses:
 *       200:
 *         description: List of categories and subcategories
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 categories:
 *                   type: array
 *                   items:
 *                     type: string
 *                     example: Residential
 *                 subcategories:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 *                   example:
 *                     Residential: ["House", "Apartment", "Extension"]
 *       500:
 *         description: Server error
 */
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
    
    // Use the same subcategories mapping as in the categories endpoint
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

    console.log(`Fetching subcategories for category: ${category}`);
    
    if (subcategories[category]) {
      res.json({
        status: "success",
        subcategories: subcategories[category]
      });
    } else {
      console.log(`No subcategories found for category: ${category}`);
      res.json({
        status: "success",
        subcategories: []
      });
    }
  } catch (error) {
    console.error('Error in /api/subcategories endpoint:', error);
    res.status(500).json({
      status: "error",
      message: error.message
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

// Get available counties
app.get("/api/counties", async (req, res) => {
  try {
    console.log('Fetching available counties');
    const result = await getAvailableCounties();
    
    if (!result || !result.counties) {
      return res.status(404).json({
        status: "error",
        message: "No counties found"
      });
    }
    
    res.json({
      status: "success",
      counties: result.counties,
      total: result.total
    });
  } catch (error) {
    console.error("Error fetching counties:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch counties"
    });
  }
});

// Get projects by county
app.get("/api/projects/county/:county", async (req, res) => {
  try {
    const county = decodeURIComponent(req.params.county);
    
    if (!county) {
      return res.status(400).json({ 
        status: "error", 
        message: "County parameter is required" 
      });
    }
    
    console.log(`Fetching projects for county: ${county}`);
    
    const filters = {
      planning_county: county
    };
    
    const result = await getProjectsByFilters(filters);
    
    res.json(result);
  } catch (error) {
    console.error("Error fetching projects by county:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch projects" 
    });
  }
});

/**
 * @swagger
 * /api/projects/track:
 *   post:
 *     summary: Track a project
 *     description: Allows a user to track a specific infrastructure project. Stores the complete project data in Firestore.
 *     tags: [Project Tracking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - projectId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Firebase user ID
 *               projectId:
 *                 type: string
 *                 description: Project planning ID
 *     responses:
 *       200:
 *         description: Project tracked successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 data:
 *                   $ref: '#/components/schemas/TrackedProject'
 *       400:
 *         description: User ID and Project ID are required
 *       500:
 *         description: Failed to track project
 */
app.post("/api/projects/track", async (req, res) => {
  try {
    const { userId, projectId } = req.body;
    
    if (!userId || !projectId) {
      return res.status(400).json({
        status: "error",
        message: "User ID and Project ID are required"
      });
    }

    const result = await trackProject(userId, projectId);
    res.json({
      status: "success",
      data: result
    });
  } catch (error) {
    console.error("Error tracking project:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to track project"
    });
  }
});

/**
 * @swagger
 * /api/projects/untrack:
 *   post:
 *     summary: Untrack a project
 *     description: Allows a user to untrack a specific infrastructure project
 *     tags: [Project Tracking]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *               - projectId
 *             properties:
 *               userId:
 *                 type: string
 *                 description: Firebase user ID
 *               projectId:
 *                 type: string
 *                 description: Project planning ID
 *     responses:
 *       200:
 *         description: Project untracked successfully
 *       400:
 *         description: User ID and Project ID are required
 *       500:
 *         description: Failed to untrack project
 */
app.post("/api/projects/untrack", async (req, res) => {
  try {
    const { userId, projectId } = req.body;
    
    if (!userId || !projectId) {
      return res.status(400).json({
        status: "error",
        message: "User ID and Project ID are required"
      });
    }

    const result = await untrackProject(userId, projectId);
    res.json({
      status: "success",
      data: result
    });
  } catch (error) {
    console.error("Error untracking project:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to untrack project"
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}/tracked-projects:
 *   get:
 *     summary: Get tracked projects for a user
 *     description: Retrieves a list of projects tracked by a specific user
 *     tags: [Project Tracking]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Firebase user ID
 *     responses:
 *       200:
 *         description: List of tracked projects
 *       500:
 *         description: Failed to get tracked projects
 */
app.get("/api/users/:userId/tracked-projects", async (req, res) => {
  try {
    const { userId } = req.params;
    const projectIds = await getTrackedProjects(userId);
    
    // Fetch full project details for each tracked project
    const trackedProjects = await Promise.all(
      projectIds.map(async (id) => {
        const project = await getProjectInfoByPlanningID(id);
        return project;
      })
    );

    res.json({
      status: "success",
      projects: trackedProjects.filter(p => p !== null)
    });
  } catch (error) {
    console.error("Error getting tracked projects:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to get tracked projects"
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}/notifications:
 *   get:
 *     summary: Get notifications for a user
 *     description: Retrieves a list of notifications for a specific user
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Firebase user ID
 *     responses:
 *       200:
 *         description: List of notifications
 *       500:
 *         description: Failed to get notifications
 */
app.get("/api/users/:userId/notifications", async (req, res) => {
  try {
    const { userId } = req.params;
    const userNotifications = await getNotifications(userId);
    
    res.json({
      status: "success",
      notifications: userNotifications
    });
  } catch (error) {
    console.error("Error getting notifications:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to get notifications"
    });
  }
});

/**
 * @swagger
 * /api/users/{userId}/notifications/clear:
 *   post:
 *     summary: Clear notifications for a user
 *     description: Clears all notifications for a specific user
 *     tags: [Notifications]
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *         description: Firebase user ID
 *     responses:
 *       200:
 *         description: Notifications cleared successfully
 *       500:
 *         description: Failed to clear notifications
 */
app.post("/api/users/:userId/notifications/clear", async (req, res) => {
  try {
    const { userId } = req.params;
    const result = await clearNotifications(userId);
    
    res.json({
      status: "success",
      data: result
    });
  } catch (error) {
    console.error("Error clearing notifications:", error);
    res.status(500).json({
      status: "error",
      message: error.message || "Failed to clear notifications"
    });
  }
});

app.use('/api', userRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
/**
 * @swagger
 * /api/project-updates:
 *   get:
 *     summary: Get recently updated projects
 *     description: Fetches projects that have been updated recently based on the specified time period
 *     tags: [Projects]
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: ['3', '-1.1', '-7.1', '-30.1']
 *           default: '3'
 *         description: Time period for updates - 3 (today), -1.1 (yesterday), -7.1 (last 7 days), -30.1 (last 30 days)
 *     responses:
 *       200:
 *         description: Successfully retrieved project updates
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 projects:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       planning_id:
 *                         type: string
 *                       planning_title:
 *                         type: string
 *                       planning_value:
 *                         type: string
 *                       planning_value_eur:
 *                         type: string
 *                       planning_county:
 *                         type: string
 *                       is_major_update:
 *                         type: boolean
 *                       api_date:
 *                         type: string
 *                         format: date-time
 *       400:
 *         description: Invalid period parameter
 *       500:
 *         description: Server error
 */
app.get("/api/project-updates", async (req, res) => {
  try {
    // Get period parameter (defaults to today)
    const period = req.query.period || '3';
    const validPeriods = ['3', '-1.1', '-7.1', '-30.1'];
    
    if (!validPeriods.includes(period)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid period parameter. Must be one of: 3 (today), -1.1 (yesterday), -7.1 (last 7 days), -30.1 (last 30 days)"
      });
    }
    
    console.log(`Fetching project updates for period: ${period}`);
    const updates = await getProjectUpdates(period);
    
    if (!updates || !Array.isArray(updates)) {
      console.error('Invalid response from updates API');
      return res.status(500).json({
        status: "error",
        message: "Failed to fetch project updates"
      });
    }
    
    console.log(`Successfully retrieved ${updates.length} project updates`);
    res.json({
      status: "success",
      projects: updates
    });
  } catch (error) {
    console.error("Error in /api/project-updates:", error);
    res.status(500).json({ 
      status: "error", 
      message: error.message || "Failed to fetch project updates",
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
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
