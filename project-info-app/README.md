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

- **Modern UI/UX**
  - Clean and minimalist interface
  - Responsive design
  - Intuitive navigation
  - Loading states and transitions
  - Mobile-friendly layout

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

1. Create a `.env` file in the server directory with the following variables:
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
cd server
npm install
```

3. Start the development servers:
```bash
# Start the backend server (from the server directory)
npm run dev

# Start the frontend development server (from the root directory)
npm start
```

## Project Structure

```
infrastructure-tracking/
├── public/
│   ├── index.html
│   └── manifest.json
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.js
│   │   │   └── SignUp.js
│   │   └── Navbar.js
│   ├── contexts/
│   │   └── AuthContext.js
│   ├── pages/
│   │   ├── Home.js
│   │   └── ProjectComparison.js
│   ├── App.js
│   └── index.js
└── server/
    ├── config/
    ├── routes/
    └── server.js
```

## Navigation

- **Home**: Main dashboard showing all infrastructure developments
- **Compare**: Compare different developments (requires authentication)
- **Authentication**: Login/Signup functionality integrated into the home page

## Recent Updates

- Streamlined navigation for better user experience
- Added GitHub authentication option
- Improved responsive design
- Updated branding and text consistency
- Enhanced error handling and loading states

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request
