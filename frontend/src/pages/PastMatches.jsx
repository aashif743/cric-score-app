import React, { useEffect, useState, useContext } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import matchService from '../utils/matchService';
import './PastMatches.css';

const PastMatches = ({ onResumeMatch }) => {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [matchToDelete, setMatchToDelete] = useState(null);
  
  // NEW: State for the "Delete All" confirmation modal
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);

  useEffect(() => {
    if (user && user.token) {
      const fetchMatches = async () => {
        try {
          setIsLoading(true);
          const userMatches = await matchService.getMyMatches(user.token);
          const sortedMatches = userMatches.sort((a, b) => {
            if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
            if (b.status !== 'in_progress' && a.status === 'in_progress') return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          });
          setMatches(sortedMatches);
        } catch (err) {
          setError('Failed to fetch matches. Please try again later.');
        } finally {
          setIsLoading(false);
        }
      };
      fetchMatches();
    } else {
      setError("You must be logged in to view past matches.");
      setIsLoading(false);
    }
  }, [user]);

  const handleConfirmDelete = async () => {
    if (!matchToDelete || !user?.token) return;
    try {
      await matchService.deleteMatch(matchToDelete._id, user.token);
      setMatches(prevMatches => prevMatches.filter(m => m._id !== matchToDelete._id));
      setShowConfirmModal(false);
      setMatchToDelete(null);
    } catch (err) {
      setError('Failed to delete match. Please try again.');
      setShowConfirmModal(false);
    }
  };

  const openDeleteConfirmation = (match) => {
    setMatchToDelete(match);
    setShowConfirmModal(true);
  };
  
  // NEW: Function to handle deleting all matches
  const handleDeleteAllMatches = async () => {
    try {
      // NOTE: This requires a new backend endpoint (see instructions below)
      await matchService.deleteAllMatches(user.token);
      setMatches([]); // Clear all matches from the UI
      setShowDeleteAllConfirm(false);
    } catch (err) {
      setError('Failed to delete all matches. Please try again.');
      setShowDeleteAllConfirm(false);
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-GB', { year: 'numeric', month: 'long', day: 'numeric' });
  const formatTime = (dateString) => new Date(dateString).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const renderMatchCard = (match, index) => {
    // FIX: More robust check for completed status
    const isCompleted = match.status === 'completed';

    const viewFullScorecard = () => navigate(`/full-scorecard/${match._id}`);

    return (
      <motion.div
        key={match._id}
        className={`match-card ${isCompleted ? 'completed' : 'in-progress'}`}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ y: -5 }}
      >
        <div className="match-card-header">
          <div className="match-teams">
            <span>{match.teamA?.name || 'Team A'}</span>
            <span className="vs-text">vs</span>
            <span>{match.teamB?.name || 'Team B'}</span>
          </div>
        </div>
        <div className="match-card-body">
          <div className="match-status">
            <span className={`status-badge ${isCompleted ? 'completed' : 'in-progress'}`}>{isCompleted ? 'Completed' : 'In Progress'}</span>
            <p className="match-result">{match.result || `Updated ${formatDate(match.updatedAt)}`}</p>
          </div>
          <div className="match-actions">
            {isCompleted ? (
              <button onClick={viewFullScorecard} className="action-button view-button">View Scorecard</button>
            ) : (
              <button onClick={() => onResumeMatch(match)} className="action-button continue-button">Continue Match</button>
            )}
            <button onClick={() => openDeleteConfirmation(match)} className="action-button delete-button">Delete</button>
          </div>
        </div>
      </motion.div>
    );
  };
  
  // --- Modals ---
  const renderConfirmModal = (title, message, onConfirm) => (
    <div className="confirm-modal-overlay" onClick={() => { setShowConfirmModal(false); setShowDeleteAllConfirm(false); }}>
      <div className="confirm-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="confirm-modal-icon">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M9.4 3L14.6 3 21.9 15.5C22.7 17.1 21.5 19 19.7 19L4.3 19C2.5 19 1.3 17.1 2.1 15.5L9.4 3Z M12 14.25A.75.75 0 0 1 11.25 13.5L11.25 9.75A.75.75 0 0 1 12.75 9.75L12.75 13.5A.75.75 0 0 1 12 14.25ZM12 17a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" />
          </svg>
        </div>
        <h2 className="confirm-modal-title">{title}</h2>
        <p className="confirm-modal-message">{message}</p>
        <div className="confirm-modal-actions">
          <button className="btn-modal btn-modal-secondary" onClick={() => { setShowConfirmModal(false); setShowDeleteAllConfirm(false); }}>Cancel</button>
          <button className="btn-modal btn-modal-danger" onClick={onConfirm}>Delete</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="past-matches-container">
      <div className="page-header">
        <button onClick={() => navigate('/dashboard')} className="back-button">Back to Dashboard</button>
        <h1 className="page-title">Your Match History</h1>
        {/* NEW: Delete All Button */}
        {matches.length > 0 && (
          <button onClick={() => setShowDeleteAllConfirm(true)} className="delete-all-btn">Delete All</button>
        )}
      </div>
      
      {isLoading ? ( <div className="loading-state"><div className="loading-spinner"></div><p>Loading...</p></div> ) :
       error ? ( <div className="error-state"><p>{error}</p></div> ) :
       !matches.length ? (
        <div className="empty-state">
          <h3>No Matches Yet</h3>
          <p>You haven't played any matches yet.</p>
          <Link to="/match-setup" className="new-match-button">Start Your First Match</Link>
        </div>
       ) : (
        <div className="matches-list">
          {matches.map((match, index) => renderMatchCard(match, index))}
        </div>
      )}
      
      {showConfirmModal && renderConfirmModal("Delete Match?", "Are you sure? This action cannot be undone.", handleConfirmDelete)}
      {showDeleteAllConfirm && renderConfirmModal("Delete All Matches?", "This will permanently delete your entire match history. Are you sure?", handleDeleteAllMatches)}
    </div>
  );
};

export default PastMatches;