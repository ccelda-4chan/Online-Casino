import { useState, useEffect, useRef } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { useSound } from '@/hooks/use-sound';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { formatCurrency, generateCrashCurvePoints, formatMultiplier } from '@/lib/game-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, TrendingUp, ChevronUp, ChevronsUp, DollarSign, X, RotateCcw, Zap, Award } from 'lucide-react';

type GameState = 'idle' | 'betting' | 'in-progress' | 'crashed' | 'cashed-out';

export default function CrashGame() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { play, stop } = useSound();
  const [betAmount, setBetAmount] = useState(1);
  const [autoCashout, setAutoCashout] = useState(2);
  const [gameState, setGameState] = useState<GameState>('idle');
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState(0);
  const [cashoutPoint, setCashoutPoint] = useState(0);
  const [gameId, setGameId] = useState('');
  const [curvePoints, setCurvePoints] = useState<{ x: number; y: number }[]>([]);
  const [showWinMessage, setShowWinMessage] = useState(false);
  
  
  const animationRef = useRef<number | null>(null);
  const gameStartTime = useRef<number>(0);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);
  
  
  const startCrashMutation = useMutation({
    mutationFn: async (data: { amount: number, autoCashout?: number }) => {
      const res = await apiRequest('POST', '/api/games/crash/start', data);
      return await res.json();
    },
    onSuccess: (data: { gameId: string, crashPoint: number, betAmount: number, autoCashout?: number }) => {
      
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      
      setGameId(data.gameId);
      setCrashPoint(data.crashPoint);
      setGameState('in-progress');
      gameStartTime.current = Date.now();
      
      
      startAnimation(data.crashPoint);
      
      
      play('slotSpin', { loop: true });
      
      
      if (data.autoCashout && data.autoCashout > 1) {
        setAutoCashout(data.autoCashout);
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
      setGameState('idle');
    },
  });
  
  
  const cashoutMutation = useMutation({
    mutationFn: async (data: { gameId: string, amount: number, crashPoint: number, cashoutPoint: number }) => {
      const res = await apiRequest('POST', '/api/games/crash/cashout', data);
      return await res.json();
    },
    onSuccess: (data) => {
      
      queryClient.invalidateQueries({ queryKey: ['/api/user'] });
      
      
      setGameState('cashed-out');
      setCashoutPoint(data.cashoutPoint);
      
      
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
        animationRef.current = null;
      }
      
      
      stop('slotSpin');
      play('cashout');
      
      
      setTimeout(() => {
        setShowWinMessage(true);
      }, 300);
      
      
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    },
  });
  
  const startAnimation = (targetCrashPoint: number) => {
    
    setCurrentMultiplier(1);
    
    
    const width = 300;
    const height = 150;
    const points = generateCrashCurvePoints(targetCrashPoint, width, height);
    setCurvePoints(points);
    
    
    const animate = () => {
      const now = Date.now();
      const elapsed = (now - gameStartTime.current) / 1000;
      
      
      
      const growthFactor = Math.log(targetCrashPoint) / 5; 
      const newMultiplier = Math.exp(elapsed * growthFactor);
      setCurrentMultiplier(Math.min(newMultiplier, targetCrashPoint));
      
      
      if (newMultiplier >= targetCrashPoint) {
        
        setGameState('crashed');
        stop('slotSpin');
        play('crash');
        
        
        setTimeout(() => {
          setShowWinMessage(true);
        }, 300);
        
        
        
        return;
      }
      
      
      if (autoCashout > 1 && newMultiplier >= autoCashout && gameState === 'in-progress') {
        handleCashout();
        return;
      }
      
      
      animationRef.current = requestAnimationFrame(animate);
      
      
      drawCurve();
    };
    
    animationRef.current = requestAnimationFrame(animate);
  };
  
  const drawCurve = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    
    
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    
    const progress = Math.min(currentMultiplier / crashPoint, 1);
    const visiblePoints = curvePoints.slice(0, Math.floor(progress * curvePoints.length));
    
    
    const lineGradient = ctx.createLinearGradient(0, canvas.height, canvas.width, 0);
    lineGradient.addColorStop(0, '#5465FF');   
    lineGradient.addColorStop(0.7, '#A78BFA'); 
    lineGradient.addColorStop(1, '#F43F5E');   
    
    
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.lineWidth = 1;
    
    
    for (let x = 50; x < canvas.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    
    
    for (let y = 50; y < canvas.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }
    
    
    ctx.strokeStyle = 'rgba(84, 101, 255, 0.5)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(canvas.width, canvas.height); 
    ctx.moveTo(0, canvas.height);
    ctx.lineTo(0, 0); 
    ctx.stroke();
    
    
    if (visiblePoints.length > 1) {
      
      ctx.strokeStyle = 'rgba(84, 101, 255, 0.3)';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
      
      for (let i = 1; i < visiblePoints.length; i++) {
        ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
      }
      
      ctx.stroke();
      
      
      ctx.strokeStyle = lineGradient;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(visiblePoints[0].x, visiblePoints[0].y);
      
      for (let i = 1; i < visiblePoints.length; i++) {
        ctx.lineTo(visiblePoints[i].x, visiblePoints[i].y);
      }
      
      ctx.stroke();
      
      
      if (visiblePoints.length > 5) {
        
        for (let i = Math.max(0, visiblePoints.length - 10); i < visiblePoints.length - 1; i++) {
          const point = visiblePoints[i];
          const opacity = (i - (visiblePoints.length - 10)) / 10;
          const size = 3 * opacity;
          
          ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
          ctx.beginPath();
          ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      
      
      const lastPoint = visiblePoints[visiblePoints.length - 1];
      
      
      const gradient = ctx.createRadialGradient(lastPoint.x, lastPoint.y, 0, lastPoint.x, lastPoint.y, 15);
      gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
      gradient.addColorStop(0.5, 'rgba(84, 101, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(84, 101, 255, 0)');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 15, 0, Math.PI * 2);
      ctx.fill();
      
      
      ctx.fillStyle = currentMultiplier > 3 ? '#F43F5E' : currentMultiplier > 2 ? '#A78BFA' : '#5465FF';
      ctx.beginPath();
      ctx.arc(lastPoint.x, lastPoint.y, 6, 0, Math.PI * 2);
      ctx.fill();
      
      
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'right';
      [2, 3, 5, 10].forEach(level => {
        
        const yPos = canvas.height - (canvas.height * Math.log(level) / Math.log(30));
        if (yPos > 0 && yPos < canvas.height) {
          ctx.beginPath();
          ctx.moveTo(0, yPos);
          ctx.lineTo(5, yPos);
          ctx.stroke();
          ctx.fillText(`${level}x`, -5, yPos + 3);
        }
      });
    }
  };
  
  const handleStartGame = () => {
    
    if (!user || betAmount <= 0) {
      toast({
        title: 'Invalid bet',
        description: 'Bet amount must be greater than 0',
        variant: 'destructive',
      });
      return;
    }
    
    
    setGameState('betting');
    
    
    startCrashMutation.mutate({ 
      amount: betAmount, 
      autoCashout: autoCashout > 1 ? autoCashout : undefined 
    });
  };
  
  const handleCashout = () => {
    if (gameState !== 'in-progress' || !gameId) return;
    
    
    cashoutMutation.mutate({
      gameId,
      amount: betAmount,
      crashPoint,
      cashoutPoint: currentMultiplier
    });
  };
  
  const handleReset = () => {
    
    setGameState('idle');
    setCurrentMultiplier(1);
    setCrashPoint(0);
    setCashoutPoint(0);
    setGameId('');
    setCurvePoints([]);
    setShowWinMessage(false);
    
    
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  };
  
  return (
    <div className="bg-gradient-to-b from-[#1E1E2E] to-[#0F0F17] p-5 rounded-xl border border-indigo-900/30 shadow-xl">
      {}
      <div className="mb-5 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-2 rounded-xl">
            <Rocket className="h-5 w-5 text-white" />
          </div>
          <h2 className="text-xl font-bold text-white">Crash Game</h2>
        </div>
        
        {user && (
          <div className="flex items-center bg-black/40 px-3 py-1.5 rounded-full border border-indigo-900/30">
            <span className="text-gray-400 text-xs mr-2">BALANCE</span>
            <span className="font-mono font-bold text-green-400">
              {formatCurrency(user.balance)}
            </span>
          </div>
        )}
      </div>

      {}
      <motion.div 
        className={`relative h-56 md:h-72 mb-6 bg-[#0A0A12] rounded-xl overflow-hidden flex items-center justify-center border-2
          ${gameState === 'in-progress' 
            ? 'border-transparent' 
            : gameState === 'crashed' 
              ? 'border-red-500/30' 
              : gameState === 'cashed-out' 
                ? 'border-green-500/30' 
                : 'border-indigo-900/30'}`}
        initial={{ borderColor: 'rgba(79, 70, 229, 0.2)' }}
        animate={gameState === 'in-progress' ? {
          borderColor: ['rgba(79, 70, 229, 0.3)', 'rgba(167, 139, 250, 0.3)', 'rgba(244, 63, 94, 0.3)'],
          boxShadow: ['0 0 10px rgba(79, 70, 229, 0.1)', '0 0 15px rgba(167, 139, 250, 0.2)', '0 0 10px rgba(244, 63, 94, 0.1)']
        } : {}}
        transition={{ duration: 3, repeat: gameState === 'in-progress' ? Infinity : 0, repeatType: "reverse" }}
      >
        {}
        <canvas 
          ref={canvasRef} 
          width={600} 
          height={300} 
          className="absolute inset-0 w-full h-full"
        />
        
        {}
        <motion.div 
          className="relative z-10 text-center"
          animate={gameState === 'in-progress' ? { scale: [1, 1.05, 1] } : {}}
          transition={{ duration: 1.5, repeat: gameState === 'in-progress' ? Infinity : 0, repeatType: "reverse" }}
        >
          {}
          <motion.div 
            className={`font-mono font-bold text-4xl md:text-5xl
              ${currentMultiplier >= 5 
                ? 'text-red-500' 
                : currentMultiplier >= 3 
                  ? 'text-purple-500' 
                  : currentMultiplier >= 2 
                    ? 'text-indigo-500' 
                    : 'text-indigo-400'}`}
            initial={{ filter: 'drop-shadow(0 0 0px rgba(255, 255, 255, 0))' }}
            animate={gameState === 'in-progress' ? { 
              filter: [
                'drop-shadow(0 0 2px rgba(255, 255, 255, 0.3))',
                'drop-shadow(0 0 10px rgba(255, 255, 255, 0.5))',
                'drop-shadow(0 0 2px rgba(255, 255, 255, 0.3))'
              ] 
            } : {}}
            transition={{ duration: 2, repeat: gameState === 'in-progress' ? Infinity : 0 }}
          >
            {gameState === 'idle' ? '1.00×' : `${formatMultiplier(currentMultiplier)}×`}
          </motion.div>

          {}
          <motion.div
            className={`mt-3 text-sm font-semibold uppercase px-3 py-1 rounded-full inline-block
              ${gameState === 'in-progress' 
                ? 'bg-indigo-500/20 text-indigo-300' 
                : gameState === 'crashed' 
                  ? 'bg-red-500/20 text-red-300' 
                  : gameState === 'cashed-out' 
                    ? 'bg-green-500/20 text-green-300' 
                    : 'bg-gray-800 text-gray-400'}`}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            {gameState === 'idle' && 'Ready to Play'}
            {gameState === 'betting' && 'Preparing...'}
            {gameState === 'in-progress' && (
              <span className="flex items-center">
                <span className="animate-pulse mr-1.5 h-2 w-2 bg-indigo-500 rounded-full inline-block"></span>
                Live
              </span>
            )}
            {gameState === 'crashed' && 'Crashed'}
            {gameState === 'cashed-out' && 'Cashed Out'}
          </motion.div>
        </motion.div>
      </motion.div>
      
      {}
      {gameState === 'idle' && (
        <div className="flex flex-wrap gap-2 mb-4 justify-center">
          {[1, 5, 10, 25, 50, 100].map(amount => (
            <motion.button
              key={amount}
              className={`px-3 py-1 rounded-lg text-sm font-semibold transition-all
                ${betAmount === amount 
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                  : 'bg-[#18181F] text-gray-400 hover:bg-[#222230]'}`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setBetAmount(amount)}
            >
              {formatCurrency(amount)}
            </motion.button>
          ))}
        </div>
      )}
      
      {}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5">
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Bet Amount</span>
            <span className="text-xs text-indigo-400">
              No max limit
            </span>
          </div>
          <div className="relative">
            <Input
              type="text"
              value={betAmount.toString()}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '');
                
                const parts = value.split('.');
                const sanitized = parts[0] + (parts.length > 1 ? '.' + parts.slice(1).join('') : '');
                setBetAmount(Number(sanitized) || 0);
              }}
              className="w-full bg-[#0A0A12] rounded-lg border border-indigo-900/30 py-2 px-4 pr-20 font-mono"
              disabled={gameState !== 'idle'}
            />
            <button 
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs bg-indigo-900/30 hover:bg-indigo-800/50 text-indigo-400 px-2 py-1 rounded transition-colors"
              onClick={() => user && setBetAmount(Number(user.balance))}
              disabled={gameState !== 'idle'}
            >
              MAX
            </button>
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <span className="text-sm text-gray-400">Auto Cash Out</span>
            <span className="text-xs text-indigo-400">
              Multiplier Target
            </span>
          </div>
          <div className="relative">
            <Input
              type="text"
              value={autoCashout.toString()}
              onChange={(e) => {
                const val = e.target.value.replace(/[^0-9.]/g, '');
                setAutoCashout(Number(val) || 0);
              }}
              className="w-full bg-[#0A0A12] rounded-lg border border-indigo-900/30 py-2 px-4 pr-10 font-mono"
              disabled={gameState !== 'idle'}
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-400 text-sm font-mono">×</span>
            </div>
          </div>
        </div>
      </div>
      
      {}
      <div className="grid grid-cols-1 gap-4">
        {}
        {gameState === 'idle' && (
          <motion.button
            className={`bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700
              text-white font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-900/20
              flex items-center justify-center space-x-2 transition-all
              ${(!user || betAmount <= 0) ? 'opacity-50 cursor-not-allowed' : ''}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleStartGame}
            disabled={!user || betAmount <= 0}
          >
            <Rocket className="h-5 w-5" />
            <span>LAUNCH ROCKET</span>
          </motion.button>
        )}
        
        {}
        {gameState === 'betting' && (
          <motion.button
            className="bg-gradient-to-r from-indigo-600/50 to-purple-600/50
              text-white/70 font-bold py-3 px-4 rounded-xl shadow-lg shadow-indigo-900/10
              flex items-center justify-center space-x-2 transition-all"
            animate={{ 
              boxShadow: ['0 10px 15px -3px rgba(79, 70, 229, 0.1)', '0 10px 15px -3px rgba(79, 70, 229, 0.2)', '0 10px 15px -3px rgba(79, 70, 229, 0.1)']
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            disabled
          >
            <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>LAUNCHING...</span>
          </motion.button>
        )}
        
        {}
        {gameState === 'in-progress' && (
          <motion.button
            className="relative z-20 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700
              text-white font-bold py-4 px-4 rounded-xl shadow-lg shadow-green-900/20
              flex items-center justify-center space-x-2 transition-all"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            animate={{ 
              scale: [1, 1.05, 1],
              boxShadow: [
                '0 10px 15px -3px rgba(16, 185, 129, 0.2)', 
                '0 10px 20px -3px rgba(16, 185, 129, 0.4)', 
                '0 10px 15px -3px rgba(16, 185, 129, 0.2)'
              ]
            }}
            transition={{ duration: 1.5, repeat: Infinity }}
            onClick={handleCashout}
          >
            <motion.div 
              className="absolute inset-0 bg-emerald-400/20 rounded-xl z-0 pointer-events-none"
              animate={{ opacity: [0, 0.5, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, repeatType: "reverse" }}
            />
            <div className="relative relative z-10 flex items-center justify-center space-x-2">
              <ChevronUp className="h-6 w-6" />
              <div className="flex flex-col items-start">
                <span className="text-lg">CASH OUT</span>
                <span className="text-sm font-mono">{formatMultiplier(currentMultiplier)}×</span>
              </div>
            </div>
          </motion.button>
        )}
        
        {}
        {(gameState === 'crashed' || gameState === 'cashed-out') && (
          <motion.button
            className={`font-bold py-3 px-4 rounded-xl shadow-lg flex items-center justify-center space-x-2 transition-all
              ${gameState === 'cashed-out' 
                ? 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-indigo-900/20' 
                : 'bg-gradient-to-r from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white shadow-slate-900/20'}`}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleReset}
          >
            <RotateCcw className="h-5 w-5" />
            <span>{gameState === 'cashed-out' ? 'PLAY AGAIN' : 'TRY AGAIN'}</span>
          </motion.button>
        )}
      </div>
      
      {}
      <AnimatePresence>
        {gameState === 'cashed-out' && showWinMessage && (betAmount * cashoutPoint > betAmount) && (
          <motion.div 
            className="mt-6 p-5 bg-gradient-to-r from-[#0F172A] to-[#0F1622] rounded-xl border border-green-500/20 shadow-lg shadow-green-900/10 text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 300 }}
          >
            {}
            <motion.div 
              className="absolute inset-0 bg-gradient-to-r from-green-500/5 to-emerald-500/5"
              animate={{ 
                backgroundPosition: ['0% center', '100% center', '0% center'],
              }}
              transition={{ duration: 5, repeat: Infinity, repeatType: "mirror" }}
              style={{ backgroundSize: '200% 200%' }}
            />
            
            {}
            <div className="absolute inset-0 overflow-hidden">
              {[...Array(10)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-green-400"
                  initial={{ 
                    x: Math.random() * 100 + '%',
                    y: Math.random() * 100 + '%',
                    scale: 0,
                    opacity: 0 
                  }}
                  animate={{ 
                    y: [null, Math.random() * -50 - 20],
                    scale: [0, Math.random() * 2 + 1],
                    opacity: [0, 1, 0]
                  }}
                  transition={{ 
                    duration: Math.random() * 2 + 1,
                    repeat: Infinity,
                    repeatType: "loop",
                    delay: Math.random() * 2
                  }}
                />
              ))}
            </div>
            
            {}
            <div className="relative z-10">
              <motion.div 
                className="flex items-center justify-center space-x-2 mb-3"
                initial={{ y: -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.3 }}
              >
                <Award className="h-6 w-6 text-green-400" />
                <div className="text-xl font-bold text-green-400">CASHED OUT</div>
              </motion.div>
              
              <motion.div 
                className="font-mono text-3xl font-bold text-white mb-2"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2, duration: 0.4 }}
              >
                {formatCurrency(betAmount * cashoutPoint)}
              </motion.div>
              
              <motion.div
                className="flex items-center justify-center space-x-2 text-lg text-green-300 font-mono"
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, duration: 0.3 }}
              >
                <span>×</span>
                <span>{cashoutPoint.toFixed(2)}</span>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {gameState === 'crashed' && showWinMessage && (
          <motion.div 
            className="mt-6 p-5 bg-gradient-to-r from-[#1A1A25] to-[#191420] rounded-xl border border-red-500/20 shadow-lg shadow-red-900/10 text-center relative overflow-hidden"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 300 }}
          >
            {}
            <motion.div 
              className="absolute inset-0 bg-red-500/10"
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: [0, 1.5, 1], opacity: [0, 0.5, 0] }}
              transition={{ duration: 1 }}
            />
            
            {}
            <div className="relative z-10">
              <motion.div 
                className="flex items-center justify-center space-x-2 mb-3"
                initial={{ scale: 1.2, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.3, type: "spring" }}
              >
                <X className="h-6 w-6 text-red-500" />
                <div className="text-xl font-bold text-red-500">CRASHED</div>
              </motion.div>
              
              <motion.div 
                className="font-mono text-3xl font-bold text-white mb-1"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.3 }}
              >
                @ {formatMultiplier(crashPoint)}×
              </motion.div>
              
              <motion.div 
                className="text-sm text-gray-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
              >
                Better luck next time!
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
