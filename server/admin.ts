import { Express, Request, Response } from "express";
import { storage } from "./storage";
import { authMiddleware, adminMiddleware, ownerMiddleware, hashPassword } from "./auth";
import { 
  adminUserUpdateSchema, 
  adminCoinAdjustmentSchema,
  adminMassBonusSchema,
  adminAnnouncementSchema,
  adminGameConfigSchema,
  adminAssignSubscriptionSchema,
  adminBanUserSchema,
  adminBanAppealResponseSchema,
  banAppealSchema
} from "@shared/schema";
import { z } from "zod";




const adminPasswordResetSchema = z.object({
  newPassword: z.string().min(6).max(50)
});




export function setupAdminRoutes(app: Express) {
  console.log("Setting up admin API routes...");
  
  
  
  
  app.get("/api/admin/analytics", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const { timeframe } = req.query;
      let startDate;
      const endDate = new Date();
      
      
      switch(timeframe) {
        case 'today':
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'yesterday':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 1);
          startDate.setHours(0, 0, 0, 0);
          break;
        case 'week':
          startDate = new Date();
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'month':
          startDate = new Date();
          startDate.setMonth(startDate.getMonth() - 1);
          break;
        case 'year':
          startDate = new Date();
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
        default:
          startDate = new Date();
          startDate.setHours(0, 0, 0, 0); 
      }
      
      
      const activeUsers = await storage.getActiveUsersCount(startDate, endDate);
      
      
      const totalUsers = await storage.getUserCount();
      
      
      const coinsSpent = await storage.getCoinsSpent(startDate, endDate);
      const coinsEarned = await storage.getCoinsEarned(startDate, endDate);
      
      
      const mostPlayedGame = await storage.getMostPlayedGame(startDate, endDate);
      
      
      const gameDistribution = await storage.getGameDistribution(startDate, endDate);
      
      
      const dailyNewUsers = await storage.getDailyNewUsers();
      
      
      const dailyTransactions = await storage.getDailyTransactions();
      
      
      const subscriptionStats = await storage.getSubscriptionStats();
      
      res.json({
        activeUsers,
        totalUsers,
        coinsSpent,
        coinsEarned,
        mostPlayedGame,
        gameDistribution,
        dailyNewUsers,
        dailyTransactions,
        subscriptionStats,
        timeframe: timeframe || 'today'
      });
    } catch (error) {
      console.error("Error in analytics endpoint:", error);
      res.status(500).json({ message: "Failed to get analytics data" });
    }
  });

  
  
  
  app.get("/api/admin/users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      
      const users = await storage.getAllUsers(limit, offset);
      
      
      const totalUsers = await storage.getUserCount();
      
      
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({
        users: safeUsers,
        pagination: {
          page,
          limit,
          totalUsers,
          totalPages: Math.ceil(totalUsers / limit)
        }
      });
    } catch (error) {
      console.error("Error fetching users:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch users", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/users/search", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const searchTerm = req.query.q as string;
      
      if (!searchTerm || searchTerm.length < 2) {
        return res.status(400).json({ message: "Search term must be at least 2 characters" });
      }
      
      const users = await storage.searchUsers(searchTerm);
      
      
      const safeUsers = users.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({ users: safeUsers });
    } catch (error) {
      console.error("Error searching users:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to search users", error: errorMessage });
    }
  });

  
  app.patch("/api/admin/users/:userId/admin-status", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const updateData = adminUserUpdateSchema.parse(req.body);
      
      
      if (userId === req.user?.id) {
        return res.status(403).json({ message: "Cannot modify your own admin status" });
      }
      
      
      const updatedUser = await storage.updateUserAdminStatus(userId, updateData);
      
      
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error updating user admin status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update user admin status", error: errorMessage });
    }
  });
  
  
  app.post("/api/admin/users/:userId/ban", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const banData = adminBanUserSchema.parse(req.body);
      
      
      if (userId === req.user?.id) {
        return res.status(403).json({ message: "Cannot ban yourself" });
      }
      
      
      const updatedUser = await storage.banUser(userId, req.user!.id, banData.banReason);
      
      
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error banning user:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to ban user", error: errorMessage });
    }
  });
  
  
  app.post("/api/admin/users/:userId/unban", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const updatedUser = await storage.unbanUser(userId);
      
      
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      console.error("Error unbanning user:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to unban user", error: errorMessage });
    }
  });

  
  
  
  app.post("/api/admin/users/:userId/adjust-balance", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const { amount, reason } = adminCoinAdjustmentSchema.omit({ username: true }).parse(req.body);
      
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      
      const updatedUser = await storage.adjustUserBalance(
        userId,
        amount,
        req.user!.id,
        reason
      );
      
      
      const { password, ...safeUser } = updatedUser;
      
      res.json({ user: safeUser });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error adjusting user balance:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to adjust user balance", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/coin-transactions", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = req.query.userId ? parseInt(req.query.userId as string) : undefined;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const transactions = await storage.getCoinTransactions(userId, limit);
      
      res.json({ transactions });
    } catch (error) {
      console.error("Error fetching coin transactions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch coin transactions", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/users/:userId/transactions", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const transactions = await storage.getUserTransactions(userId, limit);
      
      res.json({ transactions });
    } catch (error) {
      console.error("Error fetching user transactions:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch user transactions", error: errorMessage });
    }
  });

  
  
  
  app.post("/api/admin/mass-bonus", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      
      const bonusData = adminMassBonusSchema.parse(req.body);
      
      
      const allUsers = await storage.getAllUsers(1000, 0);
      const adminId = req.user!.id;
      
      
      const results = {
        success: 0,
        failed: 0,
        totalUsers: 0,
        targetedUsers: [] as number[] 
      };
      
      
      let targetUsers = [...allUsers];
      
      
      if (bonusData.targetType) {
        switch (bonusData.targetType) {
          case 'new':
            targetUsers = targetUsers.filter(user => user.playCount < 10);
            break;
          case 'active':
            targetUsers = targetUsers.filter(user => user.playCount >= 10 && user.playCount <= 100);
            break;
          case 'veteran':
            targetUsers = targetUsers.filter(user => user.playCount > 100);
            break;
          case 'custom':
            if (bonusData.filters) {
              const { minPlayCount, maxPlayCount } = bonusData.filters;
              if (minPlayCount !== undefined) {
                targetUsers = targetUsers.filter(user => user.playCount >= minPlayCount);
              }
              if (maxPlayCount !== undefined) {
                targetUsers = targetUsers.filter(user => user.playCount <= maxPlayCount);
              }
            }
            break;
          
        }
      }
      
      results.totalUsers = targetUsers.length;
      
      
      for (const user of targetUsers) {
        try {
          
          if (user.isBanned) continue;
          
          
          await storage.adjustUserBalance(
            user.id,
            bonusData.amount,
            adminId,
            bonusData.reason
          );
          
          results.success++;
          results.targetedUsers.push(user.id); 
        } catch (err) {
          console.error(`Failed to add bonus to user ${user.id}:`, err);
          results.failed++;
        }
      }
      
      
      const announcement = {
        title: "Bonus coins added!",
        message: bonusData.message,
        type: "success" as const,
        duration: 3600, 
        isPinned: true,
        targetUserIds: results.targetedUsers 
      };
      
      await storage.createAnnouncement(announcement, adminId);
      
      res.json({ 
        message: "Mass bonus processed", 
        results 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error processing mass bonus:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to process mass bonus", error: errorMessage });
    }
  });
  
  
  
  
  app.post("/api/admin/announcements", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      
      const announcementData = adminAnnouncementSchema.parse(req.body);
      
      
      const announcement = await storage.createAnnouncement(announcementData, req.user!.id);
      
      res.status(201).json({ announcement });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error creating announcement:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to create announcement", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/announcements", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const announcements = await storage.getAnnouncements(true); 
      
      res.json({ announcements });
    } catch (error) {
      console.error("Error fetching announcements:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch announcements", error: errorMessage });
    }
  });
  
  
  app.delete("/api/admin/announcements/:announcementId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const announcementId = parseInt(req.params.announcementId);
      
      await storage.deleteAnnouncement(announcementId);
      
      res.status(204).end();
    } catch (error) {
      console.error("Error deleting announcement:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to delete announcement", error: errorMessage });
    }
  });
  
  
  
  
  app.get("/api/admin/game-config/:gameType", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const gameType = req.params.gameType;
      
      
      if (!['slots', 'dice', 'crash', 'roulette', 'blackjack'].includes(gameType)) {
        return res.status(400).json({ message: "Invalid game type" });
      }
      
      const config = await storage.getGameConfig(gameType);
      
      res.json({ config });
    } catch (error) {
      console.error("Error fetching game config:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch game config", error: errorMessage });
    }
  });
  
  
  app.patch("/api/admin/game-config", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      
      const configData = adminGameConfigSchema.parse(req.body);
      
      
      const updatedConfig = await storage.updateGameConfig(
        configData.gameType,
        configData.config
      );
      
      res.json({ config: updatedConfig });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error updating game config:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update game config", error: errorMessage });
    }
  });
  
  
  
  
  app.get("/api/admin/support", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      
      const tickets = await storage.getSupportTickets(status, page, limit);
      
      res.json({ tickets });
    } catch (error) {
      console.error("Error fetching support tickets:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch support tickets", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/support/:ticketId", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      
      const ticket = await storage.getSupportTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      
      res.json({ ticket });
    } catch (error) {
      console.error("Error fetching support ticket:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch support ticket", error: errorMessage });
    }
  });
  
  
  app.post("/api/admin/support/:ticketId/reply", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { message } = req.body;
      
      if (!message || typeof message !== 'string' || message.trim().length === 0) {
        return res.status(400).json({ message: "Reply message is required" });
      }
      
      const ticket = await storage.getSupportTicket(ticketId);
      
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      
      
      const updatedTicket = await storage.addSupportTicketReply(
        ticketId,
        req.user!.id,
        message,
        true 
      );
      
      res.json({ ticket: updatedTicket });
    } catch (error) {
      console.error("Error replying to support ticket:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to reply to support ticket", error: errorMessage });
    }
  });
  
  
  app.patch("/api/admin/support/:ticketId/status", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const ticketId = parseInt(req.params.ticketId);
      const { status } = req.body;
      
      if (!status || !['open', 'in-progress', 'resolved', 'closed'].includes(status)) {
        return res.status(400).json({ message: "Valid status is required (open, in-progress, resolved, closed)" });
      }
      
      const ticket = await storage.updateSupportTicketStatus(ticketId, status);
      
      if (!ticket) {
        return res.status(404).json({ message: "Support ticket not found" });
      }
      
      res.json({ ticket });
    } catch (error) {
      console.error("Error updating support ticket status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to update support ticket status", error: errorMessage });
    }
  });
  
  
  
  
  app.post("/api/admin/subscriptions/assign", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      
      const subscriptionData = adminAssignSubscriptionSchema.parse(req.body);
      
      
      const targetUser = await storage.getUser(subscriptionData.userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      
      const subscription = await storage.assignSubscriptionToUser(
        subscriptionData.userId,
        subscriptionData.tier,
        subscriptionData.durationMonths,
        req.user!.id,
        subscriptionData.reason
      );
      
      res.status(201).json({ 
        message: `Successfully assigned ${subscriptionData.tier} subscription to ${targetUser.username} for ${subscriptionData.durationMonths} month(s)`,
        subscription 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error assigning subscription:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to assign subscription", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/users/:userId/subscription", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      
      const subscription = await storage.getUserSubscription(userId);
      
      res.json({ 
        user: {
          id: targetUser.id,
          username: targetUser.username,
          subscriptionTier: targetUser.subscriptionTier
        },
        subscription: subscription ? {
          ...subscription,
          active: subscription.status === 'active'
        } : null
      });
    } catch (error) {
      console.error("Error fetching user subscription:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch user subscription", error: errorMessage });
    }
  });

  
  app.delete("/api/admin/users/:userId/subscription", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.status(404).json({ message: "User has no active subscription" });
      }
      
      
      const { reason } = req.body;
      const auditReason = reason || "Removed by owner";
      
      
      const updatedSubscription = await storage.cancelSubscription(subscription.id);
      
      
      await storage.createCoinTransaction({
        userId,
        amount: "0", 
        reason: `Subscription removed by owner: ${auditReason}`,
        adminId: req.user!.id
      });
      
      
      
      res.json({ 
        message: `Successfully removed subscription from ${targetUser.username}`,
        subscription: updatedSubscription
      });
    } catch (error) {
      console.error("Error removing subscription:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to remove subscription", error: errorMessage });
    }
  });
  
  
  
  
  app.post("/api/admin/users/:userId/reset-password", authMiddleware, ownerMiddleware, async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      
      
      const targetUser = await storage.getUser(userId);
      if (!targetUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      
      const { newPassword } = adminPasswordResetSchema.parse(req.body);
      
      
      const hashedPassword = await hashPassword(newPassword);
      
      
      const updatedUser = await storage.updateUserPassword(userId, hashedPassword);
      
      
      const { password, ...safeUser } = updatedUser;
      
      res.json({ 
        user: safeUser,
        message: "Password reset successful" 
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error resetting user password:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to reset user password", error: errorMessage });
    }
  });

  
  
  
  app.get("/api/admin/banned-users", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      const bannedUsers = await storage.getBannedUsers(limit, offset);
      
      
      const safeBannedUsers = bannedUsers.map(user => {
        const { password, ...safeUser } = user;
        return safeUser;
      });
      
      res.json({ users: safeBannedUsers });
    } catch (error) {
      console.error("Error fetching banned users:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch banned users", error: errorMessage });
    }
  });
  
  
  app.get("/api/admin/ban-appeals", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const status = req.query.status as string | undefined;
      const page = req.query.page ? parseInt(req.query.page as string) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 20;
      const offset = (page - 1) * limit;
      
      const appeals = await storage.getBanAppeals(status, limit, offset);
      
      res.json({ appeals });
    } catch (error) {
      console.error("Error fetching ban appeals:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to fetch ban appeals", error: errorMessage });
    }
  });
  
  
  app.post("/api/admin/ban-appeals/:appealId/respond", authMiddleware, adminMiddleware, async (req, res) => {
    try {
      const appealId = parseInt(req.params.appealId);
      
      
      const responseData = {
        appealId, 
        ...req.body
      };
      
      
      const validatedData = adminBanAppealResponseSchema.parse(responseData);
      
      
      const updatedAppeal = await storage.respondToBanAppeal(
        appealId,
        req.user!.id,
        validatedData.status,
        validatedData.response
      );
      
      res.json({ appeal: updatedAppeal });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error responding to ban appeal:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to respond to ban appeal", error: errorMessage });
    }
  });
}