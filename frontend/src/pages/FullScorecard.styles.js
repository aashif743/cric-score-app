import styled, { createGlobalStyle } from 'styled-components';
import { motion } from 'framer-motion';

export const GlobalStyle = createGlobalStyle`
  body {
    background-color: #f0f4f8; /* Light blue-gray background */
  }
`;

// --- Main Layout ---
export const PageContainer = styled(motion.div)`
  max-width: 900px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
`;

export const ScorecardCard = styled(motion.div)`
  background: white;
  border-radius: 24px;
  box-shadow: 0 10px 30px -10px rgba(0,0,0,0.1);
  overflow: hidden;
  border: 1px solid #e2e8f0;
`;

// --- Header ---
export const Header = styled.header`
  padding: 1.5rem 2rem;
  border-bottom: 1px solid #f1f5f9;
`;

export const HeaderTop = styled.div`
    display: flex;
    flex-direction: column;
    gap: 1.5rem;

    @media (min-width: 768px) {
        flex-direction: row;
        justify-content: space-between;
        align-items: flex-start;
    }
`;

export const HeaderTitle = styled.h1`
  font-size: 1.75rem;
  font-weight: 700;
  color: #1e293b;
  line-height: 1.2;
`;

export const HeaderActions = styled.div`
    display: flex;
    gap: 0.75rem;
    flex-shrink: 0;
`;

export const ActionButton = styled(motion.button)`
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.6rem 1.2rem;
    border-radius: 12px;
    font-weight: 600;
    font-size: 0.9rem;
    cursor: pointer;
    border: 1px solid #e2e8f0;
    background: ${props => props.primary ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : '#fff'};
    color: ${props => props.primary ? '#fff' : '#475569'};
`;

export const MatchResult = styled(motion.div)`
    margin-top: 1.5rem;
    padding: 1rem 1.5rem;
    background: linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%);
    border-radius: 16px;
    text-align: center;
    
    p {
        font-size: 1.25rem;
        font-weight: 700;
        color: #334155;
        margin: 0;
        strong {
            color: #4f46e5;
        }
    }
`;

// --- Innings Sections ---
export const ScoreSections = styled.main`
    padding: 2rem;
`;

export const InningsSection = styled(motion.section)`
    margin-bottom: 2.5rem;
    &:last-child {
        margin-bottom: 0;
    }
`;

export const InningsHeader = styled.div`
    padding-bottom: 0.75rem;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex-wrap: wrap;
    gap: 0.5rem;
`;

export const InningsTitle = styled.h2`
    font-size: 1.1rem;
    font-weight: 700;
    color: #4f46e5;
    text-transform: uppercase;
    letter-spacing: 1px;
`;

export const InningsScore = styled.p`
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    span {
        font-size: 1rem;
        font-weight: 500;
        color: #64748b;
    }
`;

export const TableContainer = styled.div`
    margin-bottom: 1.5rem;
    h3 {
        font-size: 1.1rem;
        font-weight: 600;
        color: #334155;
        margin-bottom: 1rem;
    }
`;

export const ScorecardTable = styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: 0.9rem;

    th, td {
        padding: 0.75rem;
        text-align: left;
        border-bottom: 1px solid #f1f5f9;
    }
    th {
        font-size: 0.75rem;
        font-weight: 600;
        color: #94a3b8;
        text-transform: uppercase;
    }
    td:not(:first-child) {
        text-align: right;
    }
    .player-name {
        font-weight: 600;
        color: #1e293b;
    }
    .batsman-status {
        font-size: 0.8rem;
        color: #64748b;
    }
`;

// --- Loading & Error States ---
export const StateContainer = styled(motion.div)`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: 4rem 1rem;
    min-height: 50vh;
    color: #4a5568;
    h2 {
        font-size: 1.5rem;
        margin-bottom: 1rem;
        color: #1e293b;
    }
`;
