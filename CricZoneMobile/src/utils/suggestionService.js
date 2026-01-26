import API from '../api/config';
import axios from 'axios';

// Create a separate axios instance with shorter timeout for suggestions
const SuggestionAPI = axios.create({
  baseURL: API.defaults.baseURL,
  headers: API.defaults.headers,
  timeout: 5000, // 5 second timeout for suggestions (should be fast)
});

const suggestionService = {
  // Get player name suggestions
  getPlayerSuggestions: async (query = '', signal = null) => {
    try {
      const config = signal ? { params: { query, type: 'player' }, signal } : { params: { query, type: 'player' } };
      const response = await SuggestionAPI.get('/suggestions', config);
      return response.data.data || [];
    } catch (error) {
      // Don't log cancelled requests
      if (axios.isCancel(error)) {
        return [];
      }
      console.warn('Error fetching player suggestions:', error.message);
      return [];
    }
  },

  // Get team name suggestions
  getTeamSuggestions: async (query = '', signal = null) => {
    try {
      const config = signal ? { params: { query, type: 'team' }, signal } : { params: { query, type: 'team' } };
      const response = await SuggestionAPI.get('/suggestions', config);
      return response.data.data || [];
    } catch (error) {
      // Don't log cancelled requests
      if (axios.isCancel(error)) {
        return [];
      }
      console.warn('Error fetching team suggestions:', error.message);
      return [];
    }
  },

  // Add a new suggestion (called when user finishes entering a name)
  // This uses fire-and-forget pattern - we don't wait for the result
  addSuggestion: (name, type) => {
    if (!name || !name.trim()) return;

    // Fire and forget - don't await
    SuggestionAPI.post('/suggestions', {
      name: name.trim(),
      type,
    }).catch(error => {
      // Silently fail - this is not critical
      console.warn('Failed to save suggestion:', error.message);
    });
  },

  // Convenience methods
  addPlayerName: (name) => {
    suggestionService.addSuggestion(name, 'player');
  },

  addTeamName: (name) => {
    suggestionService.addSuggestion(name, 'team');
  },
};

export default suggestionService;
