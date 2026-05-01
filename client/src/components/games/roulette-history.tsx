import { useQuery } from "@tanstack/react-query";
import { formatCurrency, formatMultiplier } from "@/lib/game-utils";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { getQueryFn } from "@/lib/queryClient";
import { Transaction, RouletteResult } from "@shared/schema";
import { ROULETTE_COLORS } from "@/lib/game-utils";
import { useRouletteState } from "@/hooks/use-roulette-state";

export default function RouletteHistory() {
  
  const { isSpinning, lastSpinTimestamp } = useRouletteState();

  
  const { data: transactions, isLoading } = useQuery<Transaction[]>({
    queryKey: ["/api/transactions", lastSpinTimestamp],
    queryFn: getQueryFn({ on401: "returnNull" }),
    refetchInterval: 3000, 
    refetchOnWindowFocus: true,
  });

  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (!transactions || transactions.length === 0) {
    return (
      <div className="p-6 text-center">
        <p className="text-gray-400">No game history yet</p>
        <p className="text-sm text-gray-500 mt-2">Place a bet and spin the wheel</p>
      </div>
    );
  }

  
  let rouletteGames = transactions
    .filter(t => t.gameType === "roulette")
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    
  
  
  if (isSpinning && rouletteGames.length > 0) {
    
    rouletteGames = rouletteGames.slice(1);
  }

  return (
    <div className="divide-y divide-[#333333]">
      {rouletteGames.map((game, index) => {
        const isWin = game.isWin;
        
        let resultInfo;
        try {
          resultInfo = JSON.parse(game.metadata || "{}");
        } catch (e) {
          resultInfo = {};
        }
        
        
        const spin = resultInfo.spin || 0;
        const color = resultInfo.color || "unknown";
        
        
        let betType = "";
        try {
          
          if (resultInfo.betType) {
            betType = resultInfo.betType;
          } else if (game.gameData) {
            const gameData = typeof game.gameData === 'string' ? 
              JSON.parse(game.gameData) : game.gameData;
            betType = gameData.betType || "";
          }
        } catch (e) {
          betType = "";
        }
        
        
        if (!betType) {
          
          const multiplierNum = Number(game.multiplier);
          if (multiplierNum >= 35) betType = 'straight';
          else if (multiplierNum >= 17) betType = 'split';
          else if (multiplierNum >= 11) betType = 'street';
          else if (multiplierNum >= 8) betType = 'corner';
          else if (multiplierNum >= 5) betType = 'line';
          else if (multiplierNum >= 2) betType = 'dozen';
          else if (multiplierNum === 1) {
            
            if (color === 'red') betType = 'red';
            else if (color === 'black') betType = 'black';
            else betType = 'outside';
          } else {
            betType = 'bet';
          }
        }
        
        
        const displayBetType = betType.charAt(0).toUpperCase() + betType.slice(1);
        
        
        let spinBgColor = 'bg-gradient-to-b from-[#222222] to-[#121212]';
        if (color === 'red') {
          spinBgColor = 'bg-gradient-to-b from-[#E03C3C] to-[#C92A2A]';
        } else if (color === 'green') {
          spinBgColor = 'bg-gradient-to-b from-[#00A000] to-[#008000]';
        }
        
        return (
          <motion.div 
            key={game.id} 
            className="p-4 bg-[#1A1A1A] hover:bg-[#222222] transition-colors"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="flex justify-between items-center">
              <div className="flex items-center space-x-3">
                <div className={`w-10 h-10 flex items-center justify-center text-white font-bold rounded-full 
                  ${spinBgColor}`}>
                  {spin}
                </div>
                <div>
                  <div className="flex items-center space-x-1">
                    <span className="font-medium">{displayBetType}</span>
                    <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs
                      ${isWin ? 'bg-[#00A000] text-white' : 'bg-[#E03C3C] text-white'}`}>
                      {isWin ? '✓' : '✗'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-400">
                    {new Date(game.timestamp).toLocaleTimeString()}
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className={`font-mono font-medium ${isWin ? 'text-[#00E701]' : 'text-[#E03C3C]'}`}>
                  {isWin ? '+' : '-'}{formatCurrency(Math.abs(Number(game.payout)))}
                </div>
                <div className="text-xs text-gray-400">
                  {formatMultiplier(Number(game.multiplier))}× multiplier
                </div>
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}