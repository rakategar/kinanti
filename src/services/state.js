// src/services/state.js
// Simple in-memory state management untuk dialog flow

const userStates = new Map();

/**
 * Get user state
 * @param {string} userPhone - User's phone number
 * @returns {Promise<Object|null>} - User state object or null
 */
async function getState(userPhone) {
  return userStates.get(userPhone) || null;
}

/**
 * Set user state
 * @param {string} userPhone - User's phone number
 * @param {Object} state - State object to save
 * @returns {Promise<void>}
 */
async function setState(userPhone, state) {
  userStates.set(userPhone, state);
}

/**
 * Clear user state
 * @param {string} userPhone - User's phone number
 * @returns {Promise<void>}
 */
async function clearState(userPhone) {
  userStates.delete(userPhone);
}

module.exports = {
  getState,
  setState,
  clearState,
};
