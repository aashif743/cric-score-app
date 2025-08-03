import API from '../api'; // ✅ FIX: Import the custom axios instance
//https://cric-score-app.onrender.com
// Helper function to create the authorization config object
const getAuthConfig = (token) => {
  if (!token) {
    throw new Error('Authentication token is missing.');
  }
  return {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
};

// Create a new match
const createMatch = async (matchData, token) => {
  const config = getAuthConfig(token);
  // ✅ FIX: Use the API instance and a relative path
  const response = await API.post('/matches', matchData, config);
  return response.data.data;
};

// Get user's matches
const getMyMatches = async (token) => {
  const config = getAuthConfig(token);
  // ✅ FIX: Use the API instance and a relative path
  const response = await API.get('/matches', config);
  return response.data.data;
};

// Delete a match by its ID
const deleteMatch = async (matchId, token) => {
  const config = getAuthConfig(token);
  // ✅ FIX: Use the API instance and a relative path
  const response = await API.delete(`/matches/${matchId}`, config);
  return response.data;
};

// Delete all matches for the logged-in user
const deleteAllMatches = async (token) => {
  const config = getAuthConfig(token);
  // ✅ FIX: This will now work because API is imported
  const response = await API.delete('/matches/all', config);
  return response.data;
};

const matchService = {
  createMatch,
  getMyMatches,
  deleteMatch,
  deleteAllMatches,
};

export default matchService;