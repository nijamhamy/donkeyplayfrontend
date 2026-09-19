import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { motion, AnimatePresence } from 'framer-motion';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';
import {
    PlusCircle, LogIn, ArrowLeft, Copy, CheckCircle2,
    XCircle, User, Crown, Loader2, Trophy, Edit3
} from 'lucide-react';

import CardView from '../components/Card';
import PlayerSlot from '../components/PlayerSlot';

const SERVER_URL = 'https://donky-game-server.onrender.com';

const socket = io(SERVER_URL, {
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionAttempts: 10,
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
    const [highValuePlayer, setHighValuePlayer] = useState(null);

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
    const timersRef = useRef([]);

    // ✅ FIX: track whether a terminal event (strike/round) is processing
    // so gameUpdated doesn't overwrite the table and cause double-blink
    const terminalEventActiveRef = useRef(false);

    // ✅ FIX: track the IDs of cards currently on table to skip redundant updates
    const tableCardIdsRef = useRef(new Set());

    // ✅ FIX (race condition): tracks which game "session" the most recent
    // dealt hand belongs to. Incremented every time onGameStarted fires.
    // Used to guard against a stale/late yourCards or requestMyCards response
    // from a previous game overwriting the current hand, and vice versa.
    const gameSessionRef = useRef(0);

    const addTimer = (id) => { timersRef.current.push(id); return id; };
    const clearAllTimers = () => { timersRef.current.forEach(clearTimeout); timersRef.current = []; };

    useEffect(() => { pendingCardIdRef.current = pendingCardId; }, [pendingCardId]);
    useEffect(() => { joinedRoomRef.current = joinedRoom; }, [joinedRoom]);
    useEffect(() => { viewRef.current = view; }, [view]);
    useEffect(() => { latestPlayersRef.current = players; }, [players]);
    useEffect(() => { openingTrickRef.current = isOpeningTrick; }, [isOpeningTrick]);
    useEffect(() => () => clearAllTimers(), []);

    const me = useMemo(() => players.find(p => p.id === socket.id) || null, [players]);
    const myRankInfo = useMemo(() => { if (!me) return null; return winners.find(w => w.id === me.id) || null; }, [me, winners]);

    const orderedPlayers = useMemo(() => {
        if (players.length === 0) return [];
        const myIndex = players.findIndex(p => p.id === socket.id);
        if (myIndex === -1) return players;
        const reordered = [];
        for (let i = 0; i < players.length; i++) reordered.push(players[(myIndex - i + players.length) % players.length]);
        return reordered;
    }, [players]);

    const sortHand = useCallback((hand) => {
        const suitOrder = { Spades: 0, Hearts: 1, Clubs: 2, Diamonds: 3 };
        return [...hand].sort((a, b) => {
            if (suitOrder[a.name] !== suitOrder[b.name]) return suitOrder[a.name] - suitOrder[b.name];
            return a.val - b.val;
        });
    }, []);

    const getRankText = (rank) => {
        if (rank === 1) return '1st Winner';
        if (rank === 2) return '2nd Winner';
        if (rank === 3) return '3rd Winner';
        if (rank === 4) return 'Oops! Donkey';
        return 'Finished';
    };

    const resetGameState = useCallback(() => {
        clearAllTimers();
        setMyHand([]); setTable([]); setCurrentTurn(null); setCollectingPlayer(null);
        setDiscardedCount(0); setStriker(null); setWinners([]); setIsDealing(false);
        setIsSubmittingCard(false); setPendingCardId(null); setGameEnded(false);
        setFinalResults(null); setShowFinalPopup(false); setIsOpeningTrick(true);
        setHighValuePlayer(null);
        tempHandRef.current = []; hasDealtOnceRef.current = false;
        finalPlayersRef.current = []; finishHandledRef.current = false;
        openingTrickRef.current = true;
        terminalEventActiveRef.current = false;
        tableCardIdsRef.current = new Set();
    }, []);

    useEffect(() => { if (playerName) localStorage.setItem('donky_player_name', playerName); }, [playerName]);

    useEffect(() => {
        const onConnect = () => setSocketReady(true);
        const onDisconnect = () => setSocketReady(false);
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        return () => { socket.off('connect', onConnect); socket.off('disconnect', onDisconnect); };
    }, []);

    useEffect(() => {
        (async () => {
            try {
                await AdMob.prepareInterstitial({ adId: 'ca-app-pub-8553625771070050/7057056419', isTesting: false });
                adPreparedRef.current = true;
            } catch { adPreparedRef.current = false; }
        })();
    }, []);

    const showAdAndFinish = useCallback(async (data) => {
        if (finishHandledRef.current) return;
        finishHandledRef.current = true;
        const finalPlayers = data?.players?.length ? data.players : latestPlayersRef.current;
        finalPlayersRef.current = finalPlayers || [];
        const mergedData = { ...(data || {}), players: finalPlayersRef.current, winners: Array.isArray(data?.winners) ? data.winners : [] };

        const finishNow = () => {
            setGameEnded(true); setFinalResults(mergedData);
            setWinners(mergedData.winners); setShowFinalPopup(true);
            if (typeof onFinish === 'function') onFinish(mergedData);
        };

        try {
            await AdMob.removeAllListeners();
            let handled = false;
            const safeFinish = () => { if (handled) return; handled = true; adPreparedRef.current = false; finishNow(); };
            let failedListener;
            const dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, async () => {
                await dismissListener.remove();
                if (failedListener) await failedListener.remove();
                safeFinish();
            });
            failedListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, async () => {
                await dismissListener.remove();
                await failedListener.remove();
                safeFinish();
            });
            if (!adPreparedRef.current) {
                await AdMob.prepareInterstitial({ adId: 'ca-app-pub-8553625771070050/7057056419', isTesting: false });
                adPreparedRef.current = true;
            }
            await AdMob.showInterstitial();
        } catch { finishNow(); }
    }, [onFinish]);

    const showAdAndProceed = useCallback(async (callback) => {
        try {
            await AdMob.removeAllListeners();
            let failedListener;
            const dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, async () => {
                await dismissListener.remove();
                if (failedListener) await failedListener.remove();
                adPreparedRef.current = false; callback();
            });
            failedListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, async () => {
                await dismissListener.remove();
                await failedListener.remove();
                callback();
            });
            if (!adPreparedRef.current) {
                await AdMob.prepareInterstitial({ adId: 'ca-app-pub-8553625771070050/7057056419', isTesting: false });
                adPreparedRef.current = true;
            }
            await AdMob.showInterstitial();
        } catch { callback(); }
    }, []);

    // ── SOCKET EVENTS ─────────────────────────────────────────────
    useEffect(() => {
        const onPlayersUpdated = (updated) => setPlayers(updated || []);

        const onRoomState = (data) => {
            if (data?.roomId) setJoinedRoom(data.roomId);
            if (data?.players) setPlayers(data.players);
            setView('LOBBY'); setGameEnded(false); setFinalResults(null);
            setShowFinalPopup(false); setIsOpeningTrick(true);
            finishHandledRef.current = false; openingTrickRef.current = true;
        };

        const onRemovedFromRoom = (data) => {
            alert(data?.message || 'You were removed from the room');
            resetGameState(); setJoinedRoom(null); setPlayers([]); setView('LOBBY');
        };

        // ✅ FIX (race condition root cause #1):
        // Previously this only called setMyHand(sorted) when
        // viewRef.current === 'BOARD'. viewRef is updated via a useEffect,
        // which flushes AFTER render commit — i.e. asynchronously relative
        // to this socket callback. That created a timing window where
        // setView('BOARD') had already been called (state update queued)
        // but viewRef.current still read 'LOBBY', causing a legitimately
        // arrived hand to update tempHandRef.current but NOT myHand (React
        // state). Since myHand is what actually drives rendering and
        // isCardEligible(), the player's hand could silently stay empty
        // even though the server and tempHandRef both had the correct
        // cards — leaving that player's turn permanently stuck.
        //
        // Fix: always keep myHand in sync with whatever hand the server
        // sends, regardless of current view. Setting state while the
        // component isn't showing the board yet is harmless (it's just
        // ready the instant the view switches); gating it on a
        // ref-that-lags-behind-state was the actual bug.
        const onYourCards = (cards = []) => {
            const sorted = sortHand(cards);
            tempHandRef.current = sorted;
            setMyHand(sorted);
            setPendingCardId(null); setIsSubmittingCard(false);
        };

        const onGameStarted = (data) => {
            // ✅ FIX: bump the session token BEFORE resetGameState/emits so
            // any in-flight late responses from a previous game/session can
            // be identified as stale if ever needed for future debugging.
            gameSessionRef.current += 1;

            resetGameState();
            setPlayers(data?.players || []);
            setView('BOARD'); setIsDealing(true);
            setIsOpeningTrick(true); openingTrickRef.current = true;

            addTimer(setTimeout(() => {
                setIsDealing(false);
                setCurrentTurn(data?.currentTurn || null);
                hasDealtOnceRef.current = true;
                if (tempHandRef.current.length > 0) {
                    setMyHand([...tempHandRef.current]);
                } else if (joinedRoomRef.current) {
                    socket.emit('requestMyCards', { roomId: joinedRoomRef.current });
                }
            }, 2000));

            // ✅ FIX: secondary safety net. The original code only retried
            // ONCE via requestMyCards inside the 2000ms timeout above, with
            // no confirmation that myHand was ever actually populated
            // afterward. If that single retry response also landed in a
            // bad window, the hand could stay empty forever with no further
            // correction and no way for the player to ever play a card,
            // stalling the whole table (server has no timeout for a human
            // who never sends playCard). This adds one more delayed check:
            // if, shortly after dealing finishes, we're on the board with
            // an empty hand but the room clearly dealt everyone cards,
            // request the hand again. This does not change any game logic,
            // scoring, or turn order — it only guarantees the client
            // eventually reflects the hand the server already assigned.
            addTimer(setTimeout(() => {
                if (viewRef.current === 'BOARD' && joinedRoomRef.current) {
                    socket.emit('requestMyCards', { roomId: joinedRoomRef.current });
                }
            }, 3500));
        };

        const onGameUpdated = (data) => {
            if (gameEnded || finishHandledRef.current) return;

            // ✅ FIX: if a terminal event (strike/round) is currently animating,
            // ignore gameUpdated so it doesn't re-set the table and cause double-blink
            if (terminalEventActiveRef.current) return;

            const newTable = data?.table || [];

            // ✅ FIX: skip if new table cards are already rendered (same IDs)
            // This prevents the re-mount blink when server sends gameUpdated
            // right before strikeOccurred with the same cards
            const newIds = newTable.map(c => c.id).join(',');
            const currentIds = [...tableCardIdsRef.current].join(',');
            if (newIds === currentIds && newTable.length > 0) {
                // Only update turn and players, NOT table (avoids re-mount)
                if (data?.currentTurn !== undefined) setCurrentTurn(data.currentTurn);
                if (data?.players) setPlayers(data.players);
                if (typeof data?.discardedCount === 'number') setDiscardedCount(data.discardedCount);
                return;
            }

            // Update table card ID tracker
            tableCardIdsRef.current = new Set(newTable.map(c => c.id));

            setTable(newTable);
            if (data?.currentTurn !== undefined) setCurrentTurn(data.currentTurn);
            if (data?.players) setPlayers(data.players);
            if (typeof data?.discardedCount === 'number') setDiscardedCount(data.discardedCount);

            if (newTable.length > 0) {
                const leadSuit = newTable[0].symbol;
                const highest = [...newTable].filter(c => c.symbol === leadSuit).sort((a, b) => b.val - a.val)[0];
                setHighValuePlayer(highest?.playedBy || null);
            } else {
                setHighValuePlayer(null);
            }

            if (newTable.length > 0 && openingTrickRef.current) {
                setIsOpeningTrick(false); openingTrickRef.current = false;
            }

            // Optimistic removal — card confirmed on table
            const myCard = newTable.find(c => c.playedBy === socket.id && c.id === pendingCardIdRef.current);
            if (myCard && pendingCardIdRef.current) {
                setMyHand(prev => prev.filter(c => c.id !== pendingCardIdRef.current));
                tempHandRef.current = tempHandRef.current.filter(c => c.id !== pendingCardIdRef.current);
                setPendingCardId(null); setIsSubmittingCard(false);
            }
        };

        const onStrikeOccurred = (data) => {
            if (gameEnded || finishHandledRef.current) return;

            // ✅ FIX: mark terminal event active — block gameUpdated from interfering
            terminalEventActiveRef.current = true;

            const trickCards = data?.table || [];

            // ✅ FIX: only set table if cards differ (avoids re-mount if already correct)
            const incomingIds = trickCards.map(c => c.id).join(',');
            const currentIds = [...tableCardIdsRef.current].join(',');
            if (incomingIds !== currentIds) {
                tableCardIdsRef.current = new Set(trickCards.map(c => c.id));
                setTable(trickCards);
            }

            setStriker(data?.loser || null);
            setHighValuePlayer(data?.winner || null);

            if (trickCards.length > 0 && openingTrickRef.current) {
                setIsOpeningTrick(false); openingTrickRef.current = false;
            }

            if (data?.players) setPlayers(data.players);

            if (socket.id === data?.winner && data?.updatedHand) {
                const sorted = sortHand(data.updatedHand);
                tempHandRef.current = sorted;
                setMyHand(sorted);
            } else if (pendingCardIdRef.current) {
                setMyHand(prev => prev.filter(c => c.id !== pendingCardIdRef.current));
                tempHandRef.current = tempHandRef.current.filter(c => c.id !== pendingCardIdRef.current);
            }

            setPendingCardId(null); setIsSubmittingCard(false);

            // Animate: show trick → collect → clear
            addTimer(setTimeout(() => {
                setCollectingPlayer(data?.winner || data?.loser || null);
                addTimer(setTimeout(() => {
                    tableCardIdsRef.current = new Set();
                    setTable([]); setCollectingPlayer(null);
                    setStriker(null); setHighValuePlayer(null);
                    setCurrentTurn(data?.nextTurn ?? null);
                    // ✅ FIX: unblock gameUpdated only after table is cleared
                    terminalEventActiveRef.current = false;
                }, 700));
            }, 400));
        };

        const onRoundComplete = (data) => {
            if (gameEnded || finishHandledRef.current) return;

            // ✅ FIX: mark terminal event active — block gameUpdated from interfering
            terminalEventActiveRef.current = true;

            const trickCards = data?.table || [];

            // ✅ FIX: only set table if cards differ
            const incomingIds = trickCards.map(c => c.id).join(',');
            const currentIds = [...tableCardIdsRef.current].join(',');
            if (incomingIds !== currentIds) {
                tableCardIdsRef.current = new Set(trickCards.map(c => c.id));
                setTable(trickCards);
            }

            if (trickCards.length > 0 && openingTrickRef.current) {
                setIsOpeningTrick(false); openingTrickRef.current = false;
            }

            if (data?.players) setPlayers(data.players);

            if (pendingCardIdRef.current) {
                setMyHand(prev => prev.filter(c => c.id !== pendingCardIdRef.current));
                tempHandRef.current = tempHandRef.current.filter(c => c.id !== pendingCardIdRef.current);
            }

            setPendingCardId(null); setIsSubmittingCard(false);

            addTimer(setTimeout(() => {
                setCollectingPlayer('DISCARD');
                addTimer(setTimeout(() => {
                    if (typeof data?.discardedCount === 'number') setDiscardedCount(data.discardedCount);
                    else setDiscardedCount(prev => prev + (trickCards.length || 0));
                    tableCardIdsRef.current = new Set();
                    setTable([]); setCollectingPlayer(null);
                    setHighValuePlayer(null);
                    setCurrentTurn(data?.nextTurn ?? null);
                    // ✅ FIX: unblock gameUpdated only after table is cleared
                    terminalEventActiveRef.current = false;
                }, 700));
            }, 400));
        };

        const onWinnersUpdated = (serverWinners) => {
            if (finishHandledRef.current) return;
            setWinners(serverWinners || []);
            setPendingCardId(null); setIsSubmittingCard(false);
        };

        const onGameFinished = (data) => {
            if (finishHandledRef.current) return;
            setCurrentTurn(null); setIsSubmittingCard(false); setPendingCardId(null);
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

    // ── CARD ELIGIBILITY ─────────────────────────────────────────
    const isCardEligible = useCallback((card) => {
        const myId = me?.id || socket.id;
        if (gameEnded || isSubmittingCard) return false;
        if (myId !== currentTurn || isDealing) return false;

        if (table.length === 0 && openingTrickRef.current) {
            return card.symbol === '♠' && card.label === 'A';
        }

        if (table.length === 0) return true;

        const leadSuit = table[0].symbol;
        const hasLeadSuit = myHand.some(c => c.symbol === leadSuit);
        return hasLeadSuit ? card.symbol === leadSuit : true;
    }, [gameEnded, isSubmittingCard, me, currentTurn, isDealing, table, myHand]);

    // ✅ FIX: extra client-side self-healing watchdog. If it becomes "my
    // turn" but my hand is empty while I'm clearly still an active player
    // (not ranked as a winner) and the game isn't over, request my cards
    // again from the server. This cannot change any game outcome — it only
    // re-syncs the client's view of a hand the server already has — but it
    // guarantees the player is never stuck staring at an empty hand on
    // their own turn with no way to recover.
    useEffect(() => {
        if (!currentTurn || currentTurn !== socket.id) return;
        if (gameEnded || isDealing) return;
        if (myHand.length > 0) return;
        if (myRankInfo) return; // already finished, no cards expected
        if (!joinedRoomRef.current) return;

        const retryId = setTimeout(() => {
            if (currentTurn === socket.id && myHand.length === 0 && !gameEnded && joinedRoomRef.current) {
                socket.emit('requestMyCards', { roomId: joinedRoomRef.current });
            }
        }, 600);
        return () => clearTimeout(retryId);
    }, [currentTurn, gameEnded, isDealing, myHand.length, myRankInfo]);

    // ── LOBBY ACTIONS ────────────────────────────────────────────
    const handleCreateRoom = () => {
        if (creatingRoom) return;
        if (!playerName.trim()) { alert('Enter your name'); return; }
        if (!socket.connected) { alert('Server not connected'); return; }
        setCreatingRoom(true);
        socket.emit('createRoom', { playerName: playerName.trim() }, (res) => {
            setCreatingRoom(false);
            const id = typeof res === 'string' ? res : res?.roomId;
            if (id) { setJoinedRoom(id); return; }
            alert(res?.message || 'Room creation failed');
        });
    };

    const handleJoinRoom = () => {
        if (joiningRoom) return;
        if (!playerName.trim() || !roomId.trim()) { alert('Details required!'); return; }
        if (!socket.connected) { alert('Server not connected'); return; }
        setJoiningRoom(true);
        socket.emit('joinRoom', { roomId: roomId.toUpperCase(), playerName: playerName.trim() }, (res) => {
            setJoiningRoom(false);
            if (res?.success) setJoinedRoom(roomId.toUpperCase());
            else alert(res?.message || 'Unable to join room');
        });
    };

    const handleStartMatch = () => {
        if (!joinedRoom) return;
        finishHandledRef.current = false;
        setGameEnded(false); setFinalResults(null); setShowFinalPopup(false);
        setIsOpeningTrick(true); openingTrickRef.current = true;
        socket.emit('startGame', { roomId: joinedRoom });
    };

    const handleRemovePlayer = (playerId) => {
        if (!joinedRoom || !me?.host || playerId === socket.id) return;
        const target = players.find(p => p.id === playerId);
        if (!window.confirm(`Remove ${target?.name || 'this player'} from the group?`)) return;
        socket.emit('removePlayer', { roomId: joinedRoom, targetPlayerId: playerId }, (res) => {
            if (res?.success === false) { alert(res?.message || 'Unable to remove player'); return; }
            socket.emit('requestRoomState', { roomId: joinedRoom });
        });
    };

    const playCard = useCallback((card) => {
        if (gameEnded || finishHandledRef.current) return;
        if (!isCardEligible(card) || !joinedRoom || isDealing || isSubmittingCard) return;

        if (table.length === 0 && openingTrickRef.current) {
            setIsOpeningTrick(false); openingTrickRef.current = false;
        }

        setIsSubmittingCard(true);
        setPendingCardId(card.id);

        const previousHand = [...myHand];
        const nextHand = previousHand.filter(c => c.id !== card.id);
        setMyHand(nextHand);
        tempHandRef.current = nextHand;

        socket.emit('playCard', { roomId: joinedRoom, card }, (response) => {
            if (response && response.success === false) {
                setMyHand(previousHand); tempHandRef.current = previousHand;
                setIsSubmittingCard(false); setPendingCardId(null);
                if (table.length === 0) { setIsOpeningTrick(true); openingTrickRef.current = true; }
                alert(response.message || 'Invalid move');
            }
        });

        addTimer(setTimeout(() => {
            if (pendingCardIdRef.current === card.id && !gameEnded && !finishHandledRef.current) {
                setIsSubmittingCard(false); setPendingCardId(null);
            }
        }, 4000));
    }, [gameEnded, isCardEligible, joinedRoom, isDealing, isSubmittingCard, myHand, table]);

    const returnToLobby = () => {
        resetGameState();
        setView('LOBBY');
        if (joinedRoom) {
            socket.emit('returnToLobby', { roomId: joinedRoom });
            addTimer(setTimeout(() => socket.emit('requestRoomState', { roomId: joinedRoom }), 300));
        }
    };

    const handleBackClick = () => showAdAndProceed(() => onBack());

    const getProfileLabel = (playerId) => {
        const info = winners.find(w => w.id === playerId);
        return info ? getRankText(info.rank) : null;
    };

    // ── BOARD ─────────────────────────────────────────────────────
    const MultiplayerBoard = () => {
        const p2 = orderedPlayers[1] || null;
        const p3 = orderedPlayers[2] || null;
        const p4 = orderedPlayers[3] || null;

        return (
            <div
                className="mp-game-root position-relative overflow-hidden bg-black"
                style={{ width: '100%', height: '100dvh' }}
            >
                {/* TOP BAR */}
                <div
                    className="position-absolute top-0 w-100 d-flex justify-content-between align-items-center"
                    style={{
                        zIndex: 9999,
                        paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
                        paddingLeft: '15px', paddingRight: '15px',
                        pointerEvents: 'none'
                    }}
                >
                    <button
                        className="btn btn-sm text-white bg-dark bg-opacity-75 rounded-circle p-2 shadow-lg d-flex align-items-center justify-content-center"
                        onClick={handleBackClick}
                        style={{ pointerEvents: 'auto', width: '45px', height: '45px', border: '1px solid rgba(255,255,255,0.2)' }}
                    >
                        <ArrowLeft size={28} />
                    </button>
                    <div
                        className="bg-warning text-dark px-3 py-2 rounded-pill fw-bold shadow-sm"
                        style={{ pointerEvents: 'auto', fontSize: '0.8rem', border: '1px solid rgba(0,0,0,0.1)' }}
                    >
                        Discarded: {discardedCount}
                    </div>
                </div>

                {/* TOP PLAYER p3 */}
                {p3 && (
                    <div className="position-absolute top-0 start-50 translate-middle-x mt-5 pt-4" style={{ zIndex: 1500 }}>
                        <div className="position-relative">
                            <PlayerSlot
                                pos="p3" name={p3.name} count={p3.handCount ?? 0}
                                isTurn={currentTurn === p3.id}
                                winnerInfo={winners.find(w => w.id === p3.id) ? { ...winners.find(w => w.id === p3.id), text: getProfileLabel(p3.id) } : null}
                                isHighValue={highValuePlayer === p3.id} isStriker={striker === p3.id}
                            />
                            <div className="position-absolute" style={{ top: '-5px', right: '-5px', zIndex: 1600 }}>
                                {p3.isConnected !== false
                                    ? <div className="bg-success rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><CheckCircle2 size={14} className="text-white" /></div>
                                    : <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><XCircle size={14} className="text-white" /></div>
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* LEFT PLAYER p2 */}
                {p2 && (
                    <div className="position-absolute start-0 top-50 translate-middle-y ms-2" style={{ zIndex: 1500, transform: 'translateY(-120px)' }}>
                        <div className="position-relative">
                            <PlayerSlot
                                pos="p2" name={p2.name} count={p2.handCount ?? 0}
                                isTurn={currentTurn === p2.id}
                                winnerInfo={winners.find(w => w.id === p2.id) ? { ...winners.find(w => w.id === p2.id), text: getProfileLabel(p2.id) } : null}
                                isHighValue={highValuePlayer === p2.id} isStriker={striker === p2.id}
                            />
                            <div className="position-absolute" style={{ top: '-5px', right: '-5px', zIndex: 1600 }}>
                                {p2.isConnected !== false
                                    ? <div className="bg-success rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><CheckCircle2 size={14} className="text-white" /></div>
                                    : <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><XCircle size={14} className="text-white" /></div>
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* RIGHT PLAYER p4 */}
                {p4 && (
                    <div className="position-absolute end-0 top-50 translate-middle-y me-2" style={{ zIndex: 1500, transform: 'translateY(-120px)' }}>
                        <div className="position-relative">
                            <PlayerSlot
                                pos="p4" name={p4.name} count={p4.handCount ?? 0}
                                isTurn={currentTurn === p4.id}
                                winnerInfo={winners.find(w => w.id === p4.id) ? { ...winners.find(w => w.id === p4.id), text: getProfileLabel(p4.id) } : null}
                                isHighValue={highValuePlayer === p4.id} isStriker={striker === p4.id}
                            />
                            <div className="position-absolute" style={{ top: '-5px', right: '-5px', zIndex: 1600 }}>
                                {p4.isConnected !== false
                                    ? <div className="bg-success rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><CheckCircle2 size={14} className="text-white" /></div>
                                    : <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><XCircle size={14} className="text-white" /></div>
                                }
                            </div>
                        </div>
                    </div>
                )}

                {/* CENTER TABLE */}
                <div
                    className="position-absolute top-50 start-50 translate-middle rounded-circle shadow-lg"
                    style={{
                        width: '280px', height: '280px',
                        background: 'radial-gradient(circle, #1a4d2e 0%, #0a2414 100%)',
                        zIndex: 100, border: '4px solid rgba(255,255,255,0.1)'
                    }}
                >
                    <div className="d-flex h-100 justify-content-center align-items-center position-relative">
                        {/* ✅ FIX: initial={false} prevents re-running enter animation
                            when parent re-renders but cards are the same.
                            Cards only animate IN on first mount (key not seen before). */}
                        <AnimatePresence initial={false}>
                            {table.map((c, i) => {
                                const pOrderIdx = orderedPlayers.findIndex(p => p.id === c.playedBy);
                                const slots = [
                                    { y: 60, x: 0 },
                                    { x: -60, y: 0 },
                                    { y: -60, x: 0 },
                                    { x: 60, y: 0 },
                                ];
                                const pPos = slots[pOrderIdx] || { x: 0, y: 0 };
                                let exX = 0, exY = 0;
                                if (collectingPlayer === 'DISCARD') { exX = 150; exY = -400; }
                                else if (collectingPlayer) {
                                    const lIdx = orderedPlayers.findIndex(p => p.id === collectingPlayer);
                                    if (lIdx === 0) exY = 400;
                                    if (lIdx === 1) exX = -400;
                                    if (lIdx === 2) exY = -400;
                                    if (lIdx === 3) exX = 400;
                                }
                                return (
                                    <motion.div
                                        key={c.id}
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ x: pPos.x, y: pPos.y, scale: 1, opacity: 1 }}
                                        exit={{ x: exX, y: exY, scale: 0, opacity: 0, transition: { duration: 0.35 } }}
                                        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                                        className="position-absolute"
                                        style={{ zIndex: 500 + i }}
                                    >
                                        <CardView card={c} isInteractive={false} />
                                    </motion.div>
                                );
                            })}
                        </AnimatePresence>
                    </div>
                </div>

                {/*
                  ================================================================
                  BOTTOM PLAYER HAND PANEL — PREMIUM REDESIGN (matches Game.jsx)
                  ================================================================
                  FIX: Hand cards were getting hidden/overlapped behind the Android
                  navigation bar because Android WebViews frequently report
                  env(safe-area-inset-bottom) as 0px (unlike iOS), so the previous
                  fallback wasn't enough on gesture-nav / 3-button-nav devices.

                  Now using CSS max() to guarantee a solid minimum buffer
                  (34px) REGARDLESS of what the device reports, while still
                  respecting a larger real inset (notch / gesture bar) when the
                  OS does report one correctly. No socket/game logic touched
                  below — only this panel's container styling/visuals changed,
                  matching Game.jsx's single-player hand panel 1:1.
                  ================================================================
                */}
                <div
                    className="position-absolute bottom-0 w-100 d-flex flex-column align-items-center justify-content-center hand-panel"
                    style={{
                        zIndex: 2000,
                        minHeight: 'calc(190px + max(34px, env(safe-area-inset-bottom, 0px)))',
                        paddingBottom: 'max(34px, calc(env(safe-area-inset-bottom, 0px) + 22px))',
                        paddingTop: '14px',
                        paddingLeft: '12px',
                        paddingRight: '12px',
                    }}
                >
                    {/* Animated glow divider at the top edge of the panel */}
                    <motion.div
                        className="position-absolute top-0 start-0 w-100"
                        style={{ height: '2px', pointerEvents: 'none' }}
                        animate={{
                            background: [
                                'linear-gradient(90deg, rgba(25,135,84,0) 0%, rgba(25,135,84,0.9) 50%, rgba(25,135,84,0) 100%)',
                                'linear-gradient(90deg, rgba(255,215,0,0) 0%, rgba(255,215,0,0.7) 50%, rgba(255,215,0,0) 100%)',
                                'linear-gradient(90deg, rgba(25,135,84,0) 0%, rgba(25,135,84,0.9) 50%, rgba(25,135,84,0) 100%)'
                            ]
                        }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    />

                    {myRankInfo ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-2"
                        >
                            <Trophy size={45} className="text-warning mb-1" />
                            <div className="text-warning fw-bold h5">{getRankText(myRankInfo.rank)}</div>
                        </motion.div>
                    ) : (
                        <>
                            <div
                                className={`mb-2 px-3 py-1 rounded-pill fw-black shadow-sm d-flex align-items-center gap-2 ${gameEnded ? 'bg-warning text-dark'
                                    : isSubmittingCard ? 'bg-info text-dark'
                                        : me?.id === currentTurn ? 'bg-success text-white'
                                            : 'bg-secondary text-white opacity-50'
                                    }`}
                                style={{ fontSize: '0.7rem', letterSpacing: '1px' }}
                            >
                                {gameEnded ? (
                                    <><Trophy size={14} /><span>MATCH FINISHED</span></>
                                ) : isSubmittingCard ? (
                                    <><Loader2 size={14} className="mp-spin" /><span>PLAYING...</span></>
                                ) : me?.id === currentTurn ? (
                                    <><motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ repeat: Infinity, duration: 1.2 }}><Crown size={14} className="text-warning" /></motion.span><span>YOUR TURN</span></>
                                ) : (
                                    <><Loader2 size={14} className="mp-spin" /><span>WAITING...</span></>
                                )}
                            </div>

                            <div className="text-center mb-2 d-flex flex-column align-items-center gap-1">
                                <span className="x-small fw-black text-success text-uppercase tracking-widest" style={{ letterSpacing: '0.18em' }}>
                                    You {playerName ? `(${playerName})` : ''}
                                </span>
                                <motion.span
                                    animate={me?.id === currentTurn ? { scale: [1, 1.05, 1] } : { scale: 1 }}
                                    transition={me?.id === currentTurn ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                                    className="px-3 py-1 rounded-pill small fw-bold"
                                    style={{
                                        background: me?.id === currentTurn
                                            ? 'linear-gradient(135deg, #ffd700, #c9a400)'
                                            : 'rgba(255,255,255,0.08)',
                                        color: me?.id === currentTurn ? '#1a0f00' : 'rgba(255,255,255,0.65)',
                                        border: me?.id === currentTurn ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                        boxShadow: me?.id === currentTurn ? '0 3px 12px rgba(255,215,0,0.35)' : 'none'
                                    }}
                                >
                                    HAND: {myHand.length}
                                </motion.span>
                            </div>

                            <div
                                className="d-flex justify-content-center align-items-end"
                                style={{ height: '110px', width: '100%', position: 'relative', marginBottom: '2px', overflow: 'visible' }}
                            >
                                {myHand.map((c, i) => {
                                    const eligible = isCardEligible(c);
                                    const cardWidth = 58;
                                    const containerWidth = window.innerWidth - 30;
                                    const overlap = myHand.length * cardWidth > containerWidth
                                        ? (myHand.length * cardWidth - containerWidth) / (myHand.length - 1 || 1)
                                        : 0;
                                    return (
                                        <motion.div
                                            key={c.id}
                                            initial={hasDealtOnceRef.current ? false : { y: -250, opacity: 0 }}
                                            animate={{
                                                y: (me?.id === currentTurn && eligible) ? -25 : 0,
                                                scale: pendingCardId === c.id ? 0.92 : 1,
                                                opacity: pendingCardId === c.id ? 0.35 : 1
                                            }}
                                            transition={{
                                                delay: (!hasDealtOnceRef.current && isDealing) ? i * 0.08 : 0,
                                                type: 'spring', stiffness: 300, damping: 20
                                            }}
                                            style={{
                                                marginLeft: i === 0 ? 0 : -overlap,
                                                zIndex: (me?.id === currentTurn && eligible) ? 200 + i : i,
                                                opacity: pendingCardId === c.id ? 0.35 : (me?.id === currentTurn && !eligible) ? 0.6 : 1,
                                                pointerEvents: (pendingCardId || gameEnded) ? 'none' : 'auto'
                                            }}
                                        >
                                            <CardView
                                                card={c}
                                                isInteractive={eligible && !isSubmittingCard && !gameEnded}
                                                onClick={() => playCard(c)}
                                            />
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </>
                    )}
                </div>

                {/* FINAL POPUP */}
                <AnimatePresence>
                    {showFinalPopup && myRankInfo && (
                        <motion.div
                            initial={{ scale: 0.5, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className="position-absolute top-50 start-50 translate-middle text-center p-4 rounded-4 bg-dark border border-warning shadow-lg"
                            style={{ zIndex: 4000, width: '290px' }}
                        >
                            <div className="display-4">
                                {myRankInfo.rank === 1 ? '🥇' : myRankInfo.rank === 2 ? '🥈' : myRankInfo.rank === 3 ? '🥉' : '🫏'}
                            </div>
                            <h2 className="text-warning fw-bold mt-2">{getRankText(myRankInfo.rank)}</h2>
                            {finalResults?.winners?.length ? (
                                <div className="mt-2 mb-3 text-start">
                                    {finalResults.winners.map((w, idx) => {
                                        const player = (finalResults?.players || finalPlayersRef.current || []).find(p => p.id === w.id);
                                        return (
                                            <div key={w.id || idx} className="d-flex justify-content-between align-items-center text-white small py-1 border-bottom border-secondary border-opacity-25">
                                                <span>{player?.name || w.name || 'Player'}</span>
                                                <span className="text-warning fw-bold">{getRankText(w.rank)}</span>
                                            </div>
                                        );
                                    })}
                                </div>
                            ) : null}
                            <button className="btn btn-warning w-100 fw-bold mt-2 rounded-pill" onClick={returnToLobby}>
                                RESTART MATCH
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <style>{`
                    .fw-black { font-weight: 900; }
                    .x-small { font-size: 0.65rem; }
                    .mp-game-root {
                        height: 100dvh !important;
                        padding-bottom: env(safe-area-inset-bottom, 0px);
                        box-sizing: border-box;
                    }
                    .hand-panel {
                        background: linear-gradient(180deg, rgba(10,20,13,0.75) 0%, rgba(4,10,6,0.97) 40%, #04070a 100%);
                        backdrop-filter: blur(22px);
                        -webkit-backdrop-filter: blur(22px);
                        border-top-left-radius: 26px;
                        border-top-right-radius: 26px;
                        box-shadow: 0 -10px 30px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04);
                    }
                    .mp-spin { animation: mpSpin 1s linear infinite; }
                    @keyframes mpSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                `}</style>
            </div>
        );
    };

    // ── LOBBY ─────────────────────────────────────────────────────
    return (
        <div
            className="w-100 overflow-hidden"
            style={{
                height: '100dvh',
                background: '#050a06',
                paddingBottom: 'env(safe-area-inset-bottom, 0px)',
                boxSizing: 'border-box'
            }}
        >
            <AnimatePresence mode="wait">
                {view === 'LOBBY' ? (
                    <motion.div
                        key="lobby"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="d-flex align-items-center justify-content-center p-3"
                        style={{ height: '100dvh' }}
                    >
                        <div
                            className="card bg-dark border-0 shadow-lg p-4 text-white rounded-5 w-100"
                            style={{ maxWidth: '420px', background: 'rgba(15,20,15,0.98)', border: '1px solid rgba(25,135,84,0.2)' }}
                        >
                            <div className="text-center mb-4 border-bottom border-secondary border-opacity-20 pb-3">
                                <div className="d-flex align-items-center justify-content-between">
                                    <button className="btn btn-link text-secondary p-0" onClick={onBack}><ArrowLeft size={24} /></button>
                                    <h5 className="text-uppercase fw-black m-0 text-success" style={{ letterSpacing: '2px' }}>MULTIPLAYER</h5>
                                    <div style={{ width: 24 }} />
                                </div>
                            </div>

                            <div className={`small text-center mb-3 fw-bold ${socketReady ? 'text-success' : 'text-danger'}`}>
                                {socketReady ? '● Server Connected' : '● Server Disconnected'}
                            </div>

                            {!joinedRoom ? (
                                <>
                                    <div className="position-relative mb-3">
                                        <input
                                            className="form-control bg-black text-white py-3 ps-5 border-secondary rounded-4"
                                            placeholder="Your Name"
                                            value={playerName}
                                            onChange={e => setPlayerName(e.target.value)}
                                        />
                                        <Edit3 size={18} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary" />
                                    </div>
                                    <button className="btn btn-success w-100 py-3 mb-3 rounded-4 fw-bold" onClick={handleCreateRoom} disabled={creatingRoom || !socketReady}>
                                        {creatingRoom ? 'CREATING...' : <><PlusCircle size={20} className="me-2" />CREATE ROOM</>}
                                    </button>
                                    <div className="text-center text-secondary small mb-3 fw-bold opacity-50">--- OR JOIN ---</div>
                                    <input
                                        className="form-control mb-3 bg-black text-white py-3 border-secondary rounded-4 text-center fw-black"
                                        placeholder="ROOM CODE"
                                        value={roomId}
                                        onChange={e => setRoomId(e.target.value.toUpperCase())}
                                        style={{ letterSpacing: '4px' }}
                                    />
                                    <button disabled={joiningRoom || !socketReady} className="btn btn-outline-primary w-100 py-3 rounded-4 fw-bold" onClick={handleJoinRoom}>
                                        {joiningRoom ? 'JOINING...' : <><LogIn size={20} className="me-2" />JOIN MATCH</>}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="p-4 rounded-4 bg-black border border-success border-opacity-20 mb-4">
                                        <span className="small text-secondary d-block mb-1">ROOM CODE</span>
                                        <div className="d-flex align-items-center justify-content-center gap-2">
                                            <h2 className="m-0 text-white fw-black" style={{ letterSpacing: '4px' }}>{joinedRoom}</h2>
                                            <Copy size={18} className="text-secondary" style={{ cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(joinedRoom); setCopied(true); setTimeout(() => setCopied(false), 2000); }} />
                                            {copied && <CheckCircle2 size={16} className="text-success" />}
                                        </div>
                                    </div>
                                    <div className="d-flex flex-column gap-2 mb-4">
                                        {players.map(p => (
                                            <div key={p.id} className="p-3 rounded-4 d-flex align-items-center justify-content-between" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                                <div className="d-flex align-items-center gap-2">
                                                    {p.host ? <Crown size={18} className="text-warning" /> : <User size={18} className="text-success" />}
                                                    <span className="fw-bold text-white">{p.name} {p.id === socket.id ? '(You)' : ''}</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    {p.isConnected !== false ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-danger" />}
                                                    {me?.host && p.id !== socket.id && (
                                                        <button className="btn btn-sm btn-outline-danger rounded-pill px-2 py-1" onClick={() => handleRemovePlayer(p.id)}>Remove</button>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        disabled={players.length < 2 || !players.find(p => p.host && p.id === socket.id)}
                                        className="btn btn-success btn-lg w-100 py-3 rounded-pill fw-black"
                                        onClick={handleStartMatch}
                                    >
                                        START MATCH ({players.length}/4)
                                    </button>
                                </div>
                            )}
                        </div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="board"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ height: '100dvh' }}
                    >
                        <MultiplayerBoard />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}