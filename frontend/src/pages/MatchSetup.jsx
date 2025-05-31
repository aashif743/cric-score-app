import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import API from '../api';

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

  useEffect(() => {
    // Update bowling team when batting team changes
    setFormData(prev => ({
      ...prev,
      firstBowling: prev.firstBatting === prev.teamA ? prev.teamB : prev.teamA
    }));
  }, [formData.firstBatting, formData.teamA, formData.teamB]);

  const handleTeamNameChange = (teamKey, value) => {
    setFormData(prev => ({
      ...prev,
      [teamKey]: value,
      // Update firstBatting/firstBowling if team names change
      firstBatting: prev.firstBatting === prev[teamKey] ? value : prev.firstBatting,
      firstBowling: prev.firstBowling === prev[teamKey] ? value : prev.firstBowling
    }));
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

    try {
      // Prepare match data with all required fields
      const matchData = {
        teamA: {
          name: formData.teamA,
          shortName: formData.teamA.substring(0, 3).toUpperCase()
        },
        teamB: {
          name: formData.teamB,
          shortName: formData.teamB.substring(0, 3).toUpperCase()
        },
        venue: "Main Stadium", // Default value or make this an input field
        matchType: "T20", // Or add as a select field
        toss: {
          winner: formData.firstBatting,
          decision: "bat" // Default or make selectable
        },
        matchSummary: {
          playerOfMatch: "TBD", // Will update later
          winner: "TBD" // Will update when match ends
        },
        status: "scheduled",
        overs: formData.overs,
        ballsPerOver: formData.ballsPerOver,
        playersPerTeam: formData.playersPerTeam,
        firstBatting: formData.firstBatting
      };

      const response = await API.post('/matches', matchData);
      const createdMatch = response.data;
      
      onStartMatch({ 
        ...formData,
       _id: response.data._id
      });

    } catch (error) {
      console.error("Error creating match:", error);
      alert(`Failed to create match: ${error.error || error.message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const startEditing = (teamKey) => {
    setEditingTeam(teamKey);
  };

  const stopEditing = () => {
    setEditingTeam(null);
  };

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
            className="text-2xl font-bold text-center text-gray-800 mb-8"
          >
            NEW MATCH
          </motion.h2>

          {/* Teams Section */}
          <div className="flex justify-between mb-10">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="text-sm font-medium text-gray-500 mb-2">Batting</div>
              <AnimatePresence mode="wait">
                {editingTeam === 'teamA' ? (
                  <motion.input
                    key="teamA-input"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    type="text"
                    value={formData.teamA}
                    onChange={(e) => handleTeamNameChange('teamA', e.target.value)}
                    onBlur={() => setEditingTeam(null)}
                    autoFocus
                    className="text-xl font-bold text-center border-b-2 border-blue-500 outline-none w-32"
                  />
                ) : (
                  <motion.div
                    key="teamA-text"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => setEditingTeam('teamA')}
                    className="text-xl font-bold cursor-pointer py-1 px-2 hover:bg-gray-100 rounded mx-auto w-32"
                  >
                    {formData.teamA}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-center"
            >
              <div className="text-sm font-medium text-gray-500 mb-2">Bowling</div>
              <AnimatePresence mode="wait">
                {editingTeam === 'teamB' ? (
                  <motion.input
                    key="teamB-input"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    type="text"
                    value={formData.teamB}
                    onChange={(e) => handleTeamNameChange('teamB', e.target.value)}
                    onBlur={() => setEditingTeam(null)}
                    autoFocus
                    className="text-xl font-bold text-center border-b-2 border-blue-500 outline-none w-32"
                  />
                ) : (
                  <motion.div
                    key="teamB-text"
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    onClick={() => setEditingTeam('teamB')}
                    className="text-xl font-bold cursor-pointer py-1 px-2 hover:bg-gray-100 rounded mx-auto w-32"
                  >
                    {formData.teamB}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </div>

          {/* Match Parameters */}
          <div className="space-y-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="flex items-center justify-between"
            >
              <label className="text-sm font-medium text-gray-700">No of Players Per Team</label>
              <motion.select
                whileTap={{ scale: 0.95 }}
                value={formData.playersPerTeam}
                onChange={(e) => handleNumberChange('playersPerTeam', e.target.value)}
                className="ml-4 p-2 border border-gray-300 rounded-md w-20"
              >
                {[6, 7, 8, 9, 10, 11].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </motion.select>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="flex items-center justify-between"
            >
              <label className="text-sm font-medium text-gray-700">Overs</label>
              <motion.select
                whileTap={{ scale: 0.95 }}
                value={formData.overs}
                onChange={(e) => handleNumberChange('overs', e.target.value)}
                className="ml-4 p-2 border border-gray-300 rounded-md w-20"
              >
                {[1, 2, 3, 4, 5, 6, 10, 15, 20, 25, 30, 40, 50].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
              </motion.select>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="flex items-center justify-between"
            >
              <label className="text-sm font-medium text-gray-700">No of Balls Per Over</label>
              <motion.select
                whileTap={{ scale: 0.95 }}
                value={formData.ballsPerOver}
                onChange={(e) => handleNumberChange('ballsPerOver', e.target.value)}
                className="ml-4 p-2 border border-gray-300 rounded-md w-20"
              >
                {[4, 5, 6, 7, 8].map(num => (
                  <option key={num} value={num}>{num}</option>
                ))}
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
            className={`w-full mt-8 py-3 rounded-lg font-medium text-white ${
              isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                  className="inline-block h-5 w-5 border-2 border-white border-t-transparent rounded-full mr-2"
                />
                Starting...
              </span>
            ) : (
              "Start Match"
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default MatchSetup;