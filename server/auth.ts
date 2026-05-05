import { Express, Request, Response, NextFunction } from "express";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";


const JWT_SECRET = process.env.JWT_SECRET || "crypto-casino-super-secure-jwt-secret";
const TOKEN_EXPIRY = '24h';

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$')) {
    return bcrypt.compare(supplied, stored);
  }

  const [hashed, salt] = stored.split(".");
  if (!hashed || !salt) {
    return false;
  }
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}


export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("Auth middleware: No Bearer token provided");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    
    
    storage.getUser(decoded.userId)
      .then(user => {
        if (!user) {
          console.log("Auth middleware: User not found for token");
          return res.status(401).json({ message: "Unauthorized" });
        }
        
        
        if (user.isBanned) {
          console.log("Auth middleware: Banned user attempted access:", user.username);
          return res.status(403).json({ message: "Account banned" });
        }
        
        
        req.user = user;
        next();
      })
      .catch(err => {
        console.error("Error fetching user:", err);
        res.status(500).json({ message: "Server error" });
      });
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
}


export function banStatusMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log("Ban Status middleware: No Bearer token provided");
      return res.status(401).json({ message: "Unauthorized" });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    
    
    storage.getUser(decoded.userId)
      .then(user => {
        if (!user) {
          console.log("Ban Status middleware: User not found for token");
          return res.status(401).json({ message: "Unauthorized" });
        }
        
        
        req.user = user;
        next();
      })
      .catch(err => {
        console.error("Error fetching user:", err);
        res.status(500).json({ message: "Server error" });
      });
  } catch (error) {
    console.error("Token validation error:", error);
    res.status(401).json({ message: "Unauthorized" });
  }
}


export function adminMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (!req.user.isAdmin) {
    console.log("Admin access denied for user:", req.user.username);
    return res.status(403).json({ message: "Admin access required" });
  }
  
  console.log("Admin access granted for:", req.user.username);
  next();
}


export function ownerMiddleware(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  
  if (!req.user.isOwner) {
    console.log("Owner access denied for user:", req.user.username);
    return res.status(403).json({ message: "Owner access required" });
  }
  
  console.log("Owner access granted for:", req.user.username);
  next();
}

export function setupAuth(app: Express) {
  console.log("Setting up JWT authentication...");

  
  app.post("/api/register", async (req, res) => {
    try {
      console.log("Registration attempt:", req.body.username);
      
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        console.log("Registration failed: Username already exists");
        return res.status(400).json({ message: "Username already exists" });
      }

      const user = await storage.createUser({
        ...req.body,
        password: await hashPassword(req.body.password),
      });
      
      console.log("User created successfully:", user.id, user.username);
        
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
      
      
      const { password, ...safeUser } = user;
      res.status(201).json({ 
        user: safeUser,
        token 
      });
    } catch (error) {
      console.error("Registration error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Registration failed", error: errorMessage });
    }
  });

  
  app.post("/api/login", async (req, res) => {
    try {
      console.log("Login attempt:", req.body.username);
      
      const user = await storage.getUserByUsername(req.body.username);
      
      if (!user || !(await comparePasswords(req.body.password, user.password))) {
        console.log("Login failed: Invalid credentials");
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      console.log("Login successful for user:", user.username);
      
      
      const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
      
      
      const { password, ...safeUser } = user;
      res.status(200).json({ 
        user: safeUser,
        token 
      });
    } catch (error) {
      console.error("Login error:", error);
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      res.status(500).json({ message: "Login failed", error: errorMessage });
    }
  });

  
  app.get("/api/user", authMiddleware, (req, res) => {
    const user = req.user as SelectUser;
    console.log("User API Authorized - User:", user.username);
    
    
    const { password, ...safeUser } = user;
    res.json(safeUser);
  });

  
}
