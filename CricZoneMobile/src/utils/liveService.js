import API from '../api/config';

const liveService = {
  // Fetch all currently-live matches from public tournaments.
  // Returns []. Resolves successfully even when there are no live matches.
  getLiveMatches: async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get('/live/matches', config);
      return response.data?.data || [];
    } catch (error) {
      throw error;
    }
  },
};

export default liveService;
