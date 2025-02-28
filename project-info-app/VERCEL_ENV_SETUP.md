# Vercel Environment Variables Setup

When deploying to Vercel, you'll need to add the following environment variables in the Vercel dashboard:

## Firebase Configuration
```
REACT_APP_FIREBASE_API_KEY=your_firebase_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
REACT_APP_FIREBASE_PROJECT_ID=your_firebase_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
REACT_APP_FIREBASE_APP_ID=your_firebase_app_id
```

The actual values for these environment variables can be found in your Firebase console or your local .env file.

## Other Environment Variables
Add any other environment variables that your application uses here.

## How to add these variables in Vercel
1. Go to your project in the Vercel dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables" in the left sidebar
4. Add each variable with its key and value
5. Make sure to click "Save" after adding all variables

**Note**: These environment variables will be built into your application at build time.
