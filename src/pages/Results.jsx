import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, RotateCcw, Medal, Sparkles } from 'lucide-react';

const MedalIcon = ({ rank, size = 28 }) => {
    const colors = {
        1: '#FFD700',
        2: '#C0C0C0',
        3: '#CD7F32',
        4: '#dc3545'
    };

    return <Medal size={size} style={{ color: colors[rank] || '#ffffff' }} />;
};

// Small floating particle used for the celebratory background
const Particle = ({ delay, left, emoji }) => (
    <motion.div
        initial={{ y: '110vh', opacity: 0, rotate: 0 }}
        animate={{ y: '-10vh', opacity: [0, 1, 1, 0], rotate: 360 }}
        transition={{ duration: 5 + Math.random() * 3, delay, repeat: Infinity, ease: 'linear' }}
        style={{
            position: 'absolute',
            left: `${left}%`,
            fontSize: `${14 + Math.random() * 14}px`,
            pointerEvents: 'none',
            zIndex: 1
        }}
    >
        {emoji}
    </motion.div>
);

export default function Results({ winners = [], players = [], onRestart }) {
    const safeWinners = Array.isArray(winners)
        ? winners
        : Array.isArray(winners?.winners)
            ? winners.winners
            : [];

    const safePlayers = Array.isArray(players) ? players : [];

    const getRankText = (rank) => {
        if (rank === 1) return 'GOLD';
        if (rank === 2) return 'SILVER';
        if (rank === 3) return 'BRONZE';
        if (rank === 4) return 'DONKEY';
        return 'FINISHED';
    };

    const getPlayerName = (winner, index) => {
        const matchedPlayer =
            safePlayers.find((p) => p.id === winner.id) ||
            safePlayers.find((p) => p.playerId === winner.id) ||
            safePlayers.find((p) => p.socketId === winner.id);

        if (matchedPlayer?.name && matchedPlayer.name.trim()) {
            return matchedPlayer.name;
        }

        if (winner?.name && winner.name.trim()) {
            return winner.name;
        }

        if (winner?.playerName && winner.playerName.trim()) {
            return winner.playerName;
        }

        if (winner?.id === 'p1') return 'YOU';
        if (winner?.id === 'p2') return 'PLAYER 2';
        if (winner?.id === 'p3') return 'PLAYER 3';
        if (winner?.id === 'p4') return 'PLAYER 4';

        return `PLAYER ${index + 1}`;
    };

    const offlinePlayers = ['p1', 'p2', 'p3', 'p4'];

    const donkeyWinner =
        safeWinners.find((w) => w.rank === 4) ||
        (() => {
            const donkeyId = offlinePlayers.find((p) => !safeWinners.some((w) => w.id === p));
            return donkeyId ? { id: donkeyId, rank: 4 } : null;
        })();

    const podiumWinners = safeWinners.filter((w) => w.rank !== 4);

    const particles = ['🎉', '✨', '🏆', '⭐', '🎊'];

    return (
        <div
            className="vh-100 d-flex flex-column align-items-center justify-content-center p-4 position-relative overflow-hidden"
            style={{
                background: 'radial-gradient(ellipse at top, #1a1508 0%, #050505 65%)'
            }}
        >
            {/* Floating celebratory particles */}
            {Array.from({ length: 14 }).map((_, i) => (
                <Particle
                    key={i}
                    delay={i * 0.4}
                    left={(i * 7) % 100}
                    emoji={particles[i % particles.length]}
                />
            ))}

            {/* Soft glow behind the card */}
            <motion.div
                animate={{ opacity: [0.4, 0.7, 0.4], scale: [1, 1.08, 1] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                style={{
                    position: 'absolute',
                    width: '420px',
                    height: '420px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(255,215,0,0.18) 0%, rgba(255,215,0,0) 70%)',
                    zIndex: 0
                }}
            />

            <motion.div
                initial={{ opacity: 0, y: 40, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.55, ease: 'easeOut' }}
                className="p-4 rounded-4 text-center w-100 position-relative"
                style={{
                    maxWidth: '450px',
                    zIndex: 2,
                    background: 'linear-gradient(180deg, rgba(28,22,10,0.96) 0%, rgba(10,8,4,0.98) 100%)',
                    border: '1px solid rgba(255,215,0,0.35)',
                    boxShadow: '0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(255,215,0,0.08) inset',
                    backdropFilter: 'blur(10px)'
                }}
            >
                <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 14 }}
                    className="d-inline-block position-relative mb-2"
                >
                    <motion.div
                        animate={{ opacity: [0.3, 0.9, 0.3] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        style={{
                            position: 'absolute',
                            inset: '-14px',
                            borderRadius: '50%',
                            background: 'radial-gradient(circle, rgba(255,215,0,0.5) 0%, rgba(255,215,0,0) 70%)'
                        }}
                    />
                    <Trophy size={60} className="text-warning position-relative" />
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, letterSpacing: '0.4em' }}
                    animate={{ opacity: 1, letterSpacing: '0.08em' }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="fw-bold mb-4"
                    style={{
                        background: 'linear-gradient(90deg, #ffd700, #fff3c4, #ffd700)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent',
                        fontSize: '1.5rem'
                    }}
                >
                    MATCH RESULTS
                </motion.h2>

                <div className="d-flex flex-column gap-2 mb-4 text-start">
                    <AnimatePresence>
                        {podiumWinners.map((w, index) => (
                            <motion.div
                                key={w.id || index}
                                initial={{ opacity: 0, x: -40 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.45 + index * 0.15, type: 'spring', stiffness: 220, damping: 18 }}
                                whileHover={{ scale: 1.02 }}
                                className="d-flex align-items-center justify-content-between p-3 rounded-pill position-relative overflow-hidden"
                                style={{
                                    background: w.rank === 1
                                        ? 'linear-gradient(90deg, rgba(255,215,0,0.18), rgba(0,0,0,0.3))'
                                        : 'rgba(255,255,255,0.05)',
                                    border: w.rank === 1
                                        ? '1px solid rgba(255,215,0,0.5)'
                                        : '1px solid rgba(255,255,255,0.12)',
                                    boxShadow: w.rank === 1 ? '0 0 20px rgba(255,215,0,0.15)' : 'none'
                                }}
                            >
                                {w.rank === 1 && (
                                    <motion.div
                                        animate={{ x: ['-100%', '200%'] }}
                                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1 }}
                                        style={{
                                            position: 'absolute',
                                            top: 0, bottom: 0, width: '40%',
                                            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent)',
                                            zIndex: 0
                                        }}
                                    />
                                )}

                                <div className="d-flex align-items-center gap-2 overflow-hidden position-relative" style={{ zIndex: 1 }}>
                                    <motion.div
                                        animate={w.rank === 1 ? { rotate: [0, -8, 8, 0] } : {}}
                                        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 1.5 }}
                                    >
                                        <MedalIcon rank={w.rank} />
                                    </motion.div>
                                    <span className="fw-bold text-truncate text-white">
                                        {getPlayerName(w, index)}
                                    </span>
                                </div>

                                <span
                                    className="small fw-bold ms-2 position-relative"
                                    style={{
                                        zIndex: 1,
                                        color: w.rank === 1 ? '#ffd700' : 'rgba(255,255,255,0.55)',
                                        letterSpacing: '0.08em'
                                    }}
                                >
                                    {getRankText(w.rank)}
                                </span>
                            </motion.div>
                        ))}
                    </AnimatePresence>

                    {donkeyWinner && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
                            animate={{ opacity: 1, scale: 1, rotate: 0 }}
                            transition={{ delay: 0.45 + podiumWinners.length * 0.15 + 0.25, type: 'spring', stiffness: 200, damping: 12 }}
                            className="mt-3 p-3 rounded-4 text-center position-relative overflow-hidden"
                            style={{
                                background: 'linear-gradient(160deg, rgba(220,53,69,0.25), rgba(80,10,15,0.35))',
                                border: '1px solid rgba(220,53,69,0.6)',
                                boxShadow: '0 0 30px rgba(220,53,69,0.25)'
                            }}
                        >
                            <motion.div
                                animate={{ opacity: [0.15, 0.4, 0.15] }}
                                transition={{ duration: 1.6, repeat: Infinity }}
                                style={{
                                    position: 'absolute',
                                    inset: 0,
                                    background: 'radial-gradient(circle, rgba(220,53,69,0.4) 0%, rgba(220,53,69,0) 70%)'
                                }}
                            />

                            <motion.div
                                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                                transition={{ delay: 1, duration: 0.7, repeat: Infinity, repeatDelay: 2.3 }}
                                className="display-4 position-relative"
                                style={{ zIndex: 1 }}
                            >
                                🫏
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1 }}
                                className="d-flex align-items-center justify-content-center gap-2 position-relative"
                                style={{ zIndex: 1 }}
                            >
                                <Sparkles size={16} className="text-danger" />
                                <span className="h4 fw-bold text-danger mb-0" style={{ letterSpacing: '0.05em' }}>
                                    DONKEY: {getPlayerName(donkeyWinner, safeWinners.length)}
                                </span>
                                <Sparkles size={16} className="text-danger" />
                            </motion.div>
                        </motion.div>
                    )}
                </div>

                <motion.button
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.9 }}
                    whileHover={{ scale: 1.03, boxShadow: '0 6px 24px rgba(255,215,0,0.4)' }}
                    whileTap={{ scale: 0.97 }}
                    className="btn btn-warning btn-lg w-100 fw-bold rounded-pill mt-2 border-0"
                    style={{ boxShadow: '0 4px 16px rgba(255,215,0,0.25)' }}
                    onClick={onRestart}
                >
                    <RotateCcw size={20} className="me-2" /> REPLAY GAME
                </motion.button>
            </motion.div>
        </div>
    );
}