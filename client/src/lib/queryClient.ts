import { QueryClient, QueryFunction } from "@tanstack/react-query";
import {
  CoinPackage,
  Transaction,
  User as SelectUser,
  Card,
  BlackjackState,
  BlackjackHand,
} from "@shared/schema";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL?.toString().trim() || "";

const buildApiUrl = (url: string) => {
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  const normalizedUrl = url.startsWith("/") ? url : `/${url}`;
  if (!API_BASE_URL) {
    return normalizedUrl;
  }

  return `${API_BASE_URL.replace(/\/+$/, "")}${normalizedUrl}`;
};

const getAuthToken = (): string | null => {
  const token = localStorage.getItem('auth_token');
  return token;
};

const isAuthenticated = (): boolean => {
  return !!getAuthToken();
};

const getCardValue = (card: Card): number => {
  if (card.value === 'A') return 11;
  if (['K', 'Q', 'J'].includes(card.value)) return 10;
  return Number(card.value);
};

const calculateHandValue = (cards: Card[]) => {
  let total = 0;
  let aces = 0;
  for (const card of cards) {
    total += getCardValue(card);
    if (card.value === 'A') aces += 1;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces -= 1;
  }
  return total;
};

const revealCards = (hand: BlackjackHand): BlackjackHand => ({
  ...hand,
  cards: hand.cards.map((card) => ({ ...card, hidden: false })),
});

const getPlayerResult = (playerHand: BlackjackHand, dealerHand: BlackjackHand, betAmount: number) => {
  const playerValue = calculateHandValue(playerHand.cards);
  const dealerValue = calculateHandValue(dealerHand.cards);
  const isPlayerBust = playerValue > 21;
  const isDealerBust = dealerValue > 21;

  if (isPlayerBust) {
    return { result: 'lose', payout: 0 };
  }
  if (isDealerBust) {
    return { result: 'win', payout: betAmount * 2 };
  }
  if (playerValue > dealerValue) {
    return { result: 'win', payout: betAmount * 2 };
  }
  if (playerValue < dealerValue) {
    return { result: 'lose', payout: 0 };
  }
  return { result: 'push', payout: betAmount };
};

const BUCKET_COUNT = 11;
const ROWS = 10;

const MULTIPLIERS: Record<'low' | 'medium' | 'high', number[]> = {
  low: [2.0, 1.5, 1.2, 1.1, 0.9, 0.8, 0.9, 1.1, 1.2, 1.5, 2.0],
  medium: [4.0, 2.5, 1.5, 1.0, 0.5, 0.2, 0.5, 1.0, 1.5, 2.5, 4.0],
  high: [18.0, 8.0, 4.0, 1.5, 0.3, 0.1, 0.3, 1.5, 4.0, 8.0, 18.0],
};

export const setAuthToken = (token: string): void => {
  localStorage.setItem('auth_token', token);
};

export const removeAuthToken = (): void => {
  localStorage.removeItem('auth_token');
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const headers: HeadersInit = {
    "Cache-Control": "no-cache",
    "Pragma": "no-cache",
  };

  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const token = getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(buildApiUrl(url), {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
  });

  if (res.status === 401) {
    removeAuthToken();
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: HeadersInit = {
      "Cache-Control": "no-cache",
      "Pragma": "no-cache"
    };

    const token = getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    const res = await fetch(buildApiUrl(queryKey[0] as string), {
      headers
    });

    if (res.status === 401) {
      removeAuthToken();
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      throw new Error("Unauthorized");
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
