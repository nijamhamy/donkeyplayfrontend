import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, Trophy } from 'lucide-react';
import { AdMob, InterstitialAdPluginEvents } from '@capacitor-community/admob';


// Components & Logic
import CardView from '../components/Card';
import PlayerSlot from '../components/PlayerSlot';
import ExitModal from '../components/ExitModal';
import { createShuffledDeck } from '../logic/gameLogic';


export default function Game({ onExit, onFinish, externalShowExit, setExternalShowExit }) {
    const [hands, setHands] = useState({ p1: [], p2: [], p3: [], p4: [] });
    const [table, setTable] = useState([]);
    const [discardedPile, setDiscardedPile] = useState([]);
    const [turn, setTurn] = useState('');
    const [winners, setWinners] = useState([]);
    const [showWinnerPopup, setShowWinnerPopup] = useState(false);
    const [isDealing, setIsDealing] = useState(true);


    const actorNames = useRef([]);


    const sharedMemory = useRef({
        missing: {
            p1: new Set(),
            p2: new Set(),
            p3: new Set(),
            p4: new Set(),
        },
        recentLeadSuits: [],
    });


    const latestHandsRef = useRef(hands);
    const latestWinnersRef = useRef(winners);
    const latestTurnRef = useRef(turn);


    const [highValuePlayer, setHighValuePlayer] = useState(null);
    const [striker, setStriker] = useState(null);
    const [collectingPlayer, setCollectingPlayer] = useState(null);


    const isProcessingRound = useRef(false);
    const adListenersBound = useRef(false);
    const adPreloaded = useRef(false);
    const adLoading = useRef(false);
    const finishTriggered = useRef(false);
    const firstRoundPlayed = useRef(false);
    const finalRanksRef = useRef([]);


    const isMountedRef = useRef(false);
    const finishBlockedRef = useRef(false);
    const timersRef = useRef([]);
    const adListenerRefs = useRef([]);


    const turnOrder = ['p1', 'p4', 'p3', 'p2'];


    const addTimer = (timerId) => {
        timersRef.current.push(timerId);
        return timerId;
    };


    const clearAllTimers = () => {
        timersRef.current.forEach(clearTimeout);
        timersRef.current = [];
    };


    const safeGoResults = useCallback((ranks) => {
        if (!isMountedRef.current) return;
        if (finishBlockedRef.current) return;
        if (!Array.isArray(ranks) || !ranks.length) return;
        onFinish(ranks);
    }, [onFinish]);


    useEffect(() => {
        isMountedRef.current = true;
        finishBlockedRef.current = false;


        return () => {
            isMountedRef.current = false;
            finishBlockedRef.current = true;
            clearAllTimers();


            adListenerRefs.current.forEach(async (listener) => {
                try {
                    await listener.remove();
                } catch (e) { }
            });
            adListenerRefs.current = [];
            adListenersBound.current = false;
        };
    }, []);


    useEffect(() => {
        latestHandsRef.current = hands;
    }, [hands]);


    useEffect(() => {
        latestWinnersRef.current = winners;
        finalRanksRef.current = winners;
    }, [winners]);


    useEffect(() => {
        latestTurnRef.current = turn;
    }, [turn]);


    const sortHand = (hand) => {
        const suitOrder = { 'Spades': 0, 'Hearts': 1, 'Clubs': 2, 'Diamonds': 3 };
        return [...hand].sort((a, b) => {
            if (suitOrder[a.name] !== suitOrder[b.name]) return suitOrder[a.name] - suitOrder[b.name];
            return a.val - b.val;
        });
    };


    const getRankText = (r) => {
        if (r === 1) return "1st Winner";
        if (r === 2) return "2nd Winner";
        if (r === 3) return "3rd Winner";
        return "Oops! Donkey";
    };


    const myRankInfo = winners.find(w => w.id === 'p1');


    const isPlayerRanked = (playerId, localRanks) => localRanks.some(w => w.id === playerId);


    const getAlivePlayers = useCallback((localHands = latestHandsRef.current, localRanks = latestWinnersRef.current) => {
        return turnOrder.filter(p => !isPlayerRanked(p, localRanks) && localHands[p] && localHands[p].length > 0);
    }, []);


    const getNextActivePlayer = useCallback((currentPlayer, localHands = latestHandsRef.current, localRanks = latestWinnersRef.current) => {
        const alive = getAlivePlayers(localHands, localRanks);
        if (alive.length === 0) return '';
        if (alive.length === 1) return alive[0];


        const startIdx = turnOrder.indexOf(currentPlayer);
        for (let i = 1; i <= 4; i++) {
            const candidate = turnOrder[(startIdx + i) % 4];
            if (alive.includes(candidate)) return candidate;
        }
        return alive[0] || '';
    }, [getAlivePlayers]);


    const getHighestLeadPlayer = (fullTable) => {
        if (!fullTable.length) return '';
        const leadSuit = fullTable[0].symbol;
        const highestLeadCard = fullTable
            .filter(c => c.symbol === leadSuit)
            .sort((a, b) => b.val - a.val)[0];
        return highestLeadCard?.playedBy || '';
    };


    const getNextStarterFromTrick = useCallback((fullTable, localHands, localRanks) => {
        if (!fullTable.length) return '';


        const leadSuit = fullTable[0].symbol;


        const rankedLeadCards = [...fullTable]
            .filter(c => c.symbol === leadSuit)
            .sort((a, b) => b.val - a.val);


        for (const trickCard of rankedLeadCards) {
            const playerId = trickCard.playedBy;
            const isRanked = localRanks.some(w => w.id === playerId);
            const hasCards = localHands[playerId] && localHands[playerId].length > 0;


            if (!isRanked && hasCards) {
                return playerId;
            }
        }


        return '';
    }, []);


    const pushRecentLeadSuit = (suit) => {
        sharedMemory.current.recentLeadSuits.push(suit);
        if (sharedMemory.current.recentLeadSuits.length > 6) {
            sharedMemory.current.recentLeadSuits.shift();
        }
    };


    const preloadInterstitial = useCallback(async () => {
        if (adLoading.current || adPreloaded.current || finishBlockedRef.current) return;
        try {
            adLoading.current = true;
            await AdMob.prepareInterstitial({
                adId: 'ca-app-pub-8553625771070050/6609130205',
                isTesting: false,
            });
            adPreloaded.current = true;
        } catch (e) {
            adPreloaded.current = false;
        } finally {
            adLoading.current = false;
        }
    }, []);


    const showAdAndFinish = useCallback(async (finalRanks) => {
        if (finishTriggered.current) return;
        if (finishBlockedRef.current) return;
        if (!Array.isArray(finalRanks) || !finalRanks.length) return;


        finishTriggered.current = true;
        finalRanksRef.current = finalRanks;


        const goResults = () => {
            safeGoResults(finalRanksRef.current);
        };


        try {
            const timeoutId = addTimer(setTimeout(() => {
                goResults();
            }, 3000));


            if (adPreloaded.current) {
                clearTimeout(timeoutId);
                await AdMob.showInterstitial();
                return;
            }


            await preloadInterstitial();


            if (adPreloaded.current) {
                clearTimeout(timeoutId);
                await AdMob.showInterstitial();
            } else {
                clearTimeout(timeoutId);
                goResults();
            }
        } catch (e) {
            goResults();
        }
    }, [preloadInterstitial, safeGoResults]);


    const finalizeRanksIfNeeded = useCallback((currentRanks) => {
        let updated = [...currentRanks];
        const remaining = turnOrder.filter(p => !updated.some(w => w.id === p));


        if (updated.length === 3 && remaining.length === 1) {
            updated.push({ id: remaining[0], rank: 4, label: 'Oops! Donkey' });
        }


        return updated;
    }, []);


    const registerWinnerIfNeeded = useCallback((localHands) => {
        setWinners(prev => {
            let updated = [...prev];


            ['p1', 'p2', 'p3', 'p4'].forEach(playerId => {
                const alreadyRanked = updated.some(w => w.id === playerId);


                if (!alreadyRanked && localHands[playerId] && localHands[playerId].length === 0) {
                    const rank = updated.length + 1;
                    updated.push({ id: playerId, rank });


                    if (playerId === 'p1') {
                        setShowWinnerPopup(true);
                    }
                }
            });


            updated = finalizeRanksIfNeeded(updated);


            if (updated.length >= 4 && prev.length < 4) {
                setTurn('');
                isProcessingRound.current = true;
            }


            if (updated.some(x => x.rank === 3) && prev.length < 3) {
                const allRanks = updated;


                addTimer(setTimeout(() => {
                    showAdAndFinish(allRanks);
                }, 1500));
            }


            return updated;
        });
    }, [finalizeRanksIfNeeded, showAdAndFinish]);


    const finishRound = useCallback((winnerId, fullTable, localHandsAfterPlay, collectedByWinner = false) => {
        isProcessingRound.current = true;
        setTurn('');
        setCollectingPlayer(collectedByWinner ? winnerId : 'DISCARD');


        addTimer(setTimeout(() => {
            if (finishBlockedRef.current || !isMountedRef.current) return;


            let nextHands = localHandsAfterPlay;


            if (collectedByWinner) {
                nextHands = {
                    ...localHandsAfterPlay,
                    [winnerId]: sortHand([...(localHandsAfterPlay[winnerId] || []), ...fullTable]),
                };
            } else {
                setDiscardedPile(prev => [...prev, ...fullTable]);
            }


            latestHandsRef.current = nextHands;
            setHands(nextHands);


            setTable([]);
            setCollectingPlayer(null);
            setHighValuePlayer(null);

            // Mark first round as played so Ace restriction lifts from round 2 onwards
            firstRoundPlayed.current = true;


            const aliveAfterResolution = getAlivePlayers(nextHands, latestWinnersRef.current);


            if (aliveAfterResolution.length <= 1) {
                registerWinnerIfNeeded(nextHands);
            } else {
                registerWinnerIfNeeded(nextHands);
            }


            addTimer(setTimeout(() => {
                const currentRanks = latestWinnersRef.current;
                const alive = getAlivePlayers(nextHands, currentRanks);


                if (currentRanks.length >= 4) {
                    isProcessingRound.current = true;
                    setTurn('');
                    return;
                }


                isProcessingRound.current = false;


                if (alive.length === 0) {
                    setTurn('');
                    return;
                }


                if (alive.length === 1) {
                    setTurn(alive[0]);
                    return;
                }


                let nextStarter = '';


                if (collectedByWinner) {
                    nextStarter = winnerId;
                } else {
                    nextStarter = getNextStarterFromTrick(fullTable, nextHands, currentRanks);
                    if (!nextStarter) {
                        nextStarter = getNextActivePlayer(winnerId, nextHands, currentRanks);
                    }
                }


                setTurn(nextStarter);
            }, 50));
        }, 900));
    }, [getAlivePlayers, getNextActivePlayer, getNextStarterFromTrick, registerWinnerIfNeeded]);


    useEffect(() => {
        const bindAdListeners = async () => {
            if (adListenersBound.current) return;
            adListenersBound.current = true;


            try {
                const dismissed = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, async () => {
                    safeGoResults(finalRanksRef.current);
                    adPreloaded.current = false;
                    await preloadInterstitial();
                });


                const failed = await AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, () => {
                    adPreloaded.current = false;
                    safeGoResults(finalRanksRef.current);
                });


                const loaded = await AdMob.addListener(InterstitialAdPluginEvents.Loaded, () => {
                    adPreloaded.current = true;
                });


                adListenerRefs.current = [dismissed, failed, loaded];
            } catch (e) { }
        };


        bindAdListeners();
        preloadInterstitial();


        return () => {
            adListenerRefs.current.forEach(async (listener) => {
                try {
                    await listener.remove();
                } catch (e) { }
            });
            adListenerRefs.current = [];
            adListenersBound.current = false;
        };
    }, [preloadInterstitial, safeGoResults]);


    useEffect(() => {
        const namePool = [
            "Nijam", "Aslam", "Sabry", "Mohamed", "Ammar", "Kaviya", "Ajith", "Surya", "Vikram", "Dhanush",
            "Nimal", "Sunil", "Pathum", "Kusal", "Dasun", "Wanindu", "Charith", "Mahesh", "Suresh", "Pradeep",
            "Ashwin", "Rohit", "Virat", "Hardik", "Rishabh", "Shubman", "Ishaan", "Jasprit", "Mohammed", "Yuvraj",
            "Malinga", "Sanga", "Jaya", "Dilshan", "Murali", "Sanath", "Angelo", "Dimuth", "Dinesh", "Avishka",
            "Bhanuka", "Lahiru", "Chamika", "Duma", "Praveen", "Jeffrey", "Akila", "Nuwan", "Ramesh", "Asitha"
        ];


        const shuffledNames = [...namePool].sort(() => 0.5 - Math.random());
        actorNames.current = shuffledNames.slice(0, 3);


        sharedMemory.current = {
            missing: {
                p1: new Set(),
                p2: new Set(),
                p3: new Set(),
                p4: new Set(),
            },
            recentLeadSuits: [],
        };


        const deck = createShuffledDeck();
        const newHands = {
            p1: sortHand(deck.slice(0, 13)),
            p2: sortHand(deck.slice(13, 26)),
            p3: sortHand(deck.slice(26, 39)),
            p4: sortHand(deck.slice(39, 52))
        };


        latestHandsRef.current = newHands;
        latestWinnersRef.current = [];
        finalRanksRef.current = [];
        finishTriggered.current = false;
        firstRoundPlayed.current = false;
        isProcessingRound.current = false;
        finishBlockedRef.current = false;


        const starter = Object.keys(newHands).find(p => newHands[p].some(c => c.symbol === '♠' && c.label === 'A'));
        setHands(newHands);
        setWinners([]);
        setTable([]);
        setDiscardedPile([]);
        setTurn('');
        setShowWinnerPopup(false);
        setHighValuePlayer(null);
        setStriker(null);
        setCollectingPlayer(null);
        setIsDealing(true);


        addTimer(setTimeout(() => {
            if (finishBlockedRef.current || !isMountedRef.current) return;
            setIsDealing(false);
            setTurn(starter || 'p1');
        }, 2000));
    }, []);


    const isCardEligible = (card, playerHand) => {
        if (turn !== 'p1' || isDealing || isProcessingRound.current) return false;
        if (table.length === 0 && !firstRoundPlayed.current) return card.symbol === '♠' && card.label === 'A';
        if (table.length === 0) return true;


        const leadSuit = table[0].symbol;
        const hasLeadSuit = playerHand.some(c => c.symbol === leadSuit);
        return hasLeadSuit ? card.symbol === leadSuit : true;
    };


    const executeMove = useCallback((playerId, cardIndex) => {
        const currentHands = latestHandsRef.current;
        const currentRanks = latestWinnersRef.current;


        if (!currentHands[playerId] || !currentHands[playerId][cardIndex] || isProcessingRound.current) return;
        if (currentRanks.some(w => w.id === playerId)) return;


        const card = currentHands[playerId][cardIndex];
        const currentTable = [...table];
        const isLeadMove = currentTable.length === 0;


        const newHand = [...currentHands[playerId]];
        newHand.splice(cardIndex, 1);


        const playedCard = { ...card, playedBy: playerId };
        const updatedHandsAfterPlay = {
            ...currentHands,
            [playerId]: sortHand(newHand),
        };


        latestHandsRef.current = updatedHandsAfterPlay;


        const fullTable = [...currentTable, playedCard];


        setHands(updatedHandsAfterPlay);
        setTable(fullTable);


        const ranksAfterPlay = latestWinnersRef.current;
        if (ranksAfterPlay.length >= 4) {
            setTurn('');
            isProcessingRound.current = true;
            return;
        }


        const aliveAfterPlay = getAlivePlayers(updatedHandsAfterPlay, ranksAfterPlay);


        if (aliveAfterPlay.length === 0) {
            setTurn('');
            return;
        }


        if (aliveAfterPlay.length === 1) {
            finishRound(playerId, fullTable, updatedHandsAfterPlay, false);
            return;
        }


        if (isLeadMove) {
            pushRecentLeadSuit(playedCard.symbol);
            setHighValuePlayer(playerId);


            const nextPlayer = getNextActivePlayer(playerId, updatedHandsAfterPlay, ranksAfterPlay);
            setTurn(nextPlayer);
            return;
        }


        const leadSuit = currentTable[0].symbol;
        const followedSuit = playedCard.symbol === leadSuit;


        if (!followedSuit) {
            sharedMemory.current.missing[playerId].add(leadSuit);
            setStriker(playerId);


            const winnerId = getHighestLeadPlayer(fullTable);
            setHighValuePlayer(winnerId);


            addTimer(setTimeout(() => {
                if (finishBlockedRef.current || !isMountedRef.current) return;
                setStriker(null);
            }, 1000));


            finishRound(winnerId, fullTable, updatedHandsAfterPlay, true);
            return;
        }


        const currentWinner = getHighestLeadPlayer(fullTable);
        setHighValuePlayer(currentWinner);


        const roundPlayers = fullTable.map(c => c.playedBy);
        const remainingEligiblePlayers = aliveAfterPlay.filter(p => !roundPlayers.includes(p));


        if (remainingEligiblePlayers.length === 0) {
            const winnerId = getHighestLeadPlayer(fullTable);
            setHighValuePlayer(winnerId);
            finishRound(winnerId, fullTable, updatedHandsAfterPlay, false);
            return;
        }


        const nextPlayer = getNextActivePlayer(playerId, updatedHandsAfterPlay, ranksAfterPlay);
        setTurn(nextPlayer);
    }, [table, getAlivePlayers, getNextActivePlayer, finishRound]);


    const playCard = useCallback((playerId, cardIndex) => {
        if (turn !== playerId || winners.some(w => w.id === playerId) || isDealing || isProcessingRound.current) return;
        executeMove(playerId, cardIndex);
    }, [turn, winners, isDealing, executeMove]);


    // ============================================================
    // FIXED: chooseLeadCardAI — Mastermind AI lead selection
    // Now checks ALL opponents' missing suits, not just next player.
    // Avoids leading suits where any opponent is void (danger dump).
    // ============================================================
    const chooseLeadCardAI = (playerId, aiHand) => {
        const currentHands = latestHandsRef.current;
        const currentRanks = latestWinnersRef.current;

        // First move of entire game: must play Ace of Spades
        if (table.length === 0 && !firstRoundPlayed.current) {
            const aceSpadeIdx = aiHand.findIndex(c => c.symbol === '♠' && c.label === 'A');
            if (aceSpadeIdx !== -1) return aceSpadeIdx;
        }

        // All alive opponents (not ranked, still have cards)
        const aliveOpponents = turnOrder.filter(p =>
            p !== playerId &&
            !currentRanks.some(w => w.id === p) &&
            currentHands[p] &&
            currentHands[p].length > 0
        );

        // Count how many alive opponents are missing (void in) each suit
        // If we lead that suit, those opponents WILL dump their worst cards on us
        const voidCountBySuit = {};
        aliveOpponents.forEach(opponent => {
            sharedMemory.current.missing[opponent].forEach(suit => {
                voidCountBySuit[suit] = (voidCountBySuit[suit] || 0) + 1;
            });
        });

        let bestIdx = 0;
        let bestScore = -Infinity;

        aiHand.forEach((card, idx) => {
            let score = 0;

            // KEY FIX: penalize heavily for each opponent void in this suit
            // Each void opponent = they dump a danger card → we collect it if we win
            const voidOpponents = voidCountBySuit[card.symbol] || 0;
            score -= voidOpponents * 40;

            // Bonus for truly safe suits (no opponent is void)
            if (voidOpponents === 0) {
                score += 25;
            }

            // Prefer low-value cards: low cards are less likely to win the trick
            // which means we collect less (and avoid getting dumped on)
            score += (15 - card.val) * 1.5;

            // Extra penalty for Ace and King: they almost always WIN the trick
            // Winning = collecting all danger dumps from void opponents
            if (card.val >= 14) score -= 20; // Ace
            if (card.val === 13) score -= 12; // King

            // Avoid spamming the same suit repeatedly (opponents adapt)
            const recentSpam = sharedMemory.current.recentLeadSuits
                .filter(s => s === card.symbol).length;
            score -= recentSpam * 10;

            // Prefer suits with more cards in hand (more control, less likely to exhaust)
            const sameSuitCount = aiHand.filter(c => c.symbol === card.symbol).length;
            score += sameSuitCount * 3;

            // If we have a safe suit AND many cards in it, it's the best lead
            if (voidOpponents === 0 && sameSuitCount >= 3) score += 12;

            if (score > bestScore) {
                bestScore = score;
                bestIdx = idx;
            }
        });

        return bestIdx;
    };


    // ============================================================
    // FIXED: chooseFollowCardAI — Mastermind AI follow selection
    // Now detects risky tricks (future void players) and intentionally
    // loses those tricks. When void, dumps highest danger card.
    // ============================================================
    const chooseFollowCardAI = (aiHand, leadSuit) => {
        const currentHands = latestHandsRef.current;
        const currentRanks = latestWinnersRef.current;

        const sameSuitCards = aiHand
            .filter(c => c.symbol === leadSuit)
            .sort((a, b) => a.val - b.val); // ascending

        const currentHigh = table
            .filter(c => c.symbol === leadSuit)
            .sort((a, b) => b.val - a.val)[0];

        if (sameSuitCards.length > 0) {
            // Must follow suit
            const currentHighVal = currentHigh ? currentHigh.val : 0;

            const winningCards = sameSuitCards.filter(c => c.val > currentHighVal);
            const losingCards = sameSuitCards.filter(c => c.val <= currentHighVal);

            // Check remaining players who haven't played this trick yet
            const roundPlayedBy = new Set(table.map(c => c.playedBy));
            const remainingAlive = turnOrder.filter(p =>
                !roundPlayedBy.has(p) &&
                !currentRanks.some(w => w.id === p) &&
                currentHands[p] &&
                currentHands[p].length > 0
            );

            // Future void players will dump danger cards — winning is risky
            const futureVoidCount = remainingAlive.filter(p =>
                sharedMemory.current.missing[p] &&
                sharedMemory.current.missing[p].has(leadSuit)
            ).length;

            // Also check if danger cards (off-suit) are already on the table
            const dangerAlreadyOnTable = table.filter(c => c.symbol !== leadSuit).length;

            const trickIsRisky = futureVoidCount > 0 || dangerAlreadyOnTable > 0;

            if (trickIsRisky) {
                // Try to LOSE intentionally — play highest card that still loses
                if (losingCards.length > 0) {
                    const highestLoser = losingCards[losingCards.length - 1];
                    return aiHand.findIndex(c => c.id === highestLoser.id);
                }
                // Forced to win (all cards beat current high) → play smallest winner
                const smallestWinner = winningCards[0];
                return aiHand.findIndex(c => c.id === smallestWinner.id);
            }

            // Safe trick: win cheaply with smallest winning card
            if (winningCards.length > 0) {
                const smallestWinner = winningCards[0];
                return aiHand.findIndex(c => c.id === smallestWinner.id);
            }

            // Can't win → play smallest card to save higher cards
            return aiHand.findIndex(c => c.id === sameSuitCards[0].id);
        }

        // Void in lead suit → dump our HIGHEST value card (get rid of danger)
        // We cannot win this trick (we're off-suit), so dump the worst card in hand
        const sortedByDanger = [...aiHand].sort((a, b) => b.val - a.val);
        const dumpCard = sortedByDanger[0];
        return aiHand.findIndex(c => c.id === dumpCard.id);
    };


    useEffect(() => {
        if (turn === 'p1' || turn === '' || isDealing || isProcessingRound.current) return;
        if (winners.some(w => w.id === turn)) return;
        if (!hands[turn] || hands[turn].length === 0) return;


        const aiTimer = addTimer(setTimeout(() => {
            const currentHands = latestHandsRef.current;
            const currentTurn = latestTurnRef.current;
            const currentRanks = latestWinnersRef.current;


            if (!currentTurn || currentTurn === 'p1') return;
            if (currentRanks.some(w => w.id === currentTurn)) return;


            const aiHand = currentHands[currentTurn];
            if (!aiHand || aiHand.length === 0) return;


            let idx = -1;


            if (table.length === 0) {
                idx = chooseLeadCardAI(currentTurn, aiHand);
            } else {
                const leadSuit = table[0].symbol;
                idx = chooseFollowCardAI(aiHand, leadSuit);
            }


            if (idx !== -1) executeMove(currentTurn, idx);
        }, 1100));


        return () => clearTimeout(aiTimer);
    }, [turn, table, hands, winners, isDealing, executeMove, getNextActivePlayer, discardedPile.length]);


    const getProfileLabel = (playerId) => {
        const info = winners.find(w => w.id === playerId);
        if (!info) return null;
        if (info.rank === 4) return "Oops! Donkey";
        return getRankText(info.rank);
    };


    return (
        <div className="game-root position-relative overflow-hidden bg-black" style={{ width: "100%", height: "100dvh" }}>
            <div
                className="position-absolute top-0 w-100 d-flex justify-content-between align-items-center"
                style={{
                    zIndex: 9999,
                    paddingTop: 'calc(env(safe-area-inset-top) + 10px)',
                    paddingLeft: '15px',
                    paddingRight: '15px',
                    pointerEvents: 'none'
                }}
            >
                <button
                    className="btn btn-sm text-white bg-dark bg-opacity-75 rounded-circle p-2 shadow-lg d-flex align-items-center justify-content-center"
                    onClick={() => setExternalShowExit(true)}
                    style={{
                        pointerEvents: 'auto',
                        width: '45px',
                        height: '45px',
                        border: '1px solid rgba(255,255,255,0.2)'
                    }}
                >
                    <ArrowLeft size={28} />
                </button>


                <div
                    className="bg-warning text-dark px-3 py-2 rounded-pill fw-bold shadow-sm"
                    style={{
                        pointerEvents: 'auto',
                        fontSize: '0.8rem',
                        border: '1px solid rgba(0,0,0,0.1)'
                    }}
                >
                    Discarded: {discardedPile.length}
                </div>
            </div>


            <div className="position-absolute top-0 start-50 translate-middle-x mt-5 pt-4" style={{ zIndex: 1500 }}>
                <PlayerSlot
                    pos="p3"
                    name={actorNames.current[0] || "Actor 3"}
                    count={hands.p3.length}
                    isTurn={turn === 'p3'}
                    winnerInfo={winners.find(w => w.id === 'p3') ? { ...winners.find(w => w.id === 'p3'), text: getProfileLabel('p3') } : null}
                    isHighValue={highValuePlayer === 'p3'}
                    isStriker={striker === 'p3'}
                />
            </div>


            <div className="position-absolute start-0 top-50 translate-middle-y ms-2" style={{ zIndex: 1500, transform: 'translateY(-120px)' }}>
                <PlayerSlot
                    pos="p2"
                    name={actorNames.current[1] || "Actor 2"}
                    count={hands.p2.length}
                    isTurn={turn === 'p2'}
                    winnerInfo={winners.find(w => w.id === 'p2') ? { ...winners.find(w => w.id === 'p2'), text: getProfileLabel('p2') } : null}
                    isHighValue={highValuePlayer === 'p2'}
                    isStriker={striker === 'p2'}
                />
            </div>


            <div className="position-absolute end-0 top-50 translate-middle-y me-2" style={{ zIndex: 1500, transform: 'translateY(-120px)' }}>
                <PlayerSlot
                    pos="p4"
                    name={actorNames.current[2] || "Actor 4"}
                    count={hands.p4.length}
                    isTurn={turn === 'p4'}
                    winnerInfo={winners.find(w => w.id === 'p4') ? { ...winners.find(w => w.id === 'p4'), text: getProfileLabel('p4') } : null}
                    isHighValue={highValuePlayer === 'p4'}
                    isStriker={striker === 'p4'}
                />
            </div>


            <div
                className="position-absolute top-50 start-50 translate-middle rounded-circle shadow-lg"
                style={{ width: '280px', height: '280px', background: 'radial-gradient(circle, #1a4d2e 0%, #0a2414 100%)', zIndex: 100, border: '4px solid rgba(255,255,255,0.1)' }}
            >
                <div className="d-flex h-100 justify-content-center align-items-center position-relative">
                    <AnimatePresence>
                        {table.map((c, i) => {
                            const slots = { p1: { y: 60, x: 0 }, p4: { x: 60, y: 0 }, p3: { y: -60, x: 0 }, p2: { x: -60, y: 0 } };
                            const p = slots[c.playedBy];
                            let exX = 0, exY = 0;
                            if (collectingPlayer === 'DISCARD') { exX = 150; exY = -400; }
                            else if (collectingPlayer) {
                                if (collectingPlayer === 'p1') exY = 400;
                                if (collectingPlayer === 'p2') exX = -400;
                                if (collectingPlayer === 'p3') exY = -400;
                                if (collectingPlayer === 'p4') exX = 400;
                            }
                            return (
                                <motion.div
                                    key={c.id}
                                    initial={{ scale: 0, opacity: 0 }}
                                    animate={{ x: p.x, y: p.y, scale: 1, opacity: 1 }}
                                    exit={{ x: exX, y: exY, scale: 0, opacity: 0, transition: { duration: 0.4 } }}
                                    className="position-absolute"
                                    style={{ zIndex: 500 + i }}
                                >
                                    <CardView card={c} />
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
                    minHeight: 'calc(190px + env(safe-area-inset-bottom, 48px))',
                    paddingBottom: 'calc(env(safe-area-inset-bottom, 48px) + 20px)',
                    paddingTop: '10px',
                    borderTop: '1px solid rgba(25, 135, 84, 0.4)'
                }}
            >
                {myRankInfo ? (
                    <div className="text-center py-2">
                        <Trophy size={45} className="text-warning mb-1" />
                        <div className="text-warning fw-bold h5">{getProfileLabel('p1')}</div>
                    </div>
                ) : (
                    <>
                        <div className="text-center mb-1 d-flex flex-column gap-0">
                            <span className="x-small fw-black text-success text-uppercase mb-1 tracking-widest">You</span>
                            <span className={`p-1 px-3 rounded-pill small fw-bold ${turn === 'p1' ? 'bg-success text-white' : 'bg-secondary text-white opacity-50'}`}>
                                HAND: {hands.p1.length}
                            </span>
                        </div>


                        <div className="d-flex justify-content-center align-items-end" style={{ height: '110px', width: '100%', position: 'relative', marginBottom: '5px' }}>
                            {hands.p1.map((c, i) => {
                                const eligible = isCardEligible(c, hands.p1);
                                const cardWidth = 58;
                                const containerWidth = window.innerWidth - 30;
                                let overlap = hands.p1.length * cardWidth > containerWidth ? (hands.p1.length * cardWidth - containerWidth) / (hands.p1.length - 1 || 1) : 0;
                                return (
                                    <motion.div
                                        key={c.id}
                                        initial={{ y: -250, opacity: 0 }}
                                        animate={{ y: (turn === 'p1' && eligible) ? -25 : 0, scale: 1, opacity: 1 }}
                                        transition={{ delay: isDealing ? i * 0.08 : 0, type: 'spring', stiffness: 300, damping: 20 }}
                                        style={{
                                            marginLeft: i === 0 ? 0 : -overlap,
                                            zIndex: (turn === 'p1' && eligible) ? 200 + i : i,
                                            opacity: (turn === 'p1' && !eligible) ? 0.6 : 1
                                        }}
                                    >
                                        <CardView card={c} isInteractive={turn === 'p1' && eligible} onClick={() => playCard('p1', i)} />
                                    </motion.div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>


            <AnimatePresence>{showWinnerPopup && (
                <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="position-absolute top-50 start-50 translate-middle text-center p-4 rounded-4 bg-dark border border-warning shadow-lg"
                    style={{ zIndex: 4000, width: '280px' }}
                >
                    <div className="display-4">🥇</div>
                    <h2 className="text-warning fw-bold mt-2">WINNER!</h2>
                    <button className="btn btn-warning w-100 fw-bold mt-2 rounded-pill" onClick={() => setShowWinnerPopup(false)}>Watch</button>
                </motion.div>
            )}</AnimatePresence>


            {externalShowExit && <ExitModal onCancel={() => setExternalShowExit(false)} onConfirm={onExit} />}
            <style>{`.fw-black { font-weight: 900; } .x-small { font-size: 0.65rem; } .game-root { height: 100dvh !important; padding-bottom: env(safe-area-inset-bottom, 0px); box-sizing: border-box; }`}</style>
        </div>
    );
}
