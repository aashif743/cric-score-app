import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';
import myLogo from '../assets/criczone2.png';

// --- Icon Components ---
const BackIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5"/>
    <path d="M12 19l-7-7 7-7"/>
  </svg>
);

// --- Styled Components ---

const HeaderContainer = styled(motion.header)`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.6rem 0.8rem;
  background: #dee1e4;
  position: sticky;
  top: 0;
  z-index: 10;
`;

const BackButton = styled(motion.button)`
  background: #f1f5f9;
  border: none;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  color: #475569;
`;

// --- ✅ MODIFICATION 1: Removed absolute positioning ---
// The LogoContainer no longer needs special positioning.
// It will now flow correctly as a flex item.
const LogoContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const LogoImage = styled.img`
    width: 52px;
    height: 52px;
`;

const DomainName = styled(motion.div)`
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 0.5rem 1rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #475569;
  letter-spacing: 0.5px;
`;

// --- The Header Component ---

const ScorecardHeader = ({ onBack }) => {
  return (
    <HeaderContainer
      initial={{ y: -60, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 100, damping: 20 }}
    >
      <BackButton
        onClick={onBack}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.9 }}
      >
        <BackIcon />
      </BackButton>

      {/* --- ✅ MODIFICATION 2: Changed the order of elements --- */}
      {/* The DomainName is now the second item, so it will be in the middle */}
      <DomainName whileHover={{ scale: 1.05 }}>
        cric-zone.com
      </DomainName>

      {/* The LogoContainer is the last item, so it will be on the right */}
      <LogoContainer>
       <LogoImage src={myLogo} alt="CricZone Logo" />
      </LogoContainer>

    </HeaderContainer>
  );
};

export default ScorecardHeader;