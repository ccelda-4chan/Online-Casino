import { Request, Response } from "express";
import { storage } from "./storage";
import { 
  betSchema, 
  slotsPayoutSchema, 
  diceRollSchema, 
  crashGameSchema, 
  plinkoGameSchema,
  rouletteBetSchema, 
  rouletteResultSchema, 
  RouletteBetType,
  blackjackBetSchema,
  blackjackStateSchema,
  blackjackActionSchema,
  cardSchema,
  Card,
  PlinkoGame
} from "@shared/schema";
import { z } from "zod";
import { getAdjustedWinChance, shouldBeBigWin, getBigWinMultiplierBoost } from "./win-rate";




async function getVipWinMultiplier(userId: number): Promise<number> {
  try {
    
    const user = await storage.getUser(userId);
    if (!user || !user.subscriptionTier) {
      return 1.0; 
    }
    
    
    switch (user.subscriptionTier) {
      case 'bronze':
        return 1.0; 
      case 'silver':
        return 1.1; 
      case 'gold':
        return 1.25; 
      default:
        return 1.0;
    }
  } catch (error) {
    console.error("Error getting VIP win multiplier:", error);
    return 1.0; 
  }
}


declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}



const SLOT_SYMBOLS = ["🍒", "🍋", "🍊", "🍇", "🔔", "💎", "7️⃣", "🍀", "⭐", "🎰"];



const SYMBOL_WEIGHTS = [
  100, 
  95,  
  90,  
  75,  
  50,  
  20,  
  10,  
  5,   
  1,   
  0.5  
];



const SYMBOL_MULTIPLIERS = {
  "🍒": 1.2,   
  "🍋": 1.5,
  "🍊": 2,
  "🍇": 3,
  "🔔": 5,
  "💎": 10,
  "7️⃣": 25,
  "🍀": 75,
  "⭐": 250,
  "🎰": 1000   
};


const PATTERN_MULTIPLIERS = {
  "pair": 0.4,        
  "diagonal": 1.5,    
  "middle_row": 1.2,  
  "full_grid": 20     
};




export async function playSlots(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const parsedBody = betSchema.parse(req.body);
    const { amount } = parsedBody;
    
    
    if (amount > 10000) {
      return res.status(400).json({ message: "Maximum bet amount is 10,000 coins" });
    }
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    
    const playCount = await storage.getUserPlayCount(userId);
    
    
    const slotWinChance = getAdjustedWinChance('slots', playCount);
    
    
    const isBigWin = shouldBeBigWin(playCount);
    
    
    const getWeightedRandomSymbol = () => {
      
      const totalWeight = SYMBOL_WEIGHTS.reduce((sum, weight) => sum + weight, 0);
      
      let random = Math.random() * totalWeight;
      
      
      for (let i = 0; i < SYMBOL_WEIGHTS.length; i++) {
        random -= SYMBOL_WEIGHTS[i];
        if (random <= 0) {
          return SLOT_SYMBOLS[i];
        }
      }
      
      return SLOT_SYMBOLS[0];
    };
    
    
    const symbols = Array(3).fill(null).map(() => 
      Array(3).fill(null).map(() => getWeightedRandomSymbol())
    );
    
    
    let multiplier = 0;
    let isWin = false;
    let winningLines: number[][] = [];
    
    
    const winLines = [
      
      [[0,0], [0,1], [0,2]],
      [[1,0], [1,1], [1,2]],
      [[2,0], [2,1], [2,2]],
      
      [[0,0], [1,0], [2,0]],
      [[0,1], [1,1], [2,1]],
      [[0,2], [1,2], [2,2]],
      
      [[0,0], [1,1], [2,2]],
      [[0,2], [1,1], [2,0]]
    ];
    
    
    for (const line of winLines) {
      const [row1, col1] = line[0];
      const [row2, col2] = line[1];
      const [row3, col3] = line[2];
      
      const symbol1 = symbols[row1][col1];
      const symbol2 = symbols[row2][col2];
      const symbol3 = symbols[row3][col3];
      
      
      if (symbol1 === symbol2 && symbol2 === symbol3 && Math.random() * 100 < slotWinChance) {
        
        const baseMultiplier = SYMBOL_MULTIPLIERS[symbol1 as keyof typeof SYMBOL_MULTIPLIERS];
        
        
        let lineMultiplier = baseMultiplier;
        
        
        if (isBigWin) {
          lineMultiplier *= getBigWinMultiplierBoost();
        }
        
        
        if ((row1 === 0 && col1 === 0 && row3 === 2 && col3 === 2) || 
            (row1 === 0 && col1 === 2 && row3 === 2 && col3 === 0)) {
          lineMultiplier *= PATTERN_MULTIPLIERS.diagonal;
        }
        
        
        if (row1 === 1 && row2 === 1 && row3 === 1) {
          lineMultiplier *= PATTERN_MULTIPLIERS.middle_row;
        }
        
        multiplier += lineMultiplier;
        isWin = true;
        winningLines.push([row1, col1, row2, col2, row3, col3]);
      }
      
      else if (Math.random() * 100 < (slotWinChance / 2) && ((symbol1 === symbol2 && symbol1 !== symbol3) || 
               (symbol2 === symbol3 && symbol1 !== symbol2) ||
               (symbol1 === symbol3 && symbol1 !== symbol2))) {
        
        let pairMultiplier = PATTERN_MULTIPLIERS.pair;
        
        
        if (isBigWin) {
          pairMultiplier *= 1.5;
        }
        
        multiplier += pairMultiplier;
        isWin = true;
        
      }
    }
    
    
    
    const firstSymbol = symbols[0][0];
    let allSame = true;
    
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        if (symbols[i][j] !== firstSymbol) {
          allSame = false;
          break;
        }
      }
      if (!allSame) break;
    }
    
    
    
    const fullGridWinChance = (slotWinChance / 2) + (isBigWin ? 20 : 0);
    if (allSame && Math.random() * 100 < fullGridWinChance) {
      
      
      let jackpotMultiplier = SYMBOL_MULTIPLIERS[firstSymbol as keyof typeof SYMBOL_MULTIPLIERS] * PATTERN_MULTIPLIERS.full_grid;
      
      
      if (isBigWin) {
        jackpotMultiplier *= getBigWinMultiplierBoost();
      }
      
      multiplier = jackpotMultiplier;
      isWin = true;
      
    }
    
    
    const vipMultiplier = await getVipWinMultiplier(userId);
    
    
    const payout = isWin ? amount * multiplier * vipMultiplier : 0;
    
    
    const newBalance = Number(user.balance) - amount + payout;
    
    
    if (isWin && vipMultiplier > 1.0) {
      console.log(`Applied VIP multiplier (${vipMultiplier}x) to user ${userId}'s slots win. Base payout: ${amount * multiplier}, Final payout: ${payout}`);
    }
    await storage.updateUserBalance(userId, newBalance);
    
    
    await storage.createTransaction({
      userId,
      gameType: "slots",
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
      isWin
    });
    
    
    await storage.incrementPlayCount(userId);
    
    
    const result = slotsPayoutSchema.parse({
      symbols,
      multiplier,
      payout,
      isWin,
      winningLines: winningLines.length > 0 ? winningLines : undefined
    });
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Slots game error:", error);
    res.status(500).json({ message: "Failed to process slots game" });
  }
}




export async function playDice(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = z.object({
      amount: z.number().positive().min(1).max(10000),
      target: z.number().int().min(1).max(99)
    }).parse(req.body);
    
    const { amount, target } = parsedBody;
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    
    const playCount = await storage.getUserPlayCount(userId);
    
    
    const diceWinChance = getAdjustedWinChance('dice', playCount);
    
    
    const isBigWin = shouldBeBigWin(playCount);
    
    
    const result = Math.floor(Math.random() * 100) + 1;
    
    
    const isWin = result <= target;
    
    
    
    
    const baseHouseEdge = 15.0;
    
    const adjustedHouseEdge = baseHouseEdge * (1 - (diceWinChance - 50) / 100);
    let multiplier = isWin ? Number(((100 - adjustedHouseEdge) / target).toFixed(4)) : 0;
    
    
    if (isWin && isBigWin) {
      multiplier *= 1.0 + (Math.random() * 0.5); 
      multiplier = Number(multiplier.toFixed(4));
    }
    
    
    
    const forceLossChance = 0.2 * (100 - diceWinChance) / 100;
    if (isWin && Math.random() < forceLossChance) {
        
        const forcedResult = target + Math.floor(Math.random() * (100 - target)) + 1; 
        const gameResult = diceRollSchema.parse({
            target,
            result: forcedResult,
            multiplier: 0,
            payout: 0,
            isWin: false
        });
        
        
        const newBalance = Number(user.balance) - amount;
        await storage.updateUserBalance(userId, newBalance);
        
        
        await storage.createTransaction({
            userId,
            gameType: "dice",
            amount: amount.toString(),
            multiplier: "0",
            payout: "0",
            isWin: false
        });
        
        
        await storage.incrementPlayCount(userId);
        
        return res.status(200).json(gameResult);
    }
    
    
    const vipMultiplier = await getVipWinMultiplier(userId);
    
    
    
    const variation = 1 + (Math.random() * 0.01 - 0.005);
    const payout = isWin ? Number((amount * multiplier * variation * vipMultiplier).toFixed(2)) : 0;
    
    
    const newBalance = Number(user.balance) - amount + payout;
    
    
    if (isWin && vipMultiplier > 1.0) {
      console.log(`Applied VIP multiplier (${vipMultiplier}x) to user ${userId}'s dice win. Base payout: ${amount * multiplier * variation}, Final payout: ${payout}`);
    }
    await storage.updateUserBalance(userId, newBalance);
    
    
    await storage.createTransaction({
      userId,
      gameType: "dice",
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
      isWin
    });
    
    
    await storage.incrementPlayCount(userId);
    
    
    const gameResult = diceRollSchema.parse({
      target,
      result,
      multiplier,
      payout,
      isWin
    });
    
    res.status(200).json(gameResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Dice game error:", error);
    res.status(500).json({ message: "Failed to process dice game" });
  }
}




export async function startCrash(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = z.object({
      amount: z.number().positive().min(1).max(10000),
      autoCashout: z.number().positive().optional()
    }).parse(req.body);
    
    const { amount, autoCashout } = parsedBody;
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    
    const playCount = await storage.getUserPlayCount(userId);
    
    
    const crashWinChance = getAdjustedWinChance('crash', playCount);
    
    
    const isBigWin = shouldBeBigWin(playCount);
    
    
    
    
    const random = Math.random();
    
    const safeRandom = random === 1 ? 0.999999 : random;
    
    
    const rawCrashPoint = 0.95 / (1 - Math.pow(safeRandom, 2.5));
    let crashPoint = Number(Math.min(1000, rawCrashPoint).toFixed(2));
    
    
    if (isBigWin && crashPoint > 2.0) {
      crashPoint *= getBigWinMultiplierBoost();
      crashPoint = Number(Math.min(1000, crashPoint).toFixed(2));
    }
    
    
    
    const immediateCrashChance = 0.1 * (100 - crashWinChance) / 100;
    if (Math.random() < immediateCrashChance) {
      crashPoint = 1.00;
    }
    
    
    await storage.updateUserBalance(userId, Number(user.balance) - amount);
    
    res.status(200).json({ 
      gameId: Date.now().toString(),
      crashPoint,
      betAmount: amount,
      autoCashout
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Crash game error:", error);
    res.status(500).json({ message: "Failed to start crash game" });
  }
}




export async function crashCashout(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = z.object({
      gameId: z.string(),
      amount: z.number().positive().min(1),
      crashPoint: z.number().positive(),
      cashoutPoint: z.number().positive()
    }).parse(req.body);
    
    const { gameId, amount, crashPoint, cashoutPoint } = parsedBody;
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    const isWin = cashoutPoint <= crashPoint;
    const multiplier = isWin ? cashoutPoint : 0;
    const payout = isWin ? Number((amount * multiplier).toFixed(2)) : 0;
    
    
    await storage.updateUserBalance(userId, Number(user.balance) + payout);
    
    
    await storage.createTransaction({
      userId,
      gameType: "crash",
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
      isWin
    });
    
    
    await storage.incrementPlayCount(userId);
    
    
    const gameResult = crashGameSchema.parse({
      crashPoint,
      cashoutPoint,
      multiplier,
      payout,
      isWin
    });
    
    res.status(200).json(gameResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid cashout data", errors: error.errors });
    }
    
    console.error("Crash cashout error:", error);
    res.status(500).json({ message: "Failed to process crash cashout" });
  }
}




export async function getTransactions(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    
    const transactions = await storage.getUserTransactions(userId, limit);
    
    res.status(200).json(transactions);
  } catch (error) {
    console.error("Get transactions error:", error);
    res.status(500).json({ message: "Failed to get transactions" });
  }
}


const ROULETTE_NUMBERS = [
  0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];

const ROULETTE_COLORS: { [key: number]: 'red' | 'black' | 'green' } = {
  0: 'green',
  1: 'red', 2: 'black', 3: 'red', 4: 'black', 5: 'red', 6: 'black',
  7: 'red', 8: 'black', 9: 'red', 10: 'black', 11: 'black', 12: 'red',
  13: 'black', 14: 'red', 15: 'black', 16: 'red', 17: 'black', 18: 'red',
  19: 'red', 20: 'black', 21: 'red', 22: 'black', 23: 'red', 24: 'black',
  25: 'red', 26: 'black', 27: 'red', 28: 'black', 29: 'black', 30: 'red',
  31: 'black', 32: 'red', 33: 'black', 34: 'red', 35: 'black', 36: 'red'
};


const ROULETTE_PAYOUTS: { [key: string]: number } = {
  'straight': 35, 
  'split': 17, 
  'street': 11, 
  'corner': 8, 
  'line': 5, 
  'dozen': 2, 
  'column': 2, 
  'even': 1, 
  'odd': 1, 
  'red': 1, 
  'black': 1, 
  'low': 1, 
  'high': 1, 
};


const isRed = (number: number) => ROULETTE_COLORS[number] === 'red';
const isBlack = (number: number) => ROULETTE_COLORS[number] === 'black';
const isGreen = (number: number) => ROULETTE_COLORS[number] === 'green';
const isEven = (number: number) => number !== 0 && number % 2 === 0;
const isOdd = (number: number) => number % 2 === 1;
const isLow = (number: number) => number >= 1 && number <= 18;
const isHigh = (number: number) => number >= 19 && number <= 36;
const isInFirstDozen = (number: number) => number >= 1 && number <= 12;
const isInSecondDozen = (number: number) => number >= 13 && number <= 24;
const isInThirdDozen = (number: number) => number >= 25 && number <= 36;
const isInFirstColumn = (number: number) => number % 3 === 1;
const isInSecondColumn = (number: number) => number % 3 === 2;
const isInThirdColumn = (number: number) => number % 3 === 0 && number !== 0;





const CARD_VALUES: Record<string, number> = {
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


function createDeck(): Card[] {
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


function shuffleDeck(deck: Card[]): Card[] {
  const shuffled = [...deck];
  
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  
  return shuffled;
}


function calculateHandValue(cards: Card[]): number {
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


function isBlackjack(cards: Card[]): boolean {
  return cards.length === 2 && calculateHandValue(cards) === 21;
}




export async function startBlackjack(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = blackjackBetSchema.parse(req.body);
    const { amount } = parsedBody;
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    if (amount > 10000) {
      return res.status(400).json({ message: "Maximum bet amount is 10,000 coins" });
    }

    
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    
    const deck = shuffleDeck(createDeck());
    
    
    const playerHand = [deck.pop()!, deck.pop()!];
    const dealerHand = [deck.pop()!, { ...deck.pop()!, hidden: true }];
    
    
    const playerValue = calculateHandValue(playerHand);
    const dealerValue = calculateHandValue(dealerHand.filter(card => !card.hidden));
    
    
    const playerHasBlackjack = isBlackjack(playerHand);
    
    
    await storage.updateUserBalance(userId, Number(user.balance) - amount);
    
    
    const allowedActions = playerHasBlackjack 
      ? [] 
      : ['hit', 'stand', 'double'];
      
    
    if (playerHand[0].value === playerHand[1].value && Number(user.balance) >= amount) {
      allowedActions.push('split');
    }
    
    
    const gameState = blackjackStateSchema.parse({
      playerHands: [{
        cards: playerHand,
        value: playerValue,
        isBusted: false,
        isBlackjack: playerHasBlackjack,
        bet: amount
      }],
      dealerHand: {
        cards: dealerHand,
        value: dealerValue
      },
      currentHandIndex: 0,
      status: playerHasBlackjack ? 'dealer-turn' : 'player-turn',
      allowedActions: playerHasBlackjack ? [] : allowedActions
    });
    
    
    if (playerHasBlackjack) {
      
      const revealedDealerHand = dealerHand.map(card => ({ ...card, hidden: false }));
      gameState.dealerHand.cards = revealedDealerHand;
      gameState.dealerHand.value = calculateHandValue(revealedDealerHand);
      
      
      const dealerHasBlackjack = isBlackjack(revealedDealerHand);
      
      if (dealerHasBlackjack) {
        
        gameState.result = 'push';
        gameState.payout = amount;
        await storage.updateUserBalance(userId, Number(user.balance) + amount);
      } else {
        
        const blackjackPayout = amount * 2.5;
        gameState.result = 'blackjack';
        gameState.payout = blackjackPayout;
        await storage.updateUserBalance(userId, Number(user.balance) + blackjackPayout);
        
        
        await storage.createTransaction({
          userId,
          gameType: "blackjack",
          amount: amount.toString(),
          multiplier: "2.5",
          payout: blackjackPayout.toString(),
          isWin: true,
          gameData: JSON.stringify(gameState)
        });
      }
      
      gameState.status = 'complete';
      gameState.isComplete = true;
    }
    
    res.status(200).json(gameState);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Blackjack game error:", error);
    res.status(500).json({ message: "Failed to start blackjack game" });
  }
}




export async function blackjackAction(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = blackjackBetSchema.parse(req.body);
    const { action, handIndex = 0 } = parsedBody;
    
    
    const currentState = blackjackStateSchema.parse(req.body.gameState);
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    if (currentState.status !== 'player-turn') {
      return res.status(400).json({ message: "Cannot take action - not player's turn" });
    }
    
    
    if (!currentState.allowedActions?.includes(action as any)) {
      return res.status(400).json({ message: `Action ${action} is not allowed` });
    }
    
    
    let usedCards: Card[] = [];
    currentState.playerHands.forEach(hand => usedCards = [...usedCards, ...hand.cards]);
    usedCards = [...usedCards, ...currentState.dealerHand.cards];
    
    const fullDeck = createDeck();
    const remainingDeck = shuffleDeck(fullDeck.filter(card => 
      !usedCards.some(usedCard => 
        usedCard.suit === card.suit && usedCard.value === card.value
      )
    ));
    
    
    const currentHand = currentState.playerHands[handIndex];
    
    switch(action) {
      case 'hit':
        
        const newCard = remainingDeck.pop()!;
        currentHand.cards.push(newCard);
        
        
        currentHand.value = calculateHandValue(currentHand.cards);
        
        
        if (currentHand.value > 21) {
          currentHand.isBusted = true;
          
          
          const allHandsDone = currentState.playerHands.every(hand => 
            hand.isBusted || hand.isBlackjack || hand.isSurrendered
          );
          
          if (allHandsDone) {
            currentState.status = 'dealer-turn';
            currentState.currentHandIndex = undefined;
          } else {
            
            const nextHandIndex = currentState.playerHands.findIndex((hand, idx) => 
              idx > handIndex && !hand.isBusted && !hand.isBlackjack && !hand.isSurrendered
            );
            
            if (nextHandIndex !== -1) {
              currentState.currentHandIndex = nextHandIndex;
              
              currentState.allowedActions = ['hit', 'stand'];
              
              
              if (currentState.playerHands[nextHandIndex].cards.length === 2 && 
                  Number(user.balance) >= currentState.playerHands[nextHandIndex].bet!) {
                currentState.allowedActions.push('double');
              }
            } else {
              currentState.status = 'dealer-turn';
              currentState.currentHandIndex = undefined;
            }
          }
        }
        break;
      
      case 'stand':
        
        const nextHandIndex = currentState.playerHands.findIndex((hand, idx) => 
          idx > handIndex && !hand.isBusted && !hand.isBlackjack && !hand.isSurrendered
        );
        
        if (nextHandIndex !== -1) {
          currentState.currentHandIndex = nextHandIndex;
          
          currentState.allowedActions = ['hit', 'stand'];
          
          
          if (currentState.playerHands[nextHandIndex].cards.length === 2 && 
              Number(user.balance) >= currentState.playerHands[nextHandIndex].bet!) {
            currentState.allowedActions.push('double');
          }
        } else {
          currentState.status = 'dealer-turn';
          currentState.currentHandIndex = undefined;
        }
        break;
      
      case 'double':
        if (currentHand.cards.length !== 2) {
          return res.status(400).json({ message: "Can only double on first two cards" });
        }
        
        
        if (Number(user.balance) < currentHand.bet!) {
          return res.status(400).json({ message: "Insufficient balance for doubling" });
        }
        
        
        const doubleBet = currentHand.bet!;
        await storage.updateUserBalance(userId, Number(user.balance) - doubleBet);
        currentHand.bet = doubleBet * 2;
        
        
        const doubleCard = remainingDeck.pop()!;
        currentHand.cards.push(doubleCard);
        currentHand.value = calculateHandValue(currentHand.cards);
        
        
        if (currentHand.value > 21) {
          currentHand.isBusted = true;
        }
        
        
        const nextHandAfterDouble = currentState.playerHands.findIndex((hand, idx) => 
          idx > handIndex && !hand.isBusted && !hand.isBlackjack && !hand.isSurrendered
        );
        
        if (nextHandAfterDouble !== -1) {
          currentState.currentHandIndex = nextHandAfterDouble;
          
          currentState.allowedActions = ['hit', 'stand'];
          
          
          if (currentState.playerHands[nextHandAfterDouble].cards.length === 2 && 
              Number(user.balance) >= currentState.playerHands[nextHandAfterDouble].bet!) {
            currentState.allowedActions.push('double');
          }
        } else {
          currentState.status = 'dealer-turn';
          currentState.currentHandIndex = undefined;
        }
        break;
      
      case 'split':
        
        if (currentHand.cards.length !== 2 || currentHand.cards[0].value !== currentHand.cards[1].value) {
          return res.status(400).json({ message: "Cannot split this hand" });
        }
        
        
        if (Number(user.balance) < currentHand.bet!) {
          return res.status(400).json({ message: "Insufficient balance for splitting" });
        }
        
        
        const splitBet = currentHand.bet!;
        await storage.updateUserBalance(userId, Number(user.balance) - splitBet);
        
        
        const firstCard = currentHand.cards[0];
        const newCardForFirstHand = remainingDeck.pop()!;
        currentHand.cards = [firstCard, newCardForFirstHand];
        currentHand.value = calculateHandValue(currentHand.cards);
        currentHand.isSplit = true;
        
        
        const secondCard = currentHand.cards[1];
        const newCardForSecondHand = remainingDeck.pop()!;
        const secondHand = {
          cards: [secondCard, newCardForSecondHand],
          value: calculateHandValue([secondCard, newCardForSecondHand]),
          isBusted: false,
          isSplit: true,
          bet: splitBet
        };
        
        
        currentState.playerHands.splice(handIndex + 1, 0, secondHand);
        
        
        currentState.allowedActions = ['hit', 'stand'];
        
        
        if (currentHand.bet !== undefined && Number(user.balance) >= currentHand.bet) {
          currentState.allowedActions.push('double');
        }
        break;
      
      default:
        return res.status(400).json({ message: "Invalid action" });
    }
    
    
    if (currentState.status === 'dealer-turn') {
      
      currentState.dealerHand.cards = currentState.dealerHand.cards.map(card => ({ ...card, hidden: false }));
      currentState.dealerHand.value = calculateHandValue(currentState.dealerHand.cards);
      
      
      while (currentState.dealerHand.value < 17) {
        const dealerCard = remainingDeck.pop()!;
        currentState.dealerHand.cards.push(dealerCard);
        currentState.dealerHand.value = calculateHandValue(currentState.dealerHand.cards);
      }
      
      
      let totalPayout = 0;
      const dealerBusted = currentState.dealerHand.value > 21;
      const dealerTotal = currentState.dealerHand.value;
      
      
      for (const hand of currentState.playerHands) {
        if (hand.isBusted) {
          
          
          continue;
        }
        
        if (hand.isBlackjack && !hand.isSplit) {
          
          const blackjackPayout = hand.bet! * 2.5;
          totalPayout += blackjackPayout;
          continue;
        }
        
        if (dealerBusted) {
          
          const winPayout = hand.bet! * 2; 
          totalPayout += winPayout;
          continue;
        }
        
        
        if (hand.value > dealerTotal) {
          
          const winPayout = hand.bet! * 2; 
          totalPayout += winPayout;
        } else if (hand.value === dealerTotal) {
          
          totalPayout += hand.bet!;
        }
        
      }
      
      
      if (totalPayout > 0) {
        await storage.updateUserBalance(userId, Number(user.balance) + totalPayout);
      }
      
      
      currentState.status = 'complete';
      currentState.isComplete = true;
      currentState.payout = totalPayout;
      
      
      if (totalPayout > 0) {
        const totalBet = currentState.playerHands.reduce((sum, hand) => sum + hand.bet!, 0);
        currentState.result = totalPayout > totalBet ? 'win' : 'push';
        
        
        if (totalPayout > totalBet) {
          const totalBet = currentState.playerHands.reduce((sum, hand) => sum + hand.bet!, 0);
          const multiplier = totalPayout / totalBet;
          
          await storage.createTransaction({
            userId,
            gameType: "blackjack",
            amount: totalBet.toString(),
            multiplier: multiplier.toFixed(2),
            payout: totalPayout.toString(),
            isWin: true,
            gameData: JSON.stringify({ 
              playerHands: currentState.playerHands,
              dealerHand: currentState.dealerHand
            })
          });
        }
      } else {
        currentState.result = 'lose';
        
        
        const totalBet = currentState.playerHands.reduce((sum, hand) => sum + hand.bet!, 0);
        
        await storage.createTransaction({
          userId,
          gameType: "blackjack",
          amount: totalBet.toString(),
          multiplier: "0",
          payout: "0",
          isWin: false,
          gameData: JSON.stringify({ 
            playerHands: currentState.playerHands,
            dealerHand: currentState.dealerHand
          })
        });
      }
      
      
      await storage.incrementPlayCount(userId);
    }
    
    res.status(200).json(currentState);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid game data", errors: error.errors });
    }
    
    console.error("Blackjack action error:", error);
    res.status(500).json({ message: "Failed to process blackjack action" });
  }
}

export async function playRoulette(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = rouletteBetSchema.parse(req.body);
    const { bets } = parsedBody;
    
    
    if (!bets || bets.length === 0) {
      return res.status(400).json({ message: "No bets placed" });
    }
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    const totalAmount = bets.reduce((sum, bet) => sum + bet.amount, 0);
    
    
    if (totalAmount > 10000) {
      return res.status(400).json({ message: "Total bet amount cannot exceed 10,000 coins" });
    }
    
    
    if (Number(user.balance) < totalAmount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    
    const playCount = await storage.getUserPlayCount(userId);
    
    
    const rouletteWinChance = getAdjustedWinChance('roulette', playCount);
    
    
    const isBigWin = shouldBeBigWin(playCount);
    
    
    
    const randomIndex = Math.floor(Math.random() * ROULETTE_NUMBERS.length);
    const spin = ROULETTE_NUMBERS[randomIndex];
    const color = ROULETTE_COLORS[spin];
    
    
    let totalWinnings = 0;
    let anyWin = false;
    let biggestMultiplier = 0;
    let totalPayout = 0;
    let betResults: Array<{
      betType: RouletteBetType,
      amount: number,
      isWin: boolean,
      payout: number
    }> = [];
    
    
    for (const bet of bets) {
      
      if (!bet || typeof bet !== 'object') {
        console.error("Invalid bet object:", bet);
        continue;
      }
      
      const amount = bet.amount;
      const type = bet.type;
      const numbers = bet.numbers || [];
      let isWin = false;
      
      
      switch (type) {
        case 'straight':
          
          isWin = numbers.includes(spin);
          break;
        case 'split':
          
          isWin = numbers.includes(spin);
          break;
        case 'street':
          
          isWin = numbers.includes(spin);
          break;
        case 'corner':
          
          isWin = numbers.includes(spin);
          break;
        case 'line':
          
          isWin = numbers.includes(spin);
          break;
        case 'dozen':
          
          isWin = numbers.includes(spin);
          break;
        case 'column':
          
          isWin = numbers.includes(spin);
          break;
        case 'even':
          
          isWin = isEven(spin);
          break;
        case 'odd':
          
          isWin = isOdd(spin);
          break;
        case 'red':
          
          isWin = isRed(spin);
          break;
        case 'black':
          
          isWin = isBlack(spin);
          break;
        case 'low':
          
          isWin = isLow(spin);
          break;
        case 'high':
          
          isWin = isHigh(spin);
          break;
        default:
          break;
      }
      
      
      
      const forceLossFactor = 100 - rouletteWinChance; 
      const forceLossChance = (forceLossFactor / 100) * 0.12; 
      
      if (isWin && Math.random() < forceLossChance) {
        isWin = false;
      }
      
      
      
      let luckyMultiplier = 0;
      const luckyWinChance = (rouletteWinChance / 100) * 0.02; 
      
      if (!isWin && Math.random() < luckyWinChance) {
        isWin = true;
        
        
        if (isBigWin) {
          
          luckyMultiplier = 3 + Math.floor(Math.random() * 4);
        } else {
          
          luckyMultiplier = 2 + Math.floor(Math.random() * 2);
        }
      }
      
      
      const multiplier = luckyMultiplier > 0 ? luckyMultiplier : (isWin ? ROULETTE_PAYOUTS[type] : 0);
      
      
      const variation = 1 + (Math.random() * 0.01 - 0.005);
      
      
      
      const payout = isWin ? Number((amount + amount * multiplier * variation).toFixed(2)) : 0;
      
      
      totalWinnings += payout;
      totalPayout += payout;
      
      if (isWin) {
        anyWin = true;
        if (multiplier > biggestMultiplier) {
          biggestMultiplier = multiplier;
        }
      }
      
      
      betResults.push({
        betType: type,
        amount,
        isWin,
        payout
      });
    }
    
    
    const newBalance = Number(user.balance) - totalAmount + totalWinnings;
    await storage.updateUserBalance(userId, newBalance);
    
    
    await storage.createTransaction({
      userId,
      gameType: "roulette",
      amount: totalAmount.toString(),
      multiplier: (biggestMultiplier || 0).toString(), 
      payout: anyWin ? totalPayout.toString() : (-totalAmount).toString(), 
      isWin: anyWin,
      metadata: JSON.stringify({ betResults })
    });
    
    
    await storage.incrementPlayCount(userId);
    
    
    const gameResult = rouletteResultSchema.parse({
      spin,
      color,
      multiplier: biggestMultiplier || 0,
      payout: totalPayout,
      isWin: anyWin,
      metadata: JSON.stringify({ betResults })
    });
    
    res.status(200).json(gameResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Roulette game error:", error);
    res.status(500).json({ message: "Failed to process roulette game" });
  }
}




export async function playPlinko(req: Request, res: Response) {
  try {
    
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    
    const parsedBody = z.object({
      amount: z.number().positive().min(1).max(10000),
      risk: z.enum(['low', 'medium', 'high']).default('medium')
    }).parse(req.body);
    
    const { amount, risk } = parsedBody;
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    
    
    if (Number(user.balance) < amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    
    
    const playCount = await storage.getUserPlayCount(userId);
    
    
    const plinkoWinChance = getAdjustedWinChance('plinko', playCount);
    
    
    const isBigWin = shouldBeBigWin(playCount);
    
    
    
    const MULTIPLIERS_BY_RISK = {
      
      low: [2.0, 1.5, 1.2, 1.1, 0.9, 0.8, 0.9, 1.1, 1.2, 1.5, 2.0],
      
      
      medium: [4.0, 2.5, 1.5, 1.0, 0.5, 0.2, 0.5, 1.0, 1.5, 2.5, 4.0],
      
      
      high: [18.0, 8.0, 4.0, 1.5, 0.3, 0.1, 0.3, 1.5, 4.0, 8.0, 18.0]
    };
    
    
    const multipliers = MULTIPLIERS_BY_RISK[risk];
    
    
    const rows = 10;
    const pins = [];
    
    for (let r = 0; r < rows; r++) {
      const pinsInRow = r + 1;
      const row = [];
      for (let p = 0; p < pinsInRow; p++) {
        row.push({ row: r, position: p });
      }
      pins.push(row);
    }
    
    
    
    
    const path = [];
    let currentPosition = 0;
    
    
    
    
    
    const RISK_PROBABILITIES = {
      low: {
        lossChance: 40,      
        smallWinChance: 50,  
        mediumWinChance: 9,  
        bigWinChance: 1      
      },
      medium: {
        lossChance: 65,      
        smallWinChance: 20,  
        mediumWinChance: 10, 
        bigWinChance: 5      
      },
      high: {
        lossChance: 80,      
        smallWinChance: 5,   
        mediumWinChance: 5,  
        bigWinChance: 10     
      }
    };
    
    
    const riskProbs = RISK_PROBABILITIES[risk];
    
    
    
    let targetIndex = Math.floor(Math.random() * multipliers.length);
    
    
    const randomValue = Math.random() * 100;
    
    
    const vipBoostFactor = await getVipWinMultiplier(userId);
    const vipBoost = (vipBoostFactor - 1) * 3; 
    
    
    const adjustedProbs = {
      lossChance: Math.max(riskProbs.lossChance - vipBoost, 0),
      smallWinChance: riskProbs.smallWinChance + (vipBoost / 3),
      mediumWinChance: riskProbs.mediumWinChance + (vipBoost / 3),
      bigWinChance: riskProbs.bigWinChance + (vipBoost / 3)
    };
    
    console.log(`Plinko game - Risk: ${risk}, Play count: ${playCount}, Risk probabilities:`, adjustedProbs);
    
    if (randomValue < adjustedProbs.lossChance) {
      
      
      const middleIndex = Math.floor(multipliers.length / 2);
      const variance = Math.floor(multipliers.length / 5);
      targetIndex = middleIndex + Math.floor(Math.random() * variance * 2) - variance;
    } 
    else if (randomValue < (adjustedProbs.lossChance + adjustedProbs.smallWinChance)) {
      
      const smallWinPositions = multipliers
        .map((m, i) => ({ mult: m, index: i }))
        .filter(item => item.mult > 0.9 && item.mult <= 2.5)
        .map(item => item.index);
      
      if (smallWinPositions.length > 0) {
        const randomSmallWinIndex = Math.floor(Math.random() * smallWinPositions.length);
        targetIndex = smallWinPositions[randomSmallWinIndex];
      }
    }
    else if (randomValue < (adjustedProbs.lossChance + adjustedProbs.smallWinChance + adjustedProbs.mediumWinChance)) {
      
      const mediumWinPositions = multipliers
        .map((m, i) => ({ mult: m, index: i }))
        .filter(item => item.mult > 2.5 && item.mult <= 5.0)
        .map(item => item.index);
      
      if (mediumWinPositions.length > 0) {
        const randomMediumWinIndex = Math.floor(Math.random() * mediumWinPositions.length);
        targetIndex = mediumWinPositions[randomMediumWinIndex];
      }
    }
    else {
      
      
      const winChanceBoost = Math.min(plinkoWinChance / 10, 10); 
      
      if (Math.random() * 100 < (adjustedProbs.bigWinChance + winChanceBoost)) {
        
        const bigWinPositions = multipliers
          .map((m, i) => ({ mult: m, index: i }))
          .filter(item => item.mult > 5.0)
          .map(item => item.index);
        
        if (bigWinPositions.length > 0) {
          const randomBigWinIndex = Math.floor(Math.random() * bigWinPositions.length);
          targetIndex = bigWinPositions[randomBigWinIndex];
        }
      }
    }
    
    
    if (isBigWin) {
      targetIndex = Math.max(targetIndex, Math.floor(multipliers.length * 0.8));
    }
    
    
    const targetPosition = targetIndex;
    
    
    const pinRows = rows - 1;
    for (let r = 0; r < pinRows; r++) {
      path.push({ row: r, position: currentPosition });
      const maxPosition = r + 1;
      const remainingSteps = pinRows - r;
      const requiredMoves = Math.max(0, targetPosition - currentPosition);
      const moveProbability = remainingSteps > 0 ? Math.min(Math.max(requiredMoves / remainingSteps, 0.15), 0.85) : 0;
      if (Math.random() < moveProbability && currentPosition < maxPosition) {
        currentPosition += 1;
      }
    }

    path.push({ row: rows - 1, position: currentPosition });
    path.push({ row: rows, position: currentPosition });
    
    
    const landingPosition = path[path.length - 1].position;
    
    const adjustedPosition = Math.min(landingPosition, multipliers.length - 1);
    const multiplier = multipliers[adjustedPosition];
    
    
    const isWin = multiplier > 1.0;
    
    
    const vipMultiplier = await getVipWinMultiplier(userId);
    
    
    const payout = amount * multiplier * (isWin ? vipMultiplier : 1.0);
    
    
    const newBalance = Number(user.balance) - amount + payout;
    
    
    if (isWin && vipMultiplier > 1.0) {
      console.log(`Applied VIP multiplier (${vipMultiplier}x) to user ${userId}'s plinko win. Base payout: ${amount * multiplier}, Final payout: ${payout}`);
    }
    await storage.updateUserBalance(userId, newBalance);
    
    
    await storage.createTransaction({
      userId,
      gameType: "plinko",
      amount: amount.toString(),
      multiplier: multiplier.toString(),
      payout: payout.toString(),
      isWin
    });
    
    
    await storage.incrementPlayCount(userId);
    
    
    
    const result = plinkoGameSchema.parse({
      risk,
      rows,
      pins,
      path,
      multiplier,
      payout,
      isWin,
      landingPosition: adjustedPosition,
      multipliers: multipliers 
    });
    
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: "Invalid bet data", errors: error.errors });
    }
    
    console.error("Plinko game error:", error);
    res.status(500).json({ message: "Failed to process plinko game" });
  }
}
