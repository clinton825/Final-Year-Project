// In-memory storage for demo purposes
// In a production environment, this would be replaced with a database
const trackedProjects = new Map();
const notifications = new Map();

const trackProject = async (userId, projectId) => {
  if (!trackedProjects.has(userId)) {
    trackedProjects.set(userId, new Set());
  }
  trackedProjects.get(userId).add(projectId);
  
  // Create a notification for newly tracked project
  addNotification(userId, {
    type: 'PROJECT_TRACKED',
    projectId,
    message: 'You started tracking a new project',
    timestamp: new Date()
  });

  return { success: true };
};

const untrackProject = async (userId, projectId) => {
  if (!trackedProjects.has(userId)) {
    return { success: false, error: 'User not found' };
  }
  
  trackedProjects.get(userId).delete(projectId);
  return { success: true };
};

const getTrackedProjects = async (userId) => {
  return Array.from(trackedProjects.get(userId) || []);
};

const addNotification = async (userId, notification) => {
  if (!notifications.has(userId)) {
    notifications.set(userId, []);
  }
  notifications.get(userId).unshift(notification);
};

const getNotifications = async (userId) => {
  return notifications.get(userId) || [];
};

const clearNotifications = async (userId) => {
  notifications.set(userId, []);
  return { success: true };
};

module.exports = {
  trackProject,
  untrackProject,
  getTrackedProjects,
  addNotification,
  getNotifications,
  clearNotifications
};
