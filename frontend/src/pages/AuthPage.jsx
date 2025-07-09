import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import authService from '../utils/authService.js';
import './AuthPage.css';

// Sample countries data - you might want to import this from a separate file
const countries = [
  { code: 'LK', dialCode: '+94', name: 'Sri Lanka', flag: '🇱🇰' },
  { code: 'IN', dialCode: '+91', name: 'India', flag: '🇮🇳' },
  { code: 'US', dialCode: '+1', name: 'United States', flag: '🇺🇸' },
  // Add more countries as needed
];

const AuthPage = () => {
  const [step, setStep] = useState('phone'); // phone, otp, name
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [showCountryDropdown, setShowCountryDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCountry, setSelectedCountry] = useState({
    code: 'LK',
    dialCode: '+94',
    name: 'Sri Lanka',
    flag: '🇱🇰'
  });

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const filteredCountries = countries.filter(country =>
    country.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    country.dialCode.includes(searchQuery)
  );

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      await authService.sendOtp(phoneNumber);
      setStep('otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send OTP. Please check the number.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const response = await authService.verifyOtp(phoneNumber, otp);
      if (response.isNewUser) {
        setStep('name');
      } else {
        login(response);
        navigate('/dashboard');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompleteRegistration = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const userData = await authService.completeRegistration(phoneNumber, name);
      login(userData);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to register.');
    } finally {
      setIsLoading(false);
    }
  };

  const renderStep = () => {
    const formAnimation = {
      initial: { opacity: 0, y: 20 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -20 },
      transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] }
    };

    switch (step) {
      case 'otp':
        return (
          <motion.form key="otp" onSubmit={handleVerifyOtp} {...formAnimation}>
            <h2 className="auth-title">Enter Verification Code</h2>
            <p className="auth-subtitle">We've sent a 6-digit code to <strong>{phoneNumber}</strong></p>
            <input
              type="tel"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••••"
              className="auth-input otp-input"
              maxLength="6"
              required
              autoFocus
            />
            <button type="submit" disabled={isLoading || otp.length !== 6} className="auth-button">
              {isLoading ? (
                <span className="loading-text">Verifying...</span>
              ) : (
                'Verify & Continue'
              )}
            </button>
            <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#606770' }}>
              Didn't receive code? <button 
                type="button" 
                onClick={handleSendOtp}
                style={{ 
                  background: 'none', 
                  border: 'none', 
                  color: '#1877f2', 
                  fontWeight: '600', 
                  cursor: 'pointer' 
                }}
              >
                Resend
              </button>
            </p>
          </motion.form>
        );
      case 'name':
        return (
          <motion.form key="name" onSubmit={handleCompleteRegistration} {...formAnimation}>
            <h2 className="auth-title">Welcome to CricZone!</h2>
            <p className="auth-subtitle">Just one more step to complete your profile</p>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="auth-input"
              required
              autoFocus
            />
            <button type="submit" disabled={isLoading || !name.trim()} className="auth-button">
              {isLoading ? (
                <span className="loading-text">Saving...</span>
              ) : (
                'Complete Registration'
              )}
            </button>
          </motion.form>
        );
      default: // 'phone' step
        return (
          <motion.form key="phone" onSubmit={handleSendOtp} {...formAnimation}>
            <h2 className="auth-title">Login or Sign Up</h2>
            <p className="auth-subtitle">Enter your phone number to get started</p>
            
            <div className="phone-input-wrapper">
              <div className={`phone-input-container ${error ? 'error' : ''} ${showCountryDropdown ? 'show-dropdown' : ''}`}>
                <div 
                  className="country-selector"
                  onClick={() => setShowCountryDropdown(!showCountryDropdown)}
                >
                  <span className="country-flag">{selectedCountry.flag}</span>
                  <span className="country-code">{selectedCountry.dialCode}</span>
                  <svg className="chevron-icon" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M7 10l5 5 5-5z" />
                  </svg>
                </div>
                
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value.replace(/[^0-9+]/g, ''))}
                  placeholder="Phone number"
                  className="phone-input"
                  required
                  autoFocus
                />
              </div>
              
              {showCountryDropdown && (
                <div className="country-dropdown">
                  <div className="country-search">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search country..."
                      className="search-input"
                    />
                  </div>
                  <div className="country-list">
                    {filteredCountries.map((country) => (
                      <div
                        key={country.code}
                        className={`country-item ${selectedCountry.code === country.code ? 'active' : ''}`}
                        onClick={() => {
                          setSelectedCountry(country);
                          setShowCountryDropdown(false);
                          setSearchQuery('');
                        }}
                      >
                        <span className="country-item-flag">{country.flag}</span>
                        <span className="country-item-name">{country.name}</span>
                        <span className="country-item-code">{country.dialCode}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            
            <button 
              type="submit" 
              disabled={isLoading || !phoneNumber} 
              className="auth-button"
            >
              {isLoading ? (
                <span className="loading-text">Sending...</span>
              ) : (
                'Continue'
              )}
            </button>
          </motion.form>
        );
    }
  };

  return (
    <div className="auth-container">
      <motion.div 
        className="auth-card"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <motion.div 
          className="logo-placeholder"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18 10a6 6 0 0 0-12 0v5h12v-5zm2 5.5v.5a2 2 0 0 1-2 2h-1v1a1 1 0 0 1-1 1h-4a1 1 0 0 1-1-1v-1H6a2 2 0 0 1-2-2v-5a8 8 0 1 1 16 0v5z" />
          </svg>
          <span className="logo-text">CricZone</span>
        </motion.div>
        
        {error && (
          <motion.div 
            className="auth-error"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
          >
            {error}
          </motion.div>
        )}
        
        <div className="auth-form-wrapper">
          <AnimatePresence mode="wait">
            {renderStep()}
          </AnimatePresence>
        </div>
        
        <motion.div 
          className="guest-mode-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          <p className="guest-text">Continue as guest</p>
          <button 
            onClick={() => navigate('/match-setup')} 
            className="guest-button"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
            Start a Quick Match
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AuthPage;