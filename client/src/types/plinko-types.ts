

export type RiskLevel = 'low' | 'medium' | 'high';

export interface PathStep {
  row: number;
  position: number;
}

export interface PinPosition {
  row: number;
  x: number;
  y: number;
  radius: number;
}

export interface Bucket {
  x: number;
  width: number;
  multiplier: number;
}

export interface BallPosition {
  x: number;
  y: number;
}

export interface PlinkoResult {
  isWin: boolean;
  payout: number;
  multiplier: number;
  path: PathStep[];
  pins: any[][];
  risk: RiskLevel;
  rows: number;
  landingPosition: number;
  paths?: PathStep[][];
  landingPositions?: number[];
  balls?: number;
  amount?: number;
  multipliers?: number[];
}

export interface BetData {
  amount: number;
  risk: RiskLevel;
  balls?: number;
}