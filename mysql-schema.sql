-- PostgreSQL schema for Online Casino persistent data
-- Run this script in your PostgreSQL database before starting the backend.
-- IMPORTANT: do not create the database here if your Postgres user lacks permission.

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(191) NOT NULL UNIQUE,
  email VARCHAR(255) NOT NULL,
  password VARCHAR(255) NOT NULL,
  balance NUMERIC(10,2) NOT NULL DEFAULT 10000.00,
  play_count INT NOT NULL DEFAULT 0,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  is_owner BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_reward_date TIMESTAMP NULL,
  current_login_streak INT NOT NULL DEFAULT 0,
  is_banned BOOLEAN NOT NULL DEFAULT FALSE,
  ban_reason TEXT NULL,
  banned_at TIMESTAMP NULL,
  banned_by INT NULL,
  subscription_tier VARCHAR(50) NOT NULL DEFAULT 'none',
  stripe_customer_id VARCHAR(255) NULL,
  stripe_subscription_id VARCHAR(255) NULL,
  subscription_status VARCHAR(50) NOT NULL DEFAULT 'inactive',
  subscription_ends_at TIMESTAMP NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  game_type VARCHAR(50) NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  multiplier NUMERIC(10,4) NOT NULL,
  payout NUMERIC(10,2) NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_win BOOLEAN NOT NULL,
  metadata TEXT NULL,
  game_data TEXT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS coin_transactions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  reason TEXT NOT NULL,
  admin_id INT NOT NULL,
  timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  coins NUMERIC(10,2) NOT NULL,
  stripe_session_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS login_rewards (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  day INT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  tier VARCHAR(50) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL,
  start_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date TIMESTAMP NULL,
  price_id TEXT NOT NULL,
  price_amount NUMERIC(10,2) NOT NULL,
  metadata TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ban_appeals (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  reason TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  admin_response TEXT NULL,
  admin_id INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS support_tickets (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  subject TEXT NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'open',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ticket_messages (
  id SERIAL PRIMARY KEY,
  ticket_id INT NOT NULL,
  user_id INT NOT NULL,
  message TEXT NOT NULL,
  is_admin BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (ticket_id) REFERENCES support_tickets(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(255) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  is_used BOOLEAN NOT NULL DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_user_id ON coin_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_coin_transactions_admin_id ON coin_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_login_rewards_user_id ON login_rewards(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_user_id ON ban_appeals(user_id);
CREATE INDEX IF NOT EXISTS idx_ban_appeals_admin_id ON ban_appeals(admin_id);
CREATE INDEX IF NOT EXISTS idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_ticket_id ON ticket_messages(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_messages_user_id ON ticket_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
