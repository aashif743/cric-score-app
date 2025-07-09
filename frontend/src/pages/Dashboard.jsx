import React from 'react';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';
import styled from 'styled-components';

// Styled components for better organization
const DashboardContainer = styled.div`
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem;
  min-height: 100vh;
`;

const WelcomeHeader = styled(motion.div)`
  text-align: center;
  margin-bottom: 3rem;
  h2 {
    font-size: 2.5rem;
    color: #2d3748;
    margin-bottom: 0.5rem;
    font-weight: 700;
  }
  p {
    font-size: 1.2rem;
    color: #4a5568;
  }
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-top: 2rem;

  @media (max-width: 768px) {
    grid-template-columns: 1fr;
  }
`;

const ActionCard = styled(motion.div)`
  background: white;
  border-radius: 16px;
  padding: 2rem;
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 200px;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;

  h3 {
    font-size: 1.5rem;
    color: #2d3748;
    margin-bottom: 1rem;
  }

  p {
    color: #718096;
    margin-bottom: 1.5rem;
    text-align: center;
  }

  &.disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: #f7fafc;
  }
`;

const ActionButton = styled(motion.button)`
  padding: 12px 24px;
  font-size: 1rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  width: 100%;
  max-width: 200px;

  &:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 12px rgba(0, 0, 0, 0.15);
  }

  &:disabled {
    background: #e2e8f0;
    color: #a0aec0;
    cursor: not-allowed;
    transform: none;
    box-shadow: none;
  }
`;

const ComingSoonBadge = styled.span`
  background: #edf2f7;
  color: #4a5568;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 0.8rem;
  margin-top: 1rem;
  font-weight: 500;
`;

function Dashboard() {
  const { user } = useContext(AuthContext);

  // Animation variants
  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
        delayChildren: 0.2
      }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: {
      y: 0,
      opacity: 1,
      transition: {
        duration: 0.5,
        ease: [0.22, 1, 0.36, 1]
      }
    }
  };

  return (
    <DashboardContainer>
      <WelcomeHeader
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2>Welcome to CricZone</h2>
        <p>Hello, <strong>{user?.name || 'Player'}</strong>! What would you like to do today?</p>
      </WelcomeHeader>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <ActionGrid>
          {/* Tournament Card */}
          <ActionCard
            variants={itemVariants}
            className="disabled"
          >
            <h3>Tournament</h3>
            <p>Organize or join competitive cricket tournaments</p>
            <ActionButton disabled whileHover={{ scale: 1.05 }}>
              Coming Soon
            </ActionButton>
            <ComingSoonBadge>Feature in development</ComingSoonBadge>
          </ActionCard>

          {/* Quick Match Card */}
          <ActionCard
            variants={itemVariants}
            whileHover={{ y: -5 }}
          >
            <h3>Quick Match</h3>
            <p>Start a friendly match with customizable rules</p>
            <Link to="/match-setup" style={{ textDecoration: 'none', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <ActionButton whileHover={{ scale: 1.05 }}>
                Start Match
              </ActionButton>
            </Link>
          </ActionCard>

          {/* Past Matches Card */}
          <ActionCard
            variants={itemVariants}
            whileHover={{ y: -5 }}
          >
            <h3>Past Matches</h3>
            <p>Review your match history and statistics</p>
            <Link to="/past-matches" style={{ textDecoration: 'none', width: '100%', display: 'flex', justifyContent: 'center' }}>
              <ActionButton whileHover={{ scale: 1.05 }}>
                View History
              </ActionButton>
            </Link>
          </ActionCard>
        </ActionGrid>
      </motion.div>
    </DashboardContainer>
  );
}

export default Dashboard;