import React, { useState, useEffect, useContext } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import matchService from '../utils/matchService';
import styled, { createGlobalStyle } from 'styled-components';

// --- Global Styles ---
const GlobalMatchSetupStyle = createGlobalStyle`
  body {
    background-color: #f0f4f8;
  }
`;

// --- Modern Icon Components ---
const OversIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>;
const PlayersIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>;
const BallsIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="2"/></svg>;

// --- Styled Components ---

const PageContainer = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  padding: 1.5rem;
`;

const SetupCard = styled(motion.div)`
  width: 100%;
  max-width: 450px;
  background: white;
  border-radius: 24px;
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1);
  overflow: hidden;
`;

const CardHeader = styled.div`
  padding: 1.5rem 2rem;
  text-align: center;
  border-bottom: 1px solid #f1f5f9;
  h2 {
    font-size: 1.65rem;
    font-weight: 700;
    color: #1e293b;
  }
`;

const CardBody = styled.form`
  padding: 2rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
`;

const TeamInputSection = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
`;

const TeamInputGroup = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  width: 48%;
`;

const TeamRoleLabel = styled.p`
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  margin: 0;
`;

const StyledInput = styled.input`
  width: 100%;
  border: 2px solid #e2e8f0;
  background: #f8fafc;
  padding: 0.75rem;
  border-radius: 12px;
  text-align: center;
  font-weight: 600;
  font-size: 1rem;
  color: #334155;
  transition: all 0.2s ease;
  &:focus {
    outline: none;
    border-color: #667eea;
    background: white;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.2);
  }
`;

const SettingRow = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #f8fafc;
  padding: 0.5rem 1rem; /* Reduced padding for a tighter look */
  border-radius: 12px;
`;

const SettingLabel = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-weight: 600;
  color: #334155;
  svg { color: #667eea; }
`;

const DropdownContainer = styled.div`
  position: relative;
  display: inline-block;

  /* Custom dropdown arrow */
  &::after {
    content: '▾';
    font-size: 1rem;
    color: #9ca3af;
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    pointer-events: none;
  }
`;

const StyledSelect = styled.select`
  -webkit-appearance: none;
  -moz-appearance: none;
  appearance: none;
  background: white;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  padding: 0.75rem 2.5rem 0.75rem 1rem;
  font-weight: 700;
  font-size: 1rem;
  color: #1e293b;
  cursor: pointer;
  transition: border-color 0.2s ease;

  &:focus {
    outline: none;
    border-color: #667eea;
  }
`;

const SubmitButton = styled(motion.button)`
  width: 100%;
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 16px;
  font-weight: 700;
  font-size: 1.1rem;
  color: white;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  &:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }
`;

const ErrorMessage = styled(motion.div)`
  color: #ef4444;
  background: #fee2e2;
  text-align: center;
  padding: 0.75rem;
  border-radius: 12px;
  font-weight: 500;
`;


// --- Main Component ---
const MatchSetup = ({ onStartMatch }) => {
  const [formData, setFormData] = useState({
    teamA: "Team A",
    teamB: "Team B",
    playersPerTeam: 11,
    overs: 4,
    ballsPerOver: 6,
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { user } = useContext(AuthContext);

  const handleValueChange = (name, value) => {
    setFormData(prev => ({
      ...prev,
      [name]: Number(value)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');

    const matchData = {
        teamA: { name: formData.teamA, shortName: formData.teamA.substring(0, 3).toUpperCase() },
        teamB: { name: formData.teamB, shortName: formData.teamB.substring(0, 3).toUpperCase() },
        venue: "Main Stadium",
        matchType: "T20",
        toss: { winner: formData.teamA, decision: "bat" },
        status: "scheduled",
        overs: formData.overs,
        ballsPerOver: formData.ballsPerOver,
        playersPerTeam: formData.playersPerTeam,
        firstBatting: formData.teamA,
    };

    if (user) {
      try {
        const token = user.token;
        if (!token) throw new Error("Authentication token is missing.");
        const savedMatch = await matchService.createMatch(matchData, token);
        if (!savedMatch || !savedMatch._id) throw new Error("Failed to get a valid match ID from the server.");
        onStartMatch(savedMatch);
      } catch (err) {
        setError(err.response?.data?.error || err.message || 'An unknown error occurred.');
      }
    } else {
      const guestMatchSettings = { ...matchData, _id: `guest_match_${Date.now()}`, isGuestMatch: true };
      onStartMatch(guestMatchSettings);
    }

    setIsSubmitting(false);
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 100 } }
  };

  return (
    <>
      <GlobalMatchSetupStyle />
      <PageContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <SetupCard variants={containerVariants} initial="hidden" animate="visible">
          <CardHeader>
            <motion.h2 variants={itemVariants}>New Match Setup</motion.h2>
          </CardHeader>
          <CardBody onSubmit={handleSubmit}>
            <motion.div variants={itemVariants}>
              <TeamInputSection>
                <TeamInputGroup>
                  <TeamRoleLabel>Batting Team</TeamRoleLabel>
                  <StyledInput
                    type="text"
                    value={formData.teamA}
                    onChange={(e) => setFormData({...formData, teamA: e.target.value})}
                    onFocus={(e) => e.target.select()}
                  />
                </TeamInputGroup>
                <div style={{color: '#9ca3af', fontWeight: '700', paddingTop: '1.75rem'}}>VS</div>
                <TeamInputGroup>
                  <TeamRoleLabel>Bowling Team</TeamRoleLabel>
                  <StyledInput
                    type="text"
                    value={formData.teamB}
                    onChange={(e) => setFormData({...formData, teamB: e.target.value})}
                    onFocus={(e) => e.target.select()}
                  />
                </TeamInputGroup>
              </TeamInputSection>
            </motion.div>
            
            <motion.div variants={itemVariants}>
              <SettingRow>
                <SettingLabel><PlayersIcon/> Players</SettingLabel>
                <DropdownContainer>
                  <StyledSelect value={formData.playersPerTeam} onChange={(e) => handleValueChange('playersPerTeam', e.target.value)}>
                    {[...Array(11).keys()].map(i => i + 1).map(num => (<option key={num} value={num}>{num}</option>))}
                  </StyledSelect>
                </DropdownContainer>
              </SettingRow>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SettingRow>
                <SettingLabel><OversIcon/> Overs</SettingLabel>
                <DropdownContainer>
                   <StyledSelect value={formData.overs} onChange={(e) => handleValueChange('overs', e.target.value)}>
                    {[1, 2, 3, 4, 5, 6, 10, 15, 20, 25, 30, 40, 50].map(num => (<option key={num} value={num}>{num}</option>))}
                  </StyledSelect>
                </DropdownContainer>
              </SettingRow>
            </motion.div>

            <motion.div variants={itemVariants}>
              <SettingRow>
                <SettingLabel><BallsIcon/> Balls / Over</SettingLabel>
                <DropdownContainer>
                  <StyledSelect value={formData.ballsPerOver} onChange={(e) => handleValueChange('ballsPerOver', e.target.value)}>
                    {[4, 5, 6, 7, 8].map(num => (<option key={num} value={num}>{num}</option>))}
                  </StyledSelect>
                </DropdownContainer>
              </SettingRow>
            </motion.div>

            <AnimatePresence>
              {error && (
                <ErrorMessage initial={{opacity: 0, height: 0}} animate={{opacity: 1, height: 'auto'}} exit={{opacity: 0, height: 0}}>
                  {error}
                </ErrorMessage>
              )}
            </AnimatePresence>

            <SubmitButton
              type="submit"
              disabled={isSubmitting}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              variants={itemVariants}
            >
              {isSubmitting ? 'Starting...' : 'Start Match'}
            </SubmitButton>
          </CardBody>
        </SetupCard>
      </PageContainer>
    </>
  );
};

export default MatchSetup;
