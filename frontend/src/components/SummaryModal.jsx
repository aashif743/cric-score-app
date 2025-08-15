import React from 'react';
import styled from 'styled-components';
import { motion } from 'framer-motion';

// --- Icon Components ---
const TrophyIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
const TargetIcon = () => <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;

// --- Styled Components ---
const ModalOverlay = styled(motion.div)`
  position: fixed; inset: 0; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px);
  display: flex; align-items: center; justify-content: center; z-index: 2000; padding: 1rem;
`;
const ModalContent = styled(motion.div)`
  background: white; border-radius: 20px; width: 100%; max-width: 420px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); display: flex; flex-direction: column;
`;
const ModalHeader = styled.div`
  padding: 1.5rem; text-align: center; border-bottom: 1px solid #f1f5f9;
  h2 { font-size: 1.5rem; color: #1e293b; margin: 0.75rem 0 0; }
  div {
    width: 60px; height: 60px; border-radius: 50%; background: #eef2ff; color: #4f46e5;
    display: inline-flex; align-items: center; justify-content: center;
  }
`;
const ResultHighlight = styled.div`
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white; padding: 1rem; text-align: center; font-size: 1.1rem; font-weight: 600;
`;
const SummaryBody = styled.div`
  padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;
`;
const SummaryRow = styled.div`
  display: flex; justify-content: space-between; align-items: center;
  span:first-child { color: #64748b; font-weight: 500; }
  span:last-child { color: #1e293b; font-weight: 600; }
`;
const ModalFooter = styled.div`
  padding: 1rem 1.5rem; border-top: 1px solid #f1f5f9;
`;
const ContinueButton = styled(motion.button)`
  width: 100%; padding: 0.8rem; border-radius: 12px; font-weight: 700; font-size: 1rem;
  color: white; border: none; cursor: pointer;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
`;

// --- The Summary Modal Component ---
const SummaryModal = ({ title, result, summaryLines, onContinue }) => {
  return (
    <ModalOverlay initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <ModalContent initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}>
        <ModalHeader>
          <div>{result ? <TrophyIcon/> : <TargetIcon/>}</div>
          <h2>{title}</h2>
        </ModalHeader>
        {result && <ResultHighlight>{result}</ResultHighlight>}
        <SummaryBody>
          {summaryLines.map((line, index) => (
            <SummaryRow key={index}>
              <span>{line.label}</span>
              <span>{line.value}</span>
            </SummaryRow>
          ))}
        </SummaryBody>
        <ModalFooter>
          <ContinueButton whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onContinue}>
            Continue
          </ContinueButton>
        </ModalFooter>
      </ModalContent>
    </ModalOverlay>
  );
};

export default SummaryModal;
