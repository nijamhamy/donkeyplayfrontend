import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { App as CapApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';
import { Network } from '@capacitor/network';


// Pages
import Home from './pages/Home';
import Game from './pages/Game';
import Results from './pages/Results';
import MultiplayerGame from './pages/MultiplayerGame';

// Components
import AppOpenAd from './components/AppOpenAd';


export default function App() {
  const [scene, setScene] = useState('SPLASH');
  const [progress, setProgress] = useState(0);
  const [finalResults, setFinalResults] = useState({ winners: [], players: [] });
  const [showExitModal, setShowExitModal] = useState(false);
  const [showMultiplayerExitModal, setShowMultiplayerExitModal] = useState(false);
  const [lastBackPress, setLastBackPress] = useState(0);
  const [offlineGameKey, setOfflineGameKey] = useState(0);
  const [multiplayerKey, setMultiplayerKey] = useState(0);
  const [isOffline, setIsOffline] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);


  const resetToHome = () => {
    setFinalResults({ winners: [], players: [] });
    setShowExitModal(false);
    setShowMultiplayerExitModal(false);
    setScene('HOME');
  };


  const handleRetryConnection = async () => {
    if (isRetrying) return;
    setIsRetrying(true);
    try {
      const status = await Network.getStatus();
      setIsOffline(!status.connected);
      if (!status.connected) {
        Toast.show({ text: 'Still no connection', duration: 'short' });
      }
    } catch (e) {
      // ignore
    } finally {
      setTimeout(() => setIsRetrying(false), 600);
    }
  };


  // Network connectivity listener (using Capacitor Network plugin for accuracy on device)
  useEffect(() => {
    let listenerHandle;

    const checkInitialStatus = async () => {
      const status = await Network.getStatus();
      setIsOffline(!status.connected);
    };

    checkInitialStatus();

    Network.addListener('networkStatusChange', (status) => {
      setIsOffline(!status.connected);
    }).then((handle) => {
      listenerHandle = handle;
    });

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []);


  useEffect(() => {
    let lastPressTime = 0;


    const handler = () => {
      const now = Date.now();


      if (scene === 'PLAYING') {
        setShowExitModal(true);
        return;
      }


      if (scene === 'MULTIPLAYER') {
        setShowMultiplayerExitModal(true);
        return;
      }


      if (scene === 'RESULTS') {
        resetToHome();
        return;
      }


      if (scene === 'HOME') {
        if (now - lastPressTime < 2000) {
          CapApp.exitApp();
        } else {
          lastPressTime = now;
          setLastBackPress(now);


          Toast.show({
            text: 'Press back again to exit',
            duration: 'short'
          });
        }
      }
    };


    // Keep the handle of THIS listener, so we remove only this one later.
    // (CapApp.removeAllListeners() deletes ALL App listeners, also the app open ad "return to app" listener)
    let backHandle = null;
    let removed = false;

    CapApp.addListener('backButton', handler).then((handle) => {
      if (removed) {
        handle.remove();
      } else {
        backHandle = handle;
      }
    });


    return () => {
      removed = true;
      if (backHandle) {
        backHandle.remove();
      }
    };
  }, [scene]);


  useEffect(() => {
    if (scene === 'SPLASH') {
      // Don't progress or move to Home while offline — wait until connection is back
      if (isOffline) {
        return;
      }

      const duration = 3000;
      const intervalTime = 30;
      const increment = 100 / (duration / intervalTime);


      const timer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            clearInterval(timer);
            setTimeout(() => setScene('HOME'), 500);
            return 100;
          }
          return prev + increment;
        });
      }, intervalTime);


      return () => clearInterval(timer);
    }
  }, [scene, isOffline]);


  const handleMatchFinish = (resultData) => {
    let normalized = { winners: [], players: [] };


    if (Array.isArray(resultData)) {
      normalized = {
        winners: resultData,
        players: []
      };
    } else if (resultData && typeof resultData === 'object') {
      normalized = {
        winners: Array.isArray(resultData?.winners) ? resultData.winners : [],
        players: Array.isArray(resultData?.players) ? resultData.players : []
      };
    }


    if (!normalized.winners.length) {
      return;
    }


    setFinalResults(normalized);
    setScene('RESULTS');
  };


  const handleOfflineExitConfirm = () => {
    resetToHome();
  };


  const handleOfflineExitCancel = () => {
    setShowExitModal(false);
  };


  const handleMultiplayerExitConfirm = () => {
    resetToHome();
  };


  const handleMultiplayerExitCancel = () => {
    setShowMultiplayerExitModal(false);
  };


  return (
    <div className="app-container vh-100 overflow-hidden position-relative bg-dark text-white">
      {/* APP OPEN AD — no UI. Loads during splash, shows after splash (only on HOME / RESULTS, never while playing or offline) */}
      <AppOpenAd scene={scene} isOffline={isOffline} />

      <AnimatePresence mode="wait">
        {scene === 'SPLASH' && (
          <motion.div
            key="splash"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.5 }}
            className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center"
            style={{
              background: 'radial-gradient(circle, #1a4d2e 0%, #050a06 100%)',
              zIndex: 9999
            }}
          >
            <motion.img
              initial={{ y: 20, opacity: 0 }}
              animate={{
                y: 0,
                opacity: 1,
                filter: isOffline
                  ? 'grayscale(0.6) drop-shadow(0px 10px 15px rgba(0,0,0,0.5))'
                  : 'grayscale(0) drop-shadow(0px 10px 15px rgba(0,0,0,0.5))'
              }}
              transition={{ duration: 0.6 }}
              src="assets/donkey.png"
              alt="Donkey play Logo"
              className="mb-4 shadow-lg"
              style={{ width: '200px' }}
              onError={(e) => { e.target.src = "https://via.placeholder.com/150?text=Donky+Play"; }}
            />


            <h2 className="fw-bold mb-4 tracking-widest text-uppercase" style={{ fontSize: '1.5rem', color: '#ffd700' }}>
              Donkey play
            </h2>


            <div className="w-75 px-4" style={{ maxWidth: '400px' }}>
              <div className="progress bg-black border border-secondary" style={{ height: '10px', borderRadius: '10px' }}>
                <motion.div
                  className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-center mt-3 small text-secondary fw-bold">
                LOADING {Math.round(progress)}%
              </p>
            </div>
          </motion.div>
        )}


        {scene !== 'SPLASH' && (
          <motion.div
            key="main-content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="h-100 w-100 position-relative"
            style={{ zIndex: 10 }}
          >
            {scene === 'HOME' && (
              <Home
                onStart={() => {
                  setFinalResults({ winners: [], players: [] });
                  setShowExitModal(false);
                  setOfflineGameKey(prev => prev + 1);
                  setScene('PLAYING');
                }}
                onMultiplayer={() => {
                  setFinalResults({ winners: [], players: [] });
                  setShowMultiplayerExitModal(false);
                  setMultiplayerKey(prev => prev + 1);
                  setScene('MULTIPLAYER');
                }}
              />
            )}


            {scene === 'PLAYING' && (
              <Game
                key={offlineGameKey}
                externalShowExit={showExitModal}
                setExternalShowExit={setShowExitModal}
                onExit={handleOfflineExitConfirm}
                onFinish={handleMatchFinish}
              />
            )}


            {scene === 'MULTIPLAYER' && (
              <MultiplayerGame
                key={multiplayerKey}
                onBack={() => setShowMultiplayerExitModal(true)}
                onFinish={handleMatchFinish}
              />
            )}


            {scene === 'RESULTS' && (
              <Results
                winners={finalResults.winners}
                players={finalResults.players}
                onRestart={resetToHome}
              />
            )}


            <AnimatePresence>
              {showMultiplayerExitModal && scene === 'MULTIPLAYER' && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center"
                  style={{ zIndex: 99999, background: 'rgba(0,0,0,0.65)' }}
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.8, opacity: 0 }}
                    className="bg-dark text-white p-4 rounded-4 shadow-lg border border-warning text-center"
                    style={{ width: '90%', maxWidth: '360px' }}
                  >
                    <h4 className="text-warning fw-bold mb-3">Leave Match?</h4>
                    <p className="text-light small mb-4">
                      Are you sure you want to go back to Home?
                    </p>


                    <div className="d-flex gap-2">
                      <button
                        className="btn btn-secondary w-50 rounded-pill fw-bold"
                        onClick={handleMultiplayerExitCancel}
                      >
                        No
                      </button>
                      <button
                        className="btn btn-warning w-50 rounded-pill fw-bold"
                        onClick={handleMultiplayerExitConfirm}
                      >
                        Yes
                      </button>
                    </div>
                  </motion.div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>


      {/* GLOBAL OFFLINE OVERLAY — shows on top of ANY screen (Home, Game, Multiplayer, Results, Splash) the moment internet drops, in real time */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            key="global-offline-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="position-fixed top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center px-3"
            style={{
              zIndex: 999999,
              background: 'rgba(3, 8, 4, 0.86)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)'
            }}
          >
            <motion.div
              key="offline-card"
              initial={{ opacity: 0, y: 24, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 260, damping: 22 }}
              className="w-100"
              style={{ maxWidth: '380px' }}
            >
              <motion.div
                className="position-relative p-4 rounded-4 text-center overflow-hidden"
                style={{
                  background: 'rgba(255,255,255,0.06)',
                  backdropFilter: 'blur(18px)',
                  WebkitBackdropFilter: 'blur(18px)',
                  border: '1px solid rgba(255,92,92,0.35)',
                  boxShadow: '0 8px 32px rgba(0,0,0,0.45)'
                }}
              >
                {/* Animated glow border pulse */}
                <motion.div
                  className="position-absolute top-0 start-0 w-100 h-100"
                  style={{
                    borderRadius: 'inherit',
                    boxShadow: '0 0 0px rgba(255,92,92,0.0)',
                    pointerEvents: 'none'
                  }}
                  animate={{
                    boxShadow: [
                      '0 0 0px rgba(255,92,92,0.0)',
                      '0 0 22px rgba(255,92,92,0.35)',
                      '0 0 0px rgba(255,92,92,0.0)'
                    ]
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                />


                {/* Radar / wifi-off icon */}
                <div
                  className="position-relative mx-auto mb-3 d-flex align-items-center justify-content-center"
                  style={{ width: '84px', height: '84px' }}
                >
                  {[0, 1, 2].map((ring) => (
                    <motion.span
                      key={ring}
                      className="position-absolute rounded-circle"
                      style={{
                        width: '100%',
                        height: '100%',
                        border: '1.5px solid rgba(255,92,92,0.55)'
                      }}
                      animate={{
                        scale: [0.5, 1.6],
                        opacity: [0.6, 0]
                      }}
                      transition={{
                        duration: 2,
                        repeat: Infinity,
                        ease: 'easeOut',
                        delay: ring * 0.55
                      }}
                    />
                  ))}


                  <motion.div
                    className="rounded-circle d-flex align-items-center justify-content-center"
                    style={{
                      width: '56px',
                      height: '56px',
                      background: 'linear-gradient(145deg, #2a0d0d, #1a0505)',
                      border: '1px solid rgba(255,92,92,0.5)',
                      zIndex: 2
                    }}
                    animate={{ scale: [1, 1.06, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M1 9L3 11.5C7.5 7 16.5 7 21 11.5L23 9C17 3 7 3 1 9Z"
                        fill="#ff5c5c"
                        opacity="0.35"
                      />
                      <path
                        d="M5 13L7 15.3C9.7 12.9 14.3 12.9 17 15.3L19 13C15 9.5 9 9.5 5 13Z"
                        fill="#ff5c5c"
                        opacity="0.55"
                      />
                      <circle cx="12" cy="18.5" r="1.8" fill="#ff5c5c" />
                      <line x1="2.5" y1="2.5" x2="21.5" y2="21.5" stroke="#ff5c5c" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </motion.div>
                </div>


                <h5 className="fw-bold mb-2" style={{ color: '#ff8080', letterSpacing: '0.02em' }}>
                  No Internet Connection
                </h5>
                <p className="small text-light-emphasis mb-1" style={{ opacity: 0.85, lineHeight: 1.5 }}>
                  Please check your internet connection.
                </p>


                {/* Reconnecting status with animated dots */}
                <div className="d-flex align-items-center justify-content-center gap-1 mb-4 mt-2">
                  <span className="small text-secondary fw-semibold">Reconnecting</span>
                  {[0, 1, 2].map((dot) => (
                    <motion.span
                      key={dot}
                      className="rounded-circle"
                      style={{ width: '4px', height: '4px', background: '#ffd700', display: 'inline-block' }}
                      animate={{ opacity: [0.2, 1, 0.2], y: [0, -3, 0] }}
                      transition={{ duration: 1.1, repeat: Infinity, delay: dot * 0.18, ease: 'easeInOut' }}
                    />
                  ))}
                </div>


                <motion.button
                  whileTap={{ scale: 0.94 }}
                  whileHover={{ scale: 1.03 }}
                  onClick={handleRetryConnection}
                  disabled={isRetrying}
                  className="btn fw-bold rounded-pill px-4 py-2 border-0 d-inline-flex align-items-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, #ff5c5c, #c92c2c)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    boxShadow: '0 4px 14px rgba(255,92,92,0.35)',
                    opacity: isRetrying ? 0.75 : 1
                  }}
                >
                  <motion.span
                    animate={isRetrying ? { rotate: 360 } : { rotate: 0 }}
                    transition={isRetrying ? { duration: 0.7, repeat: Infinity, ease: 'linear' } : {}}
                    style={{ display: 'inline-flex' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path
                        d="M4 12a8 8 0 0 1 14.9-4M20 12a8 8 0 0 1-14.9 4"
                        stroke="#fff"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                      />
                      <path d="M18 4v5h-5M6 20v-5h5" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </motion.span>
                  {isRetrying ? 'Checking...' : 'Retry Now'}
                </motion.button>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>


      <div
        className="bg-overlay position-absolute top-0 start-0 w-100 h-100 opacity-05 pointer-events-none"
        style={{
          zIndex: 1,
          backgroundImage: 'url("https://www.transparenttextures.com/patterns/carbon-fibre.png")'
        }}
      ></div>


      <style>{`
        .opacity-05 { opacity: 0.05; }
        .tracking-widest { letter-spacing: 0.3em; }
        body, html { 
          overscroll-behavior: none; 
          background: #050a06; 
          margin: 0;
          padding: 0;
          height: 100%;
          width: 100%;
        }
        .app-container {
          width: 100vw;
          height: 100vh;
        }
      `}</style>
    </div>
  );
}