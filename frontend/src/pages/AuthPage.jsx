import React, { useState, useContext, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { AuthContext } from '../context/AuthContext.jsx';
import authService from '../utils/authService.js';
import './AuthPage.css';
import myLogo from '../assets/criczone.png'; // FIXED: Added the 'import' keyword
import styled from 'styled-components';

const LogoIcon = styled.div`
  width: 200px;
  height: 200px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  
  svg {
    width: 18px;
    height: 18px;
    color: white;
  }
`;

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
  // Email login/register (alternative to phone OTP).
  const [method, setMethod] = useState('phone');     // 'phone' | 'email'
  const [emailMode, setEmailMode] = useState('login'); // 'login' | 'register'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const { login } = useContext(AuthContext);
  const navigate = useNavigate();

  const formRef = useRef(null);

  useEffect(() => {
    if (otp.length === 4 && !isLoading) {
      formRef.current?.requestSubmit();
    }
  }, [otp, isLoading]);

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
        navigate('/auctions');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid OTP. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    try {
      const data = emailMode === 'register'
        ? await authService.registerWithEmail(name, email, password)
        : await authService.loginWithEmail(email, password);
      login(data);
      navigate('/auctions');
    } catch (err) {
      setError(err.response?.data?.message || 'Something went wrong. Please try again.');
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
    } catch (err) { // FIXED: Removed the incorrect '=>' from the catch block
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

    if (method === 'email') {
      const register = emailMode === 'register';
      return (
        <motion.form key={`email-${emailMode}`} onSubmit={handleEmailAuth} {...formAnimation}>
          <h2 className="auth-title">{register ? 'Create your account' : 'Welcome back'}</h2>
          <p className="auth-subtitle">{register ? 'Sign up with your email' : 'Log in with your email & password'}</p>
          {register && (
            <input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" className="auth-input" required autoFocus />
          )}
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email address" className="auth-input" required autoFocus={!register} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" className="auth-input" required />
          <button type="submit" disabled={isLoading || !email || !password || (register && !name.trim())} className="auth-button">
            {isLoading ? <span className="loading-text">Please wait…</span> : (register ? 'Create account' : 'Log in')}
          </button>
          <p style={{ marginTop: '1rem', fontSize: '0.9rem', color: '#606770', textAlign: 'center' }}>
            {register ? 'Already have an account? ' : "Don't have an account? "}
            <button type="button" onClick={() => { setEmailMode(register ? 'login' : 'register'); setError(''); }}
              style={{ background: 'none', border: 'none', color: '#1877f2', fontWeight: 600, cursor: 'pointer' }}>
              {register ? 'Log in' : 'Sign up'}
            </button>
          </p>
        </motion.form>
      );
    }

    switch (step) {
      case 'otp':
        return (
          <motion.form ref={formRef} key="otp" onSubmit={handleVerifyOtp} {...formAnimation}>
            <h2 className="auth-title">Enter Verification Code</h2>
            <p className="auth-subtitle">We've sent a 4-digit code to <strong>{phoneNumber}</strong></p>
            <input
              type="tel"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
              placeholder="••••"
              className="auth-input otp-input"
              maxLength="4"
              required
              autoFocus
            />
            <button type="submit" disabled={isLoading || otp.length !== 4} className="auth-button">
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
          <LogoIcon>
                      {/* 2. Replace the SVG with an img tag */}
                      <img src={myLogo} alt="CricZone Logo" style={{ height: '100%' }} />
                  </LogoIcon>
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
        
        {step === 'phone' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            {['phone', 'email'].map((m) => (
              <button key={m} type="button" onClick={() => { setMethod(m); setError(''); }}
                style={{
                  flex: 1, padding: '10px', borderRadius: 12, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14,
                  background: method === m ? '#1877f2' : '#eef2f7', color: method === m ? '#fff' : '#606770',
                }}>
                {m === 'phone' ? 'Phone' : 'Email'}
              </button>
            ))}
          </div>
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
            START A QUICK MATCH
          </button>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default AuthPage;