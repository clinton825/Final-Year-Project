# Project Information Finder
# BY Clinton Bempah (20097793)

## Overview
The **Project Information Finder** is a React-based web application that allows users to search for project details using a Planning ID. The application fetches project data from a backend API and displays relevant details such as title, category, stage, value, location, and description.

## Features
- Search functionality using Planning ID
- Detailed project information display including:
  - Project Title
  - Category
  - Stage
  - Value
  - Location (County and Region)
  - Description
  - Project URL
- Responsive design for mobile and desktop devices
- Real-time API integration
- Error handling and validation
- Loading states for better user experience
- Navigation between project details and home page
- Clean and modern user interface

## Technologies Used
- React.js (Functional Components, Hooks)
- React Router for navigation
- Axios for API requests
- Express.js backend server
- Node.js runtime
- Environment variables support with dotenv
- Modern CSS with responsive design
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

## API Endpoint
The application fetches data from the following API endpoint:
```
http://localhost:3001/api/project/{projectId}
```
### Expected API Response Format
```json
{
  "status": "success",
  "project": {
    "data": {
      "rows": [
        {
          "planning_title": "Project Name",
          "planning_category": "Category",
          "planning_stage": "Stage",
          "planning_value": "1000000",
          "planning_county": "County",
          "planning_region": "Region",
          "planning_description": "Project details here...",
          "planning_url": "https://example.com"
        }
      ]
    }
  }
}
```

## Usage
1. Enter a Planning ID in the input field.
2. Click the **Search Project** button.
3. The application will fetch and display project details.
4. If an error occurs, an error message will be displayed.

## Troubleshooting
- **API Not Working?** Ensure the backend server is running at `http://localhost:3001/`.
- **No Project Found?** Double-check the Planning ID entered.
- **CORS Issues?** If calling an external API, enable CORS in the backend.

## License
This project is licensed under the [MIT License](LICENSE).

## Contributing
Feel free to open issues and submit pull requests to improve this project!

---
Developed with ❤️ using React.js.
