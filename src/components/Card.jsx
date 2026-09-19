import React from 'react';

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

export default function Card({ card, onClick, isInteractive }) {
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
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)',
                userSelect: 'none',
                position: 'relative',
                transition: 'all 0.2s ease'
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
        </div>
    );
}