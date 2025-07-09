import axios from 'axios';

const API_URL = '/api/matches/';


const createMatch = async (matchData, token) => {
  const config = {
    headers: {
      // This Authorization header is what the 'protect' middleware looks for
      Authorization: `Bearer ${token}`,
    },
  };

  // Send the POST request with the match data and the authenticated config
  const response = await axios.post(API_URL, matchData, config);

  // The backend controller returns { success: true, data: savedMatch }
  if (response.data && response.data.success) {
    return response.data.data;
  }
};


// Get user's matches
// The token is required for the protected route
const getMyMatches = async (token) => {
  const config = {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };

  const response = await axios.get(API_URL, config);

  // The controller returns { success: true, data: matches }
  // We'll just return the data part.
  if (response.data && response.data.success) {
    return response.data.data;
  }
  
  return []; // Return empty array on failure
};

// You can add other match-related API calls here in the future
// e.g., createMatch, getMatchById, etc.

const matchService = {
  createMatch,
  getMyMatches,
};

export default matchService;