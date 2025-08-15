import React from 'react';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../context/AuthContext.jsx';
import { motion } from 'framer-motion';
import styled from 'styled-components';
import myLogo from '../assets/criczone.png';

const DashboardContainer = styled(motion.div)`
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  min-height: 100vh;
  box-sizing: border-box;

  @media (max-width: 480px) {
    padding: 0.75rem 0.5rem;
    gap: 0.75rem;
  }
`;

const LogoContainer = styled(motion.div)`
  text-align: center;
  margin-bottom: 0.1rem;

  img {
    width: 100px;
    height: 100px;

    @media (max-width: 480px) {
      width: 100px;
    }
  }
`;

const WelcomeHeader = styled(motion.div)`
  text-align: center;
  margin-bottom: 0.3rem;

  h2 {
    font-size: 1.75rem;
    color: #2d3748;
    margin-bottom: 0.5rem;
    font-weight: 700;

    @media (max-width: 480px) {
      font-size: 1rem;
    }
  }

  p {
    font-size: 1rem;
    color: #4a5568;

    @media (max-width: 480px) {
      font-size: 0.7rem;
    }
  }
`;

const ActionGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 1rem;
  margin-top: 1rem;
  width: 100%;

  @media (max-width: 480px) {
    grid-template-columns: 1fr;
  }
`;

const ActionCard = styled(motion.div)`
  background: white;
  border-radius: 12px;
  padding: 1.1rem;
  box-shadow: 0 8px 12px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  transition: all 0.3s ease;
  border: 1px solid #e2e8f0;

  h3 {
    font-size: 1.3rem;
    color: #2d3748;
    margin-bottom: 0.75rem;

    @media (max-width: 480px) {
      font-size: 1rem;
    }
  }

  p {
    color: #718096;
    margin-bottom: 1.2rem;
    text-align: center;
    font-size: 0.95rem;

    @media (max-width: 480px) {
      font-size: 0.8rem;
    }
  }

  &.disabled {
    opacity: 0.7;
    cursor: not-allowed;
    background: #f7fafc;
  }
`;

const ActionButton = styled(motion.button)`
  padding: 10px 20px;
  font-size: 0.95rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  color: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  transition: all 0.3s ease;
  width: 100%;
  max-width: 180px;

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
  font-size: 0.75rem;
  margin-top: 1rem;
  font-weight: 500;
`;

function Dashboard() {
  const { user } = useContext(AuthContext);

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
      <LogoContainer variants={itemVariants}>
        <img src={myLogo} alt="CricZone Logo" />
      </LogoContainer>

      <WelcomeHeader
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
      >
        <h2>Your Digital Scorer</h2>
        <p>Effortlessly track every run, wicket, and over with professional precision. Let's get the game started, <strong>{user?.name || 'Player'}</strong>!</p>
      </WelcomeHeader>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        style={{ width: '100%' }}
      >
        <ActionGrid>
          <ActionCard variants={itemVariants} className="disabled">
            <h3>Tournament</h3>
            <p>Organize or join competitive cricket tournaments</p>
            <ActionButton disabled whileHover={{ scale: 1.05 }}>
              Coming Soon
            </ActionButton>
            <ComingSoonBadge>Feature in development</ComingSoonBadge>
          </ActionCard>

          <ActionCard variants={itemVariants} whileHover={{ y: -5 }}>
            <h3>Quick Match</h3>
            <p>Start a friendly match with customizable rules</p>
            <Link
              to="/match-setup"
              style={{
                textDecoration: 'none',
                width: '100%',
                display: 'flex',
                justifyContent: 'center'
              }}
            >
              <ActionButton whileHover={{ scale: 1.05 }}>
                Start Match
              </ActionButton>
            </Link>
          </ActionCard>
        </ActionGrid>
      </motion.div>
    </DashboardContainer>
  );
}

export default Dashboard;
