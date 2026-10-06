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


// ---------- Splash 3D visual-only constants (no game logic) ----------
const SPLASH_SUITS = [
  { s: '♠', red: false },
  { s: '♥', red: true },
  { s: '♣', red: false },
  { s: '♦', red: true },
];
const SPLASH_TITLE = 'Donkey play'.split('');
const SPLASH_PARTICLES = Array.from({ length: 14 }, (_, i) => ({
  left: 6 + ((i * 37) % 88),
  size: 14 + ((i * 7) % 20),
  dur: 9 + ((i * 3) % 8),
  delay: -((i * 1.7) % 10),
  s: ['♠', '♥', '♦', '♣'][i % 4],
  red: i % 4 === 1 || i % 4 === 2,
}));


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
            className="position-absolute top-0 start-0 w-100 h-100 d-flex flex-column align-items-center justify-content-center overflow-hidden"
            style={{
              background: 'radial-gradient(circle, #1a4d2e 0%, #050a06 100%)',
              zIndex: 9999
            }}
          >
            {/* ===== 3D BACKGROUND: spotlight, perspective floor grid, floating suits ===== */}
            <div className="sp3d-spot" />
            <div className="sp3d-floor-wrap">
              <div className="sp3d-floor" />
            </div>
            {SPLASH_PARTICLES.map((p, i) => (
              <span
                key={i}
                className="sp3d-particle"
                style={{
                  left: `${p.left}%`,
                  fontSize: p.size,
                  animationDuration: `${p.dur}s`,
                  animationDelay: `${p.delay}s`,
                  color: p.red ? '#fca5a5' : '#bbf7d0'
                }}
              >
                {p.s}
              </span>
            ))}
            <div className="sp3d-vignette" />

            {/* ===== 3D STAGE: logo with orbiting playing cards ===== */}
            <div className="sp3d-stage mb-4">
              <div className="sp3d-scene">
                {/* glowing disc under the logo */}
                <div className="sp3d-disc" />

                {/* orbiting 3D cards (depth-sorted with the logo) */}
                <div className="sp3d-orbit">
                  {SPLASH_SUITS.map((c, i) => (
                    <div
                      key={i}
                      className="sp3d-card"
                      style={{ transform: `rotateY(${i * 90}deg) translateZ(150px)` }}
                    >
                      <span style={{ color: c.red ? '#dc2626' : '#111' }}>{c.s}</span>
                      <b style={{ color: c.red ? '#dc2626' : '#111' }}>{c.s}</b>
                    </div>
                  ))}
                </div>

                {/* the logo — floats and swings in 3D */}
                <motion.div
                  className="sp3d-logo-wrap"
                  initial={{ y: 20, opacity: 0, rotateY: -90, scale: 0.6 }}
                  animate={{ y: 0, opacity: 1, rotateY: 0, scale: 1 }}
                  transition={{ duration: 0.9, type: 'spring', stiffness: 90, damping: 14 }}
                >
                  <motion.img
                    animate={{
                      y: [0, -12, 0],
                      rotateY: [-14, 14, -14],
                      rotateX: [4, -4, 4],
                      filter: isOffline
                        ? 'grayscale(0.6) drop-shadow(0px 10px 15px rgba(0,0,0,0.5))'
                        : 'grayscale(0) drop-shadow(0px 10px 15px rgba(0,0,0,0.5))'
                    }}
                    transition={{
                      y: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
                      rotateY: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
                      rotateX: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
                      filter: { duration: 0.6 }
                    }}
                    src="assets/donkey.png"
                    alt="Donkey play Logo"
                    className="shadow-lg"
                    style={{ width: '200px', transformStyle: 'preserve-3d' }}
                    onError={(e) => { e.target.src = "https://via.placeholder.com/150?text=Donky+Play"; }}
                  />
                </motion.div>

                {/* soft ground shadow that breathes with the float */}
                <motion.div
                  className="sp3d-shadow"
                  animate={{ scaleX: [1, 0.78, 1], opacity: [0.55, 0.32, 0.55] }}
                  transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>


            {/* ===== 3D TITLE: letters flip in one by one, then gently wave ===== */}
            <h2
              className="fw-bold mb-4 tracking-widest text-uppercase sp3d-title"
              style={{ fontSize: '1.5rem', color: '#ffd700' }}
              aria-label="Donkey play"
            >
              {SPLASH_TITLE.map((ch, i) => (
                <motion.span
                  key={i}
                  className="sp3d-letter"
                  initial={{ opacity: 0, rotateX: -90, y: 20 }}
                  animate={{ opacity: 1, rotateX: 0, y: 0 }}
                  transition={{ delay: 0.35 + i * 0.07, type: 'spring', stiffness: 180, damping: 12 }}
                >
                  <span
                    className="sp3d-letter-inner"
                    style={{ animationDelay: `${i * 0.12}s` }}
                  >
                    {ch === ' ' ? '\u00A0' : ch}
                  </span>
                </motion.span>
              ))}
            </h2>


            {/* ===== 3D PROGRESS BAR (same progress logic) ===== */}
            <div className="w-75 px-4 sp3d-bar-persp" style={{ maxWidth: '400px' }}>
              <div className="sp3d-bar-tilt">
                <div className="progress bg-black border border-secondary sp3d-bar" style={{ height: '10px', borderRadius: '10px' }}>
                  <motion.div
                    className="progress-bar bg-success progress-bar-striped progress-bar-animated"
                    style={{ width: `${progress}%` }}
                  />
                </div>
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

        /* =====================================================
           3D SPLASH SCREEN (visual only)
           ===================================================== */

        /* swaying spotlight from the top */
        .sp3d-spot {
          position: absolute; left: 50%; top: -10%; width: 130%; height: 70%; margin-left: -65%;
          pointer-events: none; z-index: 0; transform-origin: 50% 0;
          background: radial-gradient(ellipse at 50% 0%, rgba(255,244,190,.30) 0%, rgba(255,244,190,0) 65%);
          animation: sp3dSway 6s ease-in-out infinite;
        }
        @keyframes sp3dSway { 0%,100% { transform: rotate(-4deg); } 50% { transform: rotate(4deg); } }

        /* perspective floor grid that scrolls toward the viewer */
        .sp3d-floor-wrap {
          position: absolute; left: 0; right: 0; bottom: 0; height: 48%;
          perspective: 420px; overflow: hidden; pointer-events: none; z-index: 0;
          -webkit-mask-image: linear-gradient(to top, #000 15%, transparent 95%);
                  mask-image: linear-gradient(to top, #000 15%, transparent 95%);
        }
        .sp3d-floor {
          position: absolute; left: -50%; width: 200%; height: 200%; bottom: -60%;
          transform-origin: 50% 100%; transform: rotateX(68deg);
          background-image:
            linear-gradient(rgba(250,204,21,.38) 1px, transparent 1px),
            linear-gradient(90deg, rgba(250,204,21,.38) 1px, transparent 1px);
          background-size: 46px 46px;
          animation: sp3dFloor 1.6s linear infinite;
        }
        @keyframes sp3dFloor { from { background-position: 0 0; } to { background-position: 0 46px; } }

        /* floating suit symbols */
        .sp3d-particle {
          position: absolute; bottom: -50px; font-weight: 900; opacity: .16; pointer-events: none; z-index: 0;
          animation: sp3dRise linear infinite;
        }
        @keyframes sp3dRise {
          from { transform: translateY(0) rotateY(0deg) rotate(0deg); }
          to   { transform: translateY(-115vh) rotateY(360deg) rotate(180deg); }
        }
        .sp3d-vignette {
          position: absolute; inset: 0; pointer-events: none; z-index: 0;
          background: radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,.7) 100%);
        }

        /* stage + 3D scene */
        .sp3d-stage {
          position: relative; z-index: 2; width: 320px; height: 260px;
          perspective: 900px; perspective-origin: 50% 40%;
        }
        .sp3d-scene {
          position: relative; width: 100%; height: 100%;
          transform-style: preserve-3d;
          transform: rotateX(-8deg);
        }
        .sp3d-logo-wrap {
          position: absolute; left: 50%; top: 50%; width: 200px; margin-left: -100px; margin-top: -100px;
          transform-style: preserve-3d; text-align: center;
        }
        .sp3d-logo-wrap img { display: block; margin: 0 auto; }

        /* glowing disc below the logo */
        .sp3d-disc {
          position: absolute; left: 50%; top: 50%; width: 270px; height: 270px; margin: -135px 0 0 -135px;
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(circle, rgba(250,204,21,.28) 0%, rgba(250,204,21,.08) 45%, transparent 70%);
          transform: translateZ(-60px);
          animation: sp3dDisc 2.4s ease-in-out infinite;
        }
        @keyframes sp3dDisc { 0%,100% { opacity: .6; } 50% { opacity: 1; } }

        .sp3d-shadow {
          position: absolute; left: 50%; bottom: 0; width: 150px; height: 22px; margin-left: -75px;
          border-radius: 50%; pointer-events: none;
          background: radial-gradient(ellipse, rgba(0,0,0,.75) 0%, transparent 70%);
          transform: translateZ(-20px);
        }

        /* orbiting playing cards */
        .sp3d-orbit {
          position: absolute; left: 0; top: 0; width: 100%; height: 100%;
          transform-style: preserve-3d;
          animation: sp3dOrbit 9s linear infinite;
        }
        @keyframes sp3dOrbit {
          from { transform: rotateX(-14deg) rotateY(0deg); }
          to   { transform: rotateX(-14deg) rotateY(360deg); }
        }
        .sp3d-card {
          position: absolute; left: 50%; top: 50%; width: 46px; height: 64px; margin: -32px 0 0 -23px;
          background: linear-gradient(145deg, #ffffff, #e5e7eb);
          border-radius: 7px; border: 1px solid #9ca3af;
          display: flex; align-items: center; justify-content: center;
          backface-visibility: visible;
          box-shadow: 0 6px 14px rgba(0,0,0,.55), 0 0 12px rgba(250,204,21,.35);
        }
        .sp3d-card span { font-size: 26px; font-weight: 900; line-height: 1; }
        .sp3d-card b { position: absolute; top: 3px; left: 5px; font-size: 11px; line-height: 1; }

        /* 3D title */
        .sp3d-title {
          position: relative; z-index: 2; perspective: 600px;
          display: flex; justify-content: center; flex-wrap: nowrap;
          text-shadow: 0 2px 0 #b45309, 0 4px 0 #78350f, 0 8px 14px rgba(0,0,0,.6), 0 0 18px rgba(255,215,0,.35);
        }
        .sp3d-letter { display: inline-block; transform-style: preserve-3d; }
        .sp3d-letter-inner { display: inline-block; animation: sp3dWave 2.4s ease-in-out infinite; }
        @keyframes sp3dWave {
          0%,100% { transform: translateY(0) rotateY(0deg); }
          50%     { transform: translateY(-5px) rotateY(18deg); }
        }

        /* 3D progress bar */
        .sp3d-bar-persp { position: relative; z-index: 2; perspective: 500px; }
        .sp3d-bar-tilt { transform: rotateX(18deg); transform-origin: 50% 100%; }
        .sp3d-bar {
          box-shadow: 0 5px 0 #000, 0 10px 14px rgba(0,0,0,.6), inset 0 2px 3px rgba(0,0,0,.8);
        }

        @media (prefers-reduced-motion: reduce) {
          .sp3d-spot, .sp3d-floor, .sp3d-particle, .sp3d-orbit, .sp3d-disc, .sp3d-letter-inner { animation: none !important; }
        }
      `}</style>
    </div>
  );
}