# Infrastructure Project Tracking Web Application
# BY Clinton Bempah (20097793)

## Overview
The **Infrastructure Project Tracking Web Application** is a React-based web application that allows users to explore and search for infrastructure project details. The application fetches project data from a backend API and displays comprehensive information about various infrastructure projects, including their planning details, categories, values, and locations.

## Features
- Advanced search and filtering capabilities:
  - Search by Planning ID, title, location, or category
  - Filter by project category and subcategory
  - Filter by project value range
- Interactive project cards with:
  - Expandable descriptions for better readability
  - "Read More/Show Less" functionality
  - Key project information at a glance
- Comprehensive project details page featuring:
  - Project overview (title, ID, category, type, stage)
  - Formatted project value in euros
  - Detailed location information
  - Site specifications (area and building size)
  - Important dates (application, decision, start, completion)
  - Project description
  - Interactive project tags
  - External resource links
- Modern Dashboard Interface:
  - Personal welcome message
  - Quick stats and activity overview
  - Dynamic card layout with hover effects
  - Smooth animations and transitions
  - Modern gradient backgrounds
  - High contrast design for better readability
  - Customizable layout options (grid/list view)
  - Widget visibility toggles for personalized experience
  - Euro (€) currency formatting
- User Activity Tracking:
  - Track user interactions with projects
  - Monitor search patterns and preferences
  - Collect analytics for user engagement
- Detailed stakeholder information:
  - Company profiles by type (Architect, Contractor, etc.)
  - Complete contact information
  - Interactive website links
- Modern, responsive design features:
  - Card-based layout with consistent spacing
  - Grid system for responsive design
  - Smooth transitions and animations
  - Mobile-friendly interface
- Real-time API integration
- Error handling and validation
- Loading states for better user experience
- Navigation between project details and home page
- Clean and intuitive user interface

## Recent Updates
### Home Page Improvements (February 2025)
- Added smart filtering to hide already tracked projects from the home page
- Implemented a toggle switch to show/hide tracked projects based on user preference
- Added a notification badge showing how many projects are currently hidden
- Enhanced project ID handling for improved tracking functionality

### Dark Mode Enhancements (February 2025)
- Improved dark mode styling throughout the application
- Enhanced dashboard summary cards with better contrast and readability in dark mode
- Fixed visibility issues in project comparison page when using dark theme
- Added proper dark styling for selected project cards in comparison view
- Ensured all text elements have proper contrast in dark mode
- Maintained consistent visual design across theme changes

### Dashboard Enhancement (February 2025)
- Added summary statistics cards at the top of the dashboard
- Implemented data visualization with bar charts for project value distribution
- Fixed location display with map marker icons
- Enhanced empty state displays with improved guidance
- Added hover effects and visual improvements to project cards
- Improved icon usage for better visual hierarchy
- Enhanced mobile responsiveness

### UI Enhancement Phase 2 (February 2025)
- Converted currency display to Euro (€)
- Simplified project card layout on Home page
- Improved tracking functionality
- Added dashboard layout customization and widget visibility toggles
- Enhanced project filter capabilities
- Fixed subcategory mapping for "Commercial & Retail" category

## Technologies Used
- React.js (Functional Components, Hooks)
- React Router for navigation
- Axios for API requests
- Express.js backend server
- Node.js runtime
- Environment variables support with dotenv
- Modern CSS with responsive design
  - CSS Grid for layout
  - Flexbox for component structure
  - CSS transitions for smooth animations
  - CSS Variables for theming
  - Modern gradient effects
- CORS support for API security
- Fetch API for making HTTP requests
- JavaScript (ES6+)
- HTML & CSS for styling

## Installation & Setup
### Prerequisites
Ensure you have the following installed:
- [Node.js](https://nodejs.org/) (v14+ recommended)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)

### Steps
1. Clone the repository:
   ```sh
   git clone https://github.com/clinton825/Final-Year-Project.git
   ```
2. Navigate to the project directory:
   ```sh
   cd Final-Year-Project/project-info-app
   ```
3. Install dependencies for both client and server:
   ```sh
   npm install
   cd server && npm install
   ```
4. Create a .env file in the server directory with your environment variables:
   ```
   PORT=3001
   # Add any other environment variables
   ```
5. Start the development servers:
   In the project-info-app directory:
   ```sh
   npm start
   ```
   In a new terminal, navigate to the server directory and start the backend:
   ```sh
   cd server && npm start
   ```
   The frontend will be available at `http://localhost:3000/` and the backend at `http://localhost:3001/`.

## API Endpoints
The application uses the following API endpoints:

### Get Project by ID
```
GET http://localhost:3001/api/project/{projectId}
```

### Get All Projects
```
GET http://localhost:3001/api/projects
```

### Get Subcategories by Category
```
GET http://localhost:3001/api/subcategories/{category}
```

### Get Projects by Category
```
GET http://localhost:3001/api/projects/category/{category}
```

### Get Projects by Category and Subcategory
```
GET http://localhost:3001/api/projects/category/{category}?subcategory={subcategory}
```

### Expected API Response Format
```json
{
  "status": "success",
  "projects": [
    {
      "planning_id": "123",
      "planning_title": "Project Name",
      "planning_category": "Category",
      "planning_subcategory": "Subcategory",
      "planning_value": "1000000",
      "planning_county": "County",
      "planning_region": "Region",
      "planning_description": "Project details here...",
      "planning_url": "https://example.com"
    }
  ]
}
```

## Usage
1. Browse projects on the home page using the grid layout
2. Use the search bar to find specific projects by ID, title, location, or category
3. Filter projects by:
   - Selecting a category from the dropdown
   - Choosing a subcategory (if available)
   - Setting a value range
4. Click "Read More" on any project card to view its full description
5. Click on a project card to view detailed information
6. Use the "Clear All Filters" button to reset your search and filters
7. Track projects by clicking the "Track Project" button on any project card
8. Access your personalized dashboard to view tracked projects and statistics
9. Customize your dashboard by:
   - Toggling between grid and list layouts
   - Showing/hiding specific widgets (Projects, Activity, Stats)
   - Untracking projects you no longer want to follow

## Dashboard Features
The personalized dashboard provides users with a customized view of their tracked projects and activities:

- **Tracked Projects Widget**: View all projects you've chosen to track
- **Recent Activity**: Monitor your recent interactions with the application
- **Project Statistics**: View aggregated data about your tracked projects
- **Customizable Layout**: Toggle between grid and list views
- **Widget Visibility Controls**: Show or hide specific dashboard sections
- **Interactive Project Cards**: View project details or untrack projects with a single click
- **Euro (€) Currency Formatting**: All monetary values displayed in euros
- **Real-time Updates**: Dashboard automatically updates when tracking or untracking projects

## Contributing
Contributions are welcome! Please feel free to submit a Pull Request.
