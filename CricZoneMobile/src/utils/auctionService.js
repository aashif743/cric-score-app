import API from '../api/config';

// Public (no-auth) auction reads for the app's live-auction viewer. A token is
// sent when available but the endpoints are public, so spectating works either
// way.
const auctionService = {
  // Lightweight list of currently-active (live/paused) public auctions — powers
  // the dashboard "Live Auctions" strip.
  getLiveAuctions: async (token) => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await API.get('/auctions/public-live', config);
      return response.data?.data || [];
    } catch (error) {
      return [];
    }
  },

  // Full live snapshot for one auction (auction + teams + players + recent bids),
  // fetched by its public shareId. Same payload the socket pushes on updates.
  getPublicAuction: async (shareId, token) => {
    try {
      const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
      const response = await API.get(`/auctions/public/${shareId}`, config);
      return response.data?.data || null;
    } catch (error) {
      throw error;
    }
  },

  // Tournament-ready payload (teamNames, teamLogos, playersPerTeam, teamSquads)
  // resolved from an auction's public share code — for importing into a tournament.
  getImportData: async (shareCode, token) => {
    const config = token ? { headers: { Authorization: `Bearer ${token}` } } : {};
    const code = String(shareCode || '').trim();
    const response = await API.get(`/auctions/import/${encodeURIComponent(code)}`, config);
    return response.data?.data || null;
  },
};

export default auctionService;
