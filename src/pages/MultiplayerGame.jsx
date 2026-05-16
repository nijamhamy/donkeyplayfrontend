import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import {
    PlusCircle,
    LogIn,
    ArrowLeft,
    Copy,
    CheckCircle2,
    XCircle,
    User,
    Crown,
    Loader2,
    Trophy,
    Edit3
} from 'lucide-react';

import CardView from '../components/Card';
import PlayerSlot from '../components/PlayerSlot';

const SERVER_URL = 'https://donky-game-server.onrender.com';

const socket = io(SERVER_URL, {
    transports: ['polling', 'websocket'],
    reconnection: true,
});

export default function MultiplayerGame({ onBack, onFinish }) {
    const [view, setView] = useState('LOBBY');
    const [playerName, setPlayerName] = useState(() => localStorage.getItem('donky_player_name') || '');
    const [roomId, setRoomId] = useState('');
    const [joinedRoom, setJoinedRoom] = useState(null);
    const [players, setPlayers] = useState([]);

    const [myHand, setMyHand] = useState([]);
    const [table, setTable] = useState([]);
    const [currentTurn, setCurrentTurn] = useState(null);
    const [collectingPlayer, setCollectingPlayer] = useState(null);
    const [discardedCount, setDiscardedCount] = useState(0);
    const [striker, setStriker] = useState(null);
    const [winners, setWinners] = useState([]);
    const [isDealing, setIsDealing] = useState(false);

    const [copied, setCopied] = useState(false);
    const [joiningRoom, setJoiningRoom] = useState(false);
    const [creatingRoom, setCreatingRoom] = useState(false);
    const [socketReady, setSocketReady] = useState(socket.connected);

    const [isSubmittingCard, setIsSubmittingCard] = useState(false);
    const [pendingCardId, setPendingCardId] = useState(null);

    const [gameEnded, setGameEnded] = useState(false);
    const [finalResults, setFinalResults] = useState(null);
    const [showFinalPopup, setShowFinalPopup] = useState(false);
    const [isOpeningTrick, setIsOpeningTrick] = useState(true);

    const tempHandRef = useRef([]);
    const hasDealtOnceRef = useRef(false);
    const adPreparedRef = useRef(false);
    const pendingCardIdRef = useRef(null);
    const joinedRoomRef = useRef(joinedRoom);
    const viewRef = useRef(view);
    const latestPlayersRef = useRef([]);
    const finalPlayersRef = useRef([]);
    const finishHandledRef = useRef(false);
    const openingTrickRef = useRef(true);

    useEffect(() => {
        pendingCardIdRef.current = pendingCardId;
    }, [pendingCardId]);

    useEffect(() => {
        joinedRoomRef.current = joinedRoom;
    }, [joinedRoom]);

    useEffect(() => {
        viewRef.current = view;
    }, [view]);

    useEffect(() => {
        latestPlayersRef.current = players;
    }, [players]);

    useEffect(() => {
        openingTrickRef.current = isOpeningTrick;
    }, [isOpeningTrick]);

    const me = useMemo(() => {
        return players.find((p) => p.id === socket.id) || null;
    }, [players]);

    const myRankInfo = useMemo(() => {
        if (!me) return null;
        return winners.find((w) => w.id === me.id) || null;
    }, [me, winners]);

    const orderedPlayers = useMemo(() => {
        if (players.length === 0) return [];
        const myIndex = players.findIndex((p) => p.id === socket.id);
        if (myIndex === -1) return players;

        const reordered = [];
        for (let i = 0; i < players.length; i += 1) {
            reordered.push(players[(myIndex - i + players.length) % players.length]);
        }
        return reordered;
    }, [players]);

    const sortHand = useCallback((hand) => {
        const suitOrder = { Spades: 0, Hearts: 1, Diamonds: 2, Clubs: 3 };
        return [...hand].sort((a, b) => {
            if (suitOrder[a.name] !== suitOrder[b.name]) {
                return suitOrder[a.name] - suitOrder[b.name];
            }
            return a.val - b.val;
        });
    }, []);

    const getRankText = (rank) => {
        if (rank === 1) return '1st Winner';
        if (rank === 2) return '2nd Winner';
        if (rank === 3) return '3rd Winner';
        if (rank === 4) return 'Donkey';
        return 'Finished';
    };

    const resetGameState = useCallback(() => {
        setMyHand([]);
        setTable([]);
        setCurrentTurn(null);
        setCollectingPlayer(null);
        setDiscardedCount(0);
        setStriker(null);
        setWinners([]);
        setIsDealing(false);
        setIsSubmittingCard(false);
        setPendingCardId(null);
        setGameEnded(false);
        setFinalResults(null);
        setShowFinalPopup(false);
        setIsOpeningTrick(true);
        tempHandRef.current = [];
        hasDealtOnceRef.current = false;
        finalPlayersRef.current = [];
        finishHandledRef.current = false;
        openingTrickRef.current = true;
    }, []);

    useEffect(() => {
        if (playerName) {
            localStorage.setItem('donky_player_name', playerName);
        }
    }, [playerName]);

    useEffect(() => {
        const onConnect = () => setSocketReady(true);
        const onDisconnect = () => setSocketReady(false);

        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
        };
    }, []);

    useEffect(() => {
        const prepareAd = async () => {
            try {
                await AdMob.prepareInterstitial({
                    adId: 'ca-app-pub-8553625771070050/6609130205',
                    isTesting: false,
                });
                adPreparedRef.current = true;
            } catch {
                adPreparedRef.current = false;
            }
        };

        prepareAd();
    }, []);

    const showAdAndFinish = useCallback(async (data) => {
        if (finishHandledRef.current) return;
        finishHandledRef.current = true;

        const finalPlayers = data?.players?.length ? data.players : latestPlayersRef.current;
        finalPlayersRef.current = finalPlayers || [];

        const mergedData = {
            ...(data || {}),
            players: finalPlayersRef.current,
            winners: Array.isArray(data?.winners) ? data.winners : []
        };

        const finishNow = () => {
            setGameEnded(true);
            setFinalResults(mergedData);
            setWinners(mergedData.winners);
            setShowFinalPopup(true);

            if (typeof onFinish === 'function') {
                onFinish(mergedData);
            }
        };

        try {
            await AdMob.removeAllListeners();

            let handled = false;

            const safeFinish = () => {
                if (handled) return;
                handled = true;
                adPreparedRef.current = false;
                finishNow();
            };

            let failedListener;

            const dismissListener = await AdMob.addListener(
                InterstitialAdPluginEvents.Dismissed,
                async () => {
                    await dismissListener.remove();
                    if (failedListener) await failedListener.remove();
                    safeFinish();
                }
            );

            failedListener = await AdMob.addListener(
                InterstitialAdPluginEvents.FailedToLoad,
                async () => {
                    await dismissListener.remove();
                    await failedListener.remove();
                    safeFinish();
                }
            );

            if (!adPreparedRef.current) {
                await AdMob.prepareInterstitial({
                    adId: 'ca-app-pub-8553625771070050/6609130205',
                    isTesting: false,
                });
                adPreparedRef.current = true;
            }

            await AdMob.showInterstitial();
        } catch {
            finishNow();
        }
    }, [onFinish]);

    const showAdAndProceed = useCallback(async (callback) => {
        try {
            await AdMob.removeAllListeners();

            let failedListener;

            const dismissListener = await AdMob.addListener(
                InterstitialAdPluginEvents.Dismissed,
                async () => {
                    await dismissListener.remove();
                    if (failedListener) await failedListener.remove();
                    adPreparedRef.current = false;
                    callback();
                }
            );

            failedListener = await AdMob.addListener(
                InterstitialAdPluginEvents.FailedToLoad,
                async () => {
                    await dismissListener.remove();
                    await failedListener.remove();
                    callback();
                }
            );

            if (!adPreparedRef.current) {
                await AdMob.prepareInterstitial({
                    adId: 'ca-app-pub-8553625771070050/6609130205',
                    isTesting: false,
                });
                adPreparedRef.current = true;
            }

            await AdMob.showInterstitial();
        } catch {
            callback();
        }
    }, []);

    useEffect(() => {
        const onPlayersUpdated = (updated) => {
            setPlayers(updated || []);
        };

        const onRoomState = (data) => {
            if (data?.roomId) setJoinedRoom(data.roomId);
            if (data?.players) setPlayers(data.players);
            setView('LOBBY');
            setGameEnded(false);
            setFinalResults(null);
            setShowFinalPopup(false);
            setIsOpeningTrick(true);
            finishHandledRef.current = false;
            openingTrickRef.current = true;
        };

        const onRemovedFromRoom = (data) => {
            alert(data?.message || 'You were removed from the room');
            resetGameState();
            setJoinedRoom(null);
            setPlayers([]);
            setView('LOBBY');
        };

        const onYourCards = (cards = []) => {
            const sorted = sortHand(cards);
            tempHandRef.current = sorted;

            if (viewRef.current === 'BOARD') {
                setMyHand(sorted);
            }

            setPendingCardId(null);
            setIsSubmittingCard(false);
        };

        const onGameStarted = (data) => {
            resetGameState();
            const incomingPlayers = data?.players || [];
            setPlayers(incomingPlayers);
            setView('BOARD');
            setIsDealing(true);
            setIsOpeningTrick(true);
            openingTrickRef.current = true;

            setTimeout(() => {
                setIsDealing(false);
                setCurrentTurn(data?.currentTurn || null);
                hasDealtOnceRef.current = true;

                if (tempHandRef.current.length > 0) {
                    setMyHand([...tempHandRef.current]);
                } else if (joinedRoomRef.current) {
                    socket.emit('requestMyCards', { roomId: joinedRoomRef.current });
                }
            }, 2500);
        };

        const onGameUpdated = (data) => {
            if (gameEnded || finishHandledRef.current) return;

            setTable(data?.table || []);
            setCurrentTurn(data?.currentTurn ?? null);

            if (data?.players) setPlayers(data.players);
            if (typeof data?.discardedCount === 'number') setDiscardedCount(data.discardedCount);

            if ((data?.table || []).length > 0 && openingTrickRef.current) {
                setIsOpeningTrick(false);
                openingTrickRef.current = false;
            }

            const myPlayedCardOnTable = (data?.table || []).some(
                (c) => c.playedBy === socket.id && c.id === pendingCardIdRef.current
            );

            if (myPlayedCardOnTable && pendingCardIdRef.current) {
                setMyHand((prev) => prev.filter((c) => c.id !== pendingCardIdRef.current));
                tempHandRef.current = tempHandRef.current.filter((c) => c.id !== pendingCardIdRef.current);
                setPendingCardId(null);
                setIsSubmittingCard(false);
            }
        };

        const onStrikeOccurred = (data) => {
            if (gameEnded || finishHandledRef.current) return;

            setTable(data?.table || []);
            setStriker(data?.loser || null);
            setCollectingPlayer(data?.loser || null);

            if (data?.players) setPlayers(data.players);

            if ((data?.table || []).length > 0 && openingTrickRef.current) {
                setIsOpeningTrick(false);
                openingTrickRef.current = false;
            }

            if (socket.id === data?.loser && data?.updatedHand) {
                const sorted = sortHand(data.updatedHand);
                tempHandRef.current = sorted;
                setMyHand(sorted);
            } else if (pendingCardIdRef.current) {
                setMyHand((prev) => prev.filter((c) => c.id !== pendingCardIdRef.current));
                tempHandRef.current = tempHandRef.current.filter((c) => c.id !== pendingCardIdRef.current);
            }

            setPendingCardId(null);
            setIsSubmittingCard(false);

            setTimeout(() => {
                setTable([]);
                setCollectingPlayer(null);
                setStriker(null);
                setCurrentTurn(data?.nextTurn ?? null);
            }, 1500);
        };

        const onRoundComplete = (data) => {
            if (gameEnded || finishHandledRef.current) return;

            setTable(data?.table || []);
            setCollectingPlayer('DISCARD');

            if (data?.players) setPlayers(data.players);

            if ((data?.table || []).length > 0 && openingTrickRef.current) {
                setIsOpeningTrick(false);
                openingTrickRef.current = false;
            }

            if (pendingCardIdRef.current) {
                setMyHand((prev) => prev.filter((c) => c.id !== pendingCardIdRef.current));
                tempHandRef.current = tempHandRef.current.filter((c) => c.id !== pendingCardIdRef.current);
            }

            setPendingCardId(null);
            setIsSubmittingCard(false);

            setTimeout(() => {
                if (typeof data?.discardedCount === 'number') {
                    setDiscardedCount(data.discardedCount);
                } else {
                    setDiscardedCount((prev) => prev + (data?.table?.length || 0));
                }

                setTable([]);
                setCollectingPlayer(null);
                setCurrentTurn(data?.nextTurn ?? null);
            }, 1200);
        };

        const onWinnersUpdated = (serverWinners) => {
            if (finishHandledRef.current) return;
            setWinners(serverWinners || []);
            setPendingCardId(null);
            setIsSubmittingCard(false);
        };

        const onGameFinished = (data) => {
            if (finishHandledRef.current) return;

            setCurrentTurn(null);
            setIsSubmittingCard(false);
            setPendingCardId(null);
            showAdAndFinish(data);
        };

        socket.on('playersUpdated', onPlayersUpdated);
        socket.on('roomState', onRoomState);
        socket.on('removedFromRoom', onRemovedFromRoom);
        socket.on('yourCards', onYourCards);
        socket.on('gameStarted', onGameStarted);
        socket.on('gameUpdated', onGameUpdated);
        socket.on('strikeOccurred', onStrikeOccurred);
        socket.on('roundComplete', onRoundComplete);
        socket.on('winnersUpdated', onWinnersUpdated);
        socket.on('gameFinished', onGameFinished);

        return () => {
            socket.off('playersUpdated', onPlayersUpdated);
            socket.off('roomState', onRoomState);
            socket.off('removedFromRoom', onRemovedFromRoom);
            socket.off('yourCards', onYourCards);
            socket.off('gameStarted', onGameStarted);
            socket.off('gameUpdated', onGameUpdated);
            socket.off('strikeOccurred', onStrikeOccurred);
            socket.off('roundComplete', onRoundComplete);
            socket.off('winnersUpdated', onWinnersUpdated);
            socket.off('gameFinished', onGameFinished);
        };
    }, [resetGameState, showAdAndFinish, sortHand, gameEnded]);

    const isCardEligible = (card) => {
        const myId = me?.id || socket.id;

        if (gameEnded) return false;
        if (isSubmittingCard) return false;
        if (myId !== currentTurn || isDealing) return false;

        if (table.length === 0 && openingTrickRef.current) {
            return card.symbol === '♠' && card.label === 'A';
        }

        if (table.length === 0) return true;

        const leadSuit = table[0].symbol;
        const hasLeadSuit = myHand.some((c) => c.symbol === leadSuit);
        return hasLeadSuit ? card.symbol === leadSuit : true;
    };

    const handleCreateRoom = () => {
        if (creatingRoom) return;
        if (!playerName.trim()) {
            alert('Enter your name');
            return;
        }
        if (!socket.connected) {
            alert('Server not connected');
            return;
        }

        setCreatingRoom(true);

        socket.emit('createRoom', { playerName: playerName.trim() }, (res) => {
            setCreatingRoom(false);

            if (typeof res === 'string' && res.trim()) {
                setJoinedRoom(res);
                return;
            }

            if (res?.success && res?.roomId) {
                setJoinedRoom(res.roomId);
                return;
            }

            if (res?.roomId) {
                setJoinedRoom(res.roomId);
                return;
            }

            alert(res?.message || 'Room creation failed');
        });
    };

    const handleJoinRoom = () => {
        if (joiningRoom) return;

        if (!playerName.trim() || !roomId.trim()) {
            alert('Details required!');
            return;
        }

        if (!socket.connected) {
            alert('Server not connected');
            return;
        }

        setJoiningRoom(true);

        socket.emit(
            'joinRoom',
            {
                roomId: roomId.toUpperCase(),
                playerName: playerName.trim(),
            },
            (res) => {
                setJoiningRoom(false);

                if (res?.success) {
                    setJoinedRoom(roomId.toUpperCase());
                } else {
                    alert(res?.message || 'Unable to join room');
                }
            }
        );
    };

    const handleStartMatch = () => {
        if (!joinedRoom) return;
        finishHandledRef.current = false;
        setGameEnded(false);
        setFinalResults(null);
        setShowFinalPopup(false);
        setIsOpeningTrick(true);
        openingTrickRef.current = true;
        socket.emit('startGame', { roomId: joinedRoom });
    };

    const handleRemovePlayer = (playerId) => {
        if (!joinedRoom || !me?.host || playerId === socket.id) return;

        const targetPlayer = players.find((p) => p.id === playerId);
        const confirmRemove = window.confirm(
            `Are you sure you want to remove ${targetPlayer?.name || 'this player'} from the group?`
        );

        if (!confirmRemove) return;

        socket.emit(
            'removePlayer',
            {
                roomId: joinedRoom,
                targetPlayerId: playerId,
            },
            (res) => {
                if (res?.success === false) {
                    alert(res?.message || 'Unable to remove player');
                    return;
                }

                socket.emit('requestRoomState', { roomId: joinedRoom });
            }
        );
    };

    const playCard = (card) => {
        if (gameEnded || finishHandledRef.current) return;
        if (!isCardEligible(card) || !joinedRoom || isDealing || isSubmittingCard) return;

        if (table.length === 0 && openingTrickRef.current) {
            setIsOpeningTrick(false);
            openingTrickRef.current = false;
        }

        setIsSubmittingCard(true);
        setPendingCardId(card.id);

        const previousHand = [...myHand];
        const nextHand = previousHand.filter((c) => c.id !== card.id);

        setMyHand(nextHand);
        tempHandRef.current = nextHand;

        socket.emit('playCard', { roomId: joinedRoom, card }, (response) => {
            if (response && response.success === false) {
                setMyHand(previousHand);
                tempHandRef.current = previousHand;
                setIsSubmittingCard(false);
                setPendingCardId(null);

                if (table.length === 0) {
                    setIsOpeningTrick(true);
                    openingTrickRef.current = true;
                }

                alert(response.message || 'Invalid move');
            }
        });

        setTimeout(() => {
            if (pendingCardIdRef.current === card.id && !gameEnded && !finishHandledRef.current) {
                setIsSubmittingCard(false);
                setPendingCardId(null);
            }
        }, 2500);
    };

    const returnToLobby = () => {
        setView('LOBBY');
        setMyHand([]);
        setTable([]);
        setCurrentTurn(null);
        setCollectingPlayer(null);
        setDiscardedCount(0);
        setStriker(null);
        setWinners([]);
        setIsDealing(false);
        setIsSubmittingCard(false);
        setPendingCardId(null);
        setGameEnded(false);
        setFinalResults(null);
        setShowFinalPopup(false);
        setIsOpeningTrick(true);

        tempHandRef.current = [];
        hasDealtOnceRef.current = false;
        finalPlayersRef.current = [];
        finishHandledRef.current = false;
        openingTrickRef.current = true;

        if (joinedRoom) {
            socket.emit('returnToLobby', { roomId: joinedRoom });
            setTimeout(() => {
                socket.emit('requestRoomState', { roomId: joinedRoom });
            }, 300);
        }
    };

    const handleBackClick = () => {
        showAdAndProceed(() => {
            onBack();
        });
    };

    const MultiplayerBoard = () => (
        <div className="w-100 h-100 position-relative overflow-hidden bg-black">
            <div
                className="position-absolute top-0 w-100 d-flex justify-content-between align-items-center px-3"
                style={{ zIndex: 9999, paddingTop: 'calc(env(safe-area-inset-top) + 10px)', pointerEvents: 'none' }}
            >
                <button
                    className="btn btn-sm text-white bg-dark bg-opacity-75 rounded-circle p-2 shadow-lg"
                    onClick={handleBackClick}
                    style={{ pointerEvents: 'auto', width: '45px', height: '45px', border: '1px solid rgba(255,255,255,0.2)' }}
                >
                    <ArrowLeft size={28} />
                </button>

                <div className="bg-warning text-dark px-3 py-2 rounded-pill fw-bold shadow-sm" style={{ pointerEvents: 'auto', fontSize: '0.8rem' }}>
                    Discarded: {discardedCount}
                </div>
            </div>

            {orderedPlayers.map((p, i) => {
                if (i === 0) return null;

                const pos = i === 1 ? 'p2' : i === 2 ? 'p3' : 'p4';
                const posClass =
                    i === 2
                        ? 'top-0 start-50 translate-middle-x mt-5 pt-4'
                        : i === 1
                            ? 'start-0 top-50 translate-middle-y ms-2'
                            : 'end-0 top-50 translate-middle-y me-2';

                return (
                    <div key={p.id} className={`position-absolute ${posClass}`} style={{ zIndex: 1500 }}>
                        <div className="position-relative">
                            <PlayerSlot
                                pos={pos}
                                name={p.name}
                                count={p.handCount ?? 0}
                                isTurn={currentTurn === p.id}
                                winnerInfo={winners.find((w) => w.id === p.id)}
                                isStriker={striker === p.id}
                            />

                            <div className="position-absolute" style={{ top: '-5px', right: '-5px', zIndex: 1600 }}>
                                {p.isConnected !== false ? (
                                    <div
                                        className="bg-success rounded-circle d-flex align-items-center justify-content-center shadow-lg border border-2 border-dark"
                                        style={{ width: '22px', height: '22px' }}
                                    >
                                        <CheckCircle2 size={14} className="text-white" />
                                    </div>
                                ) : (
                                    <div
                                        className="bg-danger rounded-circle d-flex align-items-center justify-content-center shadow-lg border border-2 border-dark"
                                        style={{ width: '22px', height: '22px' }}
                                    >
                                        <XCircle size={14} className="text-white" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                );
            })}

            <div
                className="position-absolute top-50 start-50 translate-middle rounded-circle shadow-lg"
                style={{
                    width: '300px',
                    height: '300px',
                    background: 'radial-gradient(circle, #1a4d2e 0%, #050a06 100%)',
                    zIndex: 100,
                    border: '4px solid rgba(255,255,255,0.1)',
                }}
            >
                <div className="d-flex h-100 justify-content-center align-items-center position-relative">
                    <AnimatePresence initial={false}>
                        {table.map((c, idx) => {
                            const pOrderIdx = orderedPlayers.findIndex((p) => p.id === c.playedBy);
                            const slots = [
                                { y: 65, x: 0 },
                                { x: -65, y: 0 },
                                { y: -65, x: 0 },
                                { x: 65, y: 0 },
                            ];
                            const pPos = slots[pOrderIdx] || { x: 0, y: 0 };

                            let exX = 0;
                            let exY = 0;

                            if (collectingPlayer === 'DISCARD') {
                                exX = 150;
                                exY = -450;
                            } else if (collectingPlayer) {
                                const lIdx = orderedPlayers.findIndex((p) => p.id === collectingPlayer);
                                if (lIdx === 0) exY = 450;
                                if (lIdx === 1) exX = -450;
                                if (lIdx === 2) exY = -450;
                                if (lIdx === 3) exX = 450;
                            }

                            return (
                                <motion.div
                                    key={c.id}
                                    initial={{ scale: 0.5, opacity: 0, y: pOrderIdx === 0 ? 150 : 0 }}
                                    animate={{ x: pPos.x, y: pPos.y, scale: 1, opacity: 1 }}
                                    exit={{ x: exX, y: exY, scale: 0, opacity: 0 }}
                                    transition={{ type: 'spring', stiffness: 300, damping: 25 }}
                                    className="position-absolute"
                                    style={{ zIndex: 500 + idx }}
                                >
                                    <CardView card={c} isInteractive={false} />
                                </motion.div>
                            );
                        })}
                    </AnimatePresence>
                </div>
            </div>

            <div
                className="position-absolute bottom-0 w-100 p-2 bg-dark bg-opacity-95 shadow-lg d-flex flex-column align-items-center justify-content-center"
                style={{
                    zIndex: 2000,
                    minHeight: '190px',
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 20px)',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(25, 135, 84, 0.4)',
                }}
            >
                {showFinalPopup && myRankInfo ? (
                    <div className="text-center py-2">
                        <Trophy size={45} className="text-warning mb-1" />
                        <div className="text-warning fw-bold h5">{getRankText(myRankInfo.rank)}</div>
                    </div>
                ) : (
                    <>
                        <div
                            className={`mb-2 px-4 py-2 rounded-pill fw-black shadow-lg d-flex align-items-center gap-2 ${gameEnded
                                ? 'bg-warning text-dark'
                                : isSubmittingCard
                                    ? 'bg-info text-dark'
                                    : me?.id === currentTurn
                                        ? 'bg-success text-white border border-white border-opacity-25 animate-pulse'
                                        : 'bg-secondary text-white opacity-40'
                                }`}
                            style={{ fontSize: '0.75rem', letterSpacing: '1px', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            {gameEnded ? (
                                <>
                                    <Trophy size={16} className="text-dark" />
                                    <span>MATCH FINISHED</span>
                                </>
                            ) : isSubmittingCard ? (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>PLAYING...</span>
                                </>
                            ) : me?.id === currentTurn ? (
                                <>
                                    <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                                        <Crown size={16} className="text-warning" />
                                    </motion.div>
                                    <span>YOUR TURN</span>
                                </>
                            ) : (
                                <>
                                    <Loader2 size={16} className="animate-spin" />
                                    <span>WAITING...</span>
                                </>
                            )}
                        </div>

                        <div className="d-flex flex-column align-items-center mb-2">
                            <span className="x-small fw-black text-success text-uppercase tracking-widest">
                                You ({playerName})
                            </span>
                            <span className="p-1 px-3 mt-1 rounded-pill small fw-bold bg-secondary bg-opacity-20 text-white">
                                HAND: {myHand.length}
                            </span>
                        </div>

                        <div className="d-flex justify-content-center align-items-end" style={{ height: '100px', width: '100%', position: 'relative' }}>
                            {myHand.map((c, i) => {
                                const eligible = isCardEligible(c);
                                const overlap =
                                    myHand.length * 58 > window.innerWidth - 40
                                        ? (myHand.length * 58 - (window.innerWidth - 40)) / (myHand.length - 1 || 1)
                                        : 0;

                                return (
                                    <motion.div
                                        key={c.id}
                                        initial={hasDealtOnceRef.current ? false : { y: -250, opacity: 0 }}
                                        animate={{
                                            y: eligible ? -30 : 0,
                                            scale: pendingCardId === c.id ? 0.95 : 1,
                                            opacity: pendingCardId === c.id ? 0.35 : 1,
                                        }}
                                        transition={{
                                            delay: !hasDealtOnceRef.current && isDealing ? i * 0.08 : 0,
                                            type: 'spring',
                                            stiffness: 300,
                                            damping: 20,
                                        }}
                                        style={{
                                            marginLeft: i === 0 ? 0 : -overlap,
                                            zIndex: eligible ? 300 + i : 200 + i,
                                            opacity: pendingCardId === c.id ? 0.35 : me?.id === currentTurn && !eligible ? 0.5 : 1,
                                            pointerEvents: pendingCardId || gameEnded ? 'none' : 'auto',
                                        }}
                                    >
                                        <CardView card={c} isInteractive={eligible && !isSubmittingCard && !gameEnded} onClick={() => playCard(c)} />
                                    </motion.div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>

            <AnimatePresence>
                {showFinalPopup && myRankInfo ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="position-absolute top-50 start-50 translate-middle bg-dark p-5 rounded-5 border-warning border-2 text-center shadow-2xl"
                        style={{ zIndex: 9000, width: '80%' }}
                    >
                        <Trophy size={80} className="text-warning mb-3 mx-auto" />
                        <h1 className="text-white fw-black mb-1">FINISHED!</h1>
                        <p className="text-warning fw-bold h4">{getRankText(myRankInfo.rank)}</p>

                        {finalResults?.winners?.length ? (
                            <div className="mt-3 mb-2 text-start">
                                {finalResults.winners.map((w, idx) => {
                                    const player = (finalResults?.players || finalPlayersRef.current || []).find((p) => p.id === w.id);
                                    return (
                                        <div
                                            key={w.id || idx}
                                            className="d-flex justify-content-between align-items-center text-white small py-1 border-bottom border-secondary border-opacity-25"
                                        >
                                            <span>{player?.name || w.id || 'Player'}</span>
                                            <span className="text-warning fw-bold">{getRankText(w.rank)}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        ) : null}

                        <button className="btn btn-success mt-4 w-100 rounded-pill fw-black py-3 shadow-lg" onClick={returnToLobby}>
                            RESTART MATCH
                        </button>
                    </motion.div>
                ) : null}
            </AnimatePresence>

            <style>{`
                .fw-black { font-weight: 900; }
                .x-small { font-size: 0.65rem; }
                .animate-pulse { animation: pulse 2s infinite; }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.7; }
                }
            `}</style>
        </div>
    );

    return (
        <div className="vh-100 w-100 overflow-hidden" style={{ background: '#050a06' }}>
            <AnimatePresence mode="wait">
                {view === 'LOBBY' ? (
                    <motion.div
                        key="lobby"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="vh-100 d-flex align-items-center justify-content-center p-3"
                    >
                        <div
                            className="card bg-dark border-0 shadow-2xl p-4 text-white rounded-5 w-100"
                            style={{ maxWidth: '420px', background: 'rgba(15, 20, 15, 0.98)', border: '1px solid rgba(25, 135, 84, 0.2)' }}
                        >
                            <div className="text-center mb-4 border-bottom border-secondary border-opacity-20 pb-3">
                                <div className="d-flex align-items-center justify-content-between">
                                    <button className="btn btn-link text-secondary p-0" onClick={onBack}>
                                        <ArrowLeft size={24} />
                                    </button>
                                    <h5 className="text-uppercase fw-black m-0 tracking-widest text-success">MULTIPLAYER</h5>
                                    <div style={{ width: 24 }} />
                                </div>
                            </div>

                            <div className={`small text-center mb-3 fw-bold ${socketReady ? 'text-success' : 'text-danger'}`}>
                                {socketReady ? 'Server Connected' : 'Server Disconnected'}
                            </div>

                            {!joinedRoom ? (
                                <>
                                    <div className="position-relative mb-3">
                                        <input
                                            className="form-control bg-black text-white py-3 ps-5 border-secondary rounded-4 shadow-none"
                                            placeholder="Your Name"
                                            value={playerName}
                                            onChange={(e) => setPlayerName(e.target.value)}
                                        />
                                        <Edit3 size={18} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary" />
                                    </div>

                                    <button
                                        className="btn btn-success w-100 py-3 mb-3 rounded-4 fw-bold"
                                        onClick={handleCreateRoom}
                                        disabled={creatingRoom || !socketReady}
                                    >
                                        {creatingRoom ? (
                                            'CREATING ROOM...'
                                        ) : (
                                            <>
                                                <PlusCircle size={20} className="me-2" />
                                                CREATE ROOM
                                            </>
                                        )}
                                    </button>

                                    <div className="text-center text-secondary small mb-3 fw-bold opacity-50">--- OR JOIN ---</div>

                                    <input
                                        className="form-control mb-3 bg-black text-white py-3 border-secondary rounded-4 text-center fw-black tracking-widest"
                                        placeholder="CODE"
                                        value={roomId}
                                        onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                                    />

                                    <button
                                        disabled={joiningRoom || !socketReady}
                                        className="btn btn-outline-primary w-100 py-3 rounded-4 fw-bold"
                                        onClick={handleJoinRoom}
                                    >
                                        {joiningRoom ? (
                                            'JOINING...'
                                        ) : (
                                            <>
                                                <LogIn size={20} className="me-2" />
                                                JOIN MATCH
                                            </>
                                        )}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="p-4 rounded-4 bg-black border border-success border-opacity-20 mb-4">
                                        <span className="small text-secondary d-block mb-1">ROOM CODE</span>
                                        <div className="d-flex align-items-center justify-content-center gap-2">
                                            <h2 className="m-0 text-white fw-black tracking-widest">{joinedRoom}</h2>
                                            <Copy
                                                size={18}
                                                className="text-secondary cursor-pointer"
                                                onClick={() => {
                                                    navigator.clipboard.writeText(joinedRoom);
                                                    setCopied(true);
                                                    setTimeout(() => setCopied(false), 2000);
                                                }}
                                            />
                                            {copied ? <CheckCircle2 size={16} className="text-success" /> : null}
                                        </div>
                                    </div>

                                    <div className="d-flex flex-column gap-2 mb-4">
                                        {players.map((p) => (
                                            <div key={p.id} className="p-3 bg-white bg-opacity-5 rounded-4 d-flex align-items-center justify-content-between">
                                                <div className="d-flex align-items-center gap-2">
                                                    {p.host ? <Crown size={18} className="text-warning" /> : <User size={18} className="text-success" />}
                                                    <span className="fw-bold text-dark">
                                                        {p.name} {p.id === socket.id ? '(You)' : ''}
                                                    </span>
                                                </div>

                                                <div className="d-flex align-items-center gap-2">
                                                    {p.isConnected !== false ? (
                                                        <CheckCircle2 size={16} className="text-success" />
                                                    ) : (
                                                        <XCircle size={16} className="text-danger" />
                                                    )}

                                                    {me?.host && p.id !== socket.id ? (
                                                        <button
                                                            className="btn btn-sm btn-outline-danger rounded-pill px-2 py-1"
                                                            onClick={() => handleRemovePlayer(p.id)}
                                                        >
                                                            Remove
                                                        </button>
                                                    ) : null}
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <button
                                        disabled={players.length < 2 || !players.find((p) => p.host && p.id === socket.id)}
                                        className="btn btn-success btn-lg w-100 py-3 rounded-pill fw-black"
                                        onClick={handleStartMatch}
                                    >
                                        START MATCH
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="board"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="h-100"
                    >
                        <MultiplayerBoard />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}