import React, { useMemo } from 'react';
import { Medal } from 'lucide-react';

const MedalIcon = ({ rank }) => {
    const colors = {
        1: '#FFD700',
        2: '#C0C0C0',
        3: '#CD7F32',
        4: '#ff4d4f'
    };

    return <Medal size={18} style={{ color: colors[rank] || '#ffffff' }} />;
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

// ---------- Avatar look (picked from the player's name so it is stable) ----------
const SKINS = ['#f5cba7', '#e8b48a', '#d29a6a', '#b97a4b', '#8d5a36', '#f1c9a5'];
const HAIRS = ['#1b1b1b', '#3a2214', '#5a3a1c', '#8a5a2b', '#2b2b3a', '#6b2d1a'];
const SHIRTS = [
    ['#ef4444', '#991b1b'], ['#3b82f6', '#1e3a8a'], ['#a855f7', '#581c87'],
    ['#14b8a6', '#115e59'], ['#f97316', '#9a3412'], ['#ec4899', '#9d174d'],
];
const STYLES = ['short', 'long', 'cap', 'spiky'];

const hashName = (str = '') => {
    str = String(str ?? '');
    let h = 7;
    for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
    return h;
};

function HumanAvatar({ name, mood, isTurn, rank }) {
    const look = useMemo(() => {
        const h = hashName(name);
        return {
            skin: SKINS[h % SKINS.length],
            hair: HAIRS[(h >>> 3) % HAIRS.length],
            shirt: SHIRTS[(h >>> 5) % SHIRTS.length],
            style: STYLES[(h >>> 7) % STYLES.length],
            delay: ((h % 7) * 0.35).toFixed(2),
        };
    }, [name]);

    const isDonkey = rank === 4;

    return (
        <div
            className={`pa-avatar mood-${mood} ${isTurn ? 'is-turn' : ''}`}
            style={{
                '--skin': look.skin, '--hair': look.hair,
                '--shirt1': look.shirt[0], '--shirt2': look.shirt[1],
                '--delay': `${look.delay}s`,
            }}
        >
            <div className="pa-ground" />

            {isTurn && (
                <div className="pa-think"><i /><i /><i /></div>
            )}

            <div className="pa-figure">
                {/* body / shoulders */}
                <div className="pa-body">
                    <span className="pa-collar" />
                    <span className="pa-arm pa-arm-l" />
                    <span className="pa-arm pa-arm-r" />
                </div>
                <div className="pa-neck" />

                {/* head */}
                <div className="pa-head">
                    {look.style === 'long' && <span className="pa-hair-back" />}
                    {isDonkey && <><span className="pa-donkey-ear l" /><span className="pa-donkey-ear r" /></>}
                    <span className="pa-ear l" />
                    <span className="pa-ear r" />
                    <span className="pa-face">
                        <span className="pa-brow l" />
                        <span className="pa-brow r" />
                        <span className="pa-eye l"><b /></span>
                        <span className="pa-eye r"><b /></span>
                        <span className="pa-cheek l" />
                        <span className="pa-cheek r" />
                        <span className="pa-nose" />
                        <span className="pa-mouth" />
                    </span>
                    <span className={`pa-hair style-${look.style}`} />
                    {look.style === 'cap' && <span className="pa-cap-brim" />}
                    {rank === 1 && <span className="pa-crown">♛</span>}
                </div>
            </div>

            <style>{`
                .pa-avatar { position:relative; width:70px; height:76px; perspective:420px; margin:0 auto; }
                .pa-ground { position:absolute; left:50%; bottom:-2px; width:58px; height:12px; margin-left:-29px; border-radius:50%;
                    background: radial-gradient(ellipse, rgba(0,0,0,.65), rgba(0,0,0,0) 70%); }
                .pa-figure { position:absolute; inset:0; transform-style:preserve-3d;
                    animation: paSway 4.2s ease-in-out infinite; animation-delay: var(--delay); }
                .pa-avatar.is-turn .pa-figure { animation: paActive 1.1s ease-in-out infinite; }
                .pa-avatar.mood-happy .pa-figure { animation: paCheer 0.9s ease-in-out infinite; }
                .pa-avatar.mood-angry .pa-figure { animation: paShake .25s linear infinite; }
                .pa-avatar.mood-sad .pa-figure { animation: paSlump 3s ease-in-out infinite; }
                @keyframes paSway { 0%,100% { transform: rotateY(-14deg) translateY(0); } 50% { transform: rotateY(14deg) translateY(-2px); } }
                @keyframes paActive { 0%,100% { transform: rotateY(-8deg) translateY(0) scale(1.04); } 50% { transform: rotateY(8deg) translateY(-6px) scale(1.08); } }
                @keyframes paCheer { 0%,100% { transform: rotateY(-10deg) translateY(0); } 50% { transform: rotateY(10deg) translateY(-9px); } }
                @keyframes paShake { 0%,100% { transform: translateX(-2px) rotateZ(-2deg); } 50% { transform: translateX(2px) rotateZ(2deg); } }
                @keyframes paSlump { 0%,100% { transform: translateY(3px) rotateZ(-3deg); } 50% { transform: translateY(5px) rotateZ(3deg); } }

                /* body */
                .pa-body { position:absolute; left:50%; bottom:2px; width:58px; height:30px; margin-left:-29px;
                    border-radius:28px 28px 8px 8px;
                    background: linear-gradient(160deg, var(--shirt1), var(--shirt2));
                    box-shadow: inset 0 3px 0 rgba(255,255,255,.35), inset 0 -5px 8px rgba(0,0,0,.35), 0 4px 6px rgba(0,0,0,.5);
                    transform: translateZ(-6px); }
                .pa-collar { position:absolute; left:50%; top:-1px; width:18px; height:10px; margin-left:-9px; border-radius:0 0 10px 10px;
                    background: rgba(255,255,255,.9); box-shadow: inset 0 -2px 3px rgba(0,0,0,.2); }
                .pa-arm { position:absolute; top:6px; width:9px; height:22px; border-radius:8px; background: linear-gradient(var(--shirt1), var(--shirt2));
                    box-shadow: inset 2px 0 0 rgba(255,255,255,.2); }
                .pa-arm-l { left:-4px; transform: rotate(8deg); }
                .pa-arm-r { right:-4px; transform: rotate(-8deg); }
                .pa-avatar.mood-happy .pa-arm-l { animation: paArmL .45s ease-in-out infinite alternate; transform-origin: 50% 0; }
                .pa-avatar.mood-happy .pa-arm-r { animation: paArmR .45s ease-in-out infinite alternate; transform-origin: 50% 0; }
                @keyframes paArmL { from { transform: rotate(8deg); } to { transform: rotate(-60deg); } }
                @keyframes paArmR { from { transform: rotate(-8deg); } to { transform: rotate(60deg); } }
                .pa-neck { position:absolute; left:50%; bottom:28px; width:14px; height:10px; margin-left:-7px; border-radius:4px;
                    background: linear-gradient(var(--skin), rgba(0,0,0,.25)), var(--skin); background-blend-mode: multiply; }

                /* head */
                .pa-head { position:absolute; left:50%; top:2px; width:44px; height:46px; margin-left:-22px; transform: translateZ(14px); }
                .pa-face { position:absolute; inset:0; border-radius:50% 50% 48% 48% / 46% 46% 54% 54%;
                    background: radial-gradient(circle at 36% 28%, rgba(255,255,255,.55) 0%, rgba(255,255,255,0) 38%), var(--skin);
                    box-shadow: inset -5px -7px 9px rgba(0,0,0,.28), inset 3px 3px 5px rgba(255,255,255,.25), 0 3px 6px rgba(0,0,0,.45); }
                .pa-ear { position:absolute; top:20px; width:7px; height:11px; border-radius:50%; background: var(--skin);
                    box-shadow: inset -2px -2px 3px rgba(0,0,0,.25); }
                .pa-ear.l { left:-4px; } .pa-ear.r { right:-4px; }

                /* hair */
                .pa-hair { position:absolute; left:-2px; right:-2px; top:-4px; height:22px; background: var(--hair); z-index:3;
                    border-radius: 50% 50% 30% 30% / 90% 90% 40% 40%;
                    box-shadow: inset 0 3px 3px rgba(255,255,255,.25), inset 0 -3px 4px rgba(0,0,0,.35);
                    clip-path: polygon(0 0, 100% 0, 100% 62%, 86% 44%, 62% 54%, 40% 40%, 16% 54%, 0 62%); }
                .pa-hair.style-short { height:20px; }
                .pa-hair.style-spiky { top:-9px; height:26px; border-radius:0;
                    clip-path: polygon(0 70%, 8% 20%, 22% 55%, 34% 5%, 48% 50%, 62% 0, 74% 52%, 88% 15%, 100% 70%, 86% 50%, 62% 58%, 40% 46%, 16% 58%); }
                .pa-hair.style-cap { top:-6px; height:20px; border-radius: 50% 50% 8% 8% / 100% 100% 20% 20%; clip-path:none; background: linear-gradient(var(--shirt1), var(--shirt2)); }
                .pa-cap-brim { position:absolute; left:-4px; right:-4px; top:11px; height:6px; border-radius:4px; z-index:4;
                    background: var(--shirt2); box-shadow: 0 3px 3px rgba(0,0,0,.35); }
                .pa-hair-back { position:absolute; left:-5px; right:-5px; top:2px; height:46px; border-radius:22px 22px 14px 14px;
                    background: var(--hair); transform: translateZ(-4px); box-shadow: inset 0 -6px 6px rgba(0,0,0,.35); }

                /* face parts */
                .pa-eye { position:absolute; top:21px; width:9px; height:10px; border-radius:50%; background:#fff;
                    box-shadow: inset 0 -1px 2px rgba(0,0,0,.2); animation: paBlink 4.5s infinite; animation-delay: var(--delay); transform-origin: 50% 60%; }
                .pa-eye.l { left:8px; } .pa-eye.r { right:8px; }
                .pa-eye b { position:absolute; left:2px; top:2px; width:5px; height:6px; border-radius:50%; background:#1b1b1b;
                    box-shadow: 1px -1px 0 0 rgba(255,255,255,.9) inset; }
                @keyframes paBlink { 0%,92%,100% { transform: scaleY(1); } 95% { transform: scaleY(.08); } }
                .pa-avatar.is-turn .pa-eye b { animation: paLook 1.6s ease-in-out infinite; }
                @keyframes paLook { 0%,100% { transform: translateX(-1px); } 50% { transform: translateX(1px); } }
                .pa-brow { position:absolute; top:16px; width:11px; height:3px; border-radius:3px; background: var(--hair); }
                .pa-brow.l { left:6px; } .pa-brow.r { right:6px; }
                .pa-avatar.mood-angry .pa-brow.l { transform: rotate(18deg); top:17px; }
                .pa-avatar.mood-angry .pa-brow.r { transform: rotate(-18deg); top:17px; }
                .pa-avatar.mood-sad .pa-brow.l { transform: rotate(-14deg); }
                .pa-avatar.mood-sad .pa-brow.r { transform: rotate(14deg); }
                .pa-cheek { position:absolute; top:30px; width:7px; height:5px; border-radius:50%; background: rgba(239,68,68,.35); filter: blur(1px); }
                .pa-cheek.l { left:3px; } .pa-cheek.r { right:3px; }
                .pa-nose { position:absolute; left:50%; top:28px; width:5px; height:5px; margin-left:-2.5px; border-radius:50%;
                    background: rgba(0,0,0,.14); }
                .pa-mouth { position:absolute; left:50%; top:35px; width:14px; height:6px; margin-left:-7px;
                    border-bottom:2.5px solid #7a2a2a; border-radius: 0 0 14px 14px; }
                .pa-avatar.mood-happy .pa-mouth { width:16px; height:9px; margin-left:-8px; background:#7a1f1f; border:0; border-radius:0 0 16px 16px; }
                .pa-avatar.is-turn:not(.mood-happy) .pa-mouth { width:7px; height:7px; margin-left:-3.5px; border:2.5px solid #7a2a2a; border-radius:50%; animation: paTalk 1s ease-in-out infinite; }
                @keyframes paTalk { 0%,100% { transform: scale(1); } 50% { transform: scale(1.25); } }
                .pa-avatar.mood-sad .pa-mouth { top:38px; border-bottom:0; border-top:2.5px solid #7a2a2a; border-radius: 14px 14px 0 0; }
                .pa-avatar.mood-angry .pa-mouth { width:12px; margin-left:-6px; border-bottom:0; border-top:2.5px solid #7a2a2a; border-radius: 12px 12px 0 0; top:37px; }

                /* extras */
                .pa-crown { position:absolute; left:50%; top:-20px; margin-left:-11px; font-size:22px; line-height:1; color:#fde047; z-index:6;
                    text-shadow: 0 0 8px rgba(253,224,71,.9), 0 2px 0 #b45309; animation: paCrown 1.2s ease-in-out infinite; }
                @keyframes paCrown { 0%,100% { transform: translateY(0) rotate(-6deg); } 50% { transform: translateY(-3px) rotate(6deg); } }
                .pa-donkey-ear { position:absolute; top:-22px; width:12px; height:28px; border-radius: 50% 50% 40% 40%; z-index:2;
                    background: linear-gradient(#9ca3af, #6b7280); box-shadow: inset 0 0 0 3px #f9a8d4; }
                .pa-donkey-ear.l { left:-2px; transform: rotate(-22deg); }
                .pa-donkey-ear.r { right:-2px; transform: rotate(22deg); }
                .pa-think { position:absolute; right:-6px; top:-10px; display:flex; gap:3px; padding:3px 6px; border-radius:10px; z-index:8;
                    background: rgba(255,255,255,.92); box-shadow: 0 2px 6px rgba(0,0,0,.5); }
                .pa-think i { width:4px; height:4px; border-radius:50%; background:#16a34a; animation: paDot 1s infinite; }
                .pa-think i:nth-child(2) { animation-delay: .15s; } .pa-think i:nth-child(3) { animation-delay: .3s; }
                @keyframes paDot { 0%,100% { transform: translateY(0); opacity:.4; } 50% { transform: translateY(-3px); opacity:1; } }

                /* name plate */
                .pa-plate { min-width:78px; max-width:96px; margin-top:2px; padding:4px 8px 5px; border-radius:12px; text-align:center;
                    background: linear-gradient(#1f2937, #0b1118); border:2px solid #4b5563;
                    box-shadow: 0 4px 0 rgba(0,0,0,.6), 0 8px 12px rgba(0,0,0,.45), inset 0 1px 0 rgba(255,255,255,.15);
                    transition: transform .25s, border-color .25s, background .25s, opacity .25s; opacity:.85; }
                .pa-plate.turn { background: linear-gradient(#16a34a, #14532d); border-color:#fff; transform: scale(1.1); opacity:1;
                    box-shadow: 0 4px 0 #052e16, 0 0 16px rgba(250,204,21,.6); }
                .pa-name { display:block; color:#fff; font-weight:800; font-size:.72rem; line-height:1.1; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }

                @media (prefers-reduced-motion: reduce) {
                    .pa-figure, .pa-eye, .pa-arm, .pa-crown, .pa-think i, .pa-mouth { animation: none !important; }
                }
            `}</style>
        </div>
    );
}

export default function PlayerSlot({ pos, name, count, isTurn, winnerInfo, isHighValue, isStriker }) {
    const winnerText = getWinnerText(winnerInfo);

    // Mood drives the avatar's face and body animation
    const mood = isStriker
        ? 'angry'
        : winnerInfo
            ? (winnerInfo.rank === 4 ? 'sad' : 'happy')
            : 'idle';

    return (
        <div className={`player-slot-wrapper d-flex flex-column align-items-center ${isHighValue ? 'high-value-glow' : ''} ${isStriker ? 'striker-blink' : ''}`}
            data-pos={pos}
        >
            <HumanAvatar
                name={name}
                mood={mood}
                isTurn={!!isTurn && !winnerInfo}
                rank={winnerInfo?.rank}
            />

            <div className={`pa-plate ${isTurn ? 'turn' : ''}`}>
                <span className="pa-name">{name}</span>

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
                        maxWidth: '82px',
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