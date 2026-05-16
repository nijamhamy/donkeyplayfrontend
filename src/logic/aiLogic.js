export const getAICardMove = (aiHand, table, skipPile) => {
    let cardIdx = -1;

    if (table.length === 0) {
        // AI ஆட்டத்தைத் தொடங்கினால்: Ace of Spades விதி
        const aceSpades = aiHand.findIndex(c => c.symbol === '♠' && c.label === 'A');
        cardIdx = (aceSpades !== -1 && skipPile.length === 0) ? aceSpades : 0;
    } else {
        // மேசையில் இருக்கும் கார்டைப் பின்பற்றுதல்
        const leadSuit = table[0].symbol;
        const sameSuit = aiHand.findIndex(c => c.symbol === leadSuit);
        if (sameSuit !== -1) {
            cardIdx = sameSuit;
        } else {
            // Escape Move: மிகப்பெரிய கார்டைத் தள்ளிவிடுதல்
            cardIdx = aiHand.indexOf(aiHand.reduce((prev, curr) => prev.val > curr.val ? prev : curr));
        }
    }
    return cardIdx;
};