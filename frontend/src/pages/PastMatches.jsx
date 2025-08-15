import React, { useEffect, useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import matchService from '../utils/matchService';
import styled, { createGlobalStyle } from 'styled-components';

// --- Global Styles ---
const GlobalPastMatchesStyle = createGlobalStyle`
  body {
    background-color: #f8fafc;
  }
`;

// --- Modern Icon Components ---
const TrashIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>;
const AlertIcon = () => <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>;
const EmptyIcon = () => <svg width="50" height="50" viewBox="0 0 24 24" fill="none" stroke="#CBD5E0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>;
const TrophyIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;


// --- Styled Components ---

const PageContainer = styled(motion.div)`
  max-width: 1100px;
  margin: 0 auto;
  padding: 1.5rem 1rem 6rem;
  font-family: 'Inter', sans-serif;
`;

const PageHeader = styled(motion.div)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
`;

const PageTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: #1a202c;
`;

const DeleteAllButton = styled(motion.button)`
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  background: #FFF1F2;
  border: 1px solid #FECDD3;
  padding: 0.5rem 1rem;
  border-radius: 10px;
  cursor: pointer;
  font-weight: 600;
  font-size: 0.85rem;
  color: #E11D48;
`;

const MatchesGrid = styled(motion.div)`
  display: grid;
  grid-template-columns: 1fr;
  gap: 1rem;

  @media (min-width: 640px) {
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 1.5rem;
  }
`;

const MatchCard = styled(motion.div)`
  background: white;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
  display: flex;
  flex-direction: column;
`;

const CardHeader = styled.div`
  padding: 0.75rem 1rem;
  border-bottom: 1px solid #f1f5f9;
`;

const TeamNames = styled.h3`
  font-size: 1rem;
  font-weight: 600;
  color: #2d3748;
  margin: 0 0 0.25rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  span { color: #718096; font-weight: 500; }
`;

const MatchDate = styled.p`
  font-size: 0.75rem;
  color: #718096;
  margin: 0;
`;

const CardBody = styled.div`
  padding: 1rem;
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: 1rem;
`;

const StatusBadge = styled(motion.div)`
  display: inline-block;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 0.25rem 0.6rem;
  border-radius: 999px;
  background-color: ${props => props.completed ? '#E6FFFA' : '#EBF8FF'};
  color: ${props => props.completed ? '#2C7A7B' : '#2C5282'};
  margin-bottom: 0.75rem;
`;

const ResultContainer = styled.div`
  background: linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%);
  border: 1px solid #e2e8f0;
  padding: 0.75rem;
  border-radius: 12px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  color: #434190;
  
  p {
    font-size: 0.85rem;
    font-weight: 500;
    margin: 0;
    color: #3d3b8e;
    strong {
        font-weight: 700;
        color: #2c2a72;
    }
  }
`;

const InProgressText = styled.p`
    font-size: 0.85rem;
    color: #4a5568;
    font-style: italic;
`;


const CardFooter = styled.div`
  display: flex;
  align-items: center;
  gap: 0.5rem;
`;

const ActionButton = styled(motion.button)`
  flex-grow: 1;
  padding: 0.7rem;
  border-radius: 10px;
  font-weight: 600;
  font-size: 0.85rem;
  cursor: pointer;
  border: none;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
`;

const DeleteMatchButton = styled(motion.button)`
  padding: 0.7rem;
  border-radius: 10px;
  cursor: pointer;
  border: 1px solid #e2e8f0;
  background: #fff;
  color: #718096;
  display: flex;
  align-items: center;
  justify-content: center;
`;

// --- Modal styles ---
const ModalOverlay = styled(motion.div)`
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 2000;
`;
const ModalContent = styled(motion.div)`
  background: white; padding: 2rem; border-radius: 16px; width: 90%; max-width: 380px;
  text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
`;
const ModalIcon = styled.div`
  width: 50px; height: 50px; border-radius: 50%; background: #FEE2E2; color: #EF4444;
  display: inline-flex; align-items: center; justify-content: center; margin-bottom: 1rem;
`;
const ModalTitle = styled.h2`font-size: 1.25rem; color: #1a202c; margin-bottom: 0.5rem;`;
const ModalMessage = styled.p`color: #4a5568; margin-bottom: 1.5rem; font-size: 0.9rem;`;
const ModalActions = styled.div`display: flex; gap: 0.75rem; button { flex: 1; padding: 0.75rem; border-radius: 10px; font-weight: 600; font-size: 0.9rem; cursor: pointer; border: none; }`;
const ModalConfirmButton = styled.button`background: #EF4444; color: white;`;
const ModalCancelButton = styled.button`background: #F1F5F9; color: #475569;`;

const StateContainer = styled(motion.div)`
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    text-align: center; padding: 4rem 1rem; color: #4a5568;
    h3 { font-size: 1.25rem; margin: 1.5rem 0 0.5rem; color: #2d3748; }
`;

// --- Component ---

const PastMatches = ({ onResumeMatch }) => {
  const [matches, setMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [matchToDelete, setMatchToDelete] = useState(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  useEffect(() => {
    if (!user?.token) {
      setError("You must be logged in to view past matches.");
      setIsLoading(false);
      return;
    }
    const fetchMatches = async () => {
      try {
        setIsLoading(true);
        const userMatches = await matchService.getMyMatches(user.token);
        const sortedMatches = userMatches.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        setMatches(sortedMatches);
      } catch (err) {
        setError('Failed to fetch matches. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchMatches();
  }, [user]);

  const handleConfirmDelete = async () => {
    if (!matchToDelete || !user?.token) return;
    try {
      await matchService.deleteMatch(matchToDelete._id, user.token);
      setMatches(prev => prev.filter(m => m._id !== matchToDelete._id));
    } catch (err) {
      setError('Failed to delete match.');
    } finally {
      setMatchToDelete(null);
    }
  };

  const handleConfirmDeleteAll = async () => {
    if (!user?.token) return;
    try {
      // This assumes you have a service function to delete all matches
      // If not, you'll need to implement it in your matchService.js
      await matchService.deleteAllMatches(user.token);
      setMatches([]);
    } catch (err) {
      setError('Failed to delete all matches.');
    } finally {
      setShowDeleteAllConfirm(false);
    }
  };

  const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-GB', { month: 'short', day: 'numeric', year: 'numeric' });
  
  const parseResult = (result, teamA, teamB) => {
    if (!result) return { text: "Match has not concluded." };
    const teamAName = teamA?.name || 'Team A';
    const teamBName = teamB?.name || 'Team B';
    
    const parts = result.split(' won by ');
    if (parts.length < 2) return { text: result };

    const winner = parts[0];
    const margin = parts[1];

    if (winner === teamAName) {
        return { text: <><strong>{teamAName}</strong> won by {margin}</> };
    }
    if (winner === teamBName) {
        return { text: <><strong>{teamBName}</strong> won by {margin}</> };
    }
    return { text: result };
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.08 } }
  };
  
  const cardVariant = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  return (
    <>
      <GlobalPastMatchesStyle />
      <PageContainer>
        <PageHeader initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
          <PageTitle>Match History</PageTitle>
          {!isLoading && matches.length > 0 && (
            <DeleteAllButton whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => setShowDeleteAllConfirm(true)}>
              <TrashIcon />
              <span>Delete All</span>
            </DeleteAllButton>
          )}
        </PageHeader>

        {isLoading ? (
          <StateContainer><motion.div animate={{rotate: 360}} transition={{duration: 1, repeat: Infinity, ease: 'linear'}}><EmptyIcon/></motion.div><h3>Loading Matches...</h3></StateContainer>
        ) : error ? (
          <StateContainer><h3>{error}</h3></StateContainer>
        ) : !matches.length ? (
          <StateContainer initial={{opacity: 0}} animate={{opacity: 1}}>
            <EmptyIcon />
            <h3>No Matches Found</h3>
            <p>Your played matches will appear here.</p>
          </StateContainer>
        ) : (
          <MatchesGrid variants={containerVariants} initial="hidden" animate="visible">
            {matches.map(match => (
              <MatchCard key={match._id} variants={cardVariant} layout>
                <CardHeader>
                  <TeamNames>
                    {match.teamA?.name || 'Team A'}<span>vs</span>{match.teamB?.name || 'Team B'}
                  </TeamNames>
                  <MatchDate>{formatDate(match.updatedAt)}</MatchDate>
                </CardHeader>
                <CardBody>
                  <div>
                    <StatusBadge
                      completed={match.status === 'completed'}
                      animate={match.status !== 'completed' ? { opacity: [1, 0.6, 1] } : {}}
                      transition={match.status !== 'completed' ? { duration: 1.5, repeat: Infinity, ease: "easeInOut" } : {}}
                    >
                      {match.status === 'completed' ? 'Completed' : 'In Progress'}
                    </StatusBadge>
                    {match.status === 'completed' ? (
                        <ResultContainer>
                            <TrophyIcon />
                            <p>{parseResult(match.result, match.teamA, match.teamB).text}</p>
                        </ResultContainer>
                    ) : (
                        <InProgressText>Match has not concluded.</InProgressText>
                    )}
                  </div>
                  <CardFooter>
                    <ActionButton whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => match.status === 'completed' ? navigate(`/full-scorecard/${match._id}`) : onResumeMatch(match)}>
                      {match.status === 'completed' ? 'View Scorecard' : 'Continue Match'}
                    </ActionButton>
                    <DeleteMatchButton whileHover={{ scale: 1.1, backgroundColor: '#FEF2F2', color: '#EF4444' }} whileTap={{ scale: 0.9 }} onClick={() => setMatchToDelete(match)}>
                      <TrashIcon />
                    </DeleteMatchButton>
                  </CardFooter>
                </CardBody>
              </MatchCard>
            ))}
          </MatchesGrid>
        )}
      </PageContainer>

      {/* Single Match Delete Modal */}
      <AnimatePresence>
        {matchToDelete && (
          <ModalOverlay initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalContent initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{type: 'spring', stiffness: 300, damping: 25}}>
              <ModalIcon><AlertIcon /></ModalIcon>
              <ModalTitle>Delete Match?</ModalTitle>
              <ModalMessage>This action is permanent and cannot be undone.</ModalMessage>
              <ModalActions>
                <ModalCancelButton onClick={() => setMatchToDelete(null)}>Cancel</ModalCancelButton>
                <ModalConfirmButton onClick={handleConfirmDelete}>Delete</ModalConfirmButton>
              </ModalActions>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>

      {/* Delete All Matches Modal */}
      <AnimatePresence>
        {showDeleteAllConfirm && (
          <ModalOverlay initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalContent initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} transition={{type: 'spring', stiffness: 300, damping: 25}}>
              <ModalIcon><AlertIcon /></ModalIcon>
              <ModalTitle>Delete All Matches?</ModalTitle>
              <ModalMessage>Are you absolutely sure? This will permanently delete your **entire** match history.</ModalMessage>
              <ModalActions>
                <ModalCancelButton onClick={() => setShowDeleteAllConfirm(false)}>Cancel</ModalCancelButton>
                <ModalConfirmButton onClick={handleConfirmDeleteAll}>Yes, Delete All</ModalConfirmButton>
              </ModalActions>
            </ModalContent>
          </ModalOverlay>
        )}
      </AnimatePresence>
    </>
  );
};

export default PastMatches;
