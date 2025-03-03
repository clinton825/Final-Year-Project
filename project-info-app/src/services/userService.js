import { auth } from '../firebase/config';

class UserService {
  static async getCurrentToken() {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    return user.getIdToken();
  }

  static async createOrUpdateProfile(userData) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/users/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(userData)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return response.json();
  }

  static async getUserProfile() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/users/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch profile');
    }

    return response.json();
  }

  static async updateUserProfile(updates) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/users/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(updates)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to update profile');
    }

    return response.json();
  }

  static async uploadProfilePhoto(photoFile) {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const formData = new FormData();
    formData.append('photo', photoFile);

    const response = await fetch('/api/users/profile/photo', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to upload profile photo');
    }

    return response.json();
  }

  static async changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error('No user logged in');
    
    try {
      // Reauthenticate user before changing password
      const credential = auth.EmailAuthProvider.credential(
        user.email, 
        currentPassword
      );
      await user.reauthenticateWithCredential(credential);
      
      // Change password
      await user.updatePassword(newPassword);
      return { success: true };
    } catch (error) {
      throw new Error(error.message || 'Failed to change password');
    }
  }
  
  static async getUserActivity() {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/users/activity', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Failed to fetch user activity');
    }

    return response.json();
  }
}

export default UserService;
