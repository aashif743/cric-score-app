import React, { useState, useEffect, useContext } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Import the authentication context to check if a user is logged in
import { AuthContext } from '../context/AuthContext.jsx'; 
// Import the match service for logged-in users
import matchService from '../utils/matchService';

const MatchSetup = ({ onStartMatch }) => {
  const [formData, setFormData] = useState({
    teamA: "Team A",
    teamB: "Team B",
    firstBatting: "Team A",
    firstBowling: "Team B",
    playersPerTeam: 11,
    overs: 6,
    ballsPerOver: 6,
  });

  const [editingTeam, setEditingTeam] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Get the user from context. This will be the user object if logged in, or null for guests.
  const { user } = useContext(AuthContext);

  useEffect(() => {
    setFormData(prev => ({
      ...prev,
      firstBowling: prev.firstBatting === prev.teamA ? prev.teamB : prev.teamA
    }));
  }, [formData.firstBatting, formData.teamA, formData.teamB]);

  const handleTeamNameChange = (teamKey, value) => {
    setFormData(prev => {
      const oldTeamName = prev[teamKey];
      return {
        ...prev,
        [teamKey]: value,
        firstBatting: prev.firstBatting === oldTeamName ? value : prev.firstBatting,
      };
    });
  };

  const handleNumberChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    if (user) {
      // --- LOGGED-IN USER FLOW ---
      try {
        // --- THIS IS THE FIX ---
        // Get the token directly from our custom user object's 'token' property.
        const token = user.token; 

        if (!token) {
          throw new Error("Authentication token is missing. Please log in again.");
        }

        const matchDataToCreate = {
          teamA: { name: formData.teamA, shortName: formData.teamA.substring(0, 3).toUpperCase() },
          teamB: { name: formData.teamB, shortName: formData.teamB.substring(0, 3).toUpperCase() },
          venue: "Main Stadium",
          matchType: "T20",
          toss: { winner: formData.firstBatting, decision: "bat" },
          status: "scheduled",
          overs: formData.overs,
          ballsPerOver: formData.ballsPerOver,
          playersPerTeam: formData.playersPerTeam,
          firstBatting: formData.firstBatting
        };
        
        const savedMatch = await matchService.createMatch(matchDataToCreate, token);
        
        if (!savedMatch || !savedMatch._id) {
          throw new Error("Failed to get a valid match ID from the server.");
        }
        
        onStartMatch(savedMatch);

      } catch (err) {
        const errorMessage = err.response?.data?.error || err.message || 'An unknown error occurred.';
        setError(errorMessage);
        alert(`Failed to create match: ${errorMessage}`);
      }

    } else {
      // --- GUEST USER FLOW ---
      console.log("Starting a quick match for a guest.");
      const guestMatchSettings = {
        teamA: { name: formData.teamA, shortName: formData.teamA.substring(0, 3).toUpperCase() },
        teamB: { name: formData.teamB, shortName: formData.teamB.substring(0, 3).toUpperCase() },
        venue: "Main Stadium",
        matchType: "T20",
        toss: { winner: formData.firstBatting, decision: "bat" },
        status: "scheduled",
        overs: formData.overs,
        ballsPerOver: formData.ballsPerOver,
        playersPerTeam: formData.playersPerTeam,
        firstBatting: formData.firstBatting,
        _id: `guest_match_${Date.now()}`,
        isGuestMatch: true
      };
      onStartMatch(guestMatchSettings);
    }

    setIsSubmitting(false);
  };

  const startEditing = (teamKey) => setEditingTeam(teamKey);
  const stopEditing = () => setEditingTeam(null);

  // The rest of your UI remains the same.
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-gray-100 flex items-center justify-center p-4"
    >
      <motion.div
        initial={{ y: -20, scale: 0.98 }}
        animate={{ y: 0, scale: 1 }}
        className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden"
      >
        <div className="p-6">
          <motion.h2
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-bold text-center text-gray-800 mb-6"
          >
            NEW MATCH
          </motion.h2>
          
          {error && <div className="text-red-500 text-center mb-4 p-2 bg-red-100 rounded">{error}</div>}

          <div className="flex justify-between mb-10">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="text-center">
              <div className="text-sm font-medium text-gray-500 mb-2">Batting</div>
              <AnimatePresence mode="wait">
                {editingTeam === 'teamA' ? (
                  <motion.input key="teamA-input" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} type="text" value={formData.teamA} onChange={(e) => handleTeamNameChange('teamA', e.target.value)} onBlur={stopEditing} autoFocus className="text-xl font-bold text-center border-b-2 border-blue-500 outline-none w-32" />
                ) : (
                  <motion.div key="teamA-text" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onClick={() => startEditing('teamA')} className="text-xl font-bold cursor-pointer py-1 px-2 hover:bg-gray-100 rounded mx-auto w-32">
                    {formData.teamA}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
            <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }} className="text-center">
              <div className="text-sm font-medium text-gray-500 mb-2">Bowling</div>
              <AnimatePresence mode="wait">
                {editingTeam === 'teamB' ? (
                  <motion.input key="teamB-input" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} type="text" value={formData.teamB} onChange={(e) => handleTeamNameChange('teamB', e.target.value)} onBlur={stopEditing} autoFocus className="text-xl font-bold text-center border-b-2 border-blue-500 outline-none w-32" />
                ) : (
                  <motion.div key="teamB-text" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} onClick={() => startEditing('teamB')} className="text-xl font-bold cursor-pointer py-1 px-2 hover:bg-gray-100 rounded mx-auto w-32">
                    {formData.teamB}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          <div className="space-y-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Players Per Team</label>
              <motion.select whileTap={{ scale: 0.95 }} value={formData.playersPerTeam} onChange={(e) => handleNumberChange('playersPerTeam', e.target.value)} className="ml-4 p-2 border border-gray-300 rounded-md w-20">
                {[6, 7, 8, 9, 10, 11].map(num => (<option key={num} value={num}>{num}</option>))}
              </motion.select>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Overs</label>
              <motion.select whileTap={{ scale: 0.95 }} value={formData.overs} onChange={(e) => handleNumberChange('overs', e.target.value)} className="ml-4 p-2 border border-gray-300 rounded-md w-20">
                {[1, 2, 3, 4, 5, 6, 10, 15, 20, 25, 30, 40, 50].map(num => (<option key={num} value={num}>{num}</option>))}
              </motion.select>
            </motion.div>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex items-center justify-between">
              <label className="text-sm font-medium text-gray-700">Balls Per Over</label>
              <motion.select whileTap={{ scale: 0.95 }} value={formData.ballsPerOver} onChange={(e) => handleNumberChange('ballsPerOver', e.target.value)} className="ml-4 p-2 border border-gray-300 rounded-md w-20">
                {[4, 5, 6, 7, 8].map(num => (<option key={num} value={num}>{num}</option>))}
              </motion.select>
            </motion.div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={isSubmitting}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className={`w-full mt-8 py-3 rounded-lg font-medium text-white transition-colors ${isSubmitting ? 'bg-blue-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <motion.span animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }} className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2" />
                Starting...
              </span>
            ) : ( "Start Match" )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MatchSetup;
