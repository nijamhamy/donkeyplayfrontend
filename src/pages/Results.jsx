import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
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

// ---------- Visual-only constants (no logic) ----------
const AMBIENT = [
    ['♠', 6, 22, 30], ['♥', 22, 28, 44], ['♦', 40, 20, 26],
    ['♣', 58, 30, 38], ['♥', 76, 26, 28], ['♠', 92, 24, 42],
];
const CONFETTI_SYMBOLS = ['🎉', '✨', '🏆', '⭐', '🎊', '♠', '♥', '♦', '♣'];

// Podium look per rank (2nd | 1st | 3rd layout)
const PODIUM = {
    1: { h: 118, face: 'linear-gradient(#fde68a, #fbbf24 55%, #d99a0b)', side: '#92590a', text: '#4a2c05', glow: 'rgba(250,204,21,.55)' },
    2: { h: 88, face: 'linear-gradient(#f3f4f6, #cbd5e1 55%, #94a3b8)', side: '#4b5563', text: '#1f2937', glow: 'rgba(203,213,225,.4)' },
    3: { h: 66, face: 'linear-gradient(#f5c28f, #cd7f32 55%, #8a4b14)', side: '#5a300a', text: '#2a1404', glow: 'rgba(205,127,50,.4)' },
};

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

    // ---------- Visual-only helpers ----------
    // Random values are generated once so the confetti doesn't jump on re-render
    const confetti = useMemo(() => Array.from({ length: 16 }, (_, i) => ({
        s: CONFETTI_SYMBOLS[i % CONFETTI_SYMBOLS.length],
        left: (i * 6.4 + 3) % 100,
        size: 14 + ((i * 7) % 14),
        dur: 5 + ((i * 13) % 30) / 10,
        delay: -((i * 0.45) % 6),
    })), []);

    // Build 2nd | 1st | 3rd podium order from the same winners data
    const byRank = (r) => {
        const idx = podiumWinners.findIndex((w) => w.rank === r);
        return idx === -1 ? null : { w: podiumWinners[idx], idx };
    };
    const podiumSlots = [byRank(2), byRank(1), byRank(3)].filter(Boolean);
    const enterOrder = { 3: 0, 2: 1, 1: 2 }; // 3rd rises first, 1st last

    return (
        <div
            className="res-root vh-100 d-flex flex-column align-items-center justify-content-center p-4 position-relative overflow-hidden"
        >
            {/* ===== ENVIRONMENT: casino room, spotlight, floating suits ===== */}
            <div className="env-room" />
            <div className="env-spot" />
            {AMBIENT.map(([s, left, size, dur], i) => (
                <span key={i} className="env-suit"
                    style={{ left: `${left}%`, fontSize: size, animationDuration: `${dur}s`, animationDelay: `${-i * 5}s`, color: (s === '♥' || s === '♦') ? '#fca5a5' : '#bbf7d0' }}>
                    {s}
                </span>
            ))}

            {/* Falling celebratory confetti */}
            {confetti.map((c, i) => (
                <span key={i} className="res-confetti"
                    style={{ left: `${c.left}%`, fontSize: c.size, animationDuration: `${c.dur}s`, animationDelay: `${c.delay}s` }}>
                    {c.s}
                </span>
            ))}
            <div className="env-vignette" />

            {/* ===== RESULTS PANEL ===== */}
            <motion.div
                initial={{ opacity: 0, y: 50, rotateX: 35, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, rotateX: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 130, damping: 15 }}
                className="res-panel p-4 rounded-4 text-center w-100 position-relative"
                style={{ maxWidth: '450px', zIndex: 5 }}
            >
                {/* 3D spinning trophy */}
                <motion.div
                    initial={{ scale: 0, rotate: -30 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.15, type: 'spring', stiffness: 260, damping: 14 }}
                    className="d-inline-block position-relative mb-2"
                >
                    <div className="trophy-glow" />
                    <div className="trophy-stage">
                        <div className="trophy-spin">
                            <Trophy size={64} className="text-warning" style={{ filter: 'drop-shadow(0 4px 0 #92590a)' }} />
                        </div>
                    </div>
                    <div className="trophy-shadow" />
                </motion.div>

                <motion.h2
                    initial={{ opacity: 0, letterSpacing: '0.4em' }}
                    animate={{ opacity: 1, letterSpacing: '0.08em' }}
                    transition={{ delay: 0.3, duration: 0.6 }}
                    className="res-title fw-bold mb-3"
                >
                    MATCH RESULTS
                </motion.h2>

                {/* ===== 3D PODIUM ===== */}
                {podiumSlots.length > 0 && (
                    <div className="podium d-flex align-items-end justify-content-center gap-2 mb-3">
                        {podiumSlots.map(({ w, idx }) => {
                            const st = PODIUM[w.rank] || PODIUM[3];
                            return (
                                <div key={w.id || idx} className="podium-col">
                                    <motion.div
                                        initial={{ opacity: 0, y: -60 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.7 + (enterOrder[w.rank] ?? 0) * 0.25, type: 'spring', stiffness: 220, damping: 12 }}
                                        className="podium-head"
                                    >
                                        <div className={w.rank === 1 ? 'medal-bob' : ''}>
                                            <MedalIcon rank={w.rank} size={w.rank === 1 ? 34 : 28} />
                                        </div>
                                        <span className="podium-name text-white fw-bold">{getPlayerName(w, idx)}</span>
                                        <span className="podium-rank" style={{ color: w.rank === 1 ? '#ffd700' : 'rgba(255,255,255,0.6)' }}>
                                            {getRankText(w.rank)}
                                        </span>
                                    </motion.div>

                                    <motion.div
                                        initial={{ scaleY: 0 }}
                                        animate={{ scaleY: 1 }}
                                        transition={{ delay: 0.45 + (enterOrder[w.rank] ?? 0) * 0.25, type: 'spring', stiffness: 160, damping: 16 }}
                                        className={`podium-block ${w.rank === 1 ? 'gold' : ''}`}
                                        style={{
                                            height: st.h,
                                            transformOrigin: 'bottom',
                                            background: st.face,
                                            color: st.text,
                                            boxShadow: `0 6px 0 ${st.side}, 0 12px 16px rgba(0,0,0,.5), 0 0 24px ${st.glow}, inset 0 2px 0 rgba(255,255,255,.6)`
                                        }}
                                    >
                                        <span className="podium-num">{w.rank}</span>
                                    </motion.div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ===== DONKEY ===== */}
                {donkeyWinner && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.6, rotate: -6 }}
                        animate={{ opacity: 1, scale: 1, rotate: 0 }}
                        transition={{ delay: 0.45 + podiumWinners.length * 0.15 + 0.6, type: 'spring', stiffness: 200, damping: 12 }}
                        className="donkey-card mt-3 mb-3 p-3 rounded-4 text-center position-relative overflow-hidden"
                    >
                        <div className="donkey-emoji display-4 position-relative">🫏</div>

                        <div className="d-flex align-items-center justify-content-center gap-2 position-relative">
                            <Sparkles size={16} className="text-danger" />
                            <span className="h5 fw-bold text-danger mb-0" style={{ letterSpacing: '0.05em' }}>
                                DONKEY: {getPlayerName(donkeyWinner, safeWinners.length)}
                            </span>
                            <Sparkles size={16} className="text-danger" />
                        </div>
                    </motion.div>
                )}

                <motion.button
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.2 }}
                    whileTap={{ scale: 0.97 }}
                    className="btn3d-gold w-100 fw-bold mt-2"
                    onClick={onRestart}
                >
                    <RotateCcw size={20} className="me-2" /> REPLAY GAME
                </motion.button>
            </motion.div>

            <style>{`
                .res-root { background:#02100a; perspective: 900px; user-select:none; -webkit-tap-highlight-color: transparent; }

                /* ---- environment (same casino room as the game) ---- */
                .env-room { position:absolute; inset:0; z-index:0; pointer-events:none;
                    background: radial-gradient(ellipse at 50% 42%, #14703f 0%, #0b4527 38%, #062615 70%, #02100a 100%); }
                .env-room::after { content:''; position:absolute; inset:0;
                    background: repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 7px); }
                .env-spot { position:absolute; left:50%; top:-10%; width:130%; height:75%; margin-left:-65%; z-index:1; pointer-events:none;
                    background: radial-gradient(ellipse at 50% 0%, rgba(255,244,190,.32) 0%, rgba(255,244,190,0) 65%); }
                .env-suit { position:absolute; bottom:-60px; z-index:1; font-weight:900; opacity:.12; pointer-events:none;
                    animation: envRise linear infinite; will-change: transform; }
                @keyframes envRise { from { transform: translateY(0); } to { transform: translateY(-115vh); } }
                .env-vignette { position:absolute; inset:0; z-index:2; pointer-events:none;
                    background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.65) 100%); }

                .res-confetti { position:absolute; top:-8%; z-index:3; pointer-events:none; opacity:.9;
                    animation: confFall linear infinite; will-change: transform; }
                @keyframes confFall { from { transform: translateY(0) rotate(0deg); } to { transform: translateY(115vh) rotate(360deg); } }

                /* ---- panel ---- */
                .res-panel { background: linear-gradient(160deg, rgba(27,42,32,.97), rgba(7,13,9,.98));
                    border: 2px solid #facc15;
                    box-shadow: 0 0 0 6px rgba(0,0,0,.35), 0 28px 50px rgba(0,0,0,.7), 0 0 60px rgba(250,204,21,.35), inset 0 2px 0 rgba(255,255,255,.1); }
                .res-title { font-size:1.5rem; color:#fde047;
                    text-shadow: 0 2px 0 #b45309, 0 4px 0 #78350f, 0 0 20px rgba(253,224,71,.6); }

                /* ---- trophy ---- */
                .trophy-stage { perspective: 400px; position:relative; z-index:1; }
                .trophy-spin { display:inline-block; animation: trophySpin 4s linear infinite; will-change: transform; }
                @keyframes trophySpin { to { transform: rotateY(360deg); } }
                .trophy-glow { position:absolute; inset:-18px; border-radius:50%; pointer-events:none;
                    background: radial-gradient(circle, rgba(255,215,0,.5) 0%, rgba(255,215,0,0) 70%);
                    animation: trophyGlow 2s ease-in-out infinite; }
                @keyframes trophyGlow { 0%,100% { opacity:.4; transform:scale(1); } 50% { opacity:1; transform:scale(1.12); } }
                .trophy-shadow { width:56px; height:10px; margin:2px auto 0; border-radius:50%;
                    background: radial-gradient(ellipse, rgba(0,0,0,.6), rgba(0,0,0,0) 70%); }

                /* ---- podium ---- */
                .podium { min-height: 190px; }
                .podium-col { flex:1; max-width:118px; display:flex; flex-direction:column; align-items:center; }
                .podium-head { display:flex; flex-direction:column; align-items:center; gap:2px; margin-bottom:6px; width:100%; }
                .podium-name { font-size:.78rem; max-width:100%; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
                .podium-rank { font-size:.62rem; font-weight:800; letter-spacing:.08em; }
                .podium-block { position:relative; width:100%; border-radius:10px 10px 4px 4px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
                .podium-num { font-size:2.2rem; font-weight:900; line-height:1; text-shadow: 0 2px 0 rgba(255,255,255,.35); opacity:.9; }
                .podium-block::after { content:''; position:absolute; inset:0; pointer-events:none;
                    background: linear-gradient(115deg, rgba(255,255,255,.35) 0%, rgba(255,255,255,0) 40%); }
                .podium-block.gold::before { content:''; position:absolute; top:0; bottom:0; left:0; width:40%; z-index:1; pointer-events:none;
                    background: linear-gradient(100deg, transparent, rgba(255,255,255,.6), transparent);
                    transform: translateX(-200%) skewX(-20deg); animation: podSheen 3s ease-in-out infinite; }
                @keyframes podSheen { 0%,55% { transform: translateX(-200%) skewX(-20deg); } 100% { transform: translateX(450%) skewX(-20deg); } }
                .medal-bob { animation: medalBob 1.2s ease-in-out infinite; }
                @keyframes medalBob { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-5px) rotate(6deg); } }

                /* ---- donkey ---- */
                .donkey-card { background: linear-gradient(160deg, rgba(220,53,69,.28), rgba(80,10,15,.4));
                    border: 2px solid rgba(220,53,69,.7);
                    box-shadow: 0 5px 0 rgba(90,10,18,.8), 0 0 30px rgba(220,53,69,.28), inset 0 2px 0 rgba(255,255,255,.12); }
                .donkey-emoji { display:inline-block; transform-origin: 50% 90%; animation: donkeyWobble 3s ease-in-out infinite; }
                @keyframes donkeyWobble { 0%,70%,100% { transform: rotate(0); } 75% { transform: rotate(-10deg); } 80% { transform: rotate(10deg); } 85% { transform: rotate(-10deg); } 90% { transform: rotate(10deg); } }

                /* ---- 3D gold button ---- */
                .btn3d-gold { position:relative; overflow:hidden; border:0; border-radius:999px; padding:14px; color:#4a2c05; cursor:pointer;
                    font-size:1.05rem; letter-spacing:1px;
                    background: linear-gradient(#fde68a, #fbbf24 55%, #f59e0b);
                    box-shadow: 0 7px 0 #92590a, 0 14px 18px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.6);
                    transition: transform .08s, box-shadow .08s; }
                .btn3d-gold::after { content:''; position:absolute; top:0; bottom:0; left:0; width:35%;
                    background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent);
                    transform: translateX(-200%) skewX(-20deg); animation: podSheen 3.6s ease-in-out infinite; }
                .btn3d-gold:active { transform: translateY(6px); box-shadow: 0 1px 0 #92590a, 0 4px 8px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.6); }

                @media (prefers-reduced-motion: reduce) {
                    .env-suit, .res-confetti, .trophy-spin, .trophy-glow, .medal-bob, .donkey-emoji,
                    .podium-block.gold::before, .btn3d-gold::after { animation: none !important; }
                }
            `}</style>
        </div>
    );
}