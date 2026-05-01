





const WIN_RATE_CONFIG = {
  
  initialBoost: 20,
  
  
  normalizationGames: 100,
  
  
  maxDropGames: 200,
  
  
  maxWinRateDrop: 10,
  
  
  baseChances: {
    slots: 30, 
    dice: 49,  
    crash: 70, 
    roulette: 48, 
    plinko: 52, 
  },
  
  
  bigWinChance: 10,
  
  
  bigWinMultiplierBoost: 3,
};








export function getAdjustedWinChance(
  gameType: 'slots' | 'dice' | 'crash' | 'roulette' | 'plinko',
  playCount: number,
  isForced: boolean = false
): number {
  
  const baseChance = WIN_RATE_CONFIG.baseChances[gameType];
  
  
  if (isForced) {
    return isForced ? 100 : 0;
  }
  
  
  let adjustment = 0;
  
  if (playCount < WIN_RATE_CONFIG.normalizationGames) {
    
    const boostFactor = 1 - (playCount / WIN_RATE_CONFIG.normalizationGames);
    adjustment = WIN_RATE_CONFIG.initialBoost * boostFactor;
  } else if (playCount > WIN_RATE_CONFIG.maxDropGames) {
    
    
    adjustment = -WIN_RATE_CONFIG.maxWinRateDrop;
  } else {
    
    adjustment = 0;
  }
  
  
  let adjustedChance = baseChance + adjustment;
  
  
  return Math.min(Math.max(adjustedChance, 1), 99);
}






export function shouldBeBigWin(playCount: number): boolean {
  
  const bigWinFactor = playCount < 50 ? 2 : 1;
  const adjustedBigWinChance = WIN_RATE_CONFIG.bigWinChance / bigWinFactor;
  
  
  return Math.random() < (1 / adjustedBigWinChance);
}





export function getBigWinMultiplierBoost(): number {
  
  return 1.5 + (Math.random() * (WIN_RATE_CONFIG.bigWinMultiplierBoost - 1.5));
}