const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

// Determine environment
const isProduction = process.env.NODE_ENV === 'production';
const serverUrl = isProduction 
  ? process.env.API_URL || 'https://infrastructure-tracker-api.onrender.com' 
  : 'http://localhost:8080';

// Swagger definition
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Infrastructure Tracker API',
      version: '1.0.0',
      description: 'API documentation for the Infrastructure Tracker application',
      contact: {
        name: 'South East Technological University',
      },
    },
    servers: [
      {
        url: serverUrl,
        description: isProduction ? 'Production server' : 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: 'Enter your Firebase JWT token in the format: Bearer {token}'
        },
      },
      schemas: {
        Project: {
          type: 'object',
          properties: {
            planning_id: {
              type: 'string',
              description: 'Unique identifier for the project'
            },
            title: {
              type: 'string',
              description: 'Project title'
            },
            description: {
              type: 'string',
              description: 'Detailed project description'
            },
            location: {
              type: 'string',
              description: 'Project location'
            },
            county: {
              type: 'string',
              description: 'County where the project is located'
            },
            value: {
              type: 'number',
              description: 'Estimated project value'
            },
            category: {
              type: 'string',
              description: 'Project category'
            },
            stage: {
              type: 'string',
              description: 'Current project stage'
            },
            last_updated: {
              type: 'string',
              format: 'date-time',
              description: 'Last update timestamp'
            }
          }
        },
        Error: {
          type: 'object',
          properties: {
            status: {
              type: 'string',
              example: 'error'
            },
            message: {
              type: 'string',
              description: 'Error message'
            }
          }
        }
      },
    },
    security: [{
      bearerAuth: [],
    }],
  },
  // Path to the API docs
  apis: ['./routes/*.js', './server.js'], // Path to the API docs
};

// Initialize swagger-jsdoc
const swaggerSpec = swaggerJsdoc(swaggerOptions);

module.exports = { swaggerUi, swaggerSpec };
