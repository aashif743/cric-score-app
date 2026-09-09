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

  // Real player names seen for each team across the tournament's matches, so a
  // team's line-up can be suggested first when scoring their next match.
  // Returns { "Team A": ["John", ...], ... } (empty object on any failure).
  getTeamRosters: async (id, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.get(`/tournaments/${id}/rosters`, config);
      return response.data?.data || {};
    } catch (error) {
      return {};
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

  generateShareLink: async (id, token) => {
    try {
      const config = { headers: { Authorization: `Bearer ${token}` } };
      const response = await API.post(`/tournaments/${id}/share`, {}, config);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  // Rename a team everywhere within a tournament (teamNames + all matches).
  renameTeam: async (id, oldName, newName, token) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await API.patch(
      `/tournaments/${id}/rename-team`,
      { oldName, newName },
      config,
    );
    return response.data;
  },

  // Swap two teams between their groups (league only). Allowed before any group
  // match has started; rebuilds the fixtures from the swapped arrangement.
  swapTeams: async (id, teamA, teamB, token) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await API.patch(
      `/tournaments/${id}/swap-teams`,
      { teamA, teamB },
      config,
    );
    return response.data;
  },

  // Manually set (or clear) a team in a knockout/playoff bracket slot.
  // teamName '' clears the slot back to TBD. Owner-only; scheduled matches only.
  setBracketTeam: async (id, matchId, slot, teamName, token) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await API.patch(
      `/tournaments/${id}/bracket-team`,
      { matchId, slot, teamName },
      config,
    );
    return response.data;
  },

  // Change which group position feeds a bracket slot (e.g. 'A1' → 'B2') for a
  // not-yet-qualified league-playoff slot. source '' clears it. Owner-only.
  setBracketSource: async (id, matchId, slot, source, token) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await API.patch(
      `/tournaments/${id}/bracket-source`,
      { matchId, slot, source },
      config,
    );
    return response.data;
  },

  // Switch the league playoff format ('knockout' | 'qualifier'). Rebuilds the
  // playoff matches; allowed while the playoffs haven't started.
  setPlayoffFormat: async (id, playoffFormat, token) => {
    const config = { headers: { Authorization: `Bearer ${token}` } };
    const response = await API.patch(
      `/tournaments/${id}/playoff-format`,
      { playoffFormat },
      config,
    );
    return response.data;
  },
};

export default tournamentService;
