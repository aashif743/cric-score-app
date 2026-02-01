import API from "../api";

const publicService = {
  getPublicTournament: async (shareId) => {
    const response = await API.get(`/public/tournament/${shareId}`);
    return response.data;
  },

  getPublicTournamentStats: async (shareId) => {
    const response = await API.get(`/public/tournament/${shareId}/stats`);
    return response.data;
  },

  getPublicTournamentMatches: async (shareId) => {
    const response = await API.get(`/public/tournament/${shareId}/matches`);
    return response.data;
  },

  getPublicMatch: async (matchId) => {
    const response = await API.get(`/public/match/${matchId}`);
    return response.data;
  },
};

export default publicService;
