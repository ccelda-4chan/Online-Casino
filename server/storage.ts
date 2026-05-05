import { 
  users, 
  transactions, 
  coinTransactions, 
  payments,
  loginRewards,
  subscriptions,
  banAppeals,
  supportTickets,
  ticketMessages,
  passwordResetTokens,
  User, 
  InsertUser, 
  Transaction, 
  InsertTransaction, 
  CoinTransaction, 
  InsertCoinTransaction,
  AdminUserUpdate,
  AdminBanUser,
  BanAppealType,
  InsertBanAppeal,
  AdminBanAppealResponse,
  AdminAnnouncement,
  SupportTicket,
  InsertSupportTicket,
  TicketMessage,
  InsertTicketMessage,
  AdminGameConfig,
  AdminMassBonus,
  Payment,
  InsertPayment,
  LoginReward,
  InsertLoginReward,
  Subscription,
  InsertSubscription,
  SubscriptionPlan,
  PasswordResetToken,
  InsertPasswordResetToken
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, asc, sql, like, and, or, isNull } from "drizzle-orm";



export interface IStorage {
  
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUserBalance(userId: number, newBalance: number): Promise<User>;
  incrementPlayCount(userId: number): Promise<User>;
  getUserPlayCount(userId: number): Promise<number>;
  updateUserLastLogin(userId: number): Promise<User>;
  updateLoginStreak(userId: number, streak: number): Promise<User>;
  checkDailyRewardStatus(userId: number): Promise<boolean>;
  updateUserPassword(userId: number, newPassword: string): Promise<User>;
  
  
  getActiveUsersCount(startDate: Date, endDate: Date): Promise<number>;
  getCoinsSpent(startDate: Date, endDate: Date): Promise<number>;
  getCoinsEarned(startDate: Date, endDate: Date): Promise<number>;
  getMostPlayedGame(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}>;
  getGameDistribution(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}[]>;
  getDailyNewUsers(): Promise<{date: string, count: number}[]>;
  getDailyTransactions(): Promise<{date: string, bets: number, wins: number}[]>;
  getSubscriptionStats(): Promise<{tier: string, count: number}[]>;
  
  
  getUserTransactions(userId: number, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  
  
  createLoginReward(reward: InsertLoginReward): Promise<LoginReward>;
  getUserLoginRewards(userId: number, limit?: number): Promise<LoginReward[]>;
  getRewardAmountForDay(day: number): Promise<number>;
  
  
  getAllUsers(limit?: number, offset?: number): Promise<User[]>;
  searchUsers(searchTerm: string): Promise<User[]>;
  updateUserAdminStatus(userId: number, updates: AdminUserUpdate): Promise<User>;
  getUserCount(): Promise<number>;
  
  
  adjustUserBalance(userId: number, amount: number, adminId: number, reason: string): Promise<User>;
  getCoinTransactions(userId?: number, limit?: number): Promise<CoinTransaction[]>;
  createCoinTransaction(transaction: InsertCoinTransaction): Promise<CoinTransaction>;
  
  
  createPayment(payment: InsertPayment): Promise<Payment>;
  getUserPayments(userId: number, limit?: number): Promise<Payment[]>;
  getPaymentBySessionId(sessionId: string): Promise<Payment | undefined>;
  updatePaymentStatus(id: number, status: string): Promise<Payment>;
  
  
  createAnnouncement(announcement: AdminAnnouncement, adminId: number): Promise<any>;
  getAnnouncements(includeExpired?: boolean): Promise<any[]>;
  deleteAnnouncement(id: number): Promise<void>;
  
  
  getGameConfig(gameType: string): Promise<any>;
  updateGameConfig(gameType: string, config: any): Promise<any>;
  
  
  getSupportTickets(status?: string, page?: number, limit?: number): Promise<any[]>;
  getSupportTicket(id: number): Promise<any | undefined>;
  createSupportTicket(userId: number, subject: string, message: string): Promise<any>;
  addSupportTicketReply(ticketId: number, userId: number, message: string, isAdmin: boolean): Promise<any>;
  updateSupportTicketStatus(ticketId: number, status: string): Promise<any | undefined>;
  
  
  createSubscription(subscription: InsertSubscription): Promise<Subscription>;
  getUserSubscription(userId: number): Promise<Subscription | undefined>;
  findSubscriptionByStripeId(stripeId: string): Promise<Subscription | undefined>;
  updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription>;
  cancelSubscription(id: number): Promise<Subscription>;
  getSubscriptionPlans(): Promise<SubscriptionPlan[]>;
  updateUserSubscriptionTier(userId: number, tier: string | null): Promise<User>;
  assignSubscriptionToUser(userId: number, tier: string, durationMonths: number, adminId: number, reason: string): Promise<Subscription>;
  
  
  banUser(userId: number, adminId: number, reason: string): Promise<User>;
  unbanUser(userId: number): Promise<User>;
  getBannedUsers(limit?: number, offset?: number): Promise<User[]>;
  
  
  createBanAppeal(userId: number, reason: string): Promise<BanAppealType>;
  getBanAppeals(status?: string, limit?: number, offset?: number): Promise<BanAppealType[]>;
  getUserBanAppeal(userId: number): Promise<BanAppealType | undefined>;
  respondToBanAppeal(appealId: number, adminId: number, status: string, response: string): Promise<BanAppealType>;
  
  
  createPasswordResetToken(userId: number, token: string, expiryHours: number): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenAsUsed(id: number): Promise<PasswordResetToken>;
  updateUserPassword(userId: number, newPassword: string): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserEmail(userId: number, email: string): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  
  async getUser(id: number): Promise<User | undefined> {
    console.log(`Getting user with ID ${id}`);
    
    if (!id || isNaN(id)) {
      console.error(`Invalid ID provided to getUser: ${id}`);
      throw new Error(`Invalid user ID: ${id}`);
    }
    
    
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.id, id));
    
    if (user) {
      console.log(`Found user: ${user.username} (ID: ${user.id})`);
    } else {
      console.log(`No user found with ID ${id}`);
    }
    
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    
    let isAdmin = false;
    let isOwner = false;
    
    const adminUsernames = [process.env.ADMIN_USERNAME || 'admin', 'aggeloskwn'];
    if (adminUsernames.includes(insertUser.username)) {
      isAdmin = true;
      isOwner = true;
    }
    
    const insertedRows = await db
      .insert(users)
      .values({
        ...insertUser,
        balance: "10000",
        isAdmin,
        isOwner,
        currentLoginStreak: 0,
      })
      .returning();

    const user = insertedRows[0];
    if (!user || !user.id) {
      throw new Error("Failed to create user");
    }

    return user;
  }

  async updateUserBalance(userId: number, newBalance: number): Promise<User> {
    console.log(`Updating balance for user ID ${userId} to ${newBalance}`);
    
    
    const user = await this.getUser(userId);
    if (!user) {
      console.error(`Error updating balance: User ID ${userId} not found`);
      throw new Error(`User ID ${userId} not found`);
    }
    
    console.log(`Current balance for user ${user.username} (ID: ${userId}): ${user.balance}`);
    
    
    await db
      .update(users)
      .set({ balance: String(newBalance) })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      console.error(`Error updating balance: No user returned after update for ID ${userId}`);
      throw new Error(`Failed to update user ID ${userId}`);
    }

    console.log(`Successfully updated balance for user ${updatedUser.username} (ID: ${userId}) from ${user.balance} to ${updatedUser.balance}`);
    return updatedUser;
  }
  
  async updateUserLastLogin(userId: number): Promise<User> {
    console.log(`Updating last login timestamp for user ID ${userId}`);
    
    
    const user = await this.getUser(userId);
    if (!user) {
      console.error(`Error updating last login: User ID ${userId} not found`);
      throw new Error(`User ID ${userId} not found`);
    }
    
    console.log(`Current last login for user ${user.username} (ID: ${userId}): ${user.lastLogin || 'never'}`);
    
    
    await db
      .update(users)
      .set({ lastLogin: new Date() })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      console.error(`Error updating last login: No user returned after update for ID ${userId}`);
      throw new Error(`Failed to update user ID ${userId}`);
    }

    console.log(`Successfully updated last login for user ${updatedUser.username} (ID: ${userId}) to ${updatedUser.lastLogin}`);
    return updatedUser;
  }
  
  async updateLoginStreak(userId: number, streak: number): Promise<User> {
    console.log(`Updating login streak for user ID ${userId} to ${streak}`);
    
    
    const currentTimestamp = new Date();
    console.log(`Current timestamp for reward claim: ${currentTimestamp.toISOString()}`);
    
    try {
      
      return await db.transaction(async (tx) => {
        
        const [lockedUser] = await tx
          .select()
          .from(users)
          .where(eq(users.id, userId))
          .for('update'); 
          
        if (!lockedUser) {
          console.error(`[TRANSACTION] Error updating streak: User ID ${userId} not found during row lock`);
          throw new Error(`User ID ${userId} not found during transaction lock`);
        }
        
        console.log(`[TRANSACTION] Locked user ${lockedUser.username} (ID: ${userId}) with current streak: ${lockedUser.currentLoginStreak || 0}`);
        console.log(`[TRANSACTION] User creation date: ${lockedUser.createdAt}, last reward: ${lockedUser.lastRewardDate || 'never'}`);
        
        
        await tx
          .update(users)
          .set({ 
            currentLoginStreak: streak,
            lastRewardDate: currentTimestamp  
          })
          .where(eq(users.id, userId)) 
          .execute();
        
        const updatedUser = await this.getUser(userId);
        if (!updatedUser) {
          console.error(`[TRANSACTION] Error updating streak: User not found after update for ID ${userId}`);
          throw new Error(`Failed to update user ID ${userId} in transaction`);
        }
        
        console.log(`[TRANSACTION] Successfully updated login streak for user ${updatedUser.username} (ID: ${userId}) to day ${streak}`);
        console.log(`[TRANSACTION] New lastRewardDate: ${updatedUser.lastRewardDate}`);
        
        return updatedUser;
      });
    } catch (error) {
      console.error(`Failed to update login streak for user ID ${userId}:`, error);
      throw error; 
    }
  }
  
  async checkDailyRewardStatus(userId: number): Promise<boolean> {
    console.log(`Checking daily reward eligibility for user ID ${userId}`);
    
    try {
      
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (!user) {
        console.error(`Error checking reward status: User ID ${userId} not found`);
        throw new Error(`User ID ${userId} not found`);
      }
      
      
      const userCreationDate = user.createdAt ? new Date(user.createdAt) : new Date();
      console.log(`User ${user.username} (ID: ${userId}) creation date: ${userCreationDate.toISOString()}`);
      console.log(`User ${user.username} (ID: ${userId}) last reward date: ${user.lastRewardDate || 'never'}`);
      
      
      
      if (!user.lastRewardDate) {
        console.log(`User ${user.username} has never claimed a reward before, they are eligible`);
        return true;
      }
      
      const lastReward = new Date(user.lastRewardDate);
      const now = new Date();
      
      
      const lastRewardDay = lastReward.toISOString().split('T')[0];
      const todayDay = now.toISOString().split('T')[0];
      
      
      
      const isEligible = lastRewardDay !== todayDay;
      
      console.log(`User ${user.username} (ID: ${userId}) last reward on ${lastRewardDay}, today is ${todayDay}, eligible: ${isEligible}`);
      
      return isEligible;
    } catch (error) {
      console.error(`Error checking daily reward eligibility for user ID ${userId}:`, error);
      throw error;
    }
  }

  
  async getUserTransactions(userId: number, limit = 10): Promise<Transaction[]> {
    const userTransactions = await db
      .select()
      .from(transactions)
      .where(eq(transactions.userId, userId))
      .orderBy(desc(transactions.timestamp))
      .limit(limit);
    
    return userTransactions;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const result = await db
      .insert(transactions)
      .values(insertTransaction)
      .execute();

    const id = Number(result[0].insertId);
    return {
      id,
      ...insertTransaction,
      timestamp: new Date(),
    } as Transaction;
  }
  
  async incrementPlayCount(userId: number): Promise<User> {
    console.log(`Incrementing play count for user ID ${userId}`);
    
    
    const user = await this.getUser(userId);
    if (!user) {
      console.error(`Error incrementing play count: User ID ${userId} not found`);
      throw new Error(`User ID ${userId} not found`);
    }
    
    console.log(`Current play count for user ${user.username} (ID: ${userId}): ${user.playCount || 0}`);
    
    
    const newPlayCount = (user.playCount || 0) + 1;
    
    
    await db
      .update(users)
      .set({ playCount: newPlayCount })
      .where(eq(users.id, userId))
      .execute();
    
    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      console.error(`Error incrementing play count: No user returned after update for ID ${userId}`);
      throw new Error(`Failed to update user ID ${userId}`);
    }
    
    console.log(`Successfully incremented play count for user ${updatedUser.username} (ID: ${userId}) from ${user.playCount || 0} to ${updatedUser.playCount || 0}`);
    return updatedUser;
  }
  
  async getUserPlayCount(userId: number): Promise<number> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    return user.playCount || 0;
  }
  
  
  async getAllUsers(limit = 50, offset = 0): Promise<User[]> {
    const allUsers = await db
      .select()
      .from(users)
      .orderBy(users.id)
      .limit(limit)
      .offset(offset);
    
    return allUsers;
  }
  
  async searchUsers(searchTerm: string): Promise<User[]> {
    const matchedUsers = await db
      .select()
      .from(users)
      .where(like(users.username, `%${searchTerm}%`))
      .orderBy(users.username)
      .limit(50);
    
    return matchedUsers;
  }
  
  async updateUserAdminStatus(userId: number, updates: AdminUserUpdate): Promise<User> {
    await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .execute();
    
    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }
    
    return updatedUser;
  }
  
  async getUserCount(): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users);
    
    return result[0].count;
  }
  
  
  async adjustUserBalance(userId: number, amount: number, adminId: number, reason: string): Promise<User> {
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    
    const currentBalance = parseFloat(user.balance.toString());
    const newBalance = currentBalance + amount;
    
    
    if (newBalance < 0) {
      throw new Error("Operation would result in negative balance");
    }
    
    
    const updatedUser = await this.updateUserBalance(userId, newBalance);
    
    
    await this.createCoinTransaction({
      userId,
      amount: amount.toString(),
      reason,
      adminId,
    });
    
    return updatedUser;
  }
  
  async getCoinTransactions(userId?: number, limit = 50): Promise<CoinTransaction[]> {
    let query = db
      .select()
      .from(coinTransactions)
      .orderBy(desc(coinTransactions.timestamp))
      .limit(limit);
    
    if (userId !== undefined) {
      return await db
        .select()
        .from(coinTransactions)
        .where(eq(coinTransactions.userId, userId))
        .orderBy(desc(coinTransactions.timestamp))
        .limit(limit);
    }
    
    return await query;
  }
  
  async createCoinTransaction(transaction: InsertCoinTransaction): Promise<CoinTransaction> {
    const result = await db
      .insert(coinTransactions)
      .values(transaction)
      .execute();

    const id = Number(result[0].insertId);
    return {
      id,
      ...transaction,
      timestamp: new Date(),
    } as CoinTransaction;
  }
  
  
  async createPayment(payment: InsertPayment): Promise<Payment> {
    const result = await db
      .insert(payments)
      .values(payment)
      .execute();

    const id = Number(result[0].insertId);
    return {
      id,
      ...payment,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as Payment;
  }
  
  async getUserPayments(userId: number, limit = 10): Promise<Payment[]> {
    const userPayments = await db
      .select()
      .from(payments)
      .where(eq(payments.userId, userId))
      .orderBy(desc(payments.createdAt))
      .limit(limit);
    
    return userPayments;
  }
  
  async getPaymentBySessionId(sessionId: string): Promise<Payment | undefined> {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.stripeSessionId, sessionId));
    
    return payment;
  }
  
  async updatePaymentStatus(id: number, status: string): Promise<Payment> {
    await db
      .update(payments)
      .set({ 
        status, 
        updatedAt: new Date() 
      })
      .where(eq(payments.id, id))
      .execute();
    
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, id));

    if (!payment) {
      throw new Error("Payment not found");
    }
    
    return payment;
  }
  
  
  async createLoginReward(reward: InsertLoginReward): Promise<LoginReward> {
    
    if (!reward.userId) {
      console.error("ERROR: Attempt to create login reward without userId");
      throw new Error("userId is required for login rewards");
    }
    
    
    const user = await this.getUser(reward.userId);
    if (!user) {
      console.error(`ERROR: Attempted to create login reward for non-existent user ID ${reward.userId}`);
      throw new Error(`User ID ${reward.userId} not found when creating reward`);
    }
    
    
    console.log(`REWARD CREATE: Creating login reward for user ${user.username} (ID: ${reward.userId}), day ${reward.day}, amount ${reward.amount}`);
    
    try {
      
      return await db.transaction(async (tx) => {
        
        const result = await tx
          .insert(loginRewards)
          .values({
            ...reward,
            
            userId: reward.userId 
          })
          .execute();

        const insertedId = Number(result[0].insertId);
        if (!insertedId) {
          console.error(`ERROR: Failed to create login reward for user ID ${reward.userId}`);
          throw new Error(`Failed to create login reward for user ID ${reward.userId}`);
        }

        const [newReward] = await tx
          .select()
          .from(loginRewards)
          .where(eq(loginRewards.id, insertedId));

        if (!newReward) {
          console.error(`ERROR: Failed to fetch created login reward for user ID ${reward.userId}`);
          throw new Error(`Failed to create login reward for user ID ${reward.userId}`);
        }
        
        console.log(`REWARD CREATED: Login reward ID ${newReward.id} created for user ${user.username} (ID: ${newReward.userId})`);
        return newReward;
      });
    } catch (error) {
      console.error(`Error creating login reward for user ${user.username} (ID: ${reward.userId}):`, error);
      throw error; 
    }
  }
  
  async getUserLoginRewards(userId: number, limit = 30): Promise<LoginReward[]> {
    console.log(`Getting login rewards for user ID ${userId}, limit ${limit}`);
    
    
    if (!userId || isNaN(userId)) {
      console.error(`Invalid user ID provided for rewards lookup: ${userId}`);
      throw new Error("Invalid user ID provided");
    }
    
    
    const rewards = await db
      .select()
      .from(loginRewards)
      .where(eq(loginRewards.userId, userId))
      .orderBy(desc(loginRewards.createdAt))
      .limit(limit);
    
    console.log(`Found ${rewards.length} rewards for user ID ${userId}`);
    
    
    if (rewards.length > 0) {
      console.log(`First reward: ID ${rewards[0].id}, day ${rewards[0].day}, amount ${rewards[0].amount}`);
    }
    
    return rewards;
  }
  
  async getRewardAmountForDay(day: number): Promise<number> {
    
    
    if (day <= 0 || day > 30) {
      throw new Error("Invalid day number for login rewards");
    }
    
    
    
    const baseReward = 100 + (day - 1) * 100;
    
    
    let bonusMultiplier = 1;
    if (day % 7 === 0) {
      
      bonusMultiplier = 2;
    } else if (day === 30) {
      
      bonusMultiplier = 3;
    } else if (day % 5 === 0) {
      
      bonusMultiplier = 1.5;
    }
    
    return baseReward * bonusMultiplier;
  }
  
  
  async getActiveUsersCount(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(users)
      .where(and(
        sql`"last_login" IS NOT NULL`,
        sql`"last_login" >= ${startDate}`,
        sql`"last_login" <= ${endDate}`
      ));
    
    return result[0].count;
  }
  
  async getCoinsSpent(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST("amount" AS NUMERIC)), 0)`
      })
      .from(transactions)
      .where(and(
        sql`"game_type" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`,
        sql`"is_win" = false`
      ));
    
    return parseFloat(result[0].total);
  }
  
  async getCoinsEarned(startDate: Date, endDate: Date): Promise<number> {
    const result = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST("payout" AS NUMERIC)), 0)`
      })
      .from(transactions)
      .where(and(
        sql`"game_type" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`,
        sql`"is_win" = true`
      ));
    
    return parseFloat(result[0].total);
  }
  
  async getMostPlayedGame(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}> {
    const result = await db
      .select({
        gameType: transactions.gameType,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"game_type" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`
      ))
      .groupBy(transactions.gameType)
      .orderBy(sql`count(*) DESC`)
      .limit(1);
    
    if (result.length === 0) {
      return { gameType: 'none', count: 0 };
    }
    
    return { 
      gameType: result[0].gameType!, 
      count: result[0].count 
    };
  }
  
  async getGameDistribution(startDate: Date, endDate: Date): Promise<{gameType: string, count: number}[]> {
    const result = await db
      .select({
        gameType: transactions.gameType,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"game_type" IS NOT NULL`,
        sql`"timestamp" >= ${startDate}`,
        sql`"timestamp" <= ${endDate}`
      ))
      .groupBy(transactions.gameType)
      .orderBy(sql`count(*) DESC`);
    
    return result.map(row => ({
      gameType: row.gameType!,
      count: row.count
    }));
  }
  
  async getDailyNewUsers(): Promise<{date: string, count: number}[]> {
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    const result = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', "created_at")::date`,
        count: sql<number>`count(*)`
      })
      .from(users)
      .where(sql`"created_at" >= ${startDate}`)
      .groupBy(sql`DATE_TRUNC('day', "created_at")::date`)
      .orderBy(sql`DATE_TRUNC('day', "created_at")::date`);
    
    return result.map(row => ({
      date: row.date,
      count: row.count
    }));
  }
  
  async getDailyTransactions(): Promise<{date: string, bets: number, wins: number}[]> {
    
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
    
    
    const betsResult = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', "timestamp")::date`,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"timestamp" >= ${startDate}`,
        sql`"game_type" IS NOT NULL`
      ))
      .groupBy(sql`DATE_TRUNC('day', "timestamp")::date`)
      .orderBy(sql`DATE_TRUNC('day', "timestamp")::date`);
    
    
    const winsResult = await db
      .select({
        date: sql<string>`DATE_TRUNC('day', "timestamp")::date`,
        count: sql<number>`count(*)`
      })
      .from(transactions)
      .where(and(
        sql`"timestamp" >= ${startDate}`,
        sql`"game_type" IS NOT NULL`,
        sql`"is_win" = true`
      ))
      .groupBy(sql`DATE_TRUNC('day', "timestamp")::date`)
      .orderBy(sql`DATE_TRUNC('day', "timestamp")::date`);
    
    
    const betsMap = new Map(betsResult.map(row => [row.date, row.count]));
    const winsMap = new Map(winsResult.map(row => [row.date, row.count]));
    
    
    const betsKeys = Array.from(betsMap.keys());
    const winsKeys = Array.from(winsMap.keys());
    const allDatesSet = new Set([...betsKeys, ...winsKeys]);
    const allDates = Array.from(allDatesSet).sort();
    
    return allDates.map(date => ({
      date,
      bets: betsMap.get(date) || 0,
      wins: winsMap.get(date) || 0
    }));
  }
  
  async getSubscriptionStats(): Promise<{tier: string, count: number}[]> {
    const result = await db
      .select({
        tier: users.subscriptionTier,
        count: sql<number>`count(*)`
      })
      .from(users)
      .groupBy(users.subscriptionTier)
      .orderBy(asc(users.subscriptionTier));
    
    
    const tiers = ['bronze', 'silver', 'gold', null]; 
    const resultMap = new Map(result.map(row => [row.tier, row.count]));
    
    return tiers.map(tier => ({
      tier: tier || 'none',
      count: resultMap.get(tier) || 0
    }));
  }

  
  
  private announcements: any[] = [];
  private announcementIdCounter = 1;
  
  async createAnnouncement(announcement: AdminAnnouncement, adminId: number): Promise<any> {
    const newAnnouncement = {
      id: this.announcementIdCounter++,
      ...announcement,
      adminId,
      createdAt: new Date(),
      expiresAt: announcement.isPinned 
        ? null 
        : new Date(Date.now() + announcement.duration * 1000) 
    };
    
    this.announcements.push(newAnnouncement);
    return newAnnouncement;
  }
  
  async getAnnouncements(includeExpired = false, userId?: number): Promise<any[]> {
    const now = new Date();
    
    console.log("Current announcements:", this.announcements);
    
    
    if (!this.announcements) {
      this.announcements = [];
      console.log("Initialized announcements array");
    }
    
    
    let filteredAnnouncements = includeExpired 
      ? [...this.announcements] 
      : this.announcements.filter(announcement => {
          return announcement.isPinned || 
                !announcement.expiresAt || 
                new Date(announcement.expiresAt) > now;
        });
        
    console.log("Filtered unexpired announcements:", filteredAnnouncements);
    
    
    if (userId !== undefined) {
      filteredAnnouncements = filteredAnnouncements.filter(announcement => {
        
        
        
        const shouldInclude = !announcement.targetUserIds || 
               (announcement.targetUserIds && announcement.targetUserIds.includes(userId));
        
        console.log(`Checking announcement ${announcement.id} for user ${userId}: ${shouldInclude}`);
        
        return shouldInclude;
      });
      
      console.log("Filtered for user:", filteredAnnouncements);
    }
    
    return filteredAnnouncements || [];
  }
  
  async deleteAnnouncement(id: number): Promise<void> {
    const index = this.announcements.findIndex(a => a.id === id);
    if (index !== -1) {
      this.announcements.splice(index, 1);
    }
  }
  
  
  
  private gameConfigs: Record<string, any> = {
    slots: {
      winChance: 0.85, 
      minWinMultiplier: 0.2,
      maxWinMultiplier: 50,
      paylineCount: 5
    },
    dice: {
      houseEdge: 0.01, 
      forceLossChance: 0.2 
    },
    crash: {
      immediateFailChance: 0.1, 
      minMultiplier: 1.01,
      maxMultiplier: 100,
      growthFactor: 0.05
    },
    roulette: {
      
    },
    blackjack: {
      deckCount: 6,
      shuffleThreshold: 0.25, 
      dealerStandsOnSoft17: true,
      blackjackPayout: 1.5 
    }
  };
  
  async getGameConfig(gameType: string): Promise<any> {
    return this.gameConfigs[gameType] || {};
  }
  
  async updateGameConfig(gameType: string, config: any): Promise<any> {
    this.gameConfigs[gameType] = {
      ...this.gameConfigs[gameType],
      ...config
    };
    
    return this.gameConfigs[gameType];
  }
  
  
  
  
  async getSupportTickets(status?: string, page = 1, limit = 20): Promise<any[]> {
    let queryBase = db.select({
      ticket: supportTickets,
      user: {
        username: users.username
      }
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .orderBy(desc(supportTickets.updatedAt));
    
    const offset = (page - 1) * limit;
    
    let results;
    if (status) {
      results = await queryBase
        .where(eq(supportTickets.status, status))
        .limit(limit)
        .offset(offset);
    } else {
      results = await queryBase
        .limit(limit)
        .offset(offset);
    }
    
    
    const ticketsWithMessages = await Promise.all(
      results.map(async (result) => {
        const messages = await this.getTicketMessages(result.ticket.id);
        
        return {
          ...result.ticket,
          username: result.user?.username || 'Unknown',
          messages
        };
      })
    );
    
    return ticketsWithMessages;
  }
  
  async getTicketMessages(ticketId: number): Promise<any[]> {
    const messageResults = await db.select({
      message: ticketMessages,
      user: {
        username: users.username
      }
    })
    .from(ticketMessages)
    .leftJoin(users, eq(ticketMessages.userId, users.id))
    .where(eq(ticketMessages.ticketId, ticketId))
    .orderBy(desc(ticketMessages.createdAt)); 
    
    return messageResults.map(result => ({
      ...result.message,
      username: result.user?.username || 'Unknown'
    }));
  }
  
  async getSupportTicket(id: number): Promise<any | undefined> {
    const [result] = await db.select({
      ticket: supportTickets,
      user: {
        username: users.username
      }
    })
    .from(supportTickets)
    .leftJoin(users, eq(supportTickets.userId, users.id))
    .where(eq(supportTickets.id, id));
    
    if (!result) return undefined;
    
    const messages = await this.getTicketMessages(id);
    
    return {
      ...result.ticket,
      username: result.user?.username || 'Unknown',
      messages
    };
  }
  
  async createSupportTicket(userId: number, subject: string, message: string): Promise<any> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    
    const ticketResult = await db
      .insert(supportTickets)
      .values({
        userId,
        subject,
        status: 'open',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .execute();

    const ticketId = Number(ticketResult[0].insertId);
    if (!ticketId) {
      throw new Error("Failed to create support ticket");
    }

    const messageResult = await db
      .insert(ticketMessages)
      .values({
        ticketId,
        userId,
        message,
        isAdmin: false,
        createdAt: new Date()
      })
      .execute();

    const messageId = Number(messageResult[0].insertId);

    return {
      id: ticketId,
      userId,
      subject,
      status: 'open',
      createdAt: new Date(),
      updatedAt: new Date(),
      username: user.username,
      messages: [
        {
          id: messageId,
          ticketId,
          userId,
          message,
          isAdmin: false,
          createdAt: new Date(),
          username: user.username,
        }
      ]
    };
  }
  
  async addSupportTicketReply(ticketId: number, userId: number, message: string, isAdmin: boolean): Promise<any> {
    
    const ticket = await this.getSupportTicket(ticketId);
    if (!ticket) {
      throw new Error("Support ticket not found");
    }
    
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    
const messageResult = await db
      .insert(ticketMessages)
      .values({
        ticketId,
        userId,
        message,
        isAdmin,
        createdAt: new Date()
      })
      .execute();

    const newMessageId = Number(messageResult[0].insertId);
    
    if (isAdmin && ticket.status === 'open') {
      await this.updateSupportTicketStatus(ticketId, 'in-progress');
    }
    
    
    await db
      .update(supportTickets)
      .set({ updatedAt: new Date() })
      .where(eq(supportTickets.id, ticketId));
    
    
    const updatedTicket = await this.getSupportTicket(ticketId);
    
    return updatedTicket;
  }
  
  async updateSupportTicketStatus(ticketId: number, status: string): Promise<any | undefined> {
    
    const ticket = await this.getSupportTicket(ticketId);
    if (!ticket) {
      return undefined;
    }
    
    
    await db
      .update(supportTickets)
      .set({
        status,
        updatedAt: new Date()
      })
      .where(eq(supportTickets.id, ticketId))
      .execute();

    return this.getSupportTicket(ticketId);
  }
  
  
  async createSubscription(subscription: InsertSubscription): Promise<Subscription> {
    const result = await db
      .insert(subscriptions)
      .values(subscription)
      .execute();

    const id = Number(result[0].insertId);
    if (!id) {
      throw new Error('Failed to create subscription');
    }
    
    
    
    if (subscription.status === 'active') {
      await this.updateUserSubscriptionTier(subscription.userId, subscription.tier);
    }

    return {
      id,
      ...subscription,
    } as Subscription;
  }
  
  async getUserSubscription(userId: number): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .orderBy(desc(subscriptions.createdAt))
      .limit(1);
    
    return subscription;
  }
  
  async findSubscriptionByStripeId(stripeId: string): Promise<Subscription | undefined> {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeSubscriptionId, stripeId));
    
    return subscription;
  }
  
  async updateSubscription(id: number, updates: Partial<Subscription>): Promise<Subscription> {
    await db
      .update(subscriptions)
      .set({ 
        ...updates,
        updatedAt: new Date() 
      })
      .where(eq(subscriptions.id, id))
      .execute();
    
    const updatedSubscription = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, id))
      .then(rows => rows[0]);
    
    if (!updatedSubscription) {
      throw new Error("Subscription not found");
    }
    
    
    if (updates.tier && updatedSubscription.userId) {
      await this.updateUserSubscriptionTier(updatedSubscription.userId, updates.tier);
    }
    
    
    if (updates.status && updatedSubscription.userId) {
      
      if (updates.status === 'active') {
        await this.updateUserSubscriptionTier(updatedSubscription.userId, updatedSubscription.tier);
      }
      
      else if (['canceled', 'past_due', 'unpaid', 'incomplete_expired'].includes(updates.status)) {
        await this.updateUserSubscriptionTier(updatedSubscription.userId, null);
      }
    }
    
    return updatedSubscription;
  }
  
  async cancelSubscription(id: number): Promise<Subscription> {
    return this.updateSubscription(id, { 
      status: 'canceled'
    });
  }
  
  async getSubscriptionPlans(): Promise<SubscriptionPlan[]> {
    
    return [
      {
        id: 'bronze',
        tier: 'bronze',
        name: 'Bronze',
        price: 2.99,
        description: 'Basic tier with 300 daily coins and Bronze badge',
        features: [
          '300 daily coins',
          'Bronze VIP badge',
          'Basic support'
        ],
        priceId: process.env.STRIPE_PRICE_ID_BRONZE || '',
        coinReward: 300
      },
      {
        id: 'silver',
        tier: 'silver',
        name: 'Silver',
        price: 5.99,
        description: 'Enhanced tier with 600 daily coins and multiplier benefits',
        features: [
          '600 daily coins',
          'Silver VIP badge',
          '1.1x reward multiplier',
          'Ad-free experience',
          'Priority support'
        ],
        priceId: process.env.STRIPE_PRICE_ID_SILVER || '',
        coinReward: 600,
        multiplier: 1.1
      },
      {
        id: 'gold',
        tier: 'gold',
        name: 'Gold',
        price: 9.99,
        description: 'Premium tier with 1000 daily coins, higher multiplier, and exclusive content',
        features: [
          '1000 daily coins',
          'Gold VIP badge',
          '1.25x reward multiplier',
          'Ad-free experience',
          'Access to premium games',
          'Premium support'
        ],
        priceId: process.env.STRIPE_PRICE_ID_GOLD || '',
        coinReward: 1000,
        multiplier: 1.25
      }
    ];
  }
  
  async assignSubscriptionToUser(userId: number, tier: string, durationMonths: number, adminId: number, reason: string): Promise<Subscription> {
    
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }
    
    
    const existingSubscription = await this.getUserSubscription(userId);
    if (existingSubscription && existingSubscription.status === 'active') {
      
      await this.cancelSubscription(existingSubscription.id);
    }
    
    
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + durationMonths);
    
    
    const plans = await this.getSubscriptionPlans();
    const selectedPlan = plans.find(plan => plan.tier === tier);
    
    if (!selectedPlan) {
      throw new Error("Invalid subscription tier");
    }
    
    
    const newSubscription = await this.createSubscription({
      userId,
      tier: tier as "bronze" | "silver" | "gold",
      status: 'active',
      stripeSubscriptionId: `admin_assigned_${Date.now()}`,
      priceId: selectedPlan.priceId,
      priceAmount: selectedPlan.price.toString(),
      startDate,
      endDate, 
      metadata: JSON.stringify({
        planName: selectedPlan.name,
        features: selectedPlan.features,
        assignedBy: adminId,
        reason
      })
    });
    
    
    await this.createCoinTransaction({
      userId,
      amount: "0", 
      reason: `${tier} subscription assigned by admin: ${reason}`,
      adminId
    });
    
    
    await this.updateUserSubscriptionTier(userId, tier);
    
    return newSubscription;
  }
  
  async updateUserSubscriptionTier(userId: number, tier: string | null): Promise<User> {
    await db
      .update(users)
      .set({ 
        subscriptionTier: tier
      })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async banUser(userId: number, adminId: number, reason: string): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (user.isOwner) {
      throw new Error("Cannot ban an owner account");
    }

    await db
      .update(users)
      .set({ 
        isBanned: true,
        banReason: reason,
        bannedAt: new Date(),
        bannedBy: adminId
      })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async unbanUser(userId: number): Promise<User> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await db
      .update(users)
      .set({ 
        isBanned: false,
        banReason: null,
        bannedAt: null,
        bannedBy: null
      })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async getBannedUsers(limit = 50, offset = 0): Promise<User[]> {
    const bannedUsers = await db
      .select()
      .from(users)
      .where(eq(users.isBanned, true))
      .orderBy(desc(users.bannedAt))
      .limit(limit)
      .offset(offset);

    return bannedUsers;
  }

  async createBanAppeal(userId: number, reason: string): Promise<BanAppealType> {
    const user = await this.getUser(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.isBanned) {
      throw new Error("User is not banned");
    }

    const existingAppeal = await this.getUserBanAppeal(userId);
    if (existingAppeal && (existingAppeal.status === 'pending' || existingAppeal.status === 'approved')) {
      throw new Error("User already has an active ban appeal");
    }

    const result = await db
      .insert(banAppeals)
      .values({
        userId,
        reason,
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .execute();

    const id = Number(result[0].insertId);
    if (!id) {
      throw new Error("Failed to create ban appeal");
    }

    const [appeal] = await db
      .select()
      .from(banAppeals)
      .where(eq(banAppeals.id, id));

    if (!appeal) {
      throw new Error("Failed to fetch created ban appeal");
    }

    return appeal;
  }

  async getBanAppeals(status?: string, limit = 50, offset = 0): Promise<BanAppealType[]> {
    if (status) {
      return await db
        .select()
        .from(banAppeals)
        .where(eq(banAppeals.status, status))
        .orderBy(desc(banAppeals.createdAt))
        .limit(limit)
        .offset(offset);
    } else {
      return await db
        .select()
        .from(banAppeals)
        .orderBy(desc(banAppeals.createdAt))
        .limit(limit)
        .offset(offset);
    }
  }

  async getUserBanAppeal(userId: number): Promise<BanAppealType | undefined> {
    const [appeal] = await db
      .select()
      .from(banAppeals)
      .where(eq(banAppeals.userId, userId))
      .orderBy(desc(banAppeals.createdAt))
      .limit(1);

    return appeal;
  }

  async respondToBanAppeal(appealId: number, adminId: number, status: string, response: string): Promise<BanAppealType> {
    const [appeal] = await db
      .select()
      .from(banAppeals)
      .where(eq(banAppeals.id, appealId))
      .limit(1);

    if (!appeal) {
      throw new Error('Appeal not found');
    }

    await db
      .update(banAppeals)
      .set({
        status,
        adminResponse: response,
        adminId,
        updatedAt: new Date()
      })
      .where(eq(banAppeals.id, appealId))
      .execute();

    if (status === 'approved') {
      await this.unbanUser(appeal.userId);
    }

    const [updatedAppeal] = await db
      .select()
      .from(banAppeals)
      .where(eq(banAppeals.id, appealId));

    if (!updatedAppeal) {
      throw new Error('Appeal update failed');
    }

    return updatedAppeal;
  }

  async createPasswordResetToken(userId: number, token: string, expiryHours: number): Promise<PasswordResetToken> {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + expiryHours);

    const result = await db
      .insert(passwordResetTokens)
      .values({
        userId,
        token,
        expiresAt,
        isUsed: false
      })
      .execute();

    const id = Number(result[0].insertId);
    if (!id) {
      throw new Error('Failed to create password reset token');
    }

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id));

    if (!resetToken) {
      throw new Error('Failed to fetch created password reset token');
    }

    return resetToken;
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token));

    return resetToken;
  }

  async markPasswordResetTokenAsUsed(id: number): Promise<PasswordResetToken> {
    await db
      .update(passwordResetTokens)
      .set({ isUsed: true })
      .where(eq(passwordResetTokens.id, id))
      .execute();

    const [updatedToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.id, id));

    if (!updatedToken) {
      throw new Error("Token not found");
    }

    return updatedToken;
  }

  async updateUserPassword(userId: number, newPassword: string): Promise<User> {
    await db
      .update(users)
      .set({ password: newPassword })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email));

    return user;
  }

  async updateUserEmail(userId: number, email: string): Promise<User> {
    await db
      .update(users)
      .set({ email })
      .where(eq(users.id, userId))
      .execute();

    const updatedUser = await this.getUser(userId);
    if (!updatedUser) {
      throw new Error("User not found");
    }

    return updatedUser;
  }
}

export const storage = new DatabaseStorage();
