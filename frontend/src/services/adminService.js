import API from "../api";

// All admin endpoints require a Bearer token from an admin account.
const auth = (token) => ({ headers: { Authorization: `Bearer ${token}` } });

const adminService = {
  me: (token) => API.get("/admin/me", auth(token)).then((r) => r.data?.data),

  overview: (token) => API.get("/admin/overview", auth(token)).then((r) => r.data?.data),

  // Tournaments
  listTournaments: (token, { filter = "pending", search = "", page = 1 } = {}) =>
    API.get(`/admin/tournaments`, { ...auth(token), params: { filter, search, page } }).then((r) => r.data),
  approveTournament: (token, id, approved) =>
    API.post(`/admin/tournaments/${id}/approve`, { approved }, auth(token)).then((r) => r.data),
  rejectTournament: (token, id) =>
    API.post(`/admin/tournaments/${id}/reject`, {}, auth(token)).then((r) => r.data),
  deleteTournament: (token, id) =>
    API.delete(`/admin/tournaments/${id}`, auth(token)).then((r) => r.data),

  // Users
  listUsers: (token, { search = "", page = 1 } = {}) =>
    API.get(`/admin/users`, { ...auth(token), params: { search, page } }).then((r) => r.data),
  getUser: (token, id) => API.get(`/admin/users/${id}`, auth(token)).then((r) => r.data?.data),
  setUserStatus: (token, id, status) =>
    API.post(`/admin/users/${id}/status`, { status }, auth(token)).then((r) => r.data),
  setUserRole: (token, id, role) =>
    API.post(`/admin/users/${id}/role`, { role }, auth(token)).then((r) => r.data),

  // Content cleanup
  contentIssues: (token) => API.get("/admin/content/issues", auth(token)).then((r) => r.data?.data),
  deleteOrphanMatches: (token, type) =>
    API.delete(`/admin/content/orphan-matches`, { ...auth(token), params: { type } }).then((r) => r.data),

  // Audit
  auditLog: (token, page = 1) =>
    API.get(`/admin/audit`, { ...auth(token), params: { page } }).then((r) => r.data),
};

export default adminService;
