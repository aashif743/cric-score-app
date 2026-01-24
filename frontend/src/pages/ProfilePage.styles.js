import styled, { createGlobalStyle } from 'styled-components';
import { motion } from 'framer-motion';

export const GlobalStyle = createGlobalStyle`
  body {
    background-color: #f0f4f8;
  }
`;

export const PageContainer = styled(motion.div)`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem 1.5rem;
  min-height: 100vh;
`;

export const ProfileCard = styled(motion.div)`
  width: 100%;
  max-width: 400px;
  background: white;
  border-radius: 24px;
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1);
  border: 1px solid #e2e8f0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 2rem;
  margin-bottom: 1.5rem;
`;

export const Avatar = styled.div`
  width: 90px;
  height: 90px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  font-weight: 600;
  margin-bottom: 1rem;
  box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
`;

export const UserName = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 1.5rem;
  text-align: center;
`;

export const DetailsSection = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

export const DetailItem = styled.div`
  display: flex;
  align-items: center;
  gap: 1rem;
  background: #f8fafc;
  padding: 1rem;
  border-radius: 12px;

  svg {
    color: #4f46e5;
    flex-shrink: 0;
  }
`;

export const DetailText = styled.div`
  display: flex;
  flex-direction: column;
`;

export const DetailLabel = styled.span`
  font-size: 0.8rem;
  color: #64748b;
  margin-bottom: 0.2rem;
`;

export const DetailValue = styled.span`
  font-size: 1rem;
  font-weight: 600;
  color: #334155;
`;

export const LogoutButton = styled(motion.button)`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  width: 100%;
  max-width: 400px;
  padding: 1rem;
  border: none;
  border-radius: 16px;
  background: #fff;
  color: #ef4444;
  font-size: 1rem;
  font-weight: 700;
  cursor: pointer;
  box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.03), 0 2px 4px -1px rgba(0, 0, 0, 0.02);
  border: 1px solid #e2e8f0;
`;
