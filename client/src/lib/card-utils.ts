import { Card } from '@shared/schema';


export const CARD_VALUES: Record<string, number> = {
  '2': 2,
  '3': 3,
  '4': 4,
  '5': 5,
  '6': 6,
  '7': 7,
  '8': 8,
  '9': 9,
  '10': 10,
  'J': 10,
  'Q': 10,
  'K': 10,
  'A': 11, 
};


export const SUIT_SYMBOLS: Record<string, string> = {
  'hearts': '♥',
  'diamonds': '♦',
  'clubs': '♣',
  'spades': '♠',
};


export const SUIT_COLORS: Record<string, string> = {
  'hearts': 'text-red-500',
  'diamonds': 'text-red-500',
  'clubs': 'text-gray-900',
  'spades': 'text-gray-900',
};


export function createDeck(): Card[] {
  const suits = ['hearts', 'diamonds', 'clubs', 'spades'] as const;
  const values = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'] as const;
  
  const deck: Card[] = [];
  
  for (const suit of suits) {
    for (const value of values) {
      deck.push({ suit, value });
    }
  }
  
  return deck;
}


export function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}


export function calculateBlackjackHandValue(cards: Card[]): number {
  let value = 0;
  let aceCount = 0;
  
  for (const card of cards) {
    if (card.hidden) continue; 
    
    if (card.value === 'A') {
      aceCount++;
      value += 11;
    } else {
      value += CARD_VALUES[card.value];
    }
  }
  
  
  while (value > 21 && aceCount > 0) {
    value -= 10; 
    aceCount--;
  }
  
  return value;
}


export function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && calculateBlackjackHandValue(cards) === 21;
}


export function getCardDisplayValue(card: Card): string {
  const symbol = SUIT_SYMBOLS[card.suit];
  return `${card.value}${symbol}`;
}


export function getCardColor(card: Card): string {
  return SUIT_COLORS[card.suit];
}


export function isBusted(cards: Card[]): boolean {
  return calculateBlackjackHandValue(cards) > 21;
}


export function sortByValue(cards: Card[]): Card[] {
  return [...cards].sort((a, b) => {
    const valueA = CARD_VALUES[a.value];
    const valueB = CARD_VALUES[b.value];
    return valueA - valueB;
  });
}


export function evaluatePokerHand(cards: Card[]): { type: string, value: number } {
  if (cards.length !== 5) {
    throw new Error('Poker hand evaluation requires exactly 5 cards');
  }
  
  const sortedCards = sortByValue(cards);
  const values = sortedCards.map(card => CARD_VALUES[card.value]);
  const suits = sortedCards.map(card => card.suit);
  
  
  const isFlush = suits.every(suit => suit === suits[0]);
  
  
  let isStraight = true;
  for (let i = 1; i < values.length; i++) {
    if (values[i] !== values[i-1] + 1) {
      isStraight = false;
      break;
    }
  }
  
  
  if (!isStraight && values[0] === 2 && values[1] === 3 && values[2] === 4 && values[3] === 5 && values[4] === 14) {
    isStraight = true;
  }
  
  
  if (isFlush && isStraight && values[0] === 10) {
    return { type: 'royal-flush', value: 9 };
  }
  
  
  if (isFlush && isStraight) {
    return { type: 'straight-flush', value: 8 };
  }
  
  
  const valueCounts: Record<number, number> = {};
  for (const value of values) {
    valueCounts[value] = (valueCounts[value] || 0) + 1;
  }
  
  const counts = Object.values(valueCounts);
  
  
  if (counts.includes(4)) {
    return { type: 'four-of-a-kind', value: 7 };
  }
  
  
  if (counts.includes(3) && counts.includes(2)) {
    return { type: 'full-house', value: 6 };
  }
  
  
  if (isFlush) {
    return { type: 'flush', value: 5 };
  }
  
  
  if (isStraight) {
    return { type: 'straight', value: 4 };
  }
  
  
  if (counts.includes(3)) {
    return { type: 'three-of-a-kind', value: 3 };
  }
  
  
  if (counts.filter(count => count === 2).length === 2) {
    return { type: 'two-pair', value: 2 };
  }
  
  
  if (counts.includes(2)) {
    return { type: 'pair', value: 1 };
  }
  
  
  return { type: 'high-card', value: 0 };
}