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

// ✅ UPDATED socket options (fixes "WebSocket is closed before the connection is established"):
// - autoConnect:false  -> connect only when the Multiplayer screen opens (not during splash)
// - polling first      -> wakes the sleeping Render server, then upgrades to WebSocket
// - timeout 60s        -> allows time for the Render cold start
// Persistent client identity: survives reconnects (socket.id changes on every reconnect)
const getClientId = () => {
    let id = localStorage.getItem('donkyClientId');
    if (!id) {
        id = 'c-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
        localStorage.setItem('donkyClientId', id);
    }
    return id;
};
const CLIENT_ID = getClientId();

const socket = io(SERVER_URL, {
    autoConnect: false,
    auth: { clientId: CLIENT_ID },
    transports: ['polling', 'websocket'],
    timeout: 60000,
    reconnection: true,
    reconnectionDelay: 500,
    reconnectionDelayMax: 3000,
    reconnectionAttempts: Infinity,
});

// ---------- Visual-only constants (no game logic) ----------
const AMBIENT = [
    ['♠', 6, 22, 30], ['♥', 18, 28, 44], ['♦', 30, 20, 26], ['♣', 44, 30, 38],
    ['♠', 58, 24, 34], ['♥', 70, 26, 28], ['♦', 82, 22, 42], ['♣', 92, 28, 32],
];
const CONFETTI = Array.from({ length: 22 }, (_, i) => {
    const a = (i / 22) * Math.PI * 2;
    const d = 110 + (i % 3) * 40;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d, s: ['♠', '♥', '♦', '♣', '★'][i % 5], red: i % 5 === 1 || i % 5 === 2, delay: (i % 6) * 0.04 };
});
// seat index (0 = me/bottom, 1 = left, 2 = top, 3 = right) -> pointer rotation
const SEAT_ANGLE = [180, 270, 0, 90];

// ✅ FIX (round table / flicker): Halo used to be declared INSIDE the board
// render, which meant it was a brand-new component type on every render and
// got unmounted/remounted constantly (restarting its animation). It now lives
// at module level so it is a stable component.
const Halo = ({ active }) => (active ? <div className="halo-pulse" /> : null);

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

    // ✅ UPDATED: the socket now connects when the Multiplayer screen opens
    // (autoConnect is false). If it is already connected we just sync the flag.
    useEffect(() => {
        const onConnect = () => {
            setSocketReady(true);
            // Re-attach to the room after any reconnect (new socket.id)
            if (joinedRoomRef.current) {
                socket.emit('rejoinRoom', {
                    roomId: joinedRoomRef.current,
                    playerName: (localStorage.getItem('donkyplayername') || '').trim(),
                    clientId: CLIENT_ID,
                });
            }
        };
        const onDisconnect = () => setSocketReady(false);
        // When the app returns to foreground, reconnect / resync immediately
        const onVisible = () => {
            if (document.visibilityState !== 'visible') return;
            if (!socket.connected) socket.connect();
            else if (joinedRoomRef.current) socket.emit('requestSync', { roomId: joinedRoomRef.current });
        };
        socket.on('connect', onConnect);
        socket.on('disconnect', onDisconnect);
        document.addEventListener('visibilitychange', onVisible);

        if (socket.connected) setSocketReady(true);
        else socket.connect();

        return () => {
            socket.off('connect', onConnect);
            socket.off('disconnect', onDisconnect);
            document.removeEventListener('visibilitychange', onVisible);
        };
    }, []);

    useEffect(() => {
        (async () => {
            try {
                await AdMob.prepareInterstitial({ adId: 'ca-app-pub-8553625771070050/7057056419', isTesting: false });
                adPreparedRef.current = true;
            } catch { adPreparedRef.current = false; }
        })();
    }, []);

    // ✅ UPDATED: removed AdMob.removeAllListeners() (it also deleted the App Open Ad
    // "return to app" listener). Each flow now removes ONLY its own listeners.
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

        let handled = false;
        let dismissListener;
        let failedListener;
        const cleanup = async () => {
            try { if (dismissListener) await dismissListener.remove(); } catch { }
            try { if (failedListener) await failedListener.remove(); } catch { }
        };

        try {
            const safeFinish = async () => {
                if (handled) return;
                handled = true;
                await cleanup();
                adPreparedRef.current = false;
                finishNow();
            };
            dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, safeFinish);
            failedListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, safeFinish);
            if (!adPreparedRef.current) {
                await AdMob.prepareInterstitial({ adId: 'ca-app-pub-8553625771070050/7057056419', isTesting: false });
                adPreparedRef.current = true;
            }
            await AdMob.showInterstitial();
        } catch {
            await cleanup();
            if (!handled) { handled = true; finishNow(); }
        }
    }, [onFinish]);

    const showAdAndProceed = useCallback(async (callback) => {
        let handled = false;
        let dismissListener;
        let failedListener;
        const cleanup = async () => {
            try { if (dismissListener) await dismissListener.remove(); } catch { }
            try { if (failedListener) await failedListener.remove(); } catch { }
        };

        try {
            const safeProceed = async (resetPrepared) => {
                if (handled) return;
                handled = true;
                await cleanup();
                if (resetPrepared) adPreparedRef.current = false;
                callback();
            };
            dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => safeProceed(true));
            failedListener = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => safeProceed(false));
            if (!adPreparedRef.current) {
                await AdMob.prepareInterstitial({ adId: 'ca-app-pub-8553625771070050/7057056419', isTesting: false });
                adPreparedRef.current = true;
            }
            await AdMob.showInterstitial();
        } catch {
            await cleanup();
            if (!handled) { handled = true; callback(); }
        }
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

        // Full state restore after reconnect / resume (server event 'syncState')
        const onSyncState = (d) => {
            if (!d) return;
            if (d.roomId) setJoinedRoom(d.roomId);
            if (d.players) setPlayers(d.players);
            if (d.winners) setWinners(d.winners);
            if (typeof d.discardedCount === 'number') setDiscardedCount(d.discardedCount);
            if (d.gameStarted) {
                terminalEventActiveRef.current = false;
                hasDealtOnceRef.current = true;
                setView('BOARD');
                setIsDealing(false);
                const tbl = d.table || [];
                setTable(tbl);
                tableCardIdsRef.current = new Set(tbl.map(c => c.id));
                setCurrentTurn(d.currentTurn ?? null);
                setIsSubmittingCard(false);
                setPendingCardId(null);
                if (tbl.length > 0) { openingTrickRef.current = false; setIsOpeningTrick(false); }
            }
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
        socket.on('syncState', onSyncState);

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
            socket.off('syncState', onSyncState);
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
        socket.emit('createRoom', { playerName: playerName.trim(), clientId: CLIENT_ID }, (res) => {
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
        socket.emit('joinRoom', { roomId: roomId.toUpperCase(), playerName: playerName.trim(), clientId: CLIENT_ID }, (res) => {
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

    // Small helper so the three opponent seats share identical markup
    const renderOpponent = (player, pos, wrapperClass) => {
        if (!player) return null;
        const winInfo = winners.find(w => w.id === player.id);
        return (
            <div className={`position-absolute ${wrapperClass}`} style={pos === 'p3'
                ? { zIndex: 1500 }
                : { zIndex: 1500, transform: 'translateY(-120px)' }}
            >
                <div className="position-relative">
                    <Halo active={currentTurn === player.id && !isDealing} />
                    <PlayerSlot
                        pos={pos} name={player.name} count={player.handCount ?? 0}
                        isTurn={currentTurn === player.id}
                        winnerInfo={winInfo ? { ...winInfo, text: getProfileLabel(player.id) } : null}
                        isHighValue={highValuePlayer === player.id} isStriker={striker === player.id}
                    />
                    <div className="position-absolute" style={{ top: '-5px', right: '-5px', zIndex: 1600 }}>
                        {player.isConnected !== false
                            ? <div className="bg-success rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><CheckCircle2 size={14} className="text-white" /></div>
                            : <div className="bg-danger rounded-circle d-flex align-items-center justify-content-center border border-2 border-dark" style={{ width: '22px', height: '22px' }}><XCircle size={14} className="text-white" /></div>
                        }
                    </div>
                </div>
            </div>
        );
    };

    // ── BOARD ─────────────────────────────────────────────────────
    // ✅ FIX (main bug): this used to be `const MultiplayerBoard = () => {...}`
    // declared inside the component and rendered as <MultiplayerBoard />.
    // React saw a NEW component type on every state change (socket updates,
    // timers, etc.), so the whole board — including the round table — was
    // unmounted and remounted again and again. That restarted every
    // animation/transition and made the yellow table ring look broken /
    // non-round. It is now a plain render function called as {renderBoard()},
    // so the DOM is kept and updated normally, exactly like Game.jsx.
    const renderBoard = () => {
        const p2 = orderedPlayers[1] || null;
        const p3 = orderedPlayers[2] || null;
        const p4 = orderedPlayers[3] || null;

        // ---------- Visual-only helpers ----------
        const isMyTurn = !!me && me.id === currentTurn && !isDealing && !gameEnded;
        const currentSeat = orderedPlayers.findIndex(p => p.id === currentTurn);
        const currentTurnPlayer = currentSeat >= 0 ? orderedPlayers[currentSeat] : null;
        const turnCaption = gameEnded
            ? ''
            : isDealing
                ? 'Shuffling & dealing...'
                : isMyTurn
                    ? 'Your turn - play a card'
                    : currentTurnPlayer
                        ? `${currentTurnPlayer.name} is thinking...`
                        : '';

        return (
            <div
                className="game-root mp-game-root position-relative overflow-hidden"
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
                        className="btn3d-round d-flex align-items-center justify-content-center"
                        onClick={handleBackClick}
                        style={{ pointerEvents: 'auto' }}
                        aria-label="Leave match"
                    >
                        <ArrowLeft size={26} />
                    </button>
                    <div className="discard-pill d-flex align-items-center gap-2" style={{ pointerEvents: 'auto' }}>
                        <span className="discard-stack">
                            <i style={{ transform: 'rotate(-12deg)' }} />
                            <i style={{ transform: 'rotate(0deg)' }} />
                            <i style={{ transform: 'rotate(12deg)' }}>♠</i>
                        </span>
                        <span>Discarded: <b>{discardedCount}</b></span>
                    </div>
                </div>

                {/* TOP PLAYER p3 */}
                {renderOpponent(p3, 'p3', 'top-0 start-50 translate-middle-x mt-5 pt-4')}

                {/* LEFT PLAYER p2 */}
                {renderOpponent(p2, 'p2', 'start-0 top-50 translate-middle-y ms-2')}

                {/* RIGHT PLAYER p4 */}
                {renderOpponent(p4, 'p4', 'end-0 top-50 translate-middle-y me-2')}

                {/* CENTER TABLE */}
                <div
                    className={`position-absolute top-50 start-50 translate-middle rounded-circle game-table ${isMyTurn ? 'table-mine' : ''}`}
                    style={{ width: '280px', height: '280px', zIndex: 100 }}
                >
                    <div className="table-felt" />
                    <div className="table-emblem">♠</div>
                    <div className="table-ring" />

                    {/* turn pointer (points at whoever's turn it is) */}
                    <motion.div
                        className="turn-pointer"
                        initial={false}
                        animate={{
                            rotate: currentSeat >= 0 ? SEAT_ANGLE[currentSeat] : 0,
                            opacity: currentSeat >= 0 && !isDealing && !gameEnded ? 1 : 0
                        }}
                        transition={{ type: 'spring', stiffness: 120, damping: 14 }}
                    >
                        <span />
                    </motion.div>

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
                                        initial={{ scale: 0, opacity: 0, rotate: -25 }}
                                        animate={{ x: pPos.x, y: pPos.y, scale: 1, opacity: 1, rotate: 0 }}
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

                    {/* dealing animation */}
                    <AnimatePresence>
                        {isDealing && (
                            <motion.div
                                key="dealing"
                                className="dealing-overlay"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0, scale: 1.3 }}
                            >
                                <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }} className="deal-orbit">
                                    <span style={{ color: '#fff' }}>♠</span>
                                    <span style={{ color: '#f87171' }}>♥</span>
                                    <span style={{ color: '#fff' }}>♣</span>
                                    <span style={{ color: '#f87171' }}>♦</span>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* turn caption under the table */}
                {turnCaption && !myRankInfo && (
                    <motion.div
                        key={turnCaption}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`turn-caption ${isMyTurn ? 'mine' : ''}`}
                    >
                        {turnCaption}
                    </motion.div>
                )}

                {/*
                  ================================================================
                  BOTTOM PLAYER HAND PANEL (matches Game.jsx)
                  Uses max() so cards never hide behind the Android navigation bar,
                  even when env(safe-area-inset-bottom) reports 0px. No socket/game
                  logic touched here — only visuals.
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
                    <div className="position-absolute top-0 start-0 w-100" style={{ height: '3px', pointerEvents: 'none', background: 'linear-gradient(90deg, rgba(25,135,84,0) 0%, rgba(250,204,21,0.9) 50%, rgba(25,135,84,0) 100%)' }} />

                    {myRankInfo ? (
                        <motion.div
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-center py-2"
                        >
                            <motion.div animate={{ rotateY: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} style={{ display: 'inline-block' }}>
                                <Trophy size={45} className="text-warning mb-1" />
                            </motion.div>
                            <div className="text-warning fw-bold h5">{getRankText(myRankInfo.rank)}</div>
                        </motion.div>
                    ) : (
                        <>
                            <div
                                className={`status-pill mb-2 px-3 py-1 rounded-pill fw-black shadow-sm d-flex align-items-center gap-2 ${gameEnded ? 'bg-warning text-dark'
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
                                    animate={me?.id === currentTurn ? { scale: [1, 1.07, 1] } : { scale: 1 }}
                                    transition={me?.id === currentTurn ? { duration: 1.2, repeat: Infinity, ease: 'easeInOut' } : {}}
                                    className="px-3 py-1 rounded-pill small fw-bold"
                                    style={{
                                        background: me?.id === currentTurn
                                            ? 'linear-gradient(135deg, #ffe066, #d4a900)'
                                            : 'rgba(255,255,255,0.08)',
                                        color: me?.id === currentTurn ? '#1a0f00' : 'rgba(255,255,255,0.65)',
                                        border: me?.id === currentTurn ? 'none' : '1px solid rgba(255,255,255,0.15)',
                                        boxShadow: me?.id === currentTurn ? '0 4px 0 #8a6d00, 0 6px 16px rgba(255,215,0,0.45)' : 'none'
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
                                            initial={hasDealtOnceRef.current ? false : { y: -250, opacity: 0, rotate: -20 }}
                                            animate={{
                                                y: (me?.id === currentTurn && eligible) ? -25 : 0,
                                                scale: pendingCardId === c.id ? 0.92 : 1,
                                                opacity: pendingCardId === c.id ? 0.35 : 1,
                                                rotate: 0
                                            }}
                                            transition={{
                                                delay: (!hasDealtOnceRef.current && isDealing) ? i * 0.08 : 0,
                                                type: 'spring', stiffness: 300, damping: 20
                                            }}
                                            style={{
                                                marginLeft: i === 0 ? 0 : -overlap,
                                                zIndex: (me?.id === currentTurn && eligible) ? 200 + i : i,
                                                opacity: pendingCardId === c.id ? 0.35 : (me?.id === currentTurn && !eligible) ? 0.6 : 1,
                                                pointerEvents: (pendingCardId || gameEnded) ? 'none' : 'auto',
                                                filter: (me?.id === currentTurn && eligible)
                                                    ? 'drop-shadow(0 0 7px rgba(250,204,21,.95))'
                                                    : 'none'
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
                            initial={{ scale: 0.3, opacity: 0, rotateX: 70 }}
                            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                            exit={{ scale: 0.6, opacity: 0 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 14 }}
                            className="position-absolute top-50 start-50 translate-middle text-center p-4 rounded-4 winner-card"
                            style={{ zIndex: 4000, width: '290px' }}
                        >
                            {myRankInfo.rank <= 3 && CONFETTI.map((c, i) => (
                                <motion.span
                                    key={i}
                                    initial={{ x: 0, y: 0, opacity: 1, scale: 0.4 }}
                                    animate={{ x: c.x, y: c.y, opacity: 0, scale: 1.4, rotate: 360 }}
                                    transition={{ duration: 1.6, delay: c.delay, ease: 'easeOut', repeat: Infinity, repeatDelay: 1.2 }}
                                    style={{ position: 'absolute', left: '50%', top: '30%', fontSize: 20, pointerEvents: 'none', color: c.red ? '#f87171' : '#fde047' }}
                                >
                                    {c.s}
                                </motion.span>
                            ))}
                            <motion.div
                                className="display-4"
                                animate={{ scale: [1, 1.2, 1], rotate: [-6, 6, -6] }}
                                transition={{ duration: 1.4, repeat: Infinity }}
                            >
                                {myRankInfo.rank === 1 ? '🥇' : myRankInfo.rank === 2 ? '🥈' : myRankInfo.rank === 3 ? '🥉' : '🫏'}
                            </motion.div>
                            <h2 className="winner-title fw-bold mt-2">{getRankText(myRankInfo.rank)}</h2>
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
                            <button className="btn3d-gold w-100 fw-bold mt-2" onClick={returnToLobby}>
                                RESTART MATCH
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        );
    };

    // ── LOBBY + ROOT ──────────────────────────────────────────────
    return (
        <div
            className="w-100 overflow-hidden position-relative"
            style={{
                height: '100dvh',
                background: '#050a06',
                boxSizing: 'border-box'
            }}
        >
            {/* ===== ENVIRONMENT (same casino room as Game.jsx, rendered once so it never restarts) ===== */}
            <div className="env-room" />
            <div className="env-spot" />
            {AMBIENT.map(([s, left, size, dur], i) => (
                <span key={i} className="env-suit"
                    style={{ left: `${left}%`, fontSize: size, animationDuration: `${dur}s`, animationDelay: `${-i * 4}s`, color: (s === '♥' || s === '♦') ? '#fca5a5' : '#bbf7d0' }}>
                    {s}
                </span>
            ))}
            <div className="env-vignette" />

            <AnimatePresence mode="wait">
                {view === 'LOBBY' ? (
                    <motion.div
                        key="lobby"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className="d-flex align-items-center justify-content-center p-3"
                        style={{ height: '100dvh', position: 'relative', zIndex: 5 }}
                    >
                        <motion.div
                            initial={{ scale: 0.7, opacity: 0, rotateX: 30 }}
                            animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                            transition={{ type: 'spring', stiffness: 140, damping: 13 }}
                            className="dk-panel p-4 text-white w-100"
                            style={{ maxWidth: '420px' }}
                        >
                            <div className="text-center mb-3 pb-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.12)' }}>
                                <div className="d-flex align-items-center justify-content-between">
                                    <button className="btn3d-round d-flex align-items-center justify-content-center" style={{ width: 40, height: 40 }} onClick={onBack} aria-label="Back"><ArrowLeft size={22} /></button>
                                    <h5 className="dk-title-sm m-0">MULTIPLAYER</h5>
                                    <div style={{ width: 40 }} />
                                </div>
                                <div className="lobby-suits">
                                    {['♠', '♥', '♣', '♦'].map((s, i) => (
                                        <span key={s} style={{ animationDelay: `${i * 0.25}s`, color: (s === '♥' || s === '♦') ? '#f87171' : '#fff' }}>{s}</span>
                                    ))}
                                </div>
                            </div>

                            <div className={`small text-center mb-3 fw-bold ${socketReady ? 'text-success' : 'text-danger'}`}>
                                <span className={socketReady ? 'dot-live' : ''}>{socketReady ? '● Server Connected' : '● Server Disconnected'}</span>
                            </div>

                            {!joinedRoom ? (
                                <>
                                    <div className="position-relative mb-3">
                                        <input
                                            className="form-control dk-input py-3 ps-5 rounded-4"
                                            placeholder="Your Name"
                                            value={playerName}
                                            onChange={e => setPlayerName(e.target.value)}
                                        />
                                        <Edit3 size={18} className="position-absolute top-50 start-0 translate-middle-y ms-3 text-secondary" />
                                    </div>
                                    <button className="dk-btn dk-green mb-3" onClick={handleCreateRoom} disabled={creatingRoom || !socketReady}>
                                        {creatingRoom ? 'CREATING...' : <><PlusCircle size={20} />CREATE ROOM</>}
                                    </button>
                                    <div className="text-center text-secondary small mb-3 fw-bold opacity-50">--- OR JOIN ---</div>
                                    <input
                                        className="form-control dk-input mb-3 py-3 rounded-4 text-center fw-black"
                                        placeholder="ROOM CODE"
                                        value={roomId}
                                        onChange={e => setRoomId(e.target.value.toUpperCase())}
                                        style={{ letterSpacing: '4px' }}
                                    />
                                    <button disabled={joiningRoom || !socketReady} className="dk-btn dk-gold" onClick={handleJoinRoom}>
                                        {joiningRoom ? 'JOINING...' : <><LogIn size={20} />JOIN MATCH</>}
                                    </button>
                                </>
                            ) : (
                                <div className="text-center">
                                    <div className="room-code-box p-4 rounded-4 mb-4">
                                        <span className="small text-secondary d-block mb-1">ROOM CODE</span>
                                        <div className="d-flex align-items-center justify-content-center gap-2">
                                            <h2 className="m-0 fw-black room-code" style={{ letterSpacing: '4px' }}>{joinedRoom}</h2>
                                            <Copy size={18} className="text-secondary" style={{ cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(joinedRoom); setCopied(true); setTimeout(() => setCopied(false), 2000); }} />
                                            {copied && <CheckCircle2 size={16} className="text-success" />}
                                        </div>
                                    </div>
                                    <div className="d-flex flex-column gap-2 mb-4">
                                        {players.map((p, idx) => (
                                            <motion.div
                                                key={p.id}
                                                initial={{ x: -40, opacity: 0 }}
                                                animate={{ x: 0, opacity: 1 }}
                                                transition={{ delay: idx * 0.08, type: 'spring', stiffness: 200, damping: 18 }}
                                                className="dk-row p-3 rounded-4 d-flex align-items-center justify-content-between"
                                            >
                                                <div className="d-flex align-items-center gap-2">
                                                    {p.host ? <Crown size={18} className="text-warning" /> : <User size={18} className="text-success" />}
                                                    <span className="fw-bold text-white">{p.name} {p.id === socket.id ? '(You)' : ''}</span>
                                                </div>
                                                <div className="d-flex align-items-center gap-2">
                                                    {p.isConnected !== false ? <CheckCircle2 size={16} className="text-success" /> : <XCircle size={16} className="text-danger" />}
                                                    {me?.host && p.id !== socket.id && (
                                                        <button className="dk-mini-red" onClick={() => handleRemovePlayer(p.id)}>Remove</button>
                                                    )}
                                                </div>
                                            </motion.div>
                                        ))}
                                    </div>
                                    {players.length < 2 && (
                                        <div className="small fw-bold mb-3 waiting-text">Waiting for more players...</div>
                                    )}
                                    <button
                                        disabled={players.length < 2 || !players.find(p => p.host && p.id === socket.id)}
                                        className="dk-btn dk-green"
                                        onClick={handleStartMatch}
                                    >
                                        START MATCH ({players.length}/4)
                                    </button>
                                </div>
                            )}
                        </motion.div>
                    </motion.div>
                ) : (
                    <motion.div
                        key="board"
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        style={{ height: '100dvh', position: 'relative', zIndex: 5 }}
                    >
                        {renderBoard()}
                    </motion.div>
                )}
            </AnimatePresence>

            <style>{`
                .fw-black { font-weight: 900; }
                .x-small { font-size: 0.65rem; }
                .game-root, .mp-game-root {
                    height: 100dvh !important;
                    padding-bottom: env(safe-area-inset-bottom, 0px);
                    box-sizing: border-box;
                    user-select: none; -webkit-tap-highlight-color: transparent;
                }
                .mp-spin { animation: mpSpin 1s linear infinite; }
                @keyframes mpSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

                /* ---- environment ---- */
                .env-room { position:absolute; inset:0; z-index:0; pointer-events:none;
                    background: radial-gradient(ellipse at 50% 42%, #14703f 0%, #0b4527 38%, #062615 70%, #02100a 100%); }
                .env-room::after { content:''; position:absolute; inset:0;
                    background: repeating-linear-gradient(45deg, rgba(255,255,255,.03) 0 2px, transparent 2px 7px); }
                .env-spot { position:absolute; left:50%; top:-10%; width:130%; height:75%; margin-left:-65%; z-index:1; pointer-events:none;
                    background: radial-gradient(ellipse at 50% 0%, rgba(255,244,190,.28) 0%, rgba(255,244,190,0) 65%);
                     }
                @keyframes spotSway { 0%,100% { transform: rotate(-3deg); } 50% { transform: rotate(3deg); } }
                .env-suit { position:absolute; bottom:-60px; z-index:1; font-weight:900; opacity:.12; pointer-events:none;
                    animation: envRise linear infinite; will-change: transform; }
                @keyframes envRise { from { transform: translateY(0); } to { transform: translateY(-115vh); } }
                .env-vignette { position:absolute; inset:0; z-index:2; pointer-events:none;
                    background: radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,.65) 100%); }

                /* ---- top bar ---- */
                .btn3d-round { width:46px; height:46px; border-radius:50%; border:0; color:#fff; cursor:pointer;
                    background: linear-gradient(#4b5563, #111827);
                    box-shadow: 0 5px 0 #000, 0 9px 12px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.25);
                    transition: transform .08s, box-shadow .08s; }
                .btn3d-round:active { transform: translateY(4px); box-shadow: 0 1px 0 #000, 0 3px 6px rgba(0,0,0,.5); }
                .discard-pill { padding:8px 14px; border-radius:999px; font-size:.8rem; font-weight:800; color:#3b2a00;
                    background: linear-gradient(#fde68a, #fbbf24 60%, #f59e0b);
                    box-shadow: 0 4px 0 #92590a, 0 8px 12px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.6); }
                .discard-stack { position:relative; width:16px; height:20px; display:inline-block; }
                .discard-stack i { position:absolute; inset:0; border-radius:3px; background:#fff; border:1px solid #92590a;
                    font-style:normal; font-size:.65rem; line-height:18px; text-align:center; color:#111; }

                /* ---- table (always a perfect circle) ---- */
                .game-table { background: transparent;
                    width:280px; height:280px; flex:none; aspect-ratio:1 / 1;
                    border-radius:50% !important; box-sizing:content-box;
                    box-shadow:
                      0 0 0 9px #6b4423, 0 0 0 12px #2a1708, 0 0 0 15px rgba(250,204,21,.55),
                      0 30px 50px rgba(0,0,0,.75), 0 0 70px rgba(0,0,0,.6);
                    }
                .game-table.table-mine { box-shadow:
                      0 0 0 9px #6b4423, 0 0 0 12px #2a1708, 0 0 0 15px rgba(250,204,21,.95),
                      0 30px 50px rgba(0,0,0,.75), 0 0 60px rgba(250,204,21,.55); }
                .table-felt { position:absolute; inset:0; border-radius:50%;
                    background: radial-gradient(circle at 50% 38%, #2a8f55 0%, #1a6b3c 45%, #0c3a20 100%); }
                .table-felt::after { content:''; position:absolute; inset:0; border-radius:50%;
                    background: repeating-linear-gradient(135deg, rgba(255,255,255,.035) 0 2px, transparent 2px 5px); }
                .table-emblem { position:absolute; inset:0; display:flex; align-items:center; justify-content:center;
                    font-size:130px; color:rgba(255,255,255,.07); pointer-events:none; text-shadow:0 2px 0 rgba(0,0,0,.25); }
                .table-ring { position:absolute; inset:14px; border-radius:50%; border:2px dashed rgba(253,224,71,.35);
                    pointer-events:none; }
                @keyframes ringSpin { to { transform: rotate(360deg); } }
                .turn-pointer { position:absolute; inset:-2px; pointer-events:none; z-index:50; }
                .turn-pointer span { position:absolute; left:50%; top:-26px; margin-left:-11px; width:0; height:0;
                    border-left:11px solid transparent; border-right:11px solid transparent; border-top:18px solid #facc15;
                    filter: drop-shadow(0 0 6px rgba(250,204,21,.9)); animation: pointerBounce .9s ease-in-out infinite; }
                @keyframes pointerBounce { 0%,100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
                .dealing-overlay { position:absolute; inset:0; border-radius:50%; z-index:900; display:flex; align-items:center; justify-content:center;
                    background: rgba(0,0,0,.35); pointer-events:none; }
                .deal-orbit { position:relative; width:90px; height:90px; }
                .deal-orbit span { position:absolute; font-size:30px; font-weight:900; }
                .deal-orbit span:nth-child(1) { left:30px; top:0; }
                .deal-orbit span:nth-child(2) { right:0; top:30px; }
                .deal-orbit span:nth-child(3) { left:30px; bottom:0; }
                .deal-orbit span:nth-child(4) { left:0; top:30px; }
                .turn-caption { position:absolute; left:50%; top:calc(50% + 162px); transform:translateX(-50%); z-index:1600;
                    padding:3px 14px; border-radius:999px; font-size:.7rem; font-weight:800; letter-spacing:.04em; white-space:nowrap;
                    color:#d1fae5; background:rgba(0,0,0,.55); border:1px solid rgba(255,255,255,.15); pointer-events:none; }
                .turn-caption.mine { color:#3b2a00; background:linear-gradient(#fde68a,#fbbf24); border-color:transparent;
                    box-shadow:0 0 14px rgba(250,204,21,.7); animation: capPulse 1.2s ease-in-out infinite; }
                @keyframes capPulse { 0%,100% { transform:translateX(-50%) scale(1); } 50% { transform:translateX(-50%) scale(1.07); } }

                /* ---- hand panel (✅ FIXED: broken "-webkit-" line removed, blur restored) ---- */
                .hand-panel {
                    background: linear-gradient(180deg, rgba(14,28,18,0.96) 0%, rgba(4,10,6,0.97) 40%, #04070a 100%);
                    backdrop-filter: blur(22px);
                    -webkit-backdrop-filter: blur(22px);
                    border-top-left-radius: 28px;
                    border-top-right-radius: 28px;
                    border-top: 2px solid rgba(250,204,21,.35);
                    box-shadow: 0 -12px 34px rgba(0,0,0,0.6), inset 0 2px 0 rgba(255,255,255,0.08);
                }
                .status-pill { box-shadow: 0 4px 0 rgba(0,0,0,.45), 0 8px 12px rgba(0,0,0,.4) !important; }

                /* ---- winner popup ---- */
                .winner-card { background: linear-gradient(160deg, #1b2a20, #070d09); border: 2px solid #facc15;
                    box-shadow: 0 0 0 6px rgba(0,0,0,.4), 0 25px 50px rgba(0,0,0,.7), 0 0 60px rgba(250,204,21,.45); }
                .winner-title { color:#fde047; letter-spacing:2px; font-size:1.6rem;
                    text-shadow: 0 2px 0 #b45309, 0 4px 0 #78350f, 0 0 20px rgba(253,224,71,.6); }
                .btn3d-gold { border:0; border-radius:999px; padding:12px; color:#4a2c05; cursor:pointer;
                    background: linear-gradient(#fde68a, #fbbf24 55%, #f59e0b);
                    box-shadow: 0 6px 0 #92590a, 0 12px 16px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.6);
                    transition: transform .08s, box-shadow .08s; }
                .btn3d-gold:active { transform: translateY(5px); box-shadow: 0 1px 0 #92590a, 0 3px 6px rgba(0,0,0,.5); }

                /* ---- lobby ---- */
                .dk-panel { position:relative; border-radius:34px;
                    background: linear-gradient(160deg, rgba(18,40,28,.94), rgba(5,16,10,.96));
                    border: 2px solid rgba(250,204,21,.45);
                    box-shadow: 0 0 0 6px rgba(0,0,0,.25), 0 28px 50px rgba(0,0,0,.65),
                                inset 0 2px 0 rgba(255,255,255,.12), 0 0 40px rgba(34,197,94,.25); }
                .dk-title-sm { font-weight:900; letter-spacing:3px; color:#fde047; font-size:1.15rem;
                    text-shadow: 0 1px 0 #f59e0b, 0 2px 0 #d97706, 0 3px 0 #b45309, 0 4px 0 #92400e, 0 8px 10px rgba(0,0,0,.6); }
                .lobby-suits { display:flex; justify-content:center; gap:18px; margin-top:10px; font-size:1.5rem; font-weight:900; }
                .lobby-suits span { display:inline-block; animation: suitHop 1.6s ease-in-out infinite; }
                @keyframes suitHop { 0%,100% { transform: translateY(0) rotateY(0); } 50% { transform: translateY(-8px) rotateY(180deg); } }
                .dot-live { animation: dotLive 1.6s ease-in-out infinite; }
                @keyframes dotLive { 0%,100% { opacity:1; } 50% { opacity:.45; } }
                .dk-input { background: rgba(0,0,0,.55) !important; color:#fff !important; border:2px solid rgba(255,255,255,.18) !important;
                    box-shadow: inset 0 4px 8px rgba(0,0,0,.5); }
                .dk-input:focus { border-color:#facc15 !important; box-shadow: inset 0 4px 8px rgba(0,0,0,.5), 0 0 14px rgba(250,204,21,.45) !important; }
                .dk-input::placeholder { color: rgba(255,255,255,.4); }
                .dk-btn { position:relative; width:100%; border:0; border-radius:18px; padding:14px 12px; overflow:hidden;
                    display:flex; align-items:center; justify-content:center; gap:10px;
                    font-weight:900; font-size:1rem; letter-spacing:1.5px; cursor:pointer; outline:none;
                    transition: transform .08s, box-shadow .08s, opacity .2s; }
                .dk-btn::after { content:''; position:absolute; top:0; bottom:0; width:35%; left:0;
                    background: linear-gradient(100deg, transparent, rgba(255,255,255,.55), transparent);
                    transform: translateX(-200%) skewX(-20deg); animation: dkSheen 3.6s ease-in-out infinite; }
                @keyframes dkSheen { 0%,60% { transform: translateX(-200%) skewX(-20deg); } 100% { transform: translateX(450%) skewX(-20deg); } }
                .dk-green { color:#fff; background: linear-gradient(#4ade80, #16a34a 55%, #15803d);
                    box-shadow: 0 7px 0 #0b5a2a, 0 14px 20px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.45);
                    text-shadow: 0 2px 0 rgba(0,0,0,.3); }
                .dk-gold { color:#4a2c05; background: linear-gradient(#fde68a, #fbbf24 55%, #f59e0b);
                    box-shadow: 0 7px 0 #92590a, 0 14px 20px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.6); }
                .dk-btn:active:not(:disabled) { transform: translateY(6px); }
                .dk-green:active:not(:disabled) { box-shadow: 0 1px 0 #0b5a2a, 0 4px 8px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.45); }
                .dk-gold:active:not(:disabled) { box-shadow: 0 1px 0 #92590a, 0 4px 8px rgba(0,0,0,.5), inset 0 2px 0 rgba(255,255,255,.6); }
                .dk-btn:disabled { opacity:.5; filter: grayscale(.5); cursor:not-allowed; }
                .dk-btn:disabled::after { display:none; }
                .room-code-box { background: rgba(0,0,0,.55); border: 2px dashed rgba(250,204,21,.55);
                    box-shadow: inset 0 4px 10px rgba(0,0,0,.5); }
                .room-code { color:#fde047; text-shadow: 0 2px 0 #92400e, 0 0 14px rgba(253,224,71,.5); }
                .dk-row { background: linear-gradient(160deg, rgba(255,255,255,.1), rgba(255,255,255,.03));
                    border: 1px solid rgba(255,255,255,.18); box-shadow: 0 5px 0 rgba(0,0,0,.4); }
                .dk-mini-red { border:0; border-radius:999px; padding:4px 12px; font-size:.75rem; font-weight:800; color:#fff; cursor:pointer;
                    background: linear-gradient(#f87171, #dc2626); box-shadow: 0 3px 0 #7f1d1d; }
                .dk-mini-red:active { transform: translateY(2px); box-shadow: 0 1px 0 #7f1d1d; }
                .waiting-text { color:#fde68a; animation: dotLive 1.6s ease-in-out infinite; }

                .halo-pulse { position:absolute; inset:-16px; z-index:-1; pointer-events:none; border-radius:28px;
                    background: radial-gradient(circle, rgba(250,204,21,.55) 0%, rgba(250,204,21,0) 70%); animation: haloPulse 1.3s ease-in-out infinite; will-change: transform, opacity; }
                @keyframes haloPulse { 0%,100% { opacity:.5; transform:scale(1); } 50% { opacity:1; transform:scale(1.12); } }

                @media (prefers-reduced-motion: reduce) {
                    .env-spot, .env-suit, .table-ring, .turn-pointer span, .turn-caption.mine, .lobby-suits span, .dk-btn::after { animation: none !important; }
                }
            `}</style>
        </div>
    );
}