import React from 'react';
import { NavLink } from 'react-router-dom';
import styled from 'styled-components';

// --- SVG Icons for Navigation ---
const HomeIcon = ({ active }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>;
const PointsIcon = ({ active }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20V10"></path><path d="M18 20V4"></path><path d="M6 20V16"></path></svg>;
const PlusIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>;
const HistoryIcon = ({ active }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v5h5"></path><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path></svg>;
const ProfileIcon = ({ active }) => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>;


// --- Styled Components for the Nav Bar ---
const NavContainer = styled.nav`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 65px;
  background: white;
  display: flex;
  justify-content: space-around;
  align-items: center;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.08);
  border-top: 1px solid #f0f0f0;
  z-index: 1000;
  padding: 0 1rem;
`;

const NavItem = styled(NavLink)`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #888;
  font-size: 0.7rem;
  font-weight: 500;
  transition: color 0.2s ease-in-out;
  padding: 0.5rem;
  border-radius: 8px;
  gap: 2px;

  /* Style for the active NavLink */
  &.active {
    color: #4f46e5;
  }
`;

const PlusButton = styled(NavLink)`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  color: white;
  border-radius: 50%;
  margin-bottom: 25px; /* Lifts the button up */
  box-shadow: 0 4px 12px rgba(118, 75, 162, 0.4);
  transition: all 0.3s ease;

  &:hover {
    transform: scale(1.05);
  }
`;

const BottomNav = () => {
  return (
    <NavContainer>
      <NavItem to="/dashboard">
        {({ isActive }) => (
          <>
            <HomeIcon active={isActive} />
            <span>Home</span>
          </>
        )}
      </NavItem>
      <NavItem to="/points-system">
        {({ isActive }) => (
          <>
            <PointsIcon active={isActive} />
            <span>Points</span>
          </>
        )}
      </NavItem>
      <PlusButton to="/match-setup">
        <PlusIcon />
      </PlusButton>
      <NavItem to="/past-matches">
        {({ isActive }) => (
          <>
            <HistoryIcon active={isActive} />
            <span>History</span>
          </>
        )}
      </NavItem>
      <NavItem to="/profile">
        {({ isActive }) => (
          <>
            <ProfileIcon active={isActive} />
            <span>Profile</span>
          </>
        )}
      </NavItem>
    </NavContainer>
  );
};

export default BottomNav;
