# Project Information Finder
# BY Clinton Bempah (20097793)

## Overview
The **Project Information Finder** is a React-based web application that allows users to search for project details using a Planning ID. The application fetches project data from a backend API and displays relevant details such as title, category, stage, value, location, and description.

## Features
- Input field to enter a Planning ID
- Fetches project details from an API endpoint
- Displays project information in a structured format
- Error handling for API requests
- Loading state indicator while fetching data

## Technologies Used
- React.js (Functional Components, Hooks)
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
   git clone https://github.com/your-username/project-info-finder.git
   ```
2. Navigate to the project directory:
   ```sh
   cd project-info-finder
   ```
3. Install dependencies:
   ```sh
   npm install
   ```
4. Start the development server:
   ```sh
   npm start
   ```
   The application will be available at `http://localhost:3000/`.

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

