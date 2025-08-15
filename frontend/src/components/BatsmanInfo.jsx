import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

// --- Icon Component ---
const EditIcon = () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
);

// --- Styled Components ---

const BatsmenContainer = styled(motion.div)`
  display: flex;
  gap: 0.5rem;
  padding: 1.5rem;
  padding: 1.5rem 0rem 0rem;
`;

const BatsmanCard = styled.div`
  flex: 1;
  background: ${props => props.isStriker ? '#fff' : '#f8fafc'};
  border-radius: 16px;
  padding: 1rem;
  border: 2px solid ${props => props.isStriker ? '#667eea' : '#e2e8f0'};
  box-shadow: ${props => props.isStriker ? '0 4px 12px rgba(102, 126, 234, 0.15)' : 'none'};
  position: relative;
  transition: all 0.3s ease;
`;

const StrikerLabel = styled(motion.div)`
  position: absolute;
  top: -12px;
  left: 50%;
  transform: translateX(-50%);
  background: #667eea;
  color: white;
  font-size: 0.7rem;
  font-weight: 700;
  padding: 0.2rem 0.6rem;
  border-radius: 999px;
`;

const EditableNameWrapper = styled.div`
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
    padding: 0.25rem;
`;

const BatsmanName = styled(motion.h4)`
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
`;

const NameInput = styled(motion.input)`
    width: 100%;
    text-align: center;
    font-size: 1.1rem;
    font-weight: 600;
    color: #4f46e5;
    border: none;
    border-bottom: 2px solid #667eea;
    background: transparent;
    &:focus {
        outline: none;
    }
`;

const EditButton = styled(motion.button)`
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 0;
  opacity: 0.7;
  &:hover { color: #4f46e5; }
`;

const StatsContainer = styled.div`
    text-align: center;
`;

const Runs = styled.span`
    font-size: 1.1rem;
    font-weight: 700;
    color: #1e293b;
`;

const Balls = styled.span`
    font-size: 0.9rem;
    font-weight: 500;
    color: #64748b;
    margin-left: 0.25rem;
`;

// --- Reusable Editable Batsman Component ---
const EditableBatsman = ({ batsman, onSave, label }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [tempName, setTempName] = useState(batsman.name);

    useEffect(() => {
        setTempName(batsman.name); // Sync name if prop changes
    }, [batsman.name]);

    const handleSave = () => {
        if (tempName.trim()) {
            onSave(batsman.id, tempName.trim());
        }
        setIsEditing(false);
    };

    return (
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
                    <EditableNameWrapper key="text">
                        <BatsmanName>{batsman.name || label}</BatsmanName>
                        <EditButton whileTap={{ scale: 0.8 }}><EditIcon /></EditButton>
                    </EditableNameWrapper>
                )}
            </AnimatePresence>
        </div>
    );
};

// --- Main Component ---
const BatsmanInfo = ({ striker, nonStriker, onNameChange }) => {
    return (
        <BatsmenContainer initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
            <BatsmanCard isStriker={true}>
                <AnimatePresence>
                    <StrikerLabel initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>STRIKER</StrikerLabel>
                </AnimatePresence>
                <EditableBatsman batsman={striker} onSave={onNameChange} label="Batsman 1" />
                <StatsContainer>
                    <Runs>{striker.runs || 0}</Runs>
                    <Balls>({striker.balls || 0})</Balls>
                </StatsContainer>
            </BatsmanCard>

            <BatsmanCard isStriker={false}>
                <EditableBatsman batsman={nonStriker} onSave={onNameChange} label="Batsman 2" />
                <StatsContainer>
                    <Runs>{nonStriker.runs || 0}</Runs>
                    <Balls>({nonStriker.balls || 0})</Balls>
                </StatsContainer>
            </BatsmanCard>
        </BatsmenContainer>
    );
};

export default BatsmanInfo;
