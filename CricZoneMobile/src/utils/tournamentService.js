import API from '../api/config';

const tournamentService = {
  createTournament: async (data, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.post('/tournaments', data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getMyTournaments: async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get('/tournaments', config);
      return response.data.data || response.data;
    } catch (error) {
      throw error;
    }
  },

  getTournament: async (id, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get(`/tournaments/${id}`, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  updateTournament: async (id, data, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.put(`/tournaments/${id}`, data, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  deleteTournament: async (id, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.delete(`/tournaments/${id}`, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getTournamentStats: async (id, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get(`/tournaments/${id}/stats`, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },
};

export default tournamentService;
