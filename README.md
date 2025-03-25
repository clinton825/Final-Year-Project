# Infrastructure Project Tracking Web Application
**BY Clinton Bempah (20097793)**

## Overview
The **Infrastructure Project Tracking Web Application** is a React-based web application that allows users to explore and search for infrastructure project details. The application fetches project data from a backend API and displays comprehensive information about various infrastructure projects, including their planning details, categories, values, and locations.

## Key Features
### **Search & Filtering**
- Search by **Planning ID, Title, Location, or Category**
- Filter projects by **Category, Subcategory, and Value Range**
- Smart filtering to hide **already tracked projects** (toggle-enabled)

### **Project Cards & Details**
- Expandable descriptions (**Read More/Show Less** functionality)
- Track projects with a **one-click button**
- Display essential project details (ID, Category, Value, Location, etc.)
- Interactive **Project Timeline** for milestone visualization

### **Dashboard & Visualizations**
- **Quick Stats Summary** (tracked projects, total value, activity count)
- **Interactive Bar Charts** for project value distribution
- **Dark Mode Compatibility**
- **Customizable Layout** (grid/list view, widget visibility toggles)
- **Project Notes System** (add/edit/delete personal notes)

### **User & Authentication**
- Secure **User Activity Tracking** (interactions, searches, tracking history)
- **Company Profiles** (Architects, Contractors, Contact Info, Links)
- **LocalStorage fallback** for offline support
- Enhanced authentication with **error handling & retry mechanisms**

## Recent Updates *(March 2025)*
### **Analytics Dashboard**
- **Visualizations for project data trends** (subcategory spending, development stage analysis)
- **Time-range filtering** (1-10 years) for insights
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
3. Deploy with `npm install && npm start`

## **API Endpoints**
| Method | Endpoint | Description |
|--------|------------|----------------|
| GET | `/api/project/{id}` | Fetch project details by ID |
| GET | `/api/projects` | Retrieve all projects |
| GET | `/api/projects/category/{category}` | Get projects by category |
| GET | `/api/subcategories/{category}` | Fetch subcategories by category |

### **Sample API Response**
```json
{
  "status": "success",
  "projects": [
    {
      "planning_id": "123",
      "planning_title": "Project Name",
      "planning_category": "Category",
      "planning_value": "1000000",
      "planning_location": "Region",
      "planning_description": "Project details here..."
    }
  ]
}
```

## **Usage Instructions**
1. **Browse & Search** projects on the home page
2. **Apply Filters** (category, subcategory, value range)
3. **Click on a Project** to view details
4. **Track Projects** for personal monitoring
5. **Access Dashboard** for insights and tracked projects
6. **Add Notes** to tracked projects
7. **Customize Layouts** (toggle widgets, grid/list views)
8. **View Analytics** for project trends

## **Contributing**
Contributions are welcome! Submit a **Pull Request** or open an **Issue** on GitHub.

---

