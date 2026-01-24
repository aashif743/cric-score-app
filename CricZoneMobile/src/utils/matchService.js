import API from '../api/config';

const matchService = {
  // Create a new match
  createMatch: async (matchData, token) => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await API.post('/matches', matchData, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get all matches for current user
  getMyMatches: async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get('/matches', config);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  // Get single match by ID
  getMatch: async (matchId, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get(`/matches/${matchId}`, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Update match (live state)
  updateMatch: async (matchId, updateData, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.put(`/matches/${matchId}`, updateData, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // End first innings
  endInnings: async (matchId, inningsData, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.post(`/matches/${matchId}/end-innings`, inningsData, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // End match
  endMatch: async (matchId, matchData, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.put(`/matches/${matchId}/end`, matchData, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete single match
  deleteMatch: async (matchId, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.delete(`/matches/${matchId}`, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Delete all matches
  deleteAllMatches: async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.delete('/matches/all', config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default matchService;
