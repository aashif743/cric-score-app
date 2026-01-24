import React, { useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AuthContext } from '../context/AuthContext';
import {
    GlobalStyle,
    PageContainer,
    ProfileCard,
    Avatar,
    UserName,
    DetailsSection,
    DetailItem,
    DetailText,
    DetailLabel,
    DetailValue,
    LogoutButton
} from './ProfilePage.styles';

// --- SVG Icons ---
const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
);
const PhoneIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
);
const LogoutIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
);


const ProfilePage = () => {
  const { user, logout } = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth'); // Redirect to login page after logout
  };

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.15, delayChildren: 0.2 }
    }
  };

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: 'spring', stiffness: 100 } }
  };

  if (!user) {
    return (
      <PageContainer>
        <p>Please log in to view your profile.</p>
      </PageContainer>
    );
  }

  return (
    <>
        <GlobalStyle />
        <PageContainer variants={containerVariants} initial="hidden" animate="visible">
            <ProfileCard variants={itemVariants}>
                <Avatar>
                    <span>{user.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                </Avatar>
                <UserName>{user.name || 'User'}</UserName>
                <DetailsSection>
                    <DetailItem>
                        <UserIcon />
                        <DetailText>
                            <DetailLabel>Name</DetailLabel>
                            <DetailValue>{user.name || 'Not Provided'}</DetailValue>
                        </DetailText>
                    </DetailItem>
                    <DetailItem>
                        <PhoneIcon />
                        <DetailText>
                            <DetailLabel>Phone Number</DetailLabel>
                            <DetailValue>{user.phoneNumber || 'Not Provided'}</DetailValue>
                        </DetailText>
                    </DetailItem>
                </DetailsSection>
            </ProfileCard>

            <LogoutButton
                variants={itemVariants}
                onClick={handleLogout}
                whileHover={{ scale: 1.03, boxShadow: '0 10px 15px -3px rgba(239, 68, 68, 0.1), 0 4px 6px -2px rgba(239, 68, 68, 0.05)' }}
                whileTap={{ scale: 0.98 }}
            >
                <LogoutIcon />
                <span>Logout</span>
            </LogoutButton>
        </PageContainer>
    </>
  );
};

export default ProfilePage;
