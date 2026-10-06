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

  // Curated feed of owner-featured tournaments (upcoming + live) for the
  // dashboard. Returns []; resolves successfully even when empty.
  getFeaturedTournaments: async (token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get('/live/tournaments', config);
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  },
};

export default liveService;
