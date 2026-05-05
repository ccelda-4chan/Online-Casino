import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, authMiddleware, banStatusMiddleware } from "./auth";
import { setupAdminRoutes } from "./admin";
import { setupRewardRoutes } from "./rewards";
import { setupSupportRoutes } from "./support";
import { setupPasswordResetRoutes } from "./reset-password";
import { 
  playSlots, 
  playDice, 
  startCrash, 
  crashCashout, 
  getTransactions, 
  playRoulette,
  startBlackjack,
  blackjackAction,
  playPlinko
} from "./games";
import Stripe from 'stripe';
import { 
  createPaymentIntentSchema, 
  CoinPackage, 
  subscriptionPlanSchema, 
  manageSubscriptionSchema,
  SubscriptionPlan,
  banAppealSchema
} from '@shared/schema';
import { z } from 'zod';


const coinPackages: CoinPackage[] = [
  {
    id: 'small',
    name: 'Starter Package',
    coins: 10000,
    price: 4.99,
    featured: false,
    discount: 0
  },
  {
    id: 'medium',
    name: 'Popular Package',
    coins: 30000,
    price: 9.99,
    featured: true,
    discount: 15
  },
  {
    id: 'large',
    name: 'Gold Package',
    coins: 100000,
    price: 24.99,
    featured: false,
    discount: 20
  },
  {
    id: 'whale',
    name: 'Whale Package',
    coins: 300000,
    price: 49.99,
    featured: false,
    discount: 25
  }
];


const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-02-24.acacia'
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  setupAuth(app);
  
  
  app.get("/api/announcements", async (req: Request, res: Response) => {
    try {
      
      const userId = req.user?.id;
      
      console.log("Fetching announcements for userId:", userId);
      
      
      
      const announcements = userId !== undefined 
        ? await storage.getAnnouncements(false, userId) 
        : await storage.getAnnouncements(false);
      
      console.log("Announcements retrieved successfully");
      
      
      res.json(announcements || []);
    } catch (error) {
      console.error("Error fetching announcements:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      res.json([]);
    }
  });

  
  app.post("/api/games/slots", authMiddleware, playSlots);
  app.post("/api/games/dice", authMiddleware, playDice);
  app.post("/api/games/crash/start", authMiddleware, startCrash);
  app.post("/api/games/crash/cashout", authMiddleware, crashCashout);
  app.post("/api/games/roulette", authMiddleware, playRoulette);
  app.post("/api/games/blackjack/start", authMiddleware, startBlackjack);
  app.post("/api/games/blackjack/action", authMiddleware, blackjackAction);
  app.post("/api/games/plinko", authMiddleware, playPlinko);
  
  
  app.get("/api/transactions", authMiddleware, getTransactions);
  
  
  app.get("/api/coins/packages", (req: Request, res: Response) => {
    res.json(coinPackages);
  });
  
  app.post("/api/coins/create-payment-intent", authMiddleware, async (req: Request, res: Response) => {
    return res.status(403).json({
      error: "Coin purchases are temporarily disabled. Admin crediting remains available."
    });
  });
  
  
  app.post("/api/coins/webhook", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'];
    
    let event;
    
    try {
      
      
      if (!sig) {
        return res.status(400).json({ error: "Missing Stripe signature" });
      }
      
      
      event = req.body;
      
      if (event.type === 'payment_intent.succeeded') {
        const paymentIntent = event.data.object;
        
        
        const payment = await storage.getPaymentBySessionId(paymentIntent.id);
        
        if (payment) {
          
          await storage.updatePaymentStatus(payment.id, 'completed');
          
          
          const userId = parseInt(paymentIntent.metadata.userId);
          const coins = parseInt(paymentIntent.metadata.coins);
          const user = await storage.getUser(userId);
          
          if (user) {
            const currentBalance = parseFloat(user.balance.toString());
            const newBalance = currentBalance + coins;
            
            
            await storage.updateUserBalance(userId, newBalance);
            
            
            await storage.createCoinTransaction({
              userId,
              amount: coins.toString(),
              reason: `Purchased ${coins} coins`,
              adminId: 0
            });
          }
        }
      }
      
      
      res.json({ received: true });
    } catch (err: any) {
      console.error('Error handling webhook:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });
  
  
  app.get("/api/coins/purchases", authMiddleware, async (req: Request, res: Response) => {
    try {
      const payments = await storage.getUserPayments(req.user!.id);
      res.json(payments);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
  
  
  setupAdminRoutes(app);
  
  
  setupRewardRoutes(app);
  
  
  setupSupportRoutes(app);
  
  
  setupPasswordResetRoutes(app);
  
  
  app.get("/api/user/ban-status", banStatusMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.isBanned) {
        return res.json({ 
          isBanned: false 
        });
      }
      
      
      const appeal = await storage.getUserBanAppeal(userId);
      
      res.json({
        isBanned: true,
        banReason: user.banReason,
        bannedAt: user.bannedAt,
        appeal: appeal || null
      });
    } catch (error) {
      console.error("Error checking ban status:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to check ban status", error: errorMessage });
    }
  });
  
  
  app.post("/api/user/ban-appeal", banStatusMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      
      const appealData = banAppealSchema.parse(req.body);
      
      
      const appeal = await storage.createBanAppeal(userId, appealData.reason);
      
      res.status(201).json({ appeal });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      
      console.error("Error creating ban appeal:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Failed to create ban appeal", error: errorMessage });
    }
  });
  
  
  
  
  app.get("/api/subscriptions/plans", async (req: Request, res: Response) => {
    try {
      const plans = await storage.getSubscriptionPlans();
      res.json(plans);
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  
  app.get("/api/subscriptions/current", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription) {
        return res.json({ active: false });
      }
      
      res.json({
        ...subscription,
        active: subscription.status === 'active'
      });
    } catch (error: any) {
      res.status(500).json({ message: error.message });
    }
  });
  
  
  app.post("/api/subscriptions/create", authMiddleware, async (req: Request, res: Response) => {
    try {
      const { tier } = manageSubscriptionSchema.parse(req.body);
      const userId = req.user!.id;
      
      
      const existingSubscription = await storage.getUserSubscription(userId);
      if (existingSubscription && existingSubscription.status === 'active') {
        return res.status(400).json({ message: "User already has an active subscription" });
      }
      
      
      const plans = await storage.getSubscriptionPlans();
      const selectedPlan = plans.find(plan => plan.tier === tier);
      
      if (!selectedPlan) {
        return res.status(400).json({ message: "Invalid subscription tier" });
      }
      
      
      let user = req.user!;
      let customerId = user.stripeCustomerId;
      
      if (!customerId) {
        const customer = await stripe.customers.create({
          email: user.email || `${user.username}@example.com`,
          name: user.username,
          metadata: {
            userId: user.id.toString()
          }
        });
        
        customerId = customer.id;
        
        
      }
      
      
      const subscription = await stripe.subscriptions.create({
        customer: customerId,
        items: [{
          price: selectedPlan.priceId,
        }],
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice.payment_intent'],
      });
      
      const latestInvoice = subscription.latest_invoice as Stripe.Invoice;
      const paymentIntent = latestInvoice.payment_intent as Stripe.PaymentIntent;
      
      
      await storage.createSubscription({
        userId,
        tier: selectedPlan.tier as "bronze" | "silver" | "gold",
        status: 'incomplete', 
        stripeSubscriptionId: subscription.id,
        priceId: selectedPlan.priceId,
        priceAmount: selectedPlan.price.toString(),
        startDate: new Date(),
        metadata: JSON.stringify({
          planName: selectedPlan.name,
          features: selectedPlan.features
        })
      });
      
      
      
      res.json({
        subscriptionId: subscription.id,
        clientSecret: paymentIntent.client_secret,
      });
    } catch (error: any) {
      console.error('Subscription creation error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  
  app.post("/api/subscriptions/cancel", authMiddleware, async (req: Request, res: Response) => {
    try {
      const userId = req.user!.id;
      
      
      const subscription = await storage.getUserSubscription(userId);
      
      if (!subscription || subscription.status !== 'active') {
        return res.status(400).json({ message: "No active subscription found" });
      }
      
      
      await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
      
      
      const updatedSubscription = await storage.cancelSubscription(subscription.id);
      
      
      await storage.updateUserSubscriptionTier(userId, null);
      
      res.json({
        message: "Subscription cancelled successfully",
        subscription: updatedSubscription
      });
    } catch (error: any) {
      console.error('Subscription cancellation error:', error);
      res.status(500).json({ message: error.message });
    }
  });
  
  
  app.post("/api/subscriptions/webhook", async (req: Request, res: Response) => {
    const sig = req.headers['stripe-signature'] as string;
    
    try {
      const event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test'
      );
      
      console.log(`Received webhook event: ${event.type}`);
      
      
      switch (event.type) {
        case 'customer.subscription.created':
          
          console.log(`Subscription created in Stripe: ${(event.data.object as Stripe.Subscription).id}`);
          break;
          
        case 'customer.subscription.updated':
          const updatedSubscription = event.data.object as Stripe.Subscription;
          console.log(`Subscription ${updatedSubscription.id} was updated. Status: ${updatedSubscription.status}`);
          
          try {
            
            const dbSubscription = await storage.findSubscriptionByStripeId(updatedSubscription.id);
            
            if (dbSubscription) {
              
              await storage.updateSubscription(dbSubscription.id, {
                status: updatedSubscription.status
              });
              
              
              if (updatedSubscription.status === 'active') {
                await storage.updateUserSubscriptionTier(dbSubscription.userId, dbSubscription.tier);
                console.log(`User ${dbSubscription.userId} subscription updated to ${dbSubscription.tier}`);
              } else if (updatedSubscription.status === 'canceled' || updatedSubscription.status === 'unpaid') {
                
                await storage.updateUserSubscriptionTier(dbSubscription.userId, null);
                console.log(`User ${dbSubscription.userId} subscription removed due to status: ${updatedSubscription.status}`);
              }
            }
          } catch (error) {
            console.error('Error processing subscription update:', error);
          }
          break;
          
        case 'customer.subscription.deleted':
          const deletedSubscription = event.data.object as Stripe.Subscription;
          console.log(`Subscription ${deletedSubscription.id} was deleted`);
          
          try {
            
            const dbSubscription = await storage.findSubscriptionByStripeId(deletedSubscription.id);
            
            if (dbSubscription) {
              
              await storage.updateSubscription(dbSubscription.id, {
                status: 'canceled',
                endDate: new Date()
              });
              
              
              await storage.updateUserSubscriptionTier(dbSubscription.userId, null);
              console.log(`User ${dbSubscription.userId} subscription removed due to deletion`);
            }
          } catch (error) {
            console.error('Error processing subscription deletion:', error);
          }
          break;
          
        case 'invoice.payment_succeeded':
          const invoice = event.data.object as Stripe.Invoice;
          if (invoice.subscription) {
            console.log(`Payment succeeded for subscription ${invoice.subscription}`);
            
            try {
              
              const dbSubscription = await storage.findSubscriptionByStripeId(invoice.subscription as string);
              
              if (dbSubscription) {
                
                await storage.updateSubscription(dbSubscription.id, {
                  status: 'active'
                });
                
                
                await storage.updateUserSubscriptionTier(dbSubscription.userId, dbSubscription.tier);
                console.log(`User ${dbSubscription.userId} subscription activated after payment`);
              }
            } catch (error) {
              console.error('Error processing payment success:', error);
            }
          }
          break;
          
        case 'invoice.payment_failed':
          const failedInvoice = event.data.object as Stripe.Invoice;
          if (failedInvoice.subscription) {
            console.log(`Payment failed for subscription ${failedInvoice.subscription}`);
            
            try {
              const dbSubscription = await storage.findSubscriptionByStripeId(failedInvoice.subscription as string);
              
              if (dbSubscription) {
                
                await storage.updateSubscription(dbSubscription.id, {
                  status: 'past_due'
                });
                
                
                if (dbSubscription.status === 'active') {
                  await storage.updateUserSubscriptionTier(dbSubscription.userId, null);
                  console.log(`User ${dbSubscription.userId} subscription deactivated due to payment failure`);
                }
              }
            } catch (error) {
              console.error('Error processing payment failure:', error);
            }
          }
          break;
          
        default:
          console.log(`Unhandled event type ${event.type}`);
      }
      
      res.json({ received: true });
    } catch (err: any) {
      console.error('Webhook error:', err.message);
      res.status(400).send(`Webhook Error: ${err.message}`);
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
