import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

// --- Icon Components ---
const EditIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>;
const ChangeIcon = () => <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 3h5v5"/><path d="M4 20L20 4"/><path d="M20 16v5h-5"/><path d="M15 15l5 5"/><path d="M4 4l5 5"/></svg>;
const HistoryIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>;
const CloseIcon = () => <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>;

// --- Styled Components ---

const Container = styled(motion.div)`
  padding: 1rem 1.5rem;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
`;

const BowlerSection = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1rem;
`;

const BowlerDetails = styled.div`
  display: flex;
  align-items: center;
  gap: 0.75rem;
  cursor: pointer;
`;

const BowlerName = styled.h4`
  font-size: 1.1rem;
  font-weight: 600;
  color: #1e293b;
  margin: 0;
`;

const NameInput = styled.input`
    width: 100%;
    font-size: 1.1rem;
    font-weight: 600;
    color: #4f46e5;
    border: none;
    border-bottom: 2px solid #667eea;
    background: transparent;
    &:focus { outline: none; }
`;

const BowlerStats = styled.p`
  font-size: 0.9rem;
  font-weight: 500;
  color: #64748b;
  margin: 0;
`;

const ChangeBowlerButton = styled(motion.button)`
  background: #eef2ff;
  color: #4f46e5;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
`;

const OverHistoryContainer = styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
`;

const BallsContainer = styled.div`
    display: flex;
    gap: 0.5rem;
    flex-grow: 1;
`;

const Ball = styled(motion.div)`
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    font-size: 0.8rem;
    color: white;
    background: ${props => props.color || '#94a3b8'};
`;

const ViewHistoryButton = styled(motion.button)`
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    color: #475569;
    font-size: 0.8rem;
    font-weight: 600;
    padding: 0.5rem 0.75rem;
    border-radius: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 0.5rem;
`;

// --- Modal Styles ---
const ModalOverlay = styled(motion.div)`
  position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(8px);
  display: flex; align-items: center; justify-content: center; z-index: 2000;
`;
const ModalContent = styled(motion.div)`
  background: white; padding: 1.5rem; border-radius: 16px; width: 90%; max-width: 500px;
  max-height: 80vh; display: flex; flex-direction: column;
`;
const ModalHeader = styled.div`
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;
    h3 { font-size: 1.25rem; color: #1e293b; margin: 0; }
`;
const ModalCloseButton = styled.button` background: none; border: none; cursor: pointer; color: #64748b;`;
const ModalBody = styled.div` overflow-y: auto; display: flex; flex-direction: column; gap: 1rem;`;
const OverHistoryRow = styled.div`
    padding-bottom: 1rem;
    border-bottom: 1px solid #f1f5f9;
    &:last-child { border-bottom: none; }
`;
const OverHeader = styled.div`
    display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;
    strong { font-size: 1rem; color: #334155; }
    span { font-size: 0.85rem; color: #64748b; }
`;

// --- BowlerInfo Component ---
const BowlerInfo = ({ bowler, overHistory, allOversHistory, onNameChange, onChangeBowler, onViewHistory }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(bowler.name);

    useEffect(() => { setTempName(bowler.name) }, [bowler.name]);

    const handleSave = () => {
        if (tempName.trim()) onNameChange(bowler.id, tempName.trim());
        setIsEditing(false);
    };

    const getBallColor = (ball) => {
        if (ball === 'W') return '#ef4444'; // Red for Wicket
        if (ball === '4' || ball === '6') return '#22c55e'; // Green for Boundary
        if (ball.includes('WD') || ball.includes('NB')) return '#f59e0b'; // Amber for Extras
        if (ball.includes('BYE') || ball.includes('LB')) return '#6366f1'; // Indigo for Byes
        return '#94a3b8'; // Slate for normal runs
    };

    return (
        <Container initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
            <BowlerSection>
                <div onClick={() => setIsEditing(true)}>
                    <AnimatePresence mode="wait">
                        {isEditing ? (
                            <NameInput
                                key="input"
                                value={tempName}
                                onChange={(e) => setTempName(e.target.value)}
                                onFocus={(e) => e.target.select()}
                                onBlur={handleSave}
                                onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                                autoFocus
                            />
                        ) : (
                            <BowlerDetails key="text">
                                <BowlerName>{bowler.name || 'Bowler'}</BowlerName>
                                <EditIcon />
                            </BowlerDetails>
                        )}
                    </AnimatePresence>
                    <BowlerStats>{bowler.runs}/{bowler.wickets} ({bowler.overs})</BowlerStats>
                </div>
                <ChangeBowlerButton whileTap={{ scale: 0.9 }} onClick={onChangeBowler}>
                    <ChangeIcon />
                </ChangeBowlerButton>
            </BowlerSection>
            <OverHistoryContainer>
                <BallsContainer>
                    {overHistory.slice(0, 6).map((ball, index) => (
                        <Ball key={index} color={getBallColor(ball)}
                            initial={{ scale: 0, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: index * 0.05 }}
                        >
                            {ball}
                        </Ball>
                    ))}
                </BallsContainer>
                <ViewHistoryButton whileTap={{ scale: 0.95 }} onClick={onViewHistory}>
                    <HistoryIcon /> History
                </ViewHistoryButton>
            </OverHistoryContainer>
        </Container>
    );
};

// --- History Modal Component ---
export const OverHistoryModal = ({ allOversHistory, onClose }) => {
    const getBallColor = (ball) => {
        if (ball === 'W') return '#ef4444';
        if (ball === '4' || ball === '6') return '#22c55e';
        if (ball.includes('WD') || ball.includes('NB')) return '#f59e0b';
        if (ball.includes('BYE') || ball.includes('LB')) return '#6366f1';
        return '#94a3b8';
    };

    return (
        <ModalOverlay initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <ModalContent initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
                <ModalHeader>
                    <h3>Full Over History</h3>
                    <ModalCloseButton onClick={onClose}><CloseIcon /></ModalCloseButton>
                </ModalHeader>
                <ModalBody>
                    {allOversHistory.length > 0 ? allOversHistory.map(over => (
                        <OverHistoryRow key={over.overNumber}>
                            <OverHeader>
                                <strong>Over {over.overNumber}</strong>
                                <span>{over.bowlerName}</span>
                                <span>{over.runs} Runs, {over.wickets} Wickets</span>
                            </OverHeader>
                            <BallsContainer>
                                {over.balls.map((ball, index) => (
                                    <Ball key={index} color={getBallColor(ball)}>{ball}</Ball>
                                ))}
                            </BallsContainer>
                        </OverHistoryRow>
                    )) : <p>No completed overs yet.</p>}
                </ModalBody>
            </ModalContent>
        </ModalOverlay>
    );
};


export default BowlerInfo;


