import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import { App as CapApp } from '@capacitor/app';
import { Toast } from '@capacitor/toast';


// Pages
import Home from './pages/Home';
import Game from './pages/Game';
import Results from './pages/Results';
import MultiplayerGame from './pages/MultiplayerGame';


export default function App() {
  const [scene, setScene] = useState('SPLASH');
  const [progress, setProgress] = useState(0);
  const [finalResults, setFinalResults] = useState({ winners: [], players: [] });
  const [showExitModal, setShowExitModal] = useState(false);
  const [showMultiplayerExitModal, setShowMultiplayerExitModal] = useState(false);
  const [lastBackPress, setLastBackPress] = useState(0);
  const [offlineGameKey, setOfflineGameKey] = useState(0);
  const [multiplayerKey, setMultiplayerKey] = useState(0);


  const resetToHome = () => {
    setFinalResults({ winners: [], players: [] });
    setShowExitModal(false);
    setShowMultiplayerExitModal(false);
    setScene('HOME');
  };


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


    CapApp.addListener('backButton', handler);


    return () => {
      CapApp.removeAllListeners('backButton');
    };
  }, [scene]);


  useEffect(() => {
    if (scene === 'SPLASH') {
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
  }, [scene]);


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
              animate={{ y: 0, opacity: 1 }}
              src="assets/donkey.png"
              alt="Donkey play Logo"
              className="mb-4 shadow-lg"
              style={{ width: '200px', filter: 'drop-shadow(0px 10px 15px rgba(0,0,0,0.5))' }}
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