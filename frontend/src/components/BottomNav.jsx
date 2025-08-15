import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import styled from 'styled-components';
import { motion, AnimatePresence } from 'framer-motion';

// --- Modern, Animated SVG Icons (Corrected) ---

const HomeIcon = ({ active }) => {
  const inactiveColor = "#64748b"; // Slate-500
  const activeColor = "#4f46e5";   // Indigo-600
  const whiteHex = "#FFFFFF";       // Hex code for white

  return (
    <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <motion.path
        d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        animate={{
          fill: active ? activeColor : "none",
          stroke: active ? activeColor : inactiveColor
        }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      />
      <motion.polyline
        points="9 22 9 12 15 12 15 22"
        // --- FIX IS HERE ---
        // Replaced 'white' keyword with its hex code '#FFFFFF'
        animate={{ stroke: active ? whiteHex : inactiveColor }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      />
    </motion.svg>
  );
};


const PointsIcon = ({ active }) => (
  <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <motion.path d="M12 20V10" animate={{ y: active ? -2 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 10 }} />
    <motion.path d="M18 20V4" animate={{ y: active ? 2 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 10, delay: 0.05 }}/>
    <motion.path d="M6 20V16" animate={{ y: active ? -2 : 0 }} transition={{ type: 'spring', stiffness: 400, damping: 10, delay: 0.1 }}/>
  </motion.svg>
);

const PlusIcon = () => (
    <motion.svg whileTap={{ scale: 0.9, rotate: 90 }} transition={{ type: 'spring', stiffness: 300 }}
      xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19"></line>
      <line x1="5" y1="12" x2="19" y2="12"></line>
    </motion.svg>
);

const HistoryIcon = ({ active }) => (
  <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <motion.path d="M3 3v5h5" />
    <motion.path
      d="M3.05 13A9 9 0 1 0 6 5.3L3 8"
      animate={{ rotate: active ? 360 : 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
    />
  </motion.svg>
);

const ProfileIcon = ({ active }) => (
  <motion.svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <motion.path
      d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"
      animate={{ fill: active ? "rgba(79, 70, 229, 0.1)" : "none" }}
    />
    <motion.circle
      cx="12" cy="7" r="4"
      animate={{ fill: active ? "rgba(79, 70, 229, 0.2)" : "none" }}
      transition={{ delay: 0.1 }}
    />
  </motion.svg>
);


// --- Styled Components for the Nav Bar ---

const NavContainer = styled(motion.nav)`
  position: fixed;
  bottom: 1rem;
  left: 0;
  right: 0;
  width: 95%;
  max-width: 400px;
  margin: 0 auto;
  height: 65px;
  background: rgba(255, 255, 255, 0.7);
  backdrop-filter: blur(15px) saturate(180%);
  -webkit-backdrop-filter: blur(15px) saturate(180%);
  border: 1px solid rgba(226, 232, 240, 0.5);
  display: flex;
  justify-content: space-around;
  align-items: center;
  border-radius: 999px;
  box-shadow: 0 10px 30px -10px rgba(100, 116, 139, 0.2);
  z-index: 1000;
`;

const NavItem = styled(motion(NavLink))`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-decoration: none;
  color: #64748b; /* Slate-500 */
  font-size: 0.75rem;
  font-weight: 500;
  transition: color 0.3s ease;
  position: relative;
  width: 50px;
  height: 50px;
  border-radius: 50%;
  
  span {
    position: absolute;
    bottom: -10px;
    opacity: 0;
    transition: all 0.3s ease;
    font-weight: 600;
  }
  
  /* Style for the active NavLink */
  &.active {
    color: #4f46e5; /* Indigo-600 */
    
    span {
      opacity: 1;
      bottom: 2px;
    }
    
    svg {
      transform: translateY(-8px);
    }
  }

  svg {
    transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  }
`;

const PlusButton = styled(motion(NavLink))`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 60px;
  height: 60px;
  background: linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%);
  color: white;
  border-radius: 50%;
  box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
`;


// --- Navigation Data ---
const navItems = [
  { path: "/dashboard", Icon: HomeIcon, label: "Home" },
  { path: "/points-system", Icon: PointsIcon, label: "Points" },
  { path: "/past-matches", Icon: HistoryIcon, label: "History" },
  { path: "/profile", Icon: ProfileIcon, label: "Profile" },
];

const BottomNav = () => {
  const location = useLocation();

  return (
    <AnimatePresence>
      <NavContainer
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 100, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 100, damping: 20, mass: 0.8 }}
      >
        {navItems.slice(0, 2).map(({ path, Icon, label }) => (
          <NavItem key={path} to={path} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Icon active={location.pathname === path} />
            <span>{label}</span>
          </NavItem>
        ))}

        <PlusButton to="/match-setup" whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
          <PlusIcon />
        </PlusButton>
        
        {navItems.slice(2, 4).map(({ path, Icon, label }) => (
          <NavItem key={path} to={path} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
            <Icon active={location.pathname === path} />
            <span>{label}</span>
          </NavItem>
        ))}
      </NavContainer>
    </AnimatePresence>
  );
};

export default BottomNav;
