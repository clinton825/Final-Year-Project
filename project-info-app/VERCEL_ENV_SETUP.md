# Vercel Environment Variables Setup

When deploying to Vercel, you'll need to add the following environment variables in the Vercel dashboard:

## Firebase Configuration
```
REACT_APP_FIREBASE_API_KEY=AIzaSyCYCGXsttUJHV0QStjs_sOvgmdoisFVu-o
REACT_APP_FIREBASE_AUTH_DOMAIN=infrastructure-project--app.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=infrastructure-project--app
REACT_APP_FIREBASE_STORAGE_BUCKET=infrastructure-project--app.appspot.com
REACT_APP_FIREBASE_MESSAGING_SENDER_ID=845897639432
REACT_APP_FIREBASE_APP_ID=1:845897639432:web:9e14b96fc048c7bd6313bd
```

## Other Environment Variables
Add any other environment variables that your application uses here.

## How to add these variables in Vercel
1. Go to your project in the Vercel dashboard
2. Click on "Settings" tab
3. Click on "Environment Variables" in the left sidebar
4. Add each variable with its key and value
5. Make sure to click "Save" after adding all variables

**Note**: These environment variables will be built into your application at build time.
