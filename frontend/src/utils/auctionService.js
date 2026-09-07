import API from "../api";

// All authed calls follow the app's existing pattern: pass the token, we attach
// the Bearer header. Each helper returns the useful payload (r.data.data).
const cfg = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const auctionService = {
  // Auctions
  list: (token) => API.get("/auctions", cfg(token)).then((r) => ({ auctions: r.data.data, invites: r.data.invites || [] })),
  create: (data, token) => API.post("/auctions", data, cfg(token)).then((r) => r.data.data),
  get: (id, token) => API.get(`/auctions/${id}`, cfg(token)).then((r) => r.data.data),
  update: (id, data, token) => API.patch(`/auctions/${id}`, data, cfg(token)).then((r) => r.data.data),
  remove: (id, token) => API.delete(`/auctions/${id}`, cfg(token)).then((r) => r.data),
  getPublic: (shareId) => API.get(`/auctions/public/${shareId}`).then((r) => r.data.data),

  // Teams
  addTeam: (id, data, token) => API.post(`/auctions/${id}/teams`, data, cfg(token)).then((r) => r.data.data),
  updateTeam: (id, teamId, data, token) => API.patch(`/auctions/${id}/teams/${teamId}`, data, cfg(token)).then((r) => r.data.data),
  deleteTeam: (id, teamId, token) => API.delete(`/auctions/${id}/teams/${teamId}`, cfg(token)).then((r) => r.data),

  // Players
  addPlayer: (id, data, token) => API.post(`/auctions/${id}/players`, data, cfg(token)).then((r) => r.data.data),
  addPlayersBulk: (id, players, token) => API.post(`/auctions/${id}/players/bulk`, { players }, cfg(token)).then((r) => r.data.data),
  updatePlayer: (id, playerId, data, token) => API.patch(`/auctions/${id}/players/${playerId}`, data, cfg(token)).then((r) => r.data.data),
  deletePlayer: (id, playerId, token) => API.delete(`/auctions/${id}/players/${playerId}`, cfg(token)).then((r) => r.data),

  // Live actions (admin) — the server validates, updates, and broadcasts.
  open: (id, playerId, token) => API.post(`/auctions/${id}/open`, { playerId }, cfg(token)).then((r) => r.data.data),
  bid: (id, teamId, token) => API.post(`/auctions/${id}/bid`, { teamId }, cfg(token)).then((r) => r.data.data),
  adjustBid: (id, direction, token) => API.post(`/auctions/${id}/adjust-bid`, { direction }, cfg(token)).then((r) => r.data.data),
  movePlayer: (id, playerId, direction, token) => API.post(`/auctions/${id}/move-player`, { playerId, direction }, cfg(token)).then((r) => r.data.data),
  undo: (id, token) => API.post(`/auctions/${id}/undo`, {}, cfg(token)).then((r) => r.data.data),
  sell: (id, token) => API.post(`/auctions/${id}/sell`, {}, cfg(token)).then((r) => r.data.data),
  unsold: (id, token) => API.post(`/auctions/${id}/unsold`, {}, cfg(token)).then((r) => r.data.data),
  reauctionUnsold: (id, token) => API.post(`/auctions/${id}/reauction-unsold`, {}, cfg(token)).then((r) => r.data.data),

  // Owner bidding (online mode) — the owner bids for their own team.
  ownerBid: (id, token) => API.post(`/auctions/${id}/owner-bid`, {}, cfg(token)).then((r) => r.data.data),

  // Team owner accepts / rejects an invitation.
  respondInvite: (id, accept, token) => API.post(`/auctions/${id}/invite`, { accept }, cfg(token)).then((r) => r.data.data),
};

export default auctionService;
