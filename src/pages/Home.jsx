import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Play, Info, Settings, ArrowLeft, Share2, ShieldCheck, ExternalLink, Music, HelpCircle, Users } from 'lucide-react'; // Users icon added

export default function Home({ onStart, onMultiplayer }) {
    // Current screen: 'MAIN', 'HELP', 'SETTINGS', 'ABOUT'
    const [view, setView] = useState('MAIN');
    const [musicEnabled, setMusicEnabled] = useState(true);

    const handleShare = () => {
        if (navigator.share) {
            navigator.share({
                title: 'Donkey play',
                text: 'Join the ultimate Donkey play card strategy match!',
                url: 'https://play.google.com/store/apps/details?id=com.donkygame.app',
            });
        }
    };

    // 1. Help View - How to Play
    const HelpView = () => (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-start h-100 d-flex flex-column">
            <div className="d-flex align-items-center mb-4">
                <button className="btn btn-sm text-white bg-dark rounded-circle me-3" onClick={() => setView('MAIN')}>
                    <ArrowLeft size={20} />
                </button>
                <h4 className="mb-0 fw-bold text-success">How to Play</h4>
            </div>
            <div className="overflow-auto pe-2 small flex-grow-1" style={{ maxHeight: '380px' }}>
                <div className="bg-dark bg-opacity-50 p-3 rounded-4 border border-secondary mb-3">
                    <h6 className="text-warning fw-bold">The Start</h6>
                    <p className="mb-0 opacity-75">The player holding the <strong>Ace of Spades (♠A)</strong> must lead the first round.</p>
                </div>
                <div className="bg-dark bg-opacity-50 p-3 rounded-4 border border-secondary mb-3">
                    <h6 className="text-warning fw-bold">Following Suit</h6>
                    <p className="mb-0 opacity-75">You must play a card of the same suit as the lead card. If you don't have it, you can play any <strong>Danger Card</strong> to strike.</p>
                </div>
                <div className="bg-dark bg-opacity-50 p-3 rounded-4 border border-secondary mb-3">
                    <h6 className="text-warning fw-bold">The Strike</h6>
                    <p className="mb-0 opacity-75">If a danger card is played, the person who played the highest card of the original suit collects all cards on the table.</p>
                </div>
                <div className="bg-dark bg-opacity-50 p-3 rounded-4 border border-secondary">
                    <h6 className="text-warning fw-bold">Winning</h6>
                    <p className="mb-0 opacity-75">Finish all your cards to win. The last person left with cards is the <strong>Donkey play!</strong></p>
                </div>
            </div>
        </motion.div>
    );

    // 2. Settings View
    const SettingsView = () => (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-start">
            <div className="d-flex align-items-center mb-4">
                <button className="btn btn-sm text-white bg-dark rounded-circle me-3" onClick={() => setView('MAIN')}>
                    <ArrowLeft size={20} />
                </button>
                <h4 className="mb-0 fw-bold text-success">Settings</h4>
            </div>
            <div className="d-flex flex-column gap-3">
                {/* Music Toggle */}
                <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-dark bg-opacity-50 border border-secondary">
                    <div className="d-flex align-items-center gap-3">
                        < Music size={20} className="text-info" />
                        <span>Background Music</span>
                    </div>
                    <div className="form-check form-switch">
                        <input className="form-check-input" type="checkbox" checked={musicEnabled} onChange={() => setMusicEnabled(!musicEnabled)} />
                    </div>
                </div>

                {/* About Button */}
                <div className="p-3 rounded-4 bg-dark bg-opacity-50 border border-secondary cursor-pointer" style={{ cursor: 'pointer' }} onClick={() => setView('ABOUT')}>
                    <div className="d-flex justify-content-between align-items-center">
                        <div className="d-flex align-items-center gap-3">
                            <Info size={20} className="text-warning" />
                            <span>About Game</span>
                        </div>
                        <ArrowLeft size={16} style={{ transform: 'rotate(180deg)', opacity: 0.5 }} />
                    </div>
                </div>

                {/* Privacy Policy Link */}
                <a href="https://doc-hosting.flycricket.io/donky-play-privacy-policy/28981be2-afa3-4ad8-a4ef-7aede313160b/privacy" target="_blank" rel="noopener noreferrer" className="text-decoration-none text-white">
                    <div className="d-flex justify-content-between align-items-center p-3 rounded-4 bg-dark bg-opacity-50 border border-success border-opacity-50">
                        <div className="d-flex align-items-center gap-3">
                            <ShieldCheck size={20} className="text-success" />
                            <span>Privacy Policy</span>
                        </div>
                        <ExternalLink size={16} className="text-secondary" />
                    </div>
                </a>
            </div>
        </motion.div>
    );

    // 3. About View
    const AboutView = () => (
        <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="text-center h-100">
            <div className="d-flex align-items-center mb-4 text-start">
                <button className="btn btn-sm text-white bg-dark rounded-circle me-3" onClick={() => setView('SETTINGS')}>
                    <ArrowLeft size={20} />
                </button>
                <h4 className="mb-0 fw-bold text-success">About</h4>
            </div>
            <div className="mt-4">
                <Trophy size={50} className="text-warning mb-3" />
                <h5 className="fw-bold">Donkey play Pro</h5>
                <p className="small opacity-50">Version 1.0.26</p>
                <p className="small px-3 opacity-75">Developed with passion for card game lovers. Experience the classic strategy game with premium AI and smooth animations.</p>
                <div className="mt-5 text-secondary small">© 2026 Donkey play Gaming Studio</div>
            </div>
        </motion.div>
    );

    return (
        <div className="container vh-100 d-flex align-items-center justify-content-center p-3">
            <div className="card bg-dark text-white border-success shadow-lg p-4"
                style={{ width: '100%', maxWidth: '400px', borderRadius: '35px', backgroundColor: 'rgba(0,0,0,0.9)', minHeight: '520px', border: '2px solid rgba(25, 135, 84, 0.3)' }}>

                <AnimatePresence mode="wait">
                    {view === 'MAIN' && (
                        <motion.div key="main" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="h-100 d-flex flex-column justify-content-between py-2">
                            <div className="text-center mt-3">
                                <div className="mb-3 d-inline-block p-3 bg-success bg-opacity-10 rounded-circle border border-success border-opacity-25">
                                    <Trophy size={64} className="text-warning" />
                                </div>
                                <h1 className="fw-black text-success tracking-tight mb-0" style={{ fontSize: '2.8rem', fontWeight: 900 }}>Donkey play</h1>
                                <p className="text-secondary small tracking-widest text-uppercase fw-bold">Premium Strategy Match</p>
                            </div>

                            <div className="d-flex flex-column gap-3 mt-4">
                                {/* Play Button - Primary Action */}
                                <button className="btn btn-success btn-lg py-3 fw-bold rounded-pill shadow-lg d-flex align-items-center justify-content-center gap-2" onClick={onStart}>
                                    <Play size={24} fill="currentColor" /> START GAME
                                </button>

                                {/* Multiplayer Button - NEW Action */}
                                <button className="btn btn-outline-success btn-lg py-3 fw-bold rounded-pill shadow-sm d-flex align-items-center justify-content-center gap-2"
                                    style={{ borderWidth: '2px' }}
                                    onClick={onMultiplayer}>
                                    <Users size={22} /> MULTIPLAYER
                                </button>

                                <div className="row g-2">
                                    <div className="col-6">
                                        <button className="btn btn-outline-light w-100 py-3 rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm" onClick={() => setView('HELP')}>
                                            <HelpCircle size={18} /> Help
                                        </button>
                                    </div>
                                    <div className="col-6">
                                        <button className="btn btn-outline-light w-100 py-3 rounded-pill d-flex align-items-center justify-content-center gap-2 shadow-sm" onClick={() => setView('SETTINGS')}>
                                            <Settings size={18} /> Settings
                                        </button>
                                    </div>
                                </div>

                                <button className="btn btn-link text-secondary text-decoration-none mt-2 d-flex align-items-center justify-content-center gap-2" onClick={handleShare}>
                                    <Share2 size={18} /> Share Game
                                </button>
                            </div>
                        </motion.div>
                    )}

                    {view === 'HELP' && <HelpView key="help" />}
                    {view === 'SETTINGS' && <SettingsView key="settings" />}
                    {view === 'ABOUT' && <AboutView key="about" />}
                </AnimatePresence>
            </div>
        </div>
    );
}