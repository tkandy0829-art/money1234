export type NPCType = 'KIND' | 'NORMAL' | 'DRUNK' | 'RUDE' | 'JAMMIN';

export interface Item {
  id: string;
  name: string;
  price: number;
  description: string;
  category: 'ELECTRONICS' | 'FURNITURE' | 'CLOTHING' | 'FOOD' | 'BOOKS' | 'ART' | 'CAR' | 'REAL_ESTATE' | 'OTHER';
  condition: 'NEW' | 'LIKE_NEW' | 'USED' | 'HEAVILY_USED';
  isDecayed: boolean;
  createdAt: number;
  sellerId: string;
  isSoldOut: boolean;
}

export interface NPC {
  id: string;
  name: string;
  type: NPCType;
  avatar: string;
}

export interface Stock {
  id: string;
  name: string;
  price: number;
  prevPrice: number;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  history: number[];
}

export interface Message {
  id: string;
  senderId: string;
  text: string;
  timestamp: number;
}

export interface GameState {
  balance: number;
  inventory: Item[];
  stocks: Stock[];
  heldStocks: { [stockId: string]: number };
  location: string;
  currentTime: number; // in turns or virtual days
  messages: Message[];
  activeChatNPC: NPC | null;
  activeItem: Item | null;
  proposedPrice: number;
  tradeType: 'BUY' | 'SELL' | null;
  selectedStockId: string | null;
  items: Item[]; // Marketplace items
  priceTier: 'CHEAP' | 'NORMAL' | 'EXPENSIVE' | 'AWESOME' | 'RICH' | 'LEGENDARY';
  categoryFilter: 'ALL' | 'FOOD' | 'OBJECT' | 'ART' | 'CLOTHING';
}

export interface ChatResponse {
  message: string;
  newProposedPrice: number;
  isAgreement: boolean;
}
