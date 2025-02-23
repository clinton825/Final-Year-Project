import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth } from '../../firebase/config';
import { 
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import UserService from '../../services/userService';
import { useUser } from '../../contexts/UserContext';
import './Auth.css';

const AuthHandler = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      let userCredential;
      if (isSignUp) {
        userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await UserService.createOrUpdateProfile({
          email: userCredential.user.email,
          firstName,
          lastName,
          role: 'user'
        });
      } else {
        userCredential = await signInWithEmailAndPassword(auth, email, password);
      }
      
      // Navigate to home after successful authentication
      navigate('/');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const userCredential = await signInWithPopup(auth, provider);
      
      // Create/update profile after Google sign-in
      const names = userCredential.user.displayName?.split(' ') || ['', ''];
      await UserService.createOrUpdateProfile({
        email: userCredential.user.email,
        firstName: names[0],
        lastName: names.slice(1).join(' '),
        role: 'user'
      });
      
      // Navigate to home after successful authentication
      navigate('/');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container">
      <h2>{isSignUp ? 'Sign Up' : 'Login'}</h2>
      {error && <div className="error-message">{error}</div>}
      
      <form onSubmit={handleAuth}>
        <div className="form-group">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {isSignUp && (
          <>
            <div className="form-group">
              <input
                type="text"
                placeholder="First Name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <input
                type="text"
                placeholder="Last Name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                required
              />
            </div>
          </>
        )}

        <div className="form-group">
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        <button type="submit" disabled={loading}>
          {loading ? 'Processing...' : isSignUp ? 'Sign Up' : 'Login'}
        </button>
      </form>

      <button onClick={handleGoogleSignIn} className="google-signin">
        Sign in with Google
      </button>

      <p>
        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
        <button
          onClick={() => setIsSignUp(!isSignUp)}
          className="toggle-auth-mode"
        >
          {isSignUp ? 'Login' : 'Sign Up'}
        </button>
      </p>
    </div>
  );
};

export default AuthHandler;
