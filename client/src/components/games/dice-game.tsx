import { useState, useRef, useEffect } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/hooks/use-sound';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { DiceRoll } from '@shared/schema';
import { motion, AnimatePresence, useAnimation } from 'framer-motion';
import { Sparkles, Trophy, Flame, TrendingUp, Zap } from 'lucide-react';

export default function DiceGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play } = useSound();
  const [betAmount, setBetAmount] = useState(1);
  const [target, setTarget] = useState(50);
  const [isRolling, setIsRolling] = useState(false);
  const [lastResult, setLastResult] = useState<DiceRoll | null>(null);
  const [diceValue, setDiceValue] = useState<number | null>(null);
  const [showWinMessage, setShowWinMessage] = useState(false);
  const [showHotStreak, setShowHotStreak] = useState(false);
  const diceControls = useAnimation();
  const sparkleControls = useAnimation();
  const diceRef = useRef<HTMLDivElement>(null);
  
  
  const winChance = target;
  const multiplier = 99 / target;
  const profitOnWin = betAmount * (multiplier - 1);
  
  
  const diceMutation = useMutation({
    mutationFn: async (data: { amount: number, target: number }) => {
      const res = await apiRequest('POST', '/api/games/dice', data);
      return await res.json();
    },
    onSuccess: (data: DiceRoll) => {
      
      
      
      
      animateDiceRoll(data.result);
      
      
      
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setIsRolling(false);
    },
  });
  
  
  useEffect(() => {
    
    if (lastResult?.isWin && multiplier >= 1.5) {
      
      setShowHotStreak(true);
      
      
      sparkleControls.start({
        opacity: [0, 1, 0],
        scale: [0.8, 1.2, 0.8],
        transition: { 
          duration: 2,
          repeat: 3,
          repeatType: "reverse"
        }
      });
      
      
      const timeout = setTimeout(() => {
        setShowHotStreak(false);
      }, 6000);
      
      return () => clearTimeout(timeout);
    }
  }, [lastResult, multiplier, sparkleControls]);

  const animateDiceRoll = (finalValue: number) => {
    let rolls = 0;
    const maxRolls = 15; 
    const rollInterval = 80; 
    
    
    setShowWinMessage(false);
    
    
    setLastResult(null);
    
    
    diceControls.start({
      rotate: [0, 360, 720, 1080, 1440, 1800],
      scale: [1, 1.1, 0.9, 1.2, 0.95, 1],
      transition: { 
        duration: 1.5,
        ease: "easeInOut"
      }
    });
    
    const roll = () => {
      rolls++;
      
      if (rolls < maxRolls) {
        
        setDiceValue(Math.floor(Math.random() * 100) + 1);
        
        
        if (rolls === Math.floor(maxRolls / 2)) {
          diceControls.start({
            x: [0, -5, 5, -3, 3, 0],
            transition: { duration: 0.5 }
          });
        }
        
        setTimeout(roll, rollInterval);
      } else {
        
        setDiceValue(finalValue);
        setIsRolling(false);
        
        
        diceControls.start({
          scale: [1, 1.2, 1],
          transition: { duration: 0.3 }
        });
        
        
        setTimeout(() => {
          
          setLastResult(diceMutation.data as DiceRoll);
          
          
          if (diceMutation.data?.isWin) {
            diceControls.start({
              scale: [1, 1.1, 1],
              boxShadow: ["0 0 0px rgba(84,101,255,0)", "0 0 20px rgba(84,101,255,0.8)", "0 0 15px rgba(84,101,255,0.6)"],
              transition: { duration: 0.5, repeat: 3, repeatType: "reverse" }
            });
          } else {
            diceControls.start({
              scale: [1, 0.95, 1],
              boxShadow: ["0 0 0px rgba(255,58,94,0)", "0 0 20px rgba(255,58,94,0.8)", "0 0 15px rgba(255,58,94,0.6)"],
              transition: { duration: 0.5 }
            });
          }
          
          
          queryClient.invalidateQueries({ queryKey: ['/api/user'] });
          
          
          if (diceMutation.data?.isWin) {
            play('win');
          } else {
            play('lose');
          }
          
          setShowWinMessage(true);
        }, 300);
      }
    };
    
    
    roll();
  };
  
  const handleRoll = () => {
    
    if (!user || betAmount <= 0) {
      toast({
        title: 'Invalid bet',
        description: 'Bet amount must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    
    setIsRolling(true);
    play('diceRoll');
    
    
    diceMutation.mutate({ amount: betAmount, target });
  };
  
  const handleTargetChange = (value: number[]) => {
    setTarget(value[0]);
  };
  
  
  const renderDiceFace = () => {
    
    
    const isWin = lastResult ? lastResult.isWin : diceValue !== null && diceValue <= target;
    const fgColor = isWin ? "#00E701" : "#ffffff";
    const textSize = diceValue !== null && diceValue >= 100 ? "text-xl" : "text-2xl";
    
    if (diceValue === null) {
      
      return (
        <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-lg border border-[#333] flex items-center justify-center">
          <div className="grid grid-cols-2 gap-1 p-1">
            <div className="w-3 h-3 rounded-full bg-white"></div>
            <div className="w-3 h-3 rounded-full bg-white"></div>
            <div className="w-3 h-3 rounded-full bg-white"></div>
            <div className="w-3 h-3 rounded-full bg-white"></div>
          </div>
        </div>
      );
    }
    
    
    return (
      <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] rounded-lg border border-[#333] flex items-center justify-center overflow-hidden">
        {}
        <div className={`${textSize} font-mono font-bold flex items-center justify-center`} 
             style={{ color: fgColor }}>
          {diceValue}
        </div>
        
        {}
        <div className="absolute top-0 left-0 w-full h-1/4 bg-gradient-to-b from-[rgba(255,255,255,0.15)] to-transparent"></div>
      </div>
    );
  };
  
  return (
    <div className="bg-gradient-to-b from-[#2A2A2A] to-[#222222] p-5 rounded-xl shadow-lg">
      {}
      {showHotStreak && (
        <div className="flex items-center justify-center mb-2 text-amber-400 text-sm font-bold">
          <Flame className="w-4 h-4 mr-1" />
          <span>HOT STREAK!</span>
        </div>
      )}
      
      <div className="flex justify-center mb-6 relative">
        {}
        <motion.div 
          animate={sparkleControls}
          className="absolute inset-0 pointer-events-none flex items-center justify-center"
          style={{ opacity: 0 }}
        >
          <Sparkles className="w-12 h-12 text-amber-400" />
        </motion.div>
        
        {}
        <motion.div 
          ref={diceRef}
          animate={diceControls}
          className={`dice w-20 h-20 bg-[#121212] rounded-lg shadow-xl flex items-center justify-center relative
            ${lastResult?.isWin ? 'win-glow' : lastResult && !lastResult.isWin ? 'lose-glow' : ''}
          `}
          style={{ 
            transformStyle: 'preserve-3d',
            perspective: '1000px',
            
            boxShadow: lastResult?.isWin 
              ? '0 0 20px rgba(84, 101, 255, 0.7)' 
              : lastResult && !lastResult.isWin 
                ? '0 0 20px rgba(255, 58, 94, 0.7)' 
                : '0 5px 15px rgba(0, 0, 0, 0.5)' 
          }}
        >
          {renderDiceFace()}
        </motion.div>
      </div>
      
      <div className="mb-4">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-400">Roll Under to Win</span>
          <span className="font-mono text-lg font-bold">{target}</span>
        </div>
        <Slider 
          defaultValue={[50]} 
          min={2} 
          max={98} 
          step={1}
          value={[target]}
          onValueChange={handleTargetChange}
          disabled={isRolling}
          className="w-full my-2"
        />
        <div className="flex justify-between text-xs text-gray-500">
          <span>Higher Risk</span>
          <span>Lower Risk</span>
        </div>
      </div>
      
      <div className="flex gap-2 mb-4">
        <div className="w-1/2">
          <span className="text-sm text-gray-400 block mb-1">Bet Amount</span>
          <div className="flex flex-col gap-1">
            <div className="relative">
              <Input
                type="text"
                value={betAmount.toString()}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^0-9.]/g, '');
                  
                  const parts = value.split('.');
                  const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                  const amount = Number(sanitized) || 0;
                  
                  setBetAmount(amount > 10000 ? 10000 : amount);
                }}
                className="w-full bg-[#121212] rounded-lg border border-[#333333] p-2 font-mono"
                disabled={isRolling}
              />
              <button 
                className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-[#5465FF]"
                onClick={() => user && setBetAmount(Number(user.balance))}
                disabled={isRolling}
              >
                MAX
              </button>
            </div>
            <div className="flex gap-1 text-xs">
              <button 
                className="bg-[#1a1a1a] hover:bg-[#333] text-white px-2 py-1 rounded"
                onClick={() => setBetAmount(10000)}
                disabled={isRolling}
              >
                10,000
              </button>
              <button 
                className="bg-[#1a1a1a] hover:bg-[#333] text-white px-2 py-1 rounded"
                onClick={() => setBetAmount(1000)}
                disabled={isRolling}
              >
                1,000
              </button>
              <button 
                className="bg-[#1a1a1a] hover:bg-[#333] text-white px-2 py-1 rounded"
                onClick={() => setBetAmount(100)}
                disabled={isRolling}
              >
                100
              </button>
            </div>
          </div>
        </div>
        <div className="w-1/2">
          <span className="text-sm text-gray-400 block mb-1">Profit on Win</span>
          <div className="relative">
            <Input
              type="text"
              value={formatCurrency(profitOnWin)}
              className="w-full bg-[#121212] rounded-lg border border-[#333333] p-2 font-mono"
              readOnly
            />
            <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs text-[#00E701]">
              {multiplier.toFixed(2)}x
            </div>
          </div>
        </div>
      </div>
      
      <motion.div className="relative">
        {}
        {!isRolling && (
          <motion.div 
            className="absolute inset-0 rounded-lg bg-[#5465FF] opacity-30"
            animate={{ 
              scale: [1, 1.05, 1],
            }}
            transition={{ 
              duration: 1.5, 
              repeat: Infinity,
              repeatType: "mirror" 
            }}
          />
        )}
        
        <Button
          className={`w-full relative ${
            isRolling 
              ? 'bg-gradient-to-r from-[#444] to-[#333] text-gray-300' 
              : 'bg-gradient-to-r from-[#5465FF] to-[#6677FF] hover:from-[#6677FF] hover:to-[#7788FF] text-white'
          } font-bold py-4 px-4 rounded-lg shadow-lg transition duration-200`}
          onClick={handleRoll}
          disabled={isRolling || !user || betAmount <= 0}
        >
          <div className="flex items-center justify-center">
            {isRolling ? (
              <>
                <div className="mr-2 w-5 h-5 rounded-full border-2 border-t-transparent border-white animate-spin"></div>
                <span className="tracking-wider">ROLLING...</span>
              </>
            ) : (
              <>
                <i className="ri-dice-line mr-2"></i>
                <span className="tracking-wider">ROLL DICE</span>
              </>
            )}
          </div>
        </Button>
      </motion.div>
      
      {}
      <div className="flex justify-between items-center mb-4 px-2">
        <div className="flex items-center text-sm">
          <TrendingUp className="w-4 h-4 mr-1 text-[#5465FF]" />
          <span className="text-gray-400">Win Chance: <span className="text-white font-bold">{target}%</span></span>
        </div>
        <div className="flex items-center text-sm">
          <Zap className="w-4 h-4 mr-1 text-amber-400" />
          <span className="text-gray-400">Multiplier: <span className="text-white font-bold">{multiplier.toFixed(2)}x</span></span>
        </div>
      </div>
      
      <AnimatePresence>
        {lastResult && lastResult.isWin && lastResult.payout > betAmount && showWinMessage && (
          <motion.div 
            className="mt-4 p-4 bg-gradient-to-r from-[#121212] to-[#1a1a1a] rounded-lg text-center shadow-lg border border-[#333333]"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, type: "spring", stiffness: 300 }}
          >
            {}
            <motion.div 
              className="flex items-center justify-center gap-2 text-[#00E701] font-bold mb-2"
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.1, duration: 0.2 }}
            >
              <Trophy className="h-5 w-5" />
              <span className="text-lg uppercase tracking-wider">YOU WON!</span>
              <Trophy className="h-5 w-5" />
            </motion.div>
            
            {}
            <motion.div 
              className="font-mono text-2xl font-bold relative"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
            >
              {}
              <motion.div 
                className="absolute inset-0 flex items-center justify-center" 
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0] }}
                transition={{ delay: 0.6, duration: 1.5, repeat: 2, repeatType: "mirror" }}
              >
                <Sparkles className="w-8 h-8 text-amber-400" />
              </motion.div>
              
              {formatCurrency(lastResult.payout)}
            </motion.div>
            
            {}
            <div className="mt-3 pt-2 border-t border-[#333333] flex justify-between">
              <motion.div 
                className="text-sm text-gray-400"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7, duration: 0.3 }}
              >
                Target: <span className="text-white">{lastResult.target}</span>
              </motion.div>
              
              <motion.div 
                className="text-sm text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8, duration: 0.3 }}
              >
                Result: <span className={lastResult.isWin ? "text-[#00E701]" : "text-[#FF3A5E]"}>{lastResult.result}</span>
              </motion.div>
              
              <motion.div 
                className="text-sm text-gray-400"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.9, duration: 0.3 }}
              >
                Multiplier: <span className="text-amber-400">{multiplier.toFixed(2)}x</span>
              </motion.div>
            </div>
          </motion.div>
        )}
        
        {}
        {lastResult && !lastResult.isWin && showWinMessage && (
          <motion.div 
            className="mt-4 p-3 bg-[#121212] rounded-lg text-center opacity-80"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 0.8, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="text-gray-400 text-sm">
              Try again! You rolled <span className="text-[#FF3A5E] font-mono">{lastResult.result}</span> but needed below <span className="text-white font-mono">{lastResult.target}</span>.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
