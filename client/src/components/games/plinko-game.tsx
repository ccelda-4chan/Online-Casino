import React, { useState, useRef, useEffect, ChangeEvent } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { useSound } from '@/hooks/use-sound';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { formatCurrency, formatMultiplier } from '@/lib/game-utils';
import { ArrowDown, ArrowUp, Coins, Award, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  PlinkoResult, 
  RiskLevel, 
  BallPosition, 
  Bucket, 
  PathStep, 
  PinPosition 
} from '@/types/plinko-types';


const ROWS = 10; 
const BUCKET_COUNT = 11; 
const PIN_SIZE = 14; 
const PIN_RADIUS = PIN_SIZE / 2;
const PIN_START_Y = 40;

const getPinCoordinates = (
  row: number,
  position: number,
  dimensions: {
    pinSpacingX: number;
    pinSpacingY: number;
    boardWidth: number;
    boardHeight: number;
  }
) => {
  const pinsInRow = row + 1;
  const rowWidth = (pinsInRow - 1) * dimensions.pinSpacingX;
  const startX = dimensions.boardWidth / 2 - rowWidth / 2;

  return {
    x: startX + position * dimensions.pinSpacingX,
    y: PIN_START_Y + row * dimensions.pinSpacingY,
  };
};

const getBucketCenterX = (
  bucket: number,
  dimensions: {
    boardWidth: number;
    pinSpacingX: number;
    pinSpacingY: number;
    boardHeight: number;
  }
) => {
  const bucketWidth = dimensions.boardWidth / BUCKET_COUNT;
  return bucket * bucketWidth + bucketWidth / 2;
};


const calculateDimensions = (containerWidth: number) => {
  let pinSpacingX = 40; 
  let pinSpacingY = 40;
  
  
  if (containerWidth < 300) {
    pinSpacingX = 22;
    pinSpacingY = 22;
  } else if (containerWidth < 400) {
    pinSpacingX = 24;
    pinSpacingY = 24;
  } else if (containerWidth < 500) {
    pinSpacingX = 28;
    pinSpacingY = 28;
  } else if (containerWidth < 600) {
    pinSpacingX = 32;
    pinSpacingY = 32;
  } else if (containerWidth < 800) {
    pinSpacingX = 36;
    pinSpacingY = 36;
  } else {
    pinSpacingX = 40;
    pinSpacingY = 40;
  }
  
  
  const boardWidth = pinSpacingX * (BUCKET_COUNT);
  const boardHeight = pinSpacingY * ROWS + 60; 
  
  return {
    pinSpacingX,
    pinSpacingY,
    boardWidth,
    boardHeight
  };
};


const calculatePinsWithSpacing = (spacingX: number, spacingY: number): PinPosition[] => {
  const pins: PinPosition[] = [];
  const boardWidth = spacingX * BUCKET_COUNT;
  const centerX = boardWidth / 2;

  const pinRows = ROWS - 1;

  for (let row = 0; row < pinRows; row++) {
    const pinsInRow = row + 1;
    const rowWidth = (pinsInRow - 1) * spacingX;
    const startX = centerX - rowWidth / 2;
    const yPos = PIN_START_Y + row * spacingY;

    for (let i = 0; i < pinsInRow; i++) {
      pins.push({
        row,
        x: startX + i * spacingX,
        y: yPos,
        radius: PIN_RADIUS,
      });
    }
  }

  return pins;
};



const MULTIPLIERS: Record<RiskLevel, number[]> = {
  
  low: [2.0, 1.5, 1.2, 1.1, 0.9, 0.8, 0.9, 1.1, 1.2, 1.5, 2.0],
  
  
  medium: [4.0, 2.5, 1.5, 1.0, 0.5, 0.2, 0.5, 1.0, 1.5, 2.5, 4.0],
  
  
  high: [18.0, 8.0, 4.0, 1.5, 0.3, 0.1, 0.3, 1.5, 4.0, 8.0, 18.0]
};



const calculateBucketsWithSpacing = (
  riskLevel: RiskLevel, 
  spacingX: number, 
  boardWidth: number
): Bucket[] => {
  const multipliers = MULTIPLIERS[riskLevel];
  
  
  const bucketWidth = spacingX; 
  const totalBucketsWidth = bucketWidth * multipliers.length;
  
  
  const centerX = boardWidth / 2;
  const startX = centerX - (totalBucketsWidth / 2);
  
  return multipliers.map((multiplier: number, index: number) => {
    
    return {
      x: startX + index * bucketWidth,
      width: bucketWidth,
      multiplier
    };
  });
};


interface PlinkoGameProps {
  onResultChange?: (result: PlinkoResult | null) => void;
  onAnimatingChange?: (isAnimating: boolean) => void;
  externalResult?: PlinkoResult | null;
  risk?: RiskLevel; 
  onRiskChange?: (risk: RiskLevel) => void; 
}

export default function PlinkoGame({ 
  onResultChange, 
  onAnimatingChange,
  externalResult,
  risk: externalRisk, 
  onRiskChange 
}: PlinkoGameProps = {}) {
  const { play } = useSound();
  const { toast } = useToast();
  
  
  const containerRef = useRef<HTMLDivElement>(null);
  
  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [currentPath, setCurrentPath] = useState<PathStep[] | null>(null);
  const [result, setResult] = useState<PlinkoResult | null>(null);
  
  const [risk, setRisk] = useState<RiskLevel>(externalRisk || 'medium');
  const [pins, setPins] = useState<PinPosition[]>([]);
  const [buckets, setBuckets] = useState<Bucket[]>([]);
  const [ballPosition, setBallPosition] = useState<BallPosition>({ x: 0, y: 0 });
  const [landingBucket, setLandingBucket] = useState<number | null>(null);
  
  
  const [dimensions, setDimensions] = useState({
    pinSpacingX: 40,
    pinSpacingY: 36, 
    boardWidth: 400, 
    boardHeight: 460
  });
  
  
  const [ballSize, setBallSize] = useState(14);
  
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  
  useEffect(() => {
    
    const updateDimensions = () => {
      if (!containerRef.current) return;
      
      
      const containerWidth = Math.max(containerRef.current.clientWidth, 300);
      console.log('Container width:', containerWidth);
      
      
      const newDimensions = calculateDimensions(containerWidth);
      setDimensions(newDimensions);
      
      
      const newBallSize = containerWidth < 400 ? 12 : containerWidth < 600 ? 14 : 16;
      setBallSize(newBallSize);
      
      
      const pinPositions = calculatePinsWithSpacing(
        newDimensions.pinSpacingX, 
        newDimensions.pinSpacingY
      );
      console.log('Pins calculated:', pinPositions.length, pinPositions[0]);
      setPins(pinPositions);
      
      
      setBuckets(calculateBucketsWithSpacing(
        risk, 
        newDimensions.pinSpacingX, 
        newDimensions.boardWidth
      ));
      
      
      setBallPosition({ 
        x: newDimensions.boardWidth / 2, 
        y: 0 
      });
    };
    
    
    updateDimensions();
    
    
    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });
    
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }
    
    
    return () => {
      if (containerRef.current) {
        resizeObserver.unobserve(containerRef.current);
      }
      resizeObserver.disconnect();
    };
  }, []);  
  
  
  

  
  
  useEffect(() => {
    
    if (result?.multipliers) {
      
      const bucketWidth = dimensions.pinSpacingX;
      const totalBucketsWidth = bucketWidth * result.multipliers.length;
      const centerX = dimensions.boardWidth / 2;
      const startX = centerX - (totalBucketsWidth / 2);
      
      const serverBuckets = result.multipliers.map((multiplier: number, index: number) => {
        return {
          x: startX + index * bucketWidth,
          width: bucketWidth,
          multiplier
        };
      });
      
      setBuckets(serverBuckets);
    } else {
      
      setBuckets(calculateBucketsWithSpacing(risk, dimensions.pinSpacingX, dimensions.boardWidth));
    }
  }, [risk, result, dimensions]);
  
  
  useEffect(() => {
    if (externalResult && !isAnimating) {
      setResult(externalResult);
      
      setRisk(externalResult.risk);
      animateBall(externalResult.path);
      
      console.log('Received game result from server:', externalResult);
      if (externalResult.multipliers) {
        console.log('Using server-provided multipliers:', externalResult.multipliers);
      }
    }
  }, [externalResult]);
  
  
  useEffect(() => {
    if (externalRisk && externalRisk !== risk) {
      setRisk(externalRisk);
      console.log('Risk level updated from parent:', externalRisk);
      
      
      setResult(null);
      setLandingBucket(null);
      
      
      setBuckets(calculateBucketsWithSpacing(externalRisk, dimensions.pinSpacingX, dimensions.boardWidth));
    }
  }, [externalRisk, risk, dimensions]);
  
  
  useEffect(() => {
    if (onAnimatingChange) {
      onAnimatingChange(isAnimating);
    }
  }, [isAnimating, onAnimatingChange]);
  
  
  useEffect(() => {
    if (onResultChange) {
      onResultChange(result);
    }
  }, [result, onResultChange]);
  
  
  useEffect(() => {
    if (onRiskChange) {
      onRiskChange(risk);
    }
  }, [risk, onRiskChange]);
  
  
  const animateBall = (path: PathStep[]): void => {
    setIsAnimating(true);
    
    
    setBallPosition({ x: dimensions.boardWidth / 2, y: 0 });
    
    
    const fullPath = path || generateRandomPath();
    setCurrentPath(fullPath);
    
    let currentStep = 0;
    const totalSteps = fullPath.length;
    
    
    
    const getStepDuration = (step: number, total: number): number => {
      
      if (step < total * 0.2) {
        return 700 - (step * 15); 
      } 
      
      else if (step < total * 0.8) {
        return 450;
      } 
      
      else {
        const remainingSteps = total - step;
        return 450 + ((total * 0.2 - remainingSteps) * 30); 
      }
    };
    
    const animate = (): void => {
      if (currentStep >= totalSteps) {
        
        setIsAnimating(false);
        
        
        const finalPosition = fullPath[fullPath.length - 1].position;
        
        
        const safeBucketIndex = Math.min(Math.max(0, finalPosition), BUCKET_COUNT - 1);
        setLandingBucket(safeBucketIndex);
        
        
        const bucketWidth = dimensions.pinSpacingX;
        const totalBucketsWidth = bucketWidth * BUCKET_COUNT;
        const centerX = dimensions.boardWidth / 2;
        const startX = centerX - (totalBucketsWidth / 2);
        const finalX = startX + safeBucketIndex * bucketWidth + bucketWidth / 2;
        
        
        
        const bucketPosition = dimensions.boardHeight - 30;
        
        
        
        setBallPosition({ 
          x: finalX,
          y: bucketPosition - 20 
        });
        
        
        setTimeout(() => {
          
          setBallPosition({ 
            x: finalX,
            y: bucketPosition + 5 
          });
          
          setTimeout(() => {
            
            setBallPosition({ 
              x: finalX,
              y: bucketPosition - 6
            });
            
            setTimeout(() => {
              
              setBallPosition({ 
                x: finalX,
                y: bucketPosition + 3
              });
              
              setTimeout(() => {
                
                setBallPosition({ 
                  x: finalX,
                  y: bucketPosition - 1
                });
                
                setTimeout(() => {
                  
                  setBallPosition({ 
                    x: finalX,
                    y: bucketPosition 
                  });
                }, 120);
              }, 120);
            }, 120);
          }, 150);
        }, 180);
        
        
        if (result && result.isWin) {
          play('win');
        } else {
          play('lose');
        }
        
        
        
        return;
      }
      
      
      const pathStep = fullPath[currentStep];
      let newX = 0;
      let newY = 0;

      if (pathStep.row < ROWS - 1) {
        const coords = getPinCoordinates(pathStep.row, pathStep.position, dimensions);
        newX = coords.x;
        newY = coords.y;
      } else {
        const safePosition = Math.min(Math.max(0, pathStep.position), BUCKET_COUNT - 1);
        newX = getBucketCenterX(safePosition, dimensions);
        newY = dimensions.boardHeight - 30;
      }

      setBallPosition({ x: newX, y: newY });
      
      
      if (currentStep > 0 && currentStep < totalSteps - 1) {
        play('click');
      }
      
      
      currentStep++;
      
      
      const nextDuration = 120 + Math.floor((currentStep / totalSteps) * 50);
      animationRef.current = setTimeout(animate, nextDuration);
    };

    const initialDuration = 120;
    animationRef.current = setTimeout(animate, initialDuration);
  };

  const generateRandomPath = (): PathStep[] => {
    const path: PathStep[] = [];
    let position = 0;
    const pinRows = ROWS - 1;

    for (let row = 0; row < pinRows; row++) {
      path.push({ row, position });
      const maxPosition = row + 1;
      if (Math.random() > 0.5 && position < maxPosition) {
        position += 1;
      }
    }

    path.push({ row: ROWS - 1, position });
    path.push({ row: ROWS, position });
    return path;
  };
  
  
  useEffect(() => {
    return () => {
      if (animationRef.current) {
        clearTimeout(animationRef.current);
      }
    };
  }, []);
  
  
  const handlePlayAgain = (): void => {
    if (result && !isAnimating) {
      animateBall(result.path);
    }
  };
  
  
  useEffect(() => {
    console.log('Pins state at render:', pins.length, pins);
  }, [pins]);
  
  return (
    <div className="p-4" ref={containerRef}>
      <div className="text-center mb-4">
        <p className="text-muted-foreground">
          Watch the ball drop and win big with multipliers up to 100x!
        </p>
      </div>
      
      {}
      <div className="flex flex-col items-center">
        <div 
          className="relative bg-gradient-to-b from-background/80 to-background border rounded-lg overflow-hidden"
          style={{ 
            width: Math.min(dimensions.boardWidth + 60, 700),
            height: Math.min(dimensions.boardHeight + 40, 600),
            maxWidth: "100%",
            transition: "width 0.3s, height 0.3s" 
          }}
        >
          {}
          <div className="absolute inset-0 flex items-center justify-center">
            {}
            <div 
              className="relative scale-[0.9] sm:scale-100" 
              style={{ 
                width: dimensions.boardWidth, 
                height: dimensions.boardHeight,
                transition: "width 0.3s, height 0.3s" 
              }}
            >
              {}
              {pins && pins.length > 0 ? pins.map((pin, index) => (
                <div
                  key={`pin-${index}`}
                  className="absolute rounded-full bg-primary/70"
                  style={{
                    width: PIN_SIZE, 
                    height: PIN_SIZE,
                    left: pin.x - PIN_RADIUS,
                    top: pin.y - PIN_RADIUS,
                    transform: 'translate(-50%, -50%)',
                    marginLeft: PIN_RADIUS,
                    marginTop: PIN_RADIUS,
                  }}
                />
              )) : (
                <div className="text-muted-foreground text-sm">No pins to display</div>
              )}
              
              {}
              <div className="absolute" style={{ bottom: 0, left: 0, width: "100%", height: 45 }}>
                {buckets.slice(0, -1).map((bucket, index) => (
                  <div 
                    key={`separator-${index}`}
                    className="absolute h-full w-[1px] bg-primary/30"
                    style={{ 
                      left: bucket.x + bucket.width,
                      zIndex: 5
                    }}
                  />
                ))}
              </div>
              
              {}
              <div className="absolute" style={{ bottom: 0, left: 0, width: "100%", height: 40 }}>
                {buckets.map((bucket, index) => (
                  <div
                    key={`bucket-${index}`}
                    className={`absolute flex items-center justify-center text-[0.6rem] xs:text-xs font-bold ${
                      landingBucket === index 
                        ? bucket.multiplier >= 1 
                          ? 'bg-green-500/30 text-green-500' 
                          : 'bg-red-500/30 text-red-500'
                        : bucket.multiplier >= 1 
                          ? 'bg-primary/20 text-primary' 
                          : 'bg-muted/40 text-muted-foreground'
                    }`}
                    style={{
                      left: bucket.x,
                      width: bucket.width,
                      height: "100%",
                      clipPath: 'polygon(0% 20%, 50% 0%, 100% 20%, 100% 100%, 0% 100%)'
                    }}
                  >
                    {}
                    <span className="transform scale-90">
                      {formatMultiplier(bucket.multiplier)}×
                    </span>
                  </div>
                ))}
              </div>
              
              {}
              <AnimatePresence>
                {isAnimating && (
                  <motion.div
                    className="absolute rounded-full z-10 overflow-hidden"
                    style={{
                      width: ballSize,
                      height: ballSize,
                      background: 'radial-gradient(circle at 35% 35%, #ffea00 5%, #ffbe00 60%, #ff9800 100%)',
                      boxShadow: '0 0 10px 2px rgba(255, 190, 0, 0.3), inset 0 0 6px 1px rgba(255, 255, 255, 0.5)'
                    }}
                    initial={{ 
                      x: dimensions.boardWidth / 2 - ballSize / 2,
                      y: -ballSize,
                      rotate: 0
                    }}
                    animate={{ 
                      x: ballPosition.x - ballSize / 2,
                      y: ballPosition.y - ballSize / 2,
                      
                      rotate: ballPosition.x * 0.5
                    }}
                    transition={{ 
                      type: 'spring', 
                      damping: 14, 
                      stiffness: 90,
                      mass: 1.2
                    }}
                  >
                    {}
                    <div 
                      className="absolute"
                      style={{
                        width: '40%',
                        height: '40%',
                        background: 'radial-gradient(circle at center, rgba(255,255,255,0.8) 0%, rgba(255,255,255,0) 70%)',
                        top: '15%',
                        left: '15%',
                        borderRadius: '50%'
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
      
      {}
    </div>
  );
}