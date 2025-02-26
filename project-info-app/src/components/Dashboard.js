import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebase/config';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (authUser) => {
      if (authUser) {
        const userDocRef = doc(db, 'users', authUser.uid);
        const userDoc = await getDoc(userDocRef);
        setUser({ id: authUser.uid, ...userDoc.data() });
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Please log in to view the dashboard.</div>;

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h1>Welcome, {user.displayName || 'User'}!</h1>
        <button 
          onClick={handleLogout} 
          style={{ 
            padding: '10px', 
            backgroundColor: '#ff4444', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px', 
            cursor: 'pointer' 
          }}
        >
          Logout
        </button>
      </header>

      <section style={{ marginBottom: '20px' }}>
        <h2>Profile</h2>
        <p>Email: {user.email}</p>
        <p>Bio: {user.profile?.bio || 'No bio provided.'}</p>
        <img
          src={user.profile?.avatarUrl || 'https://via.placeholder.com/150'}
          alt="Profile Avatar"
          style={{ width: '150px', height: '150px', borderRadius: '50%' }}
        />
      </section>

      <section style={{ marginBottom: '20px' }}>
        <h2>Activity</h2>
        <p>Recent activity will be displayed here.</p>
      </section>

      <section>
        <h2>Settings</h2>
        <button 
          onClick={() => alert('Edit profile functionality coming soon!')} 
          style={{ 
            padding: '10px', 
            backgroundColor: '#007bff', 
            color: 'white', 
            border: 'none', 
            borderRadius: '5px', 
            cursor: 'pointer' 
          }}
        >
          Edit Profile
        </button>
      </section>
    </div>
  );
};

export default Dashboard;
