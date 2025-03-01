const db = require('../config/database');

class User {
  static async createUser(firebaseUid, email, firstName, lastName, role = 'user') {
    const query = `
      INSERT INTO users (firebase_uid, email, first_name, last_name, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [firebaseUid, email, firstName, lastName, role];
    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getUserByFirebaseUid(firebaseUid) {
    const query = 'SELECT * FROM users WHERE firebase_uid = $1';
    try {
      const result = await db.query(query, [firebaseUid]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async updateUser(firebaseUid, updates) {
    const allowedUpdates = ['first_name', 'last_name', 'email', 'role'];
    const updateFields = Object.keys(updates)
      .filter(key => allowedUpdates.includes(key) && updates[key] !== undefined);
    
    if (updateFields.length === 0) return null;

    const setClause = updateFields
      .map((field, index) => `${field} = $${index + 2}`)
      .join(', ');
    const values = [firebaseUid, ...updateFields.map(field => updates[field])];

    const query = `
      UPDATE users 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE firebase_uid = $1 
      RETURNING *
    `;

    try {
      const result = await db.query(query, values);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }

  static async getAllUsers() {
    const query = 'SELECT * FROM users ORDER BY created_at DESC';
    try {
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      throw error;
    }
  }

  static async deleteUser(firebaseUid) {
    const query = 'DELETE FROM users WHERE firebase_uid = $1 RETURNING *';
    try {
      const result = await db.query(query, [firebaseUid]);
      return result.rows[0];
    } catch (error) {
      throw error;
    }
  }
}
