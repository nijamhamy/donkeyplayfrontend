import React from 'react';
import { User, Cpu, Medal } from 'lucide-react';

const MedalIcon = ({ rank }) => {
    const colors = {
        1: '#FFD700',
        2: '#C0C0C0',
        3: '#CD7F32',
        4: '#ff4d4f'
    };

    return <Medal size={20} style={{ color: colors[rank] || '#ffffff' }} />;
};

const getWinnerText = (winnerInfo) => {
    if (!winnerInfo) return null;
    if (winnerInfo.text) return winnerInfo.text;
    if (winnerInfo.rank === 1) return '1st Winner';
    if (winnerInfo.rank === 2) return '2nd Winner';
    if (winnerInfo.rank === 3) return '3rd Winner';
    if (winnerInfo.rank === 4) return 'Donkey';
    return 'Finished';
};

export default function PlayerSlot({ pos, name, count, isTurn, winnerInfo, isHighValue, isStriker }) {
    const isUser = pos === 'p1';
    const winnerText = getWinnerText(winnerInfo);

    return (
        <div className={`player-slot-wrapper ${isHighValue ? 'high-value-glow' : ''} ${isStriker ? 'striker-blink' : ''}`}>
            <div
                className={`p-2 rounded-3 border-2 d-flex flex-column align-items-center shadow-lg transition-all ${isTurn ? 'bg-success border-white scale-110' : 'bg-dark border-secondary opacity-75'
                    }`}
                style={{ minWidth: '75px' }}
            >
                {isUser ? <User size={20} color="white" /> : <Cpu size={20} className="text-danger" />}

                <span className="fw-bold small mt-1 text-white">{name}</span>

                <span
                    className={`badge mt-1 ${winnerInfo
                            ? winnerInfo.rank === 1
                                ? 'bg-warning text-dark'
                                : winnerInfo.rank === 2
                                    ? 'bg-light text-dark'
                                    : winnerInfo.rank === 3
                                        ? 'bg-info text-dark'
                                        : 'bg-danger text-white'
                            : 'bg-black'
                        }`}
                    style={{
                        fontSize: winnerInfo ? '0.62rem' : '0.7rem',
                        whiteSpace: 'nowrap',
                        maxWidth: '72px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                    }}
                >
                    {winnerInfo ? winnerText : `Cards: ${count}`}
                </span>

                {winnerInfo && (
                    <div className="mt-1">
                        <MedalIcon rank={winnerInfo.rank} />
                    </div>
                )}
            </div>
        </div>
    );
}