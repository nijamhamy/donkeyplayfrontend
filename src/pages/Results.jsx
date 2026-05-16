import React from 'react';
import { Trophy, RotateCcw, Medal } from 'lucide-react';

const MedalIcon = ({ rank }) => {
    const colors = {
        1: '#FFD700',
        2: '#C0C0C0',
        3: '#CD7F32',
        4: '#dc3545'
    };

    return <Medal size={28} style={{ color: colors[rank] || '#ffffff' }} />;
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

    return (
        <div className="vh-100 d-flex flex-column align-items-center justify-content-center p-4">
            <div
                className="bg-dark p-4 rounded-4 border border-warning shadow-lg text-center w-100"
                style={{ maxWidth: '450px' }}
            >
                <Trophy size={60} className="text-warning mb-3" />
                <h2 className="text-warning fw-bold mb-4">MATCH RESULTS</h2>

                <div className="d-flex flex-column gap-2 mb-4 text-start">
                    {safeWinners
                        .filter((w) => w.rank !== 4)
                        .map((w, index) => (
                            <div
                                key={w.id || index}
                                className="d-flex align-items-center justify-content-between bg-black bg-opacity-40 p-3 rounded-pill border border-secondary"
                            >
                                <div className="d-flex align-items-center gap-2 overflow-hidden">
                                    <MedalIcon rank={w.rank} />
                                    <span className="fw-bold text-truncate">
                                        {getPlayerName(w, index)}
                                    </span>
                                </div>

                                <span className="small text-secondary ms-2">
                                    {getRankText(w.rank)}
                                </span>
                            </div>
                        ))}

                    {donkeyWinner && (
                        <div className="mt-3 p-3 bg-danger bg-opacity-20 rounded-4 border border-danger text-center shadow">
                            <div className="display-4">🫏</div>
                            <div className="h4 fw-bold text-danger mb-0">
                                DONKEY: {getPlayerName(donkeyWinner, safeWinners.length)}
                            </div>
                        </div>
                    )}
                </div>

                <button
                    className="btn btn-warning btn-lg w-100 fw-bold rounded-pill mt-2 shadow"
                    onClick={onRestart}
                >
                    <RotateCcw size={20} className="me-2" /> REPLAY GAME
                </button>
            </div>
        </div>
    );
}