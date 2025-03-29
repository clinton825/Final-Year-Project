import { collection, getDocs, addDoc, doc, getDoc, setDoc, query, limit, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';

/**
 * Service to initialize and verify Firestore database collections
 * This ensures all required collections exist even before user actions
 */
export const databaseInitService = {
  // List of required collections for the application
  requiredCollections: [
    'trackedProjects',
    'projectNotes',
    'activity',
    'userActivity',
    'users'
  ],
  
  /**
   * Initialize all required collections for a user
   * @param {Object} user - The authenticated user object
   * @returns {Promise<boolean>} - Success status
   */
  async initializeDatabase(user) {
    if (!user || !user.uid) {
      console.error('Cannot initialize database: No authenticated user');
      return false;
    }
    
    console.log('Initializing database collections for user:', user.uid);
    
    try {
      // Verify each collection exists or create it
      const results = await Promise.all(
        this.requiredCollections.map(collectionName => 
          this.verifyCollection(collectionName, user)
        )
      );
      
      console.log('Database initialization complete:', results);
      return !results.includes(false);
    } catch (error) {
      console.error('Database initialization failed:', error);
      return false;
    }
  },
  
  /**
   * Verify a collection exists and create it if needed
   * @param {string} collectionName - The name of the collection to verify
   * @param {Object} user - The authenticated user
   * @returns {Promise<boolean>} - Success status
   */
  async verifyCollection(collectionName, user) {
    try {
      // Check if collection exists by trying to read from it
      const collectionRef = collection(db, collectionName);
      const testQuery = query(collectionRef, limit(1));
      const querySnapshot = await getDocs(testQuery);
      
      // If collection exists and has documents, we're done
      if (!querySnapshot.empty) {
        console.log(`Collection ${collectionName} exists and has documents`);
        return true;
      }
      
      // Collection exists but is empty, create placeholder doc
      console.log(`Collection ${collectionName} exists but is empty, creating placeholder`);
      return await this.createPlaceholderDocument(collectionName, user);
    } catch (error) {
      // Handle specific Firestore errors that indicate collection doesn't exist
      if (error.code === 'permission-denied' || error.code === 'not-found') {
        console.log(`Collection ${collectionName} doesn't exist, creating it...`);
        return await this.createPlaceholderDocument(collectionName, user);
      }
      
      console.error(`Error verifying collection ${collectionName}:`, error);
      return false;
    }
  },
  
  /**
   * Create a placeholder document in a collection
   * @param {string} collectionName - The name of the collection
   * @param {Object} user - The authenticated user
   * @returns {Promise<boolean>} - Success status
   */
  async createPlaceholderDocument(collectionName, user) {
    try {
      let documentData = {
        _placeholder: true,
        _createdAt: serverTimestamp(),
        userId: user.uid,
        _description: `Placeholder document for ${collectionName} collection`
      };
      
      // Customize document data based on collection type
      switch (collectionName) {
        case 'users':
          // For users collection, use the user's UID as document ID
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              displayName: user.displayName || user.email.split('@')[0],
              email: user.email,
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
              _initialized: true
            });
          }
          return true;
          
        case 'trackedProjects':
          documentData = {
            ...documentData,
            type: 'placeholder',
            planning_title: 'Database Initialization Record',
            trackedAt: serverTimestamp()
          };
          break;
          
        case 'projectNotes':
          documentData = {
            ...documentData,
            projectId: 'placeholder',
            text: 'Database initialization note',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          };
          break;
          
        case 'activity':
        case 'userActivity':
          documentData = {
            ...documentData,
            type: 'system_init',
            message: 'Database initialization',
            timestamp: serverTimestamp()
          };
          break;
      }
      
      // Add the document to the collection
      const docRef = await addDoc(collection(db, collectionName), documentData);
      console.log(`Created placeholder document in ${collectionName} with ID: ${docRef.id}`);
      return true;
    } catch (error) {
      console.error(`Error creating placeholder in ${collectionName}:`, error);
      return false;
    }
  }
};

export default databaseInitService;
