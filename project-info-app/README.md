# Infrastructure Tracking Web Application

A modern web application for tracking and comparing local infrastructure developments. Built with React, Firebase Authentication, and PostgreSQL.

## Features

- **User Authentication**
  - Email/Password login and registration
  - Google and GitHub Sign-in integration
  - Secure authentication powered by Firebase

- **Infrastructure Tracking**
  - View local infrastructure developments
  - Compare different developments
  - Filter by category and value
  - Search functionality
  - Detailed development information
  - Track/untrack projects for personalized dashboard
  - Customizable dashboard layout (grid/list view)
  - Widget visibility toggles

- **Modern UI/UX**
  - Clean and minimalist interface
  - Responsive design
  - Intuitive navigation
  - Loading states and transitions
  - Mobile-friendly layout
  - Euro (€) currency formatting
  - Interactive buttons with icons
  - Hover effects for better user engagement

## Dashboard Features

### Project Tracking
- Personal dashboard to track projects of interest
- Ability to add/remove projects from your tracking list
- Quick access to project details
- Projects organized in a clean, card-based layout

### Dashboard Customization
- Toggle between grid and list layouts
- Show/hide widgets based on preferences
- Widget visibility toggles for Projects, Activity, and Statistics sections
- User settings are saved and persisted between sessions

### Statistics and Visualization
- Summary statistics cards with key metrics
- Visual representation of project value distribution
- Project categorization by status and type
- Bar chart visualization for project value by category
- Numeric breakdown of project statuses

### User Experience
- Personalized welcome banner
- Enhanced empty states with guidance
- Hover effects and visual feedback
- Consistent icon system for better visual hierarchy
- Mobile-responsive design for all dashboard components

## Tech Stack

- **Frontend**
  - React 18
  - React Router v6
  - Firebase Authentication
  - Font Awesome icons
  - CSS Variables for theming

- **Backend**
  - Node.js
  - Express.js
  - PostgreSQL
  - Firebase Admin SDK

## Prerequisites

Before you begin, ensure you have the following installed:
- Node.js (v14 or higher)
- PostgreSQL
- npm or yarn

## Environment Setup

1. Create a `.env` file in the root directory with the following variables:
```env
DB_USER=your_db_user
DB_PASSWORD=your_db_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=project_info_db
```

2. Create a `.env` file in the root directory with your Firebase configuration:
```env
REACT_APP_FIREBASE_API_KEY=your_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
REACT_APP_FIREBASE_APP_ID=your_app_id
```

## Installation

1. Clone the repository:
```bash
git clone https://github.com/your-username/infrastructure-tracking.git
cd infrastructure-tracking
```

2. Install dependencies for both frontend and backend:
```bash
# Install frontend dependencies
npm install

# Install backend dependencies
cd api-server
npm install
```

3. Start the development servers:
```bash
# Start the backend server (from the api-server directory)
npm run dev

# Start the frontend development server (from the root directory)
npm start
```

## Deployment

### Deploying to Vercel

This project is configured for easy deployment to Vercel. Follow these steps:

1. Ensure your code is committed to GitHub
2. Visit [vercel.com](https://vercel.com) and sign up/login (you can use your GitHub account)
3. Click "Add New Project"
4. Import your GitHub repository
5. Configure the project:
   - Framework Preset: Create React App
   - Build Command: `npm run build`
   - Output Directory: `build`
   - Install Command: `npm install`
   
6. Set up environment variables:
   - Add all the environment variables listed in the VERCEL_ENV_SETUP.md file
   
7. Click "Deploy"

Your application will be built and deployed to a custom URL provided by Vercel. You can also set up a custom domain in the Vercel dashboard.

### Updating Your Deployment

Any time you push changes to your GitHub repository, Vercel will automatically rebuild and redeploy your application.

## Project Structure

```
infrastructure-tracking/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── auth/
│   │   ├── dashboard/
│   │   ├── layout/
│   │   └── projects/
│   ├── config/
│   │   └── firebase.js
│   ├── contexts/
│   │   ├── AuthContext.js
│   │   └── ThemeContext.js
│   ├── pages/
│   │   ├── Dashboard.js
│   │   ├── Home.js
│   │   ├── Login.js
│   │   └── ProjectDetails.js
│   ├── services/
│   │   ├── api.js
│   │   └── firebase.js
│   ├── App.js
│   └── index.js
└── api-server/
    ├── config/
    ├── routes/
    └── server.js
```

## Navigation

- **Home**: Main page showing all infrastructure developments
- **Dashboard**: Personalized dashboard with tracked projects and statistics
- **Compare**: Compare different developments (requires authentication)
- **Project Details**: Detailed view of individual projects
- **Authentication**: Login/Signup functionality integrated into the home page

## Recent Updates

### Analytics Page Improvements (April 2025)
- Fixed layout issues with overlapping cards and improved spacing
- Enhanced county comparison analysis with side-by-side county cards
- Improved filter system with visual indicators of active filters
- Added better handling for empty or limited data scenarios
- Enhanced subcategory visualization to show county distribution when a subcategory is selected
- Optimized chart rendering and responsive behavior
- Streamlined the analytics summary with more relevant metrics
- Added clear filters button for better user experience
- Improved dark mode compatibility throughout the analytics components

### Profile Page Improvements (March 2025)
- Redesigned user profile interface with a cleaner, more focused layout
- Removed unnecessary fields (bio, organization, job title) to streamline the user experience
- Enhanced profile photo upload with better client-side image compression
- Improved form styling with better input field organization
- Enhanced dark/light mode compatibility throughout the profile page
- Updated CSS with more consistent button and form styling patterns
- Improved responsive layout for better mobile experience
- Optimized profile photo upload process with clear user feedback
- Ensured CORS configuration for seamless photo uploads across development and production environments

### UX Improvements (March 2025)
- Changed login redirection to take users to the home page instead of the dashboard for a more intuitive flow
- Added a "Track Project" button directly on the home page project cards for faster project tracking
- Implemented safeguards to prevent tracking the same project multiple times
- Updated UI with new button styling for better visual hierarchy
- Improved state management to reflect tracking status without page refresh

- Streamlined navigation for better user experience
- Added GitHub authentication option
- Improved responsive design
- Updated branding and text consistency
- Enhanced error handling and loading states
- Redesigned dashboard with improved project tracking functionality and euro currency formatting
- Added customizable dashboard layout options (grid/list view)
- Implemented widget visibility toggles for personalized user experience
- Enhanced project cards with improved action buttons and icons
- Optimized dashboard performance for large datasets
- Added hover effects and transitions for better visual feedback

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
