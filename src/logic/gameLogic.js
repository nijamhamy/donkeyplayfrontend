export const createShuffledDeck = () => {
    const suits = [
        { name: 'Spades', symbol: '♠' },
        { name: 'Hearts', symbol: '♥' },
        { name: 'Clubs', symbol: '♣' },
        { name: 'Diamonds', symbol: '♦' }
    ];
    const labels = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
    let deck = [];

    suits.forEach(suit => {
        labels.forEach((label, index) => {
            deck.push({
                id: `${suit.name}-${label}`,
                name: suit.name,
                symbol: suit.symbol,
                label: label,
                val: index + 2,
                color: (suit.name === 'Hearts' || suit.name === 'Diamonds') ? 'red' : 'black'
            });
        });
    });

    return deck.sort(() => Math.random() - 0.5);
};