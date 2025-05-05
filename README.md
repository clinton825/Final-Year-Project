# Infrastructure Project Tracking Web Application
**BY Clinton Bempah (20097793)**

## Overview
The **Infrastructure Project Tracking Web Application** is a React-based web application that allows users to explore and search for infrastructure project details. The application fetches project data from a backend API and displays comprehensive information about various infrastructure projects, including their planning details, categories, values, and locations.

## Key Features
### **Search & Filtering**
- Search by **Planning ID, Title, Location, or Category**
- Filter projects by **Category, Subcategory, County, Town, and Value Range**
- Smart filtering to hide **already tracked projects** (toggle-enabled)

### **Project Updates & Notifications**
- View **Recently Updated Projects** in a newsfeed-style layout
- Filter updates by time period (**Today, Yesterday, Last 7 Days, Last 30 Days**)
- Clearly labeled **Major/Minor Updates** with visual distinction
- **Track projects directly** from the updates feed
- Automatic **currency conversion** from GBP to EUR

### **Project Cards & Details**
- Expandable descriptions (**Read More/Show Less** functionality)
- Track projects with a **one-click button**
- Display essential project details (ID, Category, Value, Location, etc.)
- Interactive **Project Timeline** for milestone visualization

### **Dashboard & Visualizations**
- **Quick Stats Summary** (tracked projects, total value, activity count)
- **Interactive Bar Charts** for project value distribution
- **County-specific project visualization**
- **Project Trends Over Time** with dual-axis visualization
- **Dark Mode Compatibility**
- **Customizable Layout** (grid/list view, widget visibility toggles)
- **Project Notes System** (add/edit/delete personal notes)

### **User & Authentication**
- Secure **User Activity Tracking** (interactions, searches, tracking history)
- **Company Profiles** (Architects, Contractors, Contact Info, Links)
- **LocalStorage fallback** for offline support
- Enhanced authentication with **error handling & retry mechanisms**

## Recent Updates *(May 2025)*
### **Analytics Enhancements**
- Added **PDF Export** functionality for Analytics page to enable sharing of insights and reports
- Improved chart rendering and display for better visualization
- Enhanced filtering capabilities with clearer UI feedback

### **Dashboard & Project Tracking Improvements**
- Fixed critical issues with **untracking functionality**
- Ensured tracked projects are properly removed from both UI and Firestore
- Improved state management to maintain correct dashboard statistics
- Enhanced localStorage caching to prevent untracked projects from reappearing after refresh
- Fixed duplicate notifications issue in dashboard layout
- Improved error handling for missing Firestore indexes

### **Performance & Reliability Enhancements**
- Added comprehensive error handling for project notes
- Improved asynchronous initialization sequence for dashboard components
- Enhanced offline support with better caching mechanisms
- Fixed critical initialization errors in component lifecycles

## Recent Updates *(April 2025)*
### **Project Updates Feature**
- Implemented **Project Updates Page** to display recently updated projects
- Created backend proxy for BuildingInfo API integration with proper **error handling**
- Added **euro currency conversion** for project values
- Applied **user-friendly date formatting** for update timestamps
- Implemented time-period filtering for **relevant project discovery**
- Visual distinction between **major and minor updates**

### **Dashboard Layout & Stability Improvements**
- Fixed layout conflicts between dashboard and project comparison pages
- Resolved issues with tracked projects and recent activities display
- Improved component structure with proper data passing
- Enhanced chart stability with fixed dimensions and disabled animations
- Optimized Recent Activity widget with reliable static data
- Removed unnecessary Save Search feature for cleaner interface

### **County Data Expansion**
- Added comprehensive **County Waterford and Carlow project data**
- Implemented **town-level filtering** for precise location-based searches
- Enhanced **county-based analytics** with value distribution and project counts
- Added **interactive time comparison chart** for tracking county project trends

### **Analytics Dashboard**
- **Visualizations for project data trends** (subcategory spending, development stage analysis)
- **County-specific analytics** with interactive filtering
- **Time-range filtering** (1-20 years) for insights
- **Dark mode support & responsive design**

### **UI & UX Improvements**
- **Redesigned Projects Page** with **on-demand data loading** (improved performance)
- **Enhanced Landing Page** (consistent layout, proper spacing, modern visuals)
- **Dashboard Enhancements** (refined layouts, hover effects, dark mode compatibility)

### **Project Notes & Tracking Enhancements**
- Integrated **Firestore** for persistent note storage
- Added **confirmation dialogs** for delete actions
- **Optimized state management** for smooth project tracking

### **Performance & Deployment Optimizations**
- **Frontend deployed on Vercel**, Backend on **Render.com**
- **Environment-Specific Configurations** for smooth deployments
- **Enhanced API Error Handling** and optimized API calls

## **Technologies Used**
- **Frontend**: React.js (Hooks, Router), Axios, Firebase (Auth, Firestore, Storage)
- **Backend**: Express.js, Node.js, Firebase, CORS, dotenv
- **CI/CD**: Vercel (Frontend), Render.com (Backend)
- **Styling**: CSS Grid, Flexbox, Dark Mode, Animations
- **Data Visualization**: Charts, Timelines, Summary Cards

## **Deployment Guide**
### **Frontend (Vercel)**
1. Connect GitHub repo to **Vercel**
2. Configure environment variables (API URLs, Firebase keys)
3. Deploy with `npm run build`

### **Backend (Render.com)**
1. Connect GitHub repo to **Render**
2. Set up **Node.js environment**
3. Configure environment variables:
   - `BUILDING_INFO_API_KEY`: BuildingInfo API key
   - `BUILDING_INFO_USER_KEY`: BuildingInfo user key
   - `FIREBASE_CLIENT_EMAIL`: Firebase service account email
   - `FIREBASE_PRIVATE_KEY`: Firebase service account private key
4. Deploy with `npm install && npm start`

## **API Endpoints**
| Method | Endpoint | Description |
|--------|------------|----------------|
| GET | `/api/project/{id}` | Fetch project details by ID |
| GET | `/api/projects` | Retrieve all projects |
| GET | `/api/projects/category/{category}` | Get projects by category |
| GET | `/api/projects/county/{county}` | Get projects by county |
| GET | `/api/subcategories/{category}` | Fetch subcategories by category |
| GET | `/api/counties` | Fetch available counties |
| GET | `/api/project-updates?period={period}` | Fetch recently updated projects (period: '3' for today, '-1.1' for yesterday, '-7.1' for last 7 days, '-30.1' for last 30 days) |
| GET | `/api/user/{userId}/tracked-projects` | Get tracked projects for a specific user |

### **Sample API Response for Project Updates**
```json
{
  "status": "success",
  "projects": [
    {
      "planning_id": "123",
      "planning_title": "Project Name",
      "planning_category": "Category",
      "planning_value": "1000000",
      "planning_value_eur": "€1,170,000",
      "planning_region": "Leinster",
      "planning_county": "Carlow",
      "is_major_update": true,
      "api_date": "2025-04-26T09:30:00Z"
    }
  ]
}
```

## **Usage Instructions**
1. **Browse & Search** projects on the home page
2. **Apply Filters** (category, subcategory, county, town, value range)
3. **Click on a Project** to view details
4. **Track Projects** for personal monitoring
5. **Access Dashboard** for insights and tracked projects
6. **Check Project Updates** to discover recently updated projects
7. **Add Notes** to tracked projects
8. **Customize Layouts** (toggle widgets, grid/list views)
9. **View Analytics** for project trends

## **Environment Configuration**
The application requires the following environment variables to be set:

### Frontend (.env file)
```
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
REACT_APP_API_URL=your_backend_api_url
REACT_APP_BUILDINGINFO_API_KEY=your_buildinginfo_api_key
REACT_APP_BUILDINGINFO_UKEY=your_buildinginfo_user_key
```

### Backend (.env file)
```
PORT=8080
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
FIREBASE_CLIENT_EMAIL=your_firebase_client_email
FIREBASE_PRIVATE_KEY=your_firebase_private_key
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
BUILDING_INFO_API_KEY=your_buildinginfo_api_key
BUILDING_INFO_USER_KEY=your_buildinginfo_user_key
```

## **Contributing**
Contributions are welcome! Submit a **Pull Request** or open an **Issue** on GitHub.

---
