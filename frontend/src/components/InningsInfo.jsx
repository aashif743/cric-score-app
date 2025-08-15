import React, { useState } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

// --- Icon Component ---
// --- ✅ MODIFICATION 1: Made the icon slightly smaller (12px) ---
const EditIcon = () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// --- Styled Components ---

// --- ✅ MODIFICATION 2: Changed to a vertical, centered layout ---
const InfoContainer = styled(motion.div)`
  padding: 0.5rem 1.25rem;
  background-color: #dee1e4;
  display: flex;
  flex-direction: column; /* Stack items vertically */
  align-items: center;    /* Center items horizontally */
  gap: 0.25rem;           /* Adjust gap for vertical spacing */
`;

const InningsBadge = styled.div`
  background-color: #eef2ff;
  color: #4f46e5;
  padding: 0.3rem 0.8rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.5px;
  flex-shrink: 0;
`;

// --- ✅ MODIFICATION 3: Centered the team names container ---
const TeamsContainer = styled.div`
    display: flex;
    align-items: baseline;
    gap: 0.5rem; /* Increased gap for better spacing */
    justify-content: center; /* Center the team names */
    width: 100%; /* Ensure it takes full width to center its content */
    margin-top: 4px;
`;

const EditableTeamWrapper = styled.div`
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 6px;
    position: relative;
`;

const TeamName = styled(motion.span)`
    font-weight: 700;
    font-size: ${props => props.isBatting ? '1.1rem' : '0.9rem'}; /* Adjusted sizes */
    color: ${props => props.isBatting ? '#1e293b' : '#64748b'};
`;

const VsText = styled.span`
    font-size: 0.8rem;
    font-weight: 600;
    color:rgb(28, 30, 33);
`;

const NameInput = styled(motion.input)`
    border: none;
    background: transparent;
    font-size: inherit;
    font-weight: inherit;
    color: #4f46e5;
    padding: 0;
    margin: 0;
    width: 100%;
    border-bottom: 2px solid #667eea;
    &:focus {
        outline: none;
    }
`;

const EditButton = styled(motion.button)`
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0.1rem;
  display: flex;
  align-items: center;
  border-radius: 4px;
  opacity: 0.7;
  transition: opacity 0.2s ease;

  ${EditableTeamWrapper}:hover & {
      opacity: 1;
      color: #4f46e5;
  }
`;

// --- Reusable Editable Name Component ---
const EditableName = ({ name, isBatting, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(name);

    const handleSave = () => {
        if (tempName.trim()) {
            onSave(tempName.trim());
        }
        setIsEditing(false);
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleSave();
        if (e.key === 'Escape') setIsEditing(false);
    };

    return (
        <EditableTeamWrapper onClick={() => !isEditing && setIsEditing(true)}>
            <AnimatePresence mode="wait">
                {isEditing ? (
                    <NameInput
                        key="input"
                        value={tempName}
                        onChange={(e) => setTempName(e.target.value)}
                        onFocus={(e) => e.target.select()}
                        onBlur={handleSave}
                        onKeyDown={handleKeyDown}
                        autoFocus
                        isBatting={isBatting}
                        style={{ fontSize: isBatting ? '1.1rem' : '0.9rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />
                ) : (
                    <motion.div
                        key="text"
                        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    >
                        <TeamName isBatting={isBatting}>{name}</TeamName>
                        <EditButton whileTap={{ scale: 0.8 }}><EditIcon /></EditButton>
                    </motion.div>
                )}
            </AnimatePresence>
        </EditableTeamWrapper>
    );
};


// --- Main Component ---
const InningsInfo = ({ innings, battingTeam, bowlingTeam, onTeamNameChange }) => {
    return (
        <InfoContainer initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
            <InningsBadge>{innings === 1 ? '1ST INNINGS' : '2ND INNINGS'}</InningsBadge>
            <TeamsContainer>
                <EditableName name={battingTeam} isBatting={true} onSave={(newName) => onTeamNameChange('batting', newName)} />
                <VsText>vs</VsText>
                <EditableName name={bowlingTeam} isBatting={false} onSave={(newName) => onTeamNameChange('bowling', newName)} />
            </TeamsContainer>
        </InfoContainer>
    );
};

export default InningsInfo;