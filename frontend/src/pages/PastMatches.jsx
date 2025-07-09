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

  useEffect(() => {
    if (user && user.token) {
      const fetchMatches = async () => {
        try {
          setIsLoading(true);
          const userMatches = await matchService.getMyMatches(user.token);
          const sortedMatches = userMatches.sort((a, b) => {
            if (a.status === 'in_progress' && b.status !== 'in_progress') return -1;
            if (b.status === 'in_progress' && a.status !== 'in_progress') return 1;
            return new Date(b.updatedAt) - new Date(a.updatedAt);
          });
          setMatches(sortedMatches);
        } catch (err) {
          setError('Failed to fetch matches. Please try again later.');
          console.error(err);
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

  const formatDate = (dateString) => {
    if (!dateString) return "Date not available";
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
  };

  const formatTime = (dateString) => {
    if (!dateString) return "";
    return new Date(dateString).toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit'
    });
  };

const renderMatchCard = (match, index) => {
    const isCompleted = match.status === 'completed';

    // --- THIS IS THE FIX ---
    // This function now ONLY navigates to the URL. It does NOT send incomplete data.
    // This forces FullScorecard.jsx to use its own logic to find the complete match data.
    const viewFullScorecard = () => {
      if (!match?._id) {
        console.error("Cannot view scorecard, match ID is missing.");
        return;
      }
      navigate(`/full-scorecard/${match._id}`);
    };

    return (
      <motion.div
        key={match._id}
        className="match-card"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: index * 0.05 }}
        whileHover={{ y: -5 }}
      >
        <div className="match-card-header">
          <div className="match-teams">
            <span className="team-name">{match.teamA?.name || 'Team A'}</span>
            <span className="vs-text">vs</span>
            <span className="team-name">{match.teamB?.name || 'Team B'}</span>
          </div>
          <div className="match-date-time">
            <span className="match-date">{formatDate(match.createdAt)}</span>
            <span className="match-time">{formatTime(match.createdAt)}</span>
          </div>
        </div>

        <div className="match-card-body">
          <div className="match-status">
            <span className={`status-badge ${isCompleted ? 'completed' : 'in-progress'}`}>
              {isCompleted ? 'Completed' : 'In Progress'}
            </span>
            <p className="match-result">{match.result || `Status: ${match.status}`}</p>
          </div>

          <div className="match-actions">
            {isCompleted ? (
              <motion.button 
                onClick={viewFullScorecard}
                className="action-button view-button"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                View Scorecard
              </motion.button>
            ) : (
              <>
                <motion.button 
                  onClick={() => onResumeMatch(match)}
                  className="action-button continue-button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  Continue Match
                </motion.button>
                <motion.button 
                  onClick={viewFullScorecard}
                  className="action-button view-button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                >
                  View Progress
                </motion.button>
              </>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="past-matches-container">
      <motion.div 
        className="page-header"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <motion.button 
          onClick={() => navigate('/dashboard')}
          className="back-button"
          whileHover={{ x: -3 }}
          whileTap={{ scale: 0.98 }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </motion.button>
        <h1 className="page-title">Your Match History</h1>
      </motion.div>
      
      {isLoading && (
        <motion.div 
          className="loading-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <div className="loading-spinner"></div>
          <p>Loading your matches...</p>
        </motion.div>
      )}

      {error && (
        <motion.div 
          className="error-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <p>{error}</p>
        </motion.div>
      )}

      {!isLoading && !error && (
        matches.length > 0 ? (
          <motion.div 
            className="matches-list"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ staggerChildren: 0.1 }}
          >
            {matches.map((match, index) => renderMatchCard(match, index))}
          </motion.div>
        ) : (
          <motion.div 
            className="empty-state"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <h3>No Matches Yet</h3>
            <p>You haven't played any matches yet</p>
            <Link to="/match-setup" className="new-match-button">
              Start Your First Match
            </Link>
          </motion.div>
        )
      )}
    </div>
  );
};

export default PastMatches;