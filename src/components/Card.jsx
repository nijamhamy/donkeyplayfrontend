import React from 'react';

export default function Card({ card, onClick, isInteractive }) {
    if (!card) return null;

    return (
        <div
            onClick={isInteractive ? onClick : null}
            className={`card-item ${isInteractive ? 'interactive' : ''}`}
            style={{
                width: '58px', // கார்டு அகலத்தை சற்று அதிகரித்துள்ளேன்
                height: '85px', // கார்டு உயரத்தை அதிகரித்துள்ளேன்
                backgroundColor: 'white',
                borderRadius: '8px',
                border: '1px solid #999',
                display: 'flex',
                flexDirection: 'column',
                padding: '4px 6px', // உட்புற இடைவெளி
                color: card.color,
                cursor: isInteractive ? 'pointer' : 'default',
                boxShadow: '0 4px 8px rgba(0,0,0,0.3)', // நிழல் (Shadow) அடர்த்தியாக்கப்பட்டுள்ளது
                userSelect: 'none',
                position: 'relative',
                transition: 'all 0.2s ease'
            }}
        >
            {/* கார்டு எண் - இடது மூலையில் (Top-Left) */}
            <div style={{
                fontSize: '1.1rem',
                fontWeight: '900',
                lineHeight: '1',
                textAlign: 'left'
            }}>
                {card.label}
            </div>

            {/* கார்டு சின்னம் - மையத்தில் பெரியதாக (Center) */}
            <div style={{
                fontSize: '2.2rem', // சின்னத்தின் அளவை கணிசமாக அதிகரித்துள்ளேன்
                lineHeight: '1',
                display: 'flex',
                flexGrow: 1,
                alignItems: 'center',
                justifyContent: 'center',
                marginTop: '-5px' // எண் மற்றும் சின்னத்திற்கு இடையே சரிசெய்தல்
            }}>
                {card.symbol}
            </div>
        </div>
    );
}