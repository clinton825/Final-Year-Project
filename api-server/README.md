# Infrastructure Tracker API Server

This is the backend API server for the Infrastructure Tracking application.

## Deployment Instructions

### Deploying to Render.com

1. Create a new Web Service on Render.com
2. Connect your GitHub repository
3. Select the `api-server` directory
4. Configure the build settings:
   - Build Command: `npm install`
   - Start Command: `npm start`

### Environment Variables Required

Make sure to set these environment variables in your Render.com dashboard:

- `PORT`: The port for the server to listen on (default: 8080)
- `BUILDING_INFO_API_KEY`: Your Building Info API Key
- `BUILDING_INFO_USER_KEY`: Your Building Info User Key
- `REACT_APP_FIREBASE_PROJECT_ID`: Firebase Project ID
- `FIREBASE_CLIENT_EMAIL`: Firebase Client Email
- `FIREBASE_PRIVATE_KEY`: Firebase Private Key (make sure to include newlines)
- `REACT_APP_FIREBASE_STORAGE_BUCKET`: Firebase Storage Bucket

## Local Development

1. Install dependencies: `npm install`
2. Create a `.env` file with the required environment variables
3. Start the development server: `npm run dev`

## API Endpoints

- `GET /api/projects`: Get all projects
- `GET /api/project/:id`: Get a specific project by ID
- `GET /api/categories`: Get all categories
- `GET /api/subcategories/:category`: Get subcategories for a specific category

See server.js for more endpoints and details.
