import React, { useEffect } from 'react';

// Import all 52 card images
import ace_of_spades from '../assets/cards/ace_of_spades2.png';
import king_of_spades from '../assets/cards/king_of_spades2.png';
import queen_of_spades from '../assets/cards/queen_of_spades2.png';
import jack_of_spades from '../assets/cards/jack_of_spades2.png';
import ten_of_spades from '../assets/cards/10_of_spades.png';
import nine_of_spades from '../assets/cards/9_of_spades.png';
import eight_of_spades from '../assets/cards/8_of_spades.png';
import seven_of_spades from '../assets/cards/7_of_spades.png';
import six_of_spades from '../assets/cards/6_of_spades.png';
import five_of_spades from '../assets/cards/5_of_spades.png';
import four_of_spades from '../assets/cards/4_of_spades.png';
import three_of_spades from '../assets/cards/3_of_spades.png';
import two_of_spades from '../assets/cards/2_of_spades.png';

import ace_of_hearts from '../assets/cards/ace_of_hearts.png';
import king_of_hearts from '../assets/cards/king_of_hearts2.png';
import queen_of_hearts from '../assets/cards/queen_of_hearts2.png';
import jack_of_hearts from '../assets/cards/jack_of_hearts2.png';
import ten_of_hearts from '../assets/cards/10_of_hearts.png';
import nine_of_hearts from '../assets/cards/9_of_hearts.png';
import eight_of_hearts from '../assets/cards/8_of_hearts.png';
import seven_of_hearts from '../assets/cards/7_of_hearts.png';
import six_of_hearts from '../assets/cards/6_of_hearts.png';
import five_of_hearts from '../assets/cards/5_of_hearts.png';
import four_of_hearts from '../assets/cards/4_of_hearts.png';
import three_of_hearts from '../assets/cards/3_of_hearts.png';
import two_of_hearts from '../assets/cards/2_of_hearts.png';

import ace_of_diamonds from '../assets/cards/ace_of_diamonds.png';
import king_of_diamonds from '../assets/cards/king_of_diamonds2.png';
import queen_of_diamonds from '../assets/cards/queen_of_diamonds2.png';
import jack_of_diamonds from '../assets/cards/jack_of_diamonds2.png';
import ten_of_diamonds from '../assets/cards/10_of_diamonds.png';
import nine_of_diamonds from '../assets/cards/9_of_diamonds.png';
import eight_of_diamonds from '../assets/cards/8_of_diamonds.png';
import seven_of_diamonds from '../assets/cards/7_of_diamonds.png';
import six_of_diamonds from '../assets/cards/6_of_diamonds.png';
import five_of_diamonds from '../assets/cards/5_of_diamonds.png';
import four_of_diamonds from '../assets/cards/4_of_diamonds.png';
import three_of_diamonds from '../assets/cards/3_of_diamonds.png';
import two_of_diamonds from '../assets/cards/2_of_diamonds.png';

import ace_of_clubs from '../assets/cards/ace_of_clubs2.png';
import king_of_clubs from '../assets/cards/king_of_clubs2.png';
import queen_of_clubs from '../assets/cards/queen_of_clubs2.png';
import jack_of_clubs from '../assets/cards/jack_of_clubs2.png';
import ten_of_clubs from '../assets/cards/10_of_clubs.png';
import nine_of_clubs from '../assets/cards/9_of_clubs.png';
import eight_of_clubs from '../assets/cards/8_of_clubs.png';
import seven_of_clubs from '../assets/cards/7_of_clubs.png';
import six_of_clubs from '../assets/cards/6_of_clubs.png';
import five_of_clubs from '../assets/cards/5_of_clubs.png';
import four_of_clubs from '../assets/cards/4_of_clubs.png';
import three_of_clubs from '../assets/cards/3_of_clubs.png';
import two_of_clubs from '../assets/cards/2_of_clubs.png';

// Map card rank+suit -> imported image
// Keys use the SAME casing your gameLogic.js produces: 'Spades','Hearts','Diamonds','Clubs'
const CARD_IMAGES = {
    Spades: {
        A: ace_of_spades, K: king_of_spades, Q: queen_of_spades, J: jack_of_spades,
        10: ten_of_spades, 9: nine_of_spades, 8: eight_of_spades, 7: seven_of_spades,
        6: six_of_spades, 5: five_of_spades, 4: four_of_spades, 3: three_of_spades, 2: two_of_spades,
    },
    Hearts: {
        A: ace_of_hearts, K: king_of_hearts, Q: queen_of_hearts, J: jack_of_hearts,
        10: ten_of_hearts, 9: nine_of_hearts, 8: eight_of_hearts, 7: seven_of_hearts,
        6: six_of_hearts, 5: five_of_hearts, 4: four_of_hearts, 3: three_of_hearts, 2: two_of_hearts,
    },
    Diamonds: {
        A: ace_of_diamonds, K: king_of_diamonds, Q: queen_of_diamonds, J: jack_of_diamonds,
        10: ten_of_diamonds, 9: nine_of_diamonds, 8: eight_of_diamonds, 7: seven_of_diamonds,
        6: six_of_diamonds, 5: five_of_diamonds, 4: four_of_diamonds, 3: three_of_diamonds, 2: two_of_diamonds,
    },
    Clubs: {
        A: ace_of_clubs, K: king_of_clubs, Q: queen_of_clubs, J: jack_of_clubs,
        10: ten_of_clubs, 9: nine_of_clubs, 8: eight_of_clubs, 7: seven_of_clubs,
        6: six_of_clubs, 5: five_of_clubs, 4: four_of_clubs, 3: three_of_clubs, 2: two_of_clubs,
    },
};

// ---------- 3D card styling (visual only) ----------
// Injected once into <head> instead of repeating a <style> tag on all 52 cards.
const CARD_STYLE_ID = 'card3d-styles';
const CARD_CSS = `
.card-item { transform-style: preserve-3d; will-change: transform; }
.card-item .card-gloss { position:absolute; inset:0; pointer-events:none; border-radius:inherit; z-index:2;
    background: linear-gradient(115deg, rgba(255,255,255,.38) 0%, rgba(255,255,255,.08) 28%, rgba(255,255,255,0) 45%, rgba(0,0,0,.10) 100%); }
.card-item .card-edge { position:absolute; inset:0; pointer-events:none; border-radius:inherit; z-index:3;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,.55), inset 0 -2px 3px rgba(0,0,0,.18); }
.card-item.interactive .card-sheen { position:absolute; top:0; bottom:0; width:40%; left:-70%; z-index:4; pointer-events:none;
    background: linear-gradient(100deg, transparent, rgba(255,255,255,.65), transparent);
    transform: skewX(-20deg); animation: cardSheen 2.8s ease-in-out infinite; }
@keyframes cardSheen { 0%,55% { left:-70%; } 100% { left:130%; } }
.card-item.interactive:active { transform: translateY(2px) scale(.97) !important; }
@media (hover: hover) {
    .card-item.interactive:hover { transform: perspective(300px) rotateX(8deg) translateY(-4px) !important;
        box-shadow: 0 0 0 2px rgba(250,204,21,.95), 0 3px 0 #b8b8b8, 0 14px 18px rgba(0,0,0,.5) !important; }
}
@media (prefers-reduced-motion: reduce) { .card-item.interactive .card-sheen { animation: none !important; } }
`;

export default function Card({ card, onClick, isInteractive }) {
    useEffect(() => {
        if (typeof document === 'undefined') return;
        if (document.getElementById(CARD_STYLE_ID)) return;
        const el = document.createElement('style');
        el.id = CARD_STYLE_ID;
        el.textContent = CARD_CSS;
        document.head.appendChild(el);
    }, []);

    if (!card) return null;

    // card.name is 'Spades' | 'Hearts' | 'Diamonds' | 'Clubs' (matches gameLogic/Game.jsx sortHand)
    // card.label is expected as 'A','2'...'10','J','Q','K'
    const imageSrc = CARD_IMAGES[card.name]?.[card.label];

    return (
        <div
            onClick={isInteractive ? onClick : null}
            className={`card-item ${isInteractive ? 'interactive' : ''}`}
            style={{
                width: '58px',
                height: '85px',
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #999',
                overflow: 'hidden',
                cursor: isInteractive ? 'pointer' : 'default',
                // layered shadow = card thickness (bottom edge) + soft drop shadow
                boxShadow: '0 3px 0 #b5b5b5, 0 4px 0 #8a8a8a, 0 9px 12px rgba(0,0,0,0.45)',
                userSelect: 'none',
                position: 'relative',
                transition: 'transform 0.2s ease, box-shadow 0.2s ease'
            }}
        >
            {imageSrc ? (
                <img
                    src={imageSrc}
                    alt={`${card.label} of ${card.name}`}
                    draggable={false}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        display: 'block',
                        pointerEvents: 'none'
                    }}
                />
            ) : (
                // fallback if image not found (shouldn't normally show now)
                <div style={{
                    width: '100%', height: '100%',
                    display: 'flex', flexDirection: 'column',
                    padding: '4px 6px', color: card.color
                }}>
                    <div style={{ fontSize: '1.1rem', fontWeight: 900 }}>{card.label}</div>
                    <div style={{
                        fontSize: '2.2rem', flexGrow: 1,
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        {card.symbol}
                    </div>
                </div>
            )}

            {/* 3D finish layers (decorative only) */}
            <span className="card-gloss" />
            <span className="card-edge" />
            {isInteractive && <span className="card-sheen" />}
        </div>
    );
}