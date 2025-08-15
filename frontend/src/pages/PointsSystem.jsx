import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

// --- New, Relevant SVG Icons for a White Theme ---



const ChartIcon = () => (
    <motion.svg whileHover={{ scale: 1.1, y: -5 }} transition={{ type: 'spring', stiffness: 300 }}
        width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="#4A5568" strokeWidth="1.5">
        <path d="M3 3v18h18" strokeLinecap="round" strokeLinejoin="round"/>
        <motion.path initial={{y: 12}} animate={{y: 0}} transition={{type:'spring', delay: 0.5}} d="M7 15V9" stroke="#667eea" strokeWidth="2.5" strokeLinecap="round"/>
        <motion.path initial={{y: 12}} animate={{y: 0}} transition={{type:'spring', delay: 0.7}} d="M12 15v-3" stroke="#3B82F6" strokeWidth="2.5" strokeLinecap="round"/>
        <motion.path initial={{y: 12}} animate={{y: 0}} transition={{type:'spring', delay: 0.9}} d="M17 15V6" stroke="#06B6D4" strokeWidth="2.5" strokeLinecap="round"/>
    </motion.svg>
);


// --- Styled Components for a White Theme ---

const PageContainer = styled(motion.div)`
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: calc(100vh - 80px); /* Adjust for nav bar */
  padding: 2rem;
  background: #f7fafc; /* Light gray background */
  overflow: hidden;
`;

const ContentBox = styled(motion.div)`
  position: relative;
  padding: 3rem 2.5rem;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(0, 0, 0, 0.05);
  border-radius: 24px;
  text-align: center;
  max-width: 500px;
  width: 100%;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.05);
`;

const IconRow = styled(motion.div)`
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-bottom: 2rem;
`;

const Title = styled(motion.h2)`
  font-size: 2.25rem;
  font-weight: 700;
  color: #2D3748; /* Dark text color */
  margin-bottom: 0.75rem;
  letter-spacing: -1px;
`;

const Subtitle = styled(motion.p)`
  font-size: 1.1rem;
  color: #4A5568; /* Medium-dark text color */
  line-height: 1.6;
  margin: 0;
`;

const CountryText = styled.span`
  font-weight: 700;
  background: linear-gradient(90deg, rgb(0, 105, 204), rgb(93, 185, 241));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

// --- Animation Variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.2, delayChildren: 0.3 }
  }
};

const itemVariants = {
  hidden: { y: 20, opacity: 0 },
  visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
};


const PointsSystem = () => {
  return (
    <PageContainer>
      <ContentBox
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      >
        <motion.div variants={containerVariants} initial="hidden" animate="visible">
          <IconRow variants={itemVariants}>
            <ChartIcon />
          </IconRow>

          <Title variants={itemVariants}>
            Coming Soon
          </Title>

          <Subtitle variants={itemVariants}>
            <CountryText>Sri Lanka</CountryText> softball outdoor & indoor points system is currently under development.
          </Subtitle>
        </motion.div>
      </ContentBox>
    </PageContainer>
  );
};

export default PointsSystem;
