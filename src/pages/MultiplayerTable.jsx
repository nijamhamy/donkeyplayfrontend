import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, PlusCircle, LogIn, ArrowLeft, Copy, CheckCircle2, User, Crown, Loader2, Trophy } from 'lucide-react';

// Components (Reusing your existing UI components)
import CardView from '../components/Card';
import PlayerSlot from '../components/PlayerSlot';

const socket = io("http://localhost:3000"); // Change to your IP for mobile testing

export default function MultiplayerGame({ onBack, onFinish }) {
    // --- LOBBY & GAME STATES ---
    const [view, setView] = useState('LOBBY'); // LOBBY or BOARD
    const [playerName, setPlayerName] = useState("");
    const [roomId, setRoomId] = useState("");
    const [joinedRoom, setJoinedRoom] = useState(null);
    const [players, setPlayers] = useState([]);
    const [copied, setCopied] = useState(false);

    // --- BOARD STATES ---
    const [myHand, setMyHand] = useState([]);
    const [table, setTable] = useState([]);
    const [currentTurn, setCurrentTurn] = useState(null);
    const [collectingPlayer, setCollectingPlayer] = useState(null);

    useEffect(() => {
        socket.on("playersUpdated", (updated) => setPlayers(updated));

        socket.on("yourCards", (cards) => setMyHand(cards));

        socket.on("gameStarted", (data) => {
            setCurrentTurn(data.currentTurn);
            setView('BOARD');
        });

        socket.on("gameUpdated", (data) => {
            setTable(data.table);
            setCurrentTurn(data.currentTurn);
        });

        // Handles Strike (Picking up cards)
        socket.on("strikeOccurred", (data) => {
            setTable(data.table);
            setCollectingPlayer(data.loser);
            setTimeout(() => {
                setTable([]);
                setCollectingPlayer(null);
                setCurrentTurn(data.nextTurn);
            }, 1200);
        });

        // Handles Clean Round (Discarding cards)
        socket.on("roundComplete", (data) => {
            setTable(data.table);
            setCollectingPlayer('DISCARD');
            setTimeout(() => {
                setTable([]);
                setCollectingPlayer(null);
                setCurrentTurn(data.nextTurn);
            }, 1200);
        });

        return () => socket.off();
    }, []);

    // --- ACTIONS ---
    const handleCreate = () => {
        if (!playerName) return;
        socket.emit("createRoom", { playerName }, (id) => setJoinedRoom(id));
    };

    const handleJoin = () => {
        if (!playerName || !roomId) return;
        socket.emit("joinRoom", { roomId: roomId.toUpperCase(), playerName }, (res) => {
            if (res.success) setJoinedRoom(roomId.toUpperCase());
            else alert(res.message);
        });
    };

    const playCard = (card) => {
        if (socket.id !== currentTurn) return;
        setMyHand(prev => prev.filter(c => c.id !== card.id));
        socket.emit("playCard", { roomId: joinedRoom, card });
    };

    // --- SUB-COMPONENT: MULTIPLAYER BOARD (MATCHES GAME.JSX) ---
    const MultiplayerBoard = () => (
        <div className="w-100 h-100 position-relative overflow-hidden bg-black">
            {/* Header Area */}
            <div className="position-absolute top-0 w-100 p-3 d-flex justify-content-between align-items-center" style={{ zIndex: 3000 }}>
                <button className="btn btn-sm text-white bg-dark bg-opacity-50 rounded-circle p-2" onClick={onBack}><ArrowLeft size={24} /></button>
                <div className={`p-2 px-4 rounded-pill fw-black tracking-widest ${socket.id === currentTurn ? 'bg-success text-white animate-pulse' : 'bg-dark text-secondary border border-secondary'}`}>
                    {socket.id === currentTurn ? "YOUR TURN" : "WAITING..."}
                </div>
            </div>

            {/* Opponent Slots (Mapped dynamically based on room players) */}
            <div className="position-absolute top-0 start-50 translate-middle-x mt-5 pt-4" style={{ zIndex: 1500 }}>
                <PlayerSlot pos="p3" name={players[2]?.name || "Waiting..."} count={13} isTurn={currentTurn === players[2]?.id} />
            </div>
            <div className="position-absolute start-0 top-50 translate-middle-y ms-2" style={{ zIndex: 1500, transform: 'translateY(-120px)' }}>
                <PlayerSlot pos="p2" name={players[1]?.name || "Waiting..."} count={13} isTurn={currentTurn === players[1]?.id} />
            </div>
            <div className="position-absolute end-0 top-50 translate-middle-y me-2" style={{ zIndex: 1500, transform: 'translateY(-120px)' }}>
                <PlayerSlot pos="p4" name={players[3]?.name || "Waiting..."} count={13} isTurn={currentTurn === players[3]?.id} />
            </div>

            {/* Center Play Area (Green Circle) */}
            <div className="position-absolute top-50 start-50 translate-middle rounded-circle shadow-lg"
                style={{ width: '280px', height: '280px', background: 'radial-gradient(circle, #1a4d2e 0%, #0a2414 100%)', zIndex: 100, border: '4px solid rgba(255,255,255,0.1)' }}>
                <div className="d-flex h-100 justify-content-center align-items-center position-relative">
                    <AnimatePresence>
                        {table.map((c, i) => {
                            // Calculate exit animations based on server response (Strike or Discard)
                            let exX = 0, exY = 0;
                            if (collectingPlayer === 'DISCARD') { exX = 150; exY = -400; }
                            else if (collectingPlayer === socket.id) { exY = 400; } // Cards come to you

                            return (
                                <motion.div key={c.id} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                                    exit={{ x: exX, y: exY, scale: 0, opacity: 0, transition: { duration: 0.4 } }}
                                    className="position-absolute" style={{ zIndex: 500 + i }}>
                                    <CardView card={c} />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            {/* Your Hand (Bottom Section) */}
            <div className="position-absolute bottom-0 w-100 p-2 bg-dark bg-opacity-95 shadow-lg d-flex flex-column align-items-center" style={{ zIndex: 2000, minHeight: '140px' }}>
                <span className="x-small fw-black text-success text-uppercase mb-1 tracking-widest">You ({playerName})</span>
                <div className="d-flex justify-content-center align-items-end" style={{ height: '110px', width: '100%' }}>
                    {myHand.map((c, i) => (
                        <motion.div key={c.id}
                            animate={{ y: socket.id === currentTurn ? -20 : 0 }}
                            style={{ marginLeft: i === 0 ? 0 : '-35px', zIndex: 200 + i }}>
                            <CardView card={c} isInteractive={socket.id === currentTurn} onClick={() => playCard(c)} />
                        </motion.div>
                    ))}
                </div>
            </div>

            <style>{`.fw-black { font-weight: 900; } .x-small { font-size: 0.65rem; } .animate-pulse { animation: pulse 2s infinite; } @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }`}</style>
        </div>
    );

    // --- LOBBY RENDER ---
    return (
        <div className="vh-100 w-100">
            {view === 'LOBBY' ? (
                <div className="vh-100 d-flex align-items-center justify-content-center p-3" style={{ background: '#050a06' }}>
                    {/* Your existing Lobby UI (Create/Join buttons) remains here... */}
                    <div className="card bg-dark text-white p-4 rounded-5 border-success shadow-lg" style={{ maxWidth: '400px', width: '100%' }}>
                        <h2 className="text-center text-success fw-black mb-4">MULTIPLAYER</h2>
                        <input className="form-control bg-black text-white mb-3" placeholder="Name" value={playerName} onChange={e => setPlayerName(e.target.value)} />
                        {!joinedRoom ? (
                            <>
                                <button className="btn btn-success w-100 py-3 mb-3" onClick={handleCreate}>Create Room</button>
                                <input className="form-control bg-black text-white mb-2" placeholder="Room Code" value={roomId} onChange={e => setRoomId(e.target.value)} />
                                <button className="btn btn-outline-primary w-100 py-3" onClick={handleJoin}>Join Room</button>
                            </>
                        ) : (
                            <div className="text-center">
                                <div className="alert alert-success">Room Code: {joinedRoom}</div>
                                <p>Players: {players.length}/4</p>
                                <button className="btn btn-success w-100 py-3" disabled={players.length < 2} onClick={() => socket.emit("startGame", { roomId: joinedRoom })}>START MATCH</button>
                            </div>
                        )}
                        <button className="btn btn-link text-danger mt-3" onClick={onBack}>Cancel</button>
                    </div>
                </div>
            ) : (
                <MultiplayerBoard />
            )}
        </div>
    );
}