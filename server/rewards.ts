import { Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware } from "./auth";




export async function checkDailyReward(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;
    console.log(`Checking eligibility for daily reward for User ID ${userId}, username: ${req.user.username}`);
    
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`Error checking reward eligibility: User ID ${userId} not found at check time`);
      return res.status(404).json({ message: "User not found" });
    }
    
    
    const isEligible = await storage.checkDailyRewardStatus(userId);
    
    
    const currentStreak = typeof user.currentLoginStreak === 'number' ? user.currentLoginStreak : 0;
    
    
    
    let nextDay = currentStreak + 1;
    if (nextDay > 30) {
      nextDay = 1;
    }
    
    console.log(`User ${user.username} (ID: ${userId}) reward check: currentStreak=${currentStreak}, nextDay=${nextDay}, isEligible=${isEligible}`);
    
    return res.status(200).json({ 
      isEligible,
      streak: currentStreak,
      nextRewardDay: nextDay,
    });
  } catch (error) {
    console.error("Error checking daily reward:", error);
    return res.status(500).json({ message: "Server error" });
  }
}




export async function claimDailyReward(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;
    console.log(`Attempting to claim daily reward for User ID ${userId}, username: ${req.user.username}`);
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`Error claiming reward: User ID ${userId} not found at claim time`);
      return res.status(404).json({ message: "User not found" });
    }
    
    
    const isEligible = await storage.checkDailyRewardStatus(userId);
    if (!isEligible) {
      console.log(`User ${user.username} (ID: ${userId}) is not eligible for a reward today`);
      return res.status(400).json({ message: "You've already claimed your daily reward today" });
    }
    
    console.log(`User ${user.username} (ID: ${userId}) is eligible for a reward, proceeding...`);
    
    
    
    
    const currentStreak = typeof user.currentLoginStreak === 'number' ? user.currentLoginStreak : 0;
    console.log(`User ${user.username} current streak: ${currentStreak}`);
    let newStreak = currentStreak + 1;
    
    
    if (newStreak > 30) {
      newStreak = 1; 
    }
    
    console.log(`User ${user.username} new streak will be: ${newStreak}`);
    
    
    let baseRewardAmount = await storage.getRewardAmountForDay(newStreak);
    let rewardAmount = baseRewardAmount;
    let vipBonusAmount = 0;
    let multiplierApplied = 1;
    
    
    if (user.subscriptionTier) {
      
      console.log(`User subscription tier for reward calculation: ${user.subscriptionTier}`);
      
      
      const subscriptionPlans = await storage.getSubscriptionPlans();
      console.log(`Available subscription plans for reward calculation: ${subscriptionPlans.map(p => p.tier).join(', ')}`);
      
      
      const userPlan = subscriptionPlans.find(plan => plan.tier === user.subscriptionTier);
      console.log(`Found matching plan for ${user.subscriptionTier}: ${userPlan ? 'Yes' : 'No'}`);
      
      if (userPlan) {
        
        console.log(`User's specific plan details: tier=${userPlan.tier}, multiplier=${userPlan.multiplier}, coinReward=${userPlan.coinReward}`);
        
        
        if (userPlan.multiplier) {
          multiplierApplied = userPlan.multiplier;
          rewardAmount = Math.round(baseRewardAmount * userPlan.multiplier);
          console.log(`Applied ${userPlan.tier} multiplier (${userPlan.multiplier}x) to daily reward: ${baseRewardAmount} -> ${rewardAmount}`);
        } else {
          console.log(`No multiplier found for tier ${userPlan.tier}, using base reward amount`);
        }
        
        
        if (userPlan.coinReward > 0) {
          vipBonusAmount = userPlan.coinReward;
          rewardAmount += vipBonusAmount;
          console.log(`Added ${userPlan.tier} fixed bonus (${vipBonusAmount} coins) to daily reward: Total = ${rewardAmount}`);
        } else {
          console.log(`No coin reward found for tier ${userPlan.tier}`);
        }
      } else {
        console.log(`Warning: User has subscription tier ${user.subscriptionTier} but no matching plan configuration was found`);
      }
    } else {
      console.log("User has no subscription tier - using standard reward calculations");
    }
    
    
    await storage.updateLoginStreak(userId, newStreak);
    
    
    const currentBalance = parseFloat(user.balance.toString());
    const newBalance = currentBalance + rewardAmount;
    await storage.updateUserBalance(userId, newBalance);
    
    
    console.log(`Creating login reward record for user ID ${userId} - day ${newStreak}, amount: ${rewardAmount}`);
    try {
      const loginReward = await storage.createLoginReward({
        userId,
        day: newStreak,
        amount: rewardAmount.toString()
      });
      console.log(`Successfully created login reward record: ${loginReward.id}`);
    } catch (error) {
      console.error(`Error creating login reward record for user ID ${userId}:`, error);
      throw error; 
    }
    
    
    console.log(`Creating coin transaction record for user ID ${userId} - amount: ${rewardAmount}`);
    try {
      const transaction = await storage.createCoinTransaction({
        userId,
        amount: rewardAmount.toString(),
        reason: `Daily Login Reward - Day ${newStreak}`,
        adminId: 0 
      });
      console.log(`Successfully created coin transaction record: ${transaction.id}`);
    } catch (error) {
      console.error(`Error creating coin transaction for user ID ${userId}:`, error);
      throw error; 
    }
    
    
    let rewardMessage = `Congratulations! You've received ${rewardAmount} coins for your Day ${newStreak} login reward!`;
    
    
    if (user.subscriptionTier && vipBonusAmount > 0) {
      rewardMessage = `Congratulations! You've received ${rewardAmount} coins for your Day ${newStreak} login reward!\n` +
                      `Base reward: ${baseRewardAmount} coins\n` +
                      `${user.subscriptionTier.toUpperCase()} multiplier (${multiplierApplied}x): ${Math.round(baseRewardAmount * multiplierApplied) - baseRewardAmount} additional coins\n` +
                      `${user.subscriptionTier.toUpperCase()} VIP bonus: ${vipBonusAmount} coins`;
    }
    
    return res.status(200).json({
      success: true,
      message: rewardMessage,
      rewardAmount,
      baseRewardAmount,
      vipBonusAmount: vipBonusAmount || 0,
      multiplier: multiplierApplied,
      day: newStreak,
      newBalance,
      streak: newStreak,
      subscriptionTier: user.subscriptionTier || null
    });
  } catch (error) {
    console.error("Error claiming daily reward:", error);
    return res.status(500).json({ message: "Server error" });
  }
}




export async function getRewardHistory(req: Request, res: Response) {
  try {
    if (!req.user) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const userId = req.user.id;
    console.log(`Getting login rewards for user ID ${userId}, username: ${req.user.username}`);
    
    
    const user = await storage.getUser(userId);
    if (!user) {
      console.error(`Error getting reward history: User ID ${userId} not found`);
      return res.status(404).json({ message: "User not found" });
    }
    
    const rewardHistory = await storage.getUserLoginRewards(userId);
    console.log(`Found ${rewardHistory.length} rewards for user ID ${userId}`);
    
    return res.status(200).json(rewardHistory);
  } catch (error) {
    console.error("Error getting reward history:", error);
    return res.status(500).json({ message: "Server error" });
  }
}




export async function getRewardSchedule(req: Request, res: Response) {
  try {
    const rewardSchedule = [];
    let multiplier = 1; 
    let minimumReward = 0; 
    
    
    if (!req.user) {
      console.log("Reward schedule requested by unauthenticated user");
      
      
      for (let day = 1; day <= 30; day++) {
        const baseAmount = await storage.getRewardAmountForDay(day);
        rewardSchedule.push({
          day,
          amount: baseAmount,
          baseAmount,
          isMilestone: (day % 7 === 0 || day % 5 === 0 || day === 30)
        });
      }
      
      return res.status(200).json(rewardSchedule);
    }
    
    
    const user = await storage.getUser(req.user.id);
    if (!user) {
      console.error(`Error getting reward schedule: User ID ${req.user.id} not found`);
      return res.status(404).json({ message: "User not found" });
    }
    
    console.log("Reward Schedule - User data:", {
      id: user.id,
      username: user.username,
      subscriptionTier: user.subscriptionTier || "none"
    });
    
    
    if (user.subscriptionTier) {
      console.log(`User has subscription tier: ${user.subscriptionTier}`);
      
      
      const subscriptionPlans = await storage.getSubscriptionPlans();
      console.log("Available subscription plans found:", subscriptionPlans.length);
      
      const userPlan = subscriptionPlans.find(plan => plan.tier === user.subscriptionTier);
      console.log("User's plan:", userPlan ? `${userPlan.tier} tier found` : "No matching tier found");
      
      if (userPlan) {
        
        if (userPlan.multiplier) {
          multiplier = userPlan.multiplier;
          console.log(`Applying ${userPlan.tier} multiplier: ${multiplier}x - Standard rewards will be multiplied by this value`);
        }
        
        
        if (userPlan.coinReward) {
          minimumReward = userPlan.coinReward;
          console.log(`Applying ${userPlan.tier} VIP bonus: ${minimumReward} coins - This will be added on top of the multiplied base rewards`);
        }
      } else {
        console.log(`Warning: User has tier ${user.subscriptionTier} but no matching plan was found`);
      }
    } else {
      console.log("User has no subscription tier - using default reward values");
    }
    
    for (let day = 1; day <= 30; day++) {
      
      let baseAmount = await storage.getRewardAmountForDay(day);
      let amount = baseAmount;
      
      
      if (multiplier !== 1 || minimumReward > 0) {
        
        if (multiplier !== 1) {
          amount = Math.round(baseAmount * multiplier);
        }
        
        
        if (minimumReward > 0) {
          amount += minimumReward;
        }
      }
      
      
      const rewardObject = {
        day,
        amount,
        baseAmount,
        isMilestone: (day % 7 === 0 || day % 5 === 0 || day === 30)
      };
      
      
      if (multiplier !== 1 || minimumReward > 0) {
        Object.assign(rewardObject, {
          multiplier,
          vipBonus: minimumReward,
          calculationBreakdown: {
            baseReward: baseAmount,
            afterMultiplier: Math.round(baseAmount * multiplier),
            bonusAdded: minimumReward
          }
        });
      }
      
      rewardSchedule.push(rewardObject);
    }
    
    return res.status(200).json(rewardSchedule);
  } catch (error) {
    console.error("Error getting reward schedule:", error);
    return res.status(500).json({ message: "Server error" });
  }
}




export function setupRewardRoutes(app: any) {
  app.get("/api/rewards/check", authMiddleware, checkDailyReward);
  app.post("/api/rewards/claim", authMiddleware, claimDailyReward);
  app.get("/api/rewards/history", authMiddleware, getRewardHistory);
  app.get("/api/rewards/schedule", authMiddleware, getRewardSchedule);
}