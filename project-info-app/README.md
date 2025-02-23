# Infrastructure Project Tracker

A modern web application for tracking and comparing infrastructure projects. Built with React, Firebase Authentication, and PostgreSQL.

## Features

- **User Authentication**
  - Email/Password login and registration
  - Google Sign-in integration
  - Secure authentication powered by Firebase

- **Project Management**
  - View infrastructure projects
  - Compare different projects
  - Detailed project information

- **Modern UI/UX**
  - Responsive design
  - Clean and professional interface
  - Consistent design system
  - Loading states and transitions
  - Mobile-friendly navigation

## Tech Stack

- **Frontend**
  - React 18
  - React Router v6
  - Firebase Authentication
  - Font Awesome icons
  - Inter font family
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
git clone https://github.com/your-username/infrastructure-project-tracker.git
cd infrastructure-project-tracker
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
project-info-app/
├── public/
├── server/
│   ├── config/
│   ├── models/
│   ├── routes/
│   └── server.js
├── src/
│   ├── components/
│   │   ├── Auth/
│   │   └── Project/
│   ├── contexts/
│   ├── pages/
│   ├── services/
│   ├── styles/
│   └── App.js
└── package.json
```

## Available Scripts

- `npm start`: Start the frontend development server
- `npm test`: Run frontend tests
- `npm run build`: Build the frontend for production
- `npm run dev` (in server directory): Start the backend development server

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
