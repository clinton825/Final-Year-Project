import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './Auth.css';

const SignUp = () => {
  const navigate = useNavigate();
  const { signup } = useAuth();
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: ''
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const validatePassword = (password) => {
    const requirements = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password)
    };
    return requirements;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      return setError('Passwords do not match');
    }

    const passwordReqs = validatePassword(formData.password);
    if (!Object.values(passwordReqs).every(Boolean)) {
      return setError('Password does not meet requirements');
    }

    if (!formData.role) {
      return setError('Please select a role');
    }

    try {
      setLoading(true);
      await signup(
        formData.email,
        formData.password,
        formData.firstName,
        formData.lastName,
        formData.role
      );
      navigate('/dashboard');
    } catch (err) {
      setError('Failed to create an account: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-header">
          <i className="fas fa-user-plus"></i>
          <h2>Create Your Account</h2>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="name-fields">
            <div className="form-group">
              <label>First Name</label>
              <input
                type="text"
                name="firstName"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="First Name"
              />
            </div>
            <div className="form-group">
              <label>Last Name</label>
              <input
                type="text"
                name="lastName"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Last Name"
              />
            </div>
          </div>

          <div className="form-group">
            <label>Email Address</label>
            <input
              type="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              placeholder="Create a password"
            />
            <div className="password-requirements">
              <p className={formData.password.length >= 8 ? 'met' : ''}>
                ✓ At least 8 characters
              </p>
              <p className={/[A-Z]/.test(formData.password) ? 'met' : ''}>
                ✓ One uppercase letter
              </p>
              <p className={/[a-z]/.test(formData.password) ? 'met' : ''}>
                ✓ One lowercase letter
              </p>
              <p className={/[0-9]/.test(formData.password) ? 'met' : ''}>
                ✓ One number
              </p>
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              placeholder="Confirm your password"
            />
          </div>

          <div className="form-group">
            <label>Select Your Role</label>
            <div className="role-options">
              <label className={`role-option ${formData.role === 'citizen' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="citizen"
                  checked={formData.role === 'citizen'}
                  onChange={handleChange}
                />
                <span>Citizen</span>
              </label>
              <label className={`role-option ${formData.role === 'investor' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="investor"
                  checked={formData.role === 'investor'}
                  onChange={handleChange}
                />
                <span>Investor</span>
              </label>
              <label className={`role-option ${formData.role === 'researcher' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="researcher"
                  checked={formData.role === 'researcher'}
                  onChange={handleChange}
                />
                <span>Researcher</span>
              </label>
              <label className={`role-option ${formData.role === 'policymaker' ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="role"
                  value="policymaker"
                  checked={formData.role === 'policymaker'}
                  onChange={handleChange}
                />
                <span>Policymaker</span>
              </label>
            </div>
          </div>

          <button 
            type="submit" 
            className="auth-button" 
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          <p>Already have an account? <a href="/login">Log In</a></p>
        </div>
      </div>
    </div>
  );
};

export default SignUp;
