import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MessageCircle, 
  TrendingUp, 
  User, 
  Settings, 
  ArrowLeft, 
  Send,
  MapPin,
  TrendingDown,
  ShoppingBag,
  PlusCircle,
  X,
  Shield,
  ShieldCheck
} from 'lucide-react';
import { 
  Item, 
  NPC, 
  Stock, 
  Message, 
  GameState, 
  NPCType, 
  ChatResponse 
} from './types';
import { INITIAL_STOCKS, NPC_SAMPLES, LOCATIONS } from './constants';
import { 
  generateNPCMessage, 
  generateInitialItems, 
  fetchSoldOutItems, 
  markItemAsSoldInFirestore 
} from './services/aiService';
import { 
  checkIdExists, 
  registerUser, 
  loginUser, 
  getAllUsers, 
  updateUserBalanceInFirestore 
} from './lib/userService';
import { updateStockPrices } from './services/marketEngine';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    balance: 10000,
    inventory: [],
    stocks: INITIAL_STOCKS,
    heldStocks: {},
    location: LOCATIONS[0],
    currentTime: 0,
    messages: [],
    activeChatNPC: null,
    activeItem: null,
    proposedPrice: 0,
    tradeType: null,
    selectedStockId: null,
    items: [],
    priceTier: 'NORMAL',
    categoryFilter: 'ALL',
  });

  const [activeScreen, setActiveScreen] = useState<'market' | 'chat' | 'stock' | 'inventory'>('market');
  const [currentUser, setCurrentUser] = useState<{ id: string; balance: number } | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authId, setAuthId] = useState('');
  const [authPw, setAuthPw] = useState('');
  const [authError, setAuthError] = useState('');
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibleCount, setVisibleCount] = useState(30);

  // Handle scroll for infinite loading
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const target = e.currentTarget;
    if (target.scrollHeight - target.scrollTop <= target.clientHeight + 100) {
      setVisibleCount(prev => prev + 30);
    }
  };

  useEffect(() => {
    // Reset visible count when filters change
    setVisibleCount(30);
  }, [gameState.priceTier, gameState.categoryFilter, searchQuery]);
  const [inputText, setInputText] = useState('');
  const [showAdmin, setShowAdmin] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Initialize items from Firestore
  useEffect(() => {
    const initItems = async () => {
      try {
        const soldIds = await fetchSoldOutItems();
        const items = generateInitialItems(soldIds);
        setGameState(prev => ({ ...prev, items }));
      } catch (error) {
        console.error("Failed to fetch shared items:", error);
        // Fallback to local if firebase fails
        const items = generateInitialItems();
        setGameState(prev => ({ ...prev, items }));
      }
    };
    initItems();

    // Set up periodic sync for sold items from other users
    const interval = setInterval(async () => {
      const soldIds = await fetchSoldOutItems();
      setGameState(prev => ({
        ...prev,
        items: prev.items.map(it => ({ ...it, isSoldOut: soldIds.includes(it.id) }))
      }));
    }, 15000); // Sync every 15 seconds

    return () => clearInterval(interval);
  }, []);

  // Stock update Every 5 Minutes (Real API)
  const fetchStocks = async () => {
    try {
      const response = await fetch('/api/stocks');
      if (response.ok) {
        const data = await response.json();
        if (data.length > 0) {
          setGameState(prev => ({
            ...prev,
            stocks: data
          }));
        }
      }
    } catch (error) {
      console.error("Failed to fetch stocks:", error);
    }
  };

  useEffect(() => {
    fetchStocks();
    const interval = setInterval(fetchStocks, 5 * 60 * 1000); // 5 minutes
    return () => clearInterval(interval);
  }, []);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [gameState.messages]);

  // Handle Turn Change (e.g. searching or chatting)
  // Handle Turn Change (e.g. searching or chatting)
  const handleAuth = async () => {
    setAuthError('');
    if (!authId || !authPw) {
      setAuthError('ID와 비밀번호를 입력해주세요.');
      return;
    }

    if (authMode === 'signup') {
      const exists = await checkIdExists(authId);
      if (exists) {
        setAuthError('중복된 아이디입니다.');
        return;
      }
      await registerUser({ id: authId, password: authPw, balance: 10000 });
      alert('회원가입이 완료되었습니다! 로그인해주세요.');
      setAuthMode('login');
      setAuthPw('');
    } else {
      const user = await loginUser(authId, authPw);
      if (user) {
        setCurrentUser({ id: user.id, balance: user.balance });
        setGameState(prev => ({ ...prev, balance: user.balance }));
        if (user.id === 'master' && authPw === 'master131107') {
          setIsAdmin(true);
        }
      } else {
        setAuthError('아이디 또는 비밀번호가 일치하지 않습니다.');
      }
    }
  };

  const handleAdminRefresh = async () => {
    const users = await getAllUsers();
    setAllUsers(users);
  };

  const handleUpdateUserBalance = async (uid: string, amount: string) => {
    const newBal = parseInt(amount);
    if (isNaN(newBal)) return;
    await updateUserBalanceInFirestore(uid, newBal);
    handleAdminRefresh();
    if (currentUser?.id === uid) {
      setGameState(prev => ({ ...prev, balance: newBal }));
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    setIsAdmin(false);
    setAuthId('');
    setAuthPw('');
  };

  if (!currentUser) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="card w-full max-w-md p-6 bg-white shadow-xl">
          <div className="text-center mb-8">
            <div className="text-3xl font-black text-brand mb-2">🥕 중고마켓 통합본</div>
            <div className="text-gray-500 font-medium tracking-tight">전세계 모든 유저와 함께하는 시장</div>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">아이디</label>
              <input 
                type="text" 
                value={authId}
                onChange={(e) => {
                  setAuthId(e.target.value);
                  setAuthError('');
                }}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 border-none focus:ring-2 focus:ring-brand"
                placeholder="아이디를 입력하세요"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">비밀번호</label>
              <input 
                type="password" 
                value={authPw}
                onChange={(e) => setAuthPw(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-gray-100 border-none focus:ring-2 focus:ring-brand"
                placeholder="비밀번호를 입력하세요"
              />
            </div>
            
            {authError && (
              <div className="text-red-600 text-sm font-bold py-2">
                ⚠️ {authError}
              </div>
            )}

            <button 
              onClick={handleAuth}
              className="w-full py-4 bg-brand text-white font-black rounded-xl shadow-lg shadow-brand/20 active:scale-95 transition-all text-lg"
            >
              {authMode === 'login' ? '로그인' : '회원가입'}
            </button>

            <button 
              onClick={() => {
                setAuthMode(authMode === 'login' ? 'signup' : 'login');
                setAuthError('');
              }}
              className="w-full py-2 text-gray-400 text-sm font-bold hover:text-brand transition-colors"
            >
              {authMode === 'login' ? '아직 계정이 없으신가요? 회원가입' : '이미 계정이 있으신가요? 로그인'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nextTurn = (timeAdd = 5) => { // Adding 5 virtual days on time skip
    setGameState(prev => {
      const newTime = prev.currentTime + timeAdd;
      
      // Decay system for food: if category is FOOD and 5 days (turns) passed, value drops
      const activeItemsWithDecay = prev.items
        .filter(it => !it.isSoldOut)
        .map(item => {
          if (item.category === 'FOOD' && !item.isDecayed && (newTime - Math.floor(item.createdAt/1000/60)) >= 5) {
            return { ...item, isDecayed: true, price: Math.floor(item.price * 0.5) };
          }
          return item;
        });

      // Maintain 1000 items: generate new ones to reach 1000
      const itemsToGenerate = 1000 - activeItemsWithDecay.length;
      let finalItems = [...activeItemsWithDecay];
      
      if (itemsToGenerate > 0) {
        const fullNewSet = generateInitialItems();
        // Ensure new IDs are unique if necessary, but generateInitialItems uses item_i
        // To avoid conflicts, we'll prefix them with current timestamp
        const timestamp = Date.now();
        const brandNewItems = fullNewSet.slice(0, itemsToGenerate).map((it, idx) => ({
          ...it,
          id: `item_${timestamp}_${idx}`
        }));
        finalItems = [...activeItemsWithDecay, ...brandNewItems];
      }

      return {
        ...prev,
        currentTime: newTime,
        items: finalItems
      };
    });
  };

  const buyItem = async (item: Item) => {
    if (gameState.balance < item.price) {
      alert("잔액이 부족하여 아이템을 구매할 수 없습니다.");
      return;
    }

    try {
      await markItemAsSoldInFirestore(item.id);
      setGameState(prev => ({
        ...prev,
        balance: prev.balance - item.price,
        inventory: [...prev.inventory, { ...item, isSoldOut: true }],
        items: prev.items.map(it => it.id === item.id ? { ...it, isSoldOut: true } : it)
      }));
      alert(`${item.name}을(를) 구매했습니다! (전세계 유저와 공유됨)`);
      setActiveScreen('inventory');
    } catch (error) {
      alert("구매 중 오류가 발생했습니다. 다시 시도해주세요.");
    }
  };

  const startChat = (npc: NPC) => {
    setGameState(prev => ({ ...prev, activeChatNPC: npc }));
    setActiveScreen('chat');
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !gameState.activeChatNPC) return;

    const userText = inputText.trim();
    const userMsg: Message = {
      id: Date.now().toString(),
      senderId: 'player',
      text: userText,
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      messages: [...prev.messages, userMsg]
    }));
    setInputText('');

    // Explicit agreement check for the specific phrase "네 알겠습니다"
    const explicitAgreement = userText.replace(/\s/g, '').includes('네알겠습니다');
    
    if (explicitAgreement) {
      setIsTyping(false);
      const totalCost = gameState.proposedPrice;
      if (gameState.tradeType === 'BUY') {
        if (gameState.balance >= totalCost) {
          try {
            await markItemAsSoldInFirestore(gameState.activeItem!.id);
            setGameState(prev => ({
              ...prev,
              balance: prev.balance - totalCost,
              inventory: [...prev.inventory, { ...prev.activeItem!, isSoldOut: true }],
              items: prev.items.map(it => it.id === prev.activeItem!.id ? { ...it, isSoldOut: true } : it),
              messages: [...prev.messages, {
                id: (Date.now() + 10).toString(),
                senderId: 'system',
                text: `🎉 거래가 완료되었습니다! (₩${totalCost.toLocaleString()} 결제 완료)`,
                timestamp: Date.now()
              }],
              activeItem: null,
              proposedPrice: 0,
              tradeType: null,
              activeChatNPC: null
            }));
            setTimeout(() => setActiveScreen('market'), 1500);
            return;
          } catch (error) {
            alert("거래 처리 중 오류가 발생했습니다.");
          }
        } else {
          alert("잔액이 부족하여 거래를 완료할 수 없습니다.");
        }
      } else if (gameState.tradeType === 'SELL') {
        setGameState(prev => ({
          ...prev,
          balance: prev.balance + totalCost,
          inventory: prev.inventory.filter(it => it.id !== prev.activeItem!.id),
          messages: [...prev.messages, {
            id: (Date.now() + 10).toString(),
            senderId: 'system',
            text: `💰 판매가 완료되었습니다! (₩${totalCost.toLocaleString()} 입금 완료)`,
            timestamp: Date.now()
          }],
          activeItem: null,
          proposedPrice: 0,
          tradeType: null,
          activeChatNPC: null
        }));
        setTimeout(() => setActiveScreen('inventory'), 1500);
        return;
      }
      return;
    }

    // AI Response
    setIsTyping(true);
    const context = `User is ${gameState.tradeType === 'BUY' ? 'buying' : 'selling'} '${gameState.activeItem?.name}' to ${gameState.activeChatNPC.name} (${gameState.activeChatNPC.type}). Current location: ${gameState.location}. Role: ${gameState.tradeType}.`;
    
    const aiResponse = await generateNPCMessage(
      gameState.activeChatNPC.type, 
      userText, 
      context, 
      gameState.proposedPrice, 
      gameState.activeItem?.price || 0,
      gameState.tradeType || 'BUY'
    );
    
    setIsTyping(false);

    const npcMsg: Message = {
      id: (Date.now() + 1).toString(),
      senderId: gameState.activeChatNPC.id,
      text: aiResponse.message,
      timestamp: Date.now()
    };

    setGameState(prev => ({
      ...prev,
      proposedPrice: aiResponse.newProposedPrice,
      messages: [...prev.messages, npcMsg]
    }));
  };

  const handleBuyStock = (stockId: string, amount: number) => {
    const stock = gameState.stocks.find(s => s.id === stockId);
    if (!stock) return;
    const cost = stock.price * amount;
    if (gameState.balance >= cost) {
      setGameState(prev => ({
        ...prev,
        balance: prev.balance - cost,
        heldStocks: {
          ...prev.heldStocks,
          [stockId]: (prev.heldStocks[stockId] || 0) + amount
        }
      }));
    } else {
      alert("잔액이 부족합니다.");
    }
  };

  const handleSellStock = (stockId: string, amount: number) => {
    const stock = gameState.stocks.find(s => s.id === stockId);
    const held = gameState.heldStocks[stockId] || 0;
    if (!stock || held < amount) return;
    
    const revenue = stock.price * amount;
    setGameState(prev => ({
      ...prev,
      balance: prev.balance + revenue,
      heldStocks: {
        ...prev.heldStocks,
        [stockId]: held - amount
      }
    }));
  };

  const handleDirectTrade = (item: Item) => {
    if (item.isSoldOut) return;

    // Randomize NPC persona based on probabilities
    const rand = Math.random() * 100;
    let type: NPCType = 'NORMAL';
    if (rand < 1) type = 'JAMMIN';
    else if (rand < 5) type = 'RUDE';
    else if (rand < 10) type = 'KIND';
    else if (rand < 20) type = 'DRUNK';
    else type = 'NORMAL';

    const npcTemplate = NPC_SAMPLES.find(n => n.type === type) || NPC_SAMPLES[0];
    const npc = { ...npcTemplate, id: `npc_${Date.now()}` };
    
    const targetPrice = item.price;
    const initialProposedPrice = targetPrice; 

    setGameState(prev => ({
      ...prev,
      activeChatNPC: { ...npc, type },
      activeItem: item,
      proposedPrice: initialProposedPrice,
      tradeType: 'BUY',
      location: item.description.includes("서울") ? "서울" : LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)],
      messages: [
        {
          id: 'welcome',
          senderId: npc.id,
          text: `안녕하세요! '${item.name}' 말씀하시는거죠? ₩${item.price.toLocaleString()}에 드릴게요. 괜찮으시면 '살게요' 혹은 '네고' 말씀해주세요!`,
          timestamp: Date.now()
        }
      ]
    }));
    setActiveScreen('chat');
  };

  const handleStartSellChat = (item: Item) => {
    const rand = Math.random() * 100;
    let type: NPCType = 'NORMAL';
    if (rand < 1) type = 'JAMMIN';
    else if (rand < 5) type = 'RUDE';
    else if (rand < 10) type = 'KIND';
    else if (rand < 20) type = 'DRUNK';
    else type = 'NORMAL';

    const npcTemplate = NPC_SAMPLES.find(n => n.type === type) || NPC_SAMPLES[0];
    const npc = { ...npcTemplate, id: `npc_${Date.now()}` };

    // Typically buyers offer slightly less than the item's original price
    const buyerOffer = Math.floor((item.price * (0.6 + Math.random() * 0.3)) / 100) * 100;

    setGameState(prev => ({
      ...prev,
      activeChatNPC: { ...npc, type },
      activeItem: item,
      proposedPrice: buyerOffer,
      tradeType: 'SELL',
      messages: [
        {
          id: 'welcome-sell',
          senderId: npc.id,
          text: `안녕하세요~ '${item.name}' 팔고 계신 거 보고 연락드렸어요! 제가 ₩${buyerOffer.toLocaleString()} 정도면 바로 살 수 있을 것 같은데 어떠신가요? 괜찮으시면 '네 알겠습니다' 해주세요!`,
          timestamp: Date.now()
        }
      ]
    }));
    setActiveScreen('chat');
  };

  const handleGiveUp = () => {
    if (!gameState.activeItem) return;

    if (gameState.tradeType === 'BUY') {
      setActiveScreen('market');
    } else {
      setActiveScreen('inventory');
    }

    setGameState(prev => ({
      ...prev,
      activeItem: null,
      proposedPrice: 0,
      tradeType: null,
      activeChatNPC: null
    }));
  };

  // Admin Actions
  const adminAddMoney = (val: number) => {
    setGameState(prev => ({ ...prev, balance: prev.balance + val }));
  };

  const adminTimeSkip = () => {
    setGameState(prev => ({ ...prev, currentTime: prev.currentTime + 5 }));
    nextTurn(5);
  };

  // Rendering
  return (
    <div className="min-h-screen bg-gray-50 text-[#1a1a1b] font-sans selection:bg-brand/20">
      {/* Admin Panel Overlay */}
      {isAdmin && isAdminPanelOpen && (
        <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm p-4 md:p-10 flex items-center justify-center">
          <div className="bg-white w-full max-w-4xl h-[80vh] rounded-3xl overflow-hidden shadow-2xl flex flex-col">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h2 className="text-xl font-black flex items-center gap-2">
                <Shield className="w-6 h-6 text-red-600" /> 관리자 마스터 패널
              </h2>
              <button onClick={() => setIsAdminPanelOpen(false)} className="p-2 hover:bg-gray-200 rounded-full">
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b-2 border-gray-100">
                    <th className="py-3 px-4 font-bold text-gray-400 text-[10px] uppercase">User ID</th>
                    <th className="py-3 px-4 font-bold text-gray-400 text-[10px] uppercase">Password</th>
                    <th className="py-3 px-4 font-bold text-gray-400 text-[10px] uppercase">Balance Override</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(user => (
                    <tr key={user.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-3 px-4 font-bold text-sm">
                        {user.id} {user.id === 'master' && '👑'}
                      </td>
                      <td className="py-3 px-4 text-gray-500 font-mono text-[12px]">{user.password}</td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <input 
                            type="number" 
                            defaultValue={user.balance}
                            onBlur={(e) => handleUpdateUserBalance(user.id, e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleUpdateUserBalance(user.id, (e.target as any).value)}
                            className="w-32 px-3 py-1.5 bg-gray-100 rounded-lg text-sm font-bold border-2 border-transparent focus:border-red-400 focus:outline-none transition-all"
                          />
                          <span className="text-xs text-gray-400 font-bold">₩</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Admin Quick Bar */}
      {isAdmin && (
        <div className="bg-red-600 text-white p-2">
          <div className="max-w-4xl mx-auto flex justify-between items-center px-4 text-center">
            <span className="font-bold text-[10px] uppercase tracking-widest flex items-center justify-center gap-1">
               <ShieldCheck className="w-3 h-3" /> Master Logged In
            </span>
            <button 
              onClick={() => {
                setIsAdminPanelOpen(!isAdminPanelOpen);
                if (!isAdminPanelOpen) handleAdminRefresh();
              }}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-[10px] font-bold"
            >
              {isAdminPanelOpen ? 'EXIT PANEL' : 'OPEN MASTER PANEL'}
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-center min-h-[calc(100vh-40px)] p-4">
        <div className="phone-frame w-[1140px] h-[720px] max-w-full">
        {/* Status Bar */}
        <div className="h-6 bg-white flex justify-end items-center px-6 gap-1.5 text-[12px] font-semibold">
          <span>9:41</span>
          <span>📶</span>
          <span>🔋 88%</span>
        </div>

        {/* Header */}
        <header className="bg-white border-b border-gray-100 p-4 flex items-center justify-between sticky top-0 z-20">
          <h1 className="text-[18px] font-extrabold text-brand" id="app-title">
            📱 My Market App
          </h1>
          <div className="flex items-center gap-3 text-gray-400">
            <Search className="w-4 h-4 cursor-pointer" />
            <button onClick={() => setShowAdmin(!showAdmin)} className="hover:text-gray-600 transition-colors">
              <Settings className="w-4 h-4" />
            </button>
            <button 
              onClick={handleLogout}
              className="px-2 py-1 bg-gray-100 hover:bg-gray-200 text-gray-500 rounded text-[10px] font-bold transition-all"
              title="로그아웃"
            >
              로그아웃
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto bg-bg-gray p-3">
          <AnimatePresence mode="wait">
            {activeScreen === 'market' && (
              <motion.div 
                key="market"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col h-full"
              >
                {/* Balance Card */}
                <div className="card !bg-gradient-to-br from-brand to-[#ff6b00] text-white p-4">
                   <div className="text-[12px] opacity-80">내 자산</div>
                   <div className="text-[24px] font-extrabold">₩ {gameState.balance.toLocaleString()}</div>
                   <div className="text-[10px] mt-1 opacity-90">📍 {gameState.location} • 총 1,150,000개의 공유 매물 대기 중</div>
                </div>

                {/* Price Tier Selection */}
                <div className="flex gap-1 mb-3 overflow-x-auto no-scrollbar pb-1">
                  {(['CHEAP', 'NORMAL', 'EXPENSIVE', 'AWESOME', 'RICH', 'LEGENDARY'] as const).map(tier => (
                    <button
                      key={tier}
                      onClick={() => setGameState(prev => ({ ...prev, priceTier: tier }))}
                      className={`px-3 py-2 rounded-lg text-[11px] font-bold transition-all whitespace-nowrap ${
                        gameState.priceTier === tier 
                        ? 'bg-brand text-white shadow-md' 
                        : 'bg-white text-gray-500 border border-gray-100'
                      }`}
                    >
                      {tier === 'CHEAP' ? '싼 매물' : 
                       tier === 'NORMAL' ? '일반 매물' : 
                       tier === 'EXPENSIVE' ? '비싼 매물' : 
                       tier === 'AWESOME' ? '엄청난 매물' : 
                       tier === 'RICH' ? '부자 매물' : '역대급 매물'}
                    </button>
                  ))}
                </div>

                {/* Category Selection */}
                <div className="flex gap-1 mb-4 overflow-x-auto no-scrollbar">
                  {(['ALL', 'FOOD', 'ART', 'CLOTHING', 'OBJECT'] as const).map(cat => (
                    <button
                      key={cat}
                      onClick={() => setGameState(prev => ({ ...prev, categoryFilter: cat }))}
                      className={`px-4 py-1.5 rounded-full text-[11px] font-bold transition-all whitespace-nowrap ${
                        gameState.categoryFilter === cat 
                        ? 'bg-text-dark text-white' 
                        : 'bg-gray-100 text-gray-400'
                      }`}
                    >
                      {cat === 'ALL' ? '전체' : cat === 'FOOD' ? '음식' : cat === 'ART' ? '작품' : cat === 'CLOTHING' ? '옷' : '사물'}
                    </button>
                  ))}
                </div>

                <div className="section-label">
                  {gameState.priceTier === 'CHEAP' ? '💰 5,000원 이하' : 
                   gameState.priceTier === 'NORMAL' ? '🏷️ 5,001원 ~ 100만원' : 
                   gameState.priceTier === 'EXPENSIVE' ? '💎 100만 ~ 1,000만원' : 
                   gameState.priceTier === 'AWESOME' ? '🔥 1,000만 ~ 1억' : 
                   gameState.priceTier === 'RICH' ? '👑 1억 ~ 10억' : '🪐 10억 이상'}
                </div>
                
                <div className="grid grid-cols-1 gap-2 flex-1 overflow-y-auto pb-4 no-scrollbar" onScroll={handleScroll}>
                  {gameState.items
                    .filter(it => {
                      // Price Tier Filter
                      const p = it.price;
                      if (gameState.priceTier === 'CHEAP') return p <= 5000;
                      if (gameState.priceTier === 'NORMAL') return p > 5000 && p <= 1000000;
                      if (gameState.priceTier === 'EXPENSIVE') return p > 1000000 && p <= 10000000;
                      if (gameState.priceTier === 'AWESOME') return p > 10000000 && p <= 100000000;
                      if (gameState.priceTier === 'RICH') return p > 100000000 && p <= 1000000000;
                      if (gameState.priceTier === 'LEGENDARY') return p > 1000000000;
                      return true;
                    })
                    .filter(it => {
                      // Category Filter
                      if (gameState.categoryFilter === 'FOOD') return it.category === 'FOOD';
                      if (gameState.categoryFilter === 'ART') return it.category === 'ART';
                      if (gameState.categoryFilter === 'CLOTHING') return it.category === 'CLOTHING';
                      if (gameState.categoryFilter === 'OBJECT') return !['FOOD', 'ART', 'CLOTHING'].includes(it.category);
                      return true;
                    })
                    .filter(it => it.name.includes(searchQuery))
                    .sort((a, b) => b.createdAt - a.createdAt) // Show newest first
                    .slice(0, visibleCount) 
                    .map(item => (
                      <div key={item.id} className="card flex gap-3 p-2 cursor-pointer active:scale-95 transition-transform" onClick={() => handleDirectTrade(item)}>
                      <div className="w-16 h-16 bg-gray-50 rounded-lg flex items-center justify-center text-2xl shrink-0">
                        {item.category === 'ELECTRONICS' ? '💻' : 
                         item.category === 'FOOD' ? '🍕' : 
                         item.category === 'CLOTHING' ? '👕' : 
                         item.category === 'ART' ? '🖼️' : 
                         item.category === 'FURNITURE' ? '🪑' : 
                         item.category === 'CAR' ? '🚗' : 
                         item.category === 'REAL_ESTATE' ? '🏠' : '📦'}
                      </div>
                      <div className="flex-1 flex flex-col justify-between overflow-hidden">
                        <div>
                          <h3 className="font-bold text-[13px] text-text-dark truncate">{item.name}</h3>
                          <p className="text-[11px] text-gray-500">{item.condition}</p>
                        </div>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[14px] font-bold text-text-dark">₩{item.price.toLocaleString()}</span>
                          <div className="flex gap-1">
                            <button 
                              onClick={() => handleDirectTrade(item)}
                              disabled={item.isSoldOut}
                              className="text-[10px] bg-brand text-white px-2 py-1 rounded-md font-bold disabled:bg-gray-200"
                            >
                              채팅
                            </button>
                            <button 
                              onClick={() => buyItem(item)}
                              disabled={item.isSoldOut}
                              className="text-[10px] bg-text-dark text-white px-2 py-1 rounded-md font-bold disabled:bg-gray-200"
                            >
                              구매
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeScreen === 'chat' && gameState.activeChatNPC && (
              <motion.div 
                key="chat"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex flex-col h-full"
              >
                <div className="bg-white p-3 border-b border-gray-100 flex items-center gap-3">
                  <button onClick={handleGiveUp}>
                    <ArrowLeft className="w-4 h-4 text-gray-600" />
                  </button>
                  <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center text-xl">
                    {gameState.activeChatNPC.avatar}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-[12px]">{gameState.activeChatNPC.name}</h2>
                    <p className="text-[10px] text-gray-400">{gameState.activeChatNPC.type} · {gameState.location}</p>
                  </div>
                  {gameState.activeItem && (
                    <div className="text-right">
                       <p className="text-[9px] text-gray-400">현재 제안가</p>
                       <p className="text-[12px] font-extrabold text-brand">₩ {gameState.proposedPrice.toLocaleString()}</p>
                    </div>
                  )}
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-3 flex flex-col min-h-0 bg-white">
                  {gameState.messages.map(msg => (
                    <div 
                      key={msg.id} 
                      className={msg.senderId === 'player' ? 'messenger-bubble-user' : msg.senderId === 'system' ? 'self-center bg-gray-200 text-gray-600 text-[10px] px-3 py-1 rounded-full' : 'messenger-bubble-npc'}
                    >
                      {msg.text}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="messenger-bubble-npc animate-pulse">...</div>
                  )}
                  <div ref={chatEndRef} />
                </div>

                <div className="p-2 bg-white border-t border-gray-100 flex gap-2">
                  <button 
                    onClick={handleGiveUp}
                    className="px-3 py-2 bg-red-100 text-red-500 rounded-full text-[12px] font-bold shrink-0"
                  >
                    포기하기
                  </button>
                  <input 
                    type="text" 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="메시지 보내기"
                    className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-[13px] outline-none"
                  />
                  <button 
                    onClick={handleSendMessage}
                    className="bg-brand text-white p-2 rounded-full disabled:opacity-50"
                    disabled={!inputText.trim()}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            )}

            {activeScreen === 'stock' && (
              <motion.div 
                key="stock"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="space-y-4 h-full flex flex-col"
              >
                <div className="section-label">📈 실시간 증시 (실제 API)</div>
                <div className="grid grid-cols-3 gap-2">
                  {gameState.stocks.map(stock => {
                    const isUp = stock.price >= stock.prevPrice;
                    const krName = stock.name === "KOSPI" ? "코스피" : 
                                   stock.name === "Samsung Electronics Co., Ltd." ? "삼성전자" :
                                   stock.name === "SK hynix Inc." ? "SK하이닉스" :
                                   stock.name === "Hyundai Motor Company" ? "현대차" :
                                   stock.name === "NAVER Corp." ? "네이버" :
                                   stock.name === "POSCO Holdings Inc." ? "포스코" : stock.name;
                    return (
                      <div 
                        key={stock.id} 
                        className={`stock-item cursor-pointer transition-all ${gameState.selectedStockId === stock.id ? 'ring-2 ring-brand ring-offset-2' : ''}`}
                        onClick={() => setGameState(prev => ({ ...prev, selectedStockId: stock.id }))}
                      >
                        <div className="text-[10px] font-bold text-gray-500 mb-1 truncate">{krName}</div>
                        <div className={`text-[12px] font-extrabold ${isUp ? 'text-status-up' : 'text-status-down'}`}>
                          {isUp ? '▲' : '▼'}{Math.abs(((stock.price - stock.prevPrice)/stock.prevPrice*100)).toFixed(1)}%
                        </div>
                      </div>
                    );
                  })}
                </div>

                {gameState.selectedStockId && (
                  <div className="card !p-2 bg-white flex-1 min-h-[250px]">
                    <h3 className="text-[12px] font-bold mb-2">
                       {(() => {
                         const s = gameState.stocks.find(s => s.id === gameState.selectedStockId);
                         if (!s) return "";
                         return (s.name === "KOSPI" ? "코스피" : 
                                 s.name === "Samsung Electronics Co., Ltd." ? "삼성전자" :
                                 s.name === "SK hynix Inc." ? "SK하이닉스" :
                                 s.name === "Hyundai Motor Company" ? "현대차" :
                                 s.name === "NAVER Corp." ? "네이버" :
                                 s.name === "POSCO Holdings Inc." ? "포스코" : s.name) + " 주가 추이";
                       })()}
                    </h3>
                    <div className="h-[200px] w-full pr-4 pb-2">
                       <ResponsiveContainer width="100%" height="100%">
                         <LineChart 
                           data={gameState.stocks.find(s => s.id === gameState.selectedStockId)?.history.map((val, i) => ({ time: i, price: val })) || []}
                           margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                         >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="time" hide />
                          <YAxis 
                            domain={['auto', 'auto']} 
                            tick={{ fontSize: 10 }}
                            width={40}
                          />
                          <Tooltip 
                            contentStyle={{ fontSize: '10px', borderRadius: '8px' }}
                            formatter={(value: number) => `₩${value.toLocaleString()}`}
                          />
                          <Line 
                            type="monotone" 
                            dataKey="price" 
                            stroke="#ff914d" 
                            strokeWidth={2} 
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        </LineChart>
                       </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="space-y-2 pb-4">
                  {gameState.stocks.map(stock => {
                    const krName = stock.name === "KOSPI" ? "코스피" : 
                                   stock.name === "Samsung Electronics Co., Ltd." ? "삼성전자" :
                                   stock.name === "SK hynix Inc." ? "SK하이닉스" :
                                   stock.name === "Hyundai Motor Company" ? "현대차" :
                                   stock.name === "NAVER Corp." ? "네이버" :
                                   stock.name === "POSCO Holdings Inc." ? "포스코" : stock.name;
                    return (
                      <div key={stock.id} className="card !mb-0">
                        <div className="flex justify-between items-center mb-3">
                          <div>
                            <div className="font-bold text-[14px]">{krName}</div>
                            <div className="text-[11px] text-gray-400">보유: {gameState.heldStocks[stock.id] || 0}주</div>
                          </div>
                          <div className="text-right">
                            <div className="font-extrabold text-[16px]">₩ {stock.price.toLocaleString()}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={() => handleBuyStock(stock.id, 1)}
                            className="flex-1 bg-status-up/10 text-status-up text-[11px] font-bold py-2 rounded-lg"
                          >
                            매수
                          </button>
                          <button 
                            onClick={() => handleSellStock(stock.id, 1)}
                            className="flex-1 bg-status-down/10 text-status-down text-[11px] font-bold py-2 rounded-lg"
                            disabled={(gameState.heldStocks[stock.id] || 0) <= 0}
                          >
                            매도
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {activeScreen === 'inventory' && (
              <motion.div 
                key="inventory"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-full"
              >
                <div className="section-label">👤 내 보관함</div>
                {gameState.inventory.length === 0 ? (
                  <div className="text-center py-20 text-gray-300">
                    <ShoppingBag className="w-12 h-12 mx-auto mb-2 opacity-20" />
                    <p className="text-[13px]">텅 비었어요</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {gameState.inventory.map(item => (
                      <div key={item.id} className="card flex flex-col h-full">
                        <div className="aspect-square bg-gray-50 rounded-lg flex items-center justify-center text-3xl mb-1">
                          {item.category === 'ELECTRONICS' ? '💻' : '📦'}
                        </div>
                        <h3 className="font-bold text-[11px] truncate">{item.name}</h3>
                        <p className="text-[10px] text-brand font-bold mb-2">₩ {item.price.toLocaleString()}</p>
                        <button 
                          onClick={() => handleStartSellChat(item)}
                          className="mt-auto bg-brand text-white text-[10px] font-bold py-1 rounded-md hover:bg-orange-600"
                        >
                          네고하여 팔기
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Footer Stats */}
        <div className="footer-stats text-[11px] font-bold">
           <span>💰 ₩ {gameState.balance.toLocaleString()}</span>
           <span>📈 {gameState.stocks[1].price > gameState.stocks[1].prevPrice ? '상승세' : '하락세'}</span>
           <span>📍 {gameState.location}</span>
        </div>

        {/* Navigation Bar */}
        {(activeScreen !== 'chat' || gameState.tradeType === 'BUY') && (
          <nav className="h-[60px] flex justify-around items-center border-t border-gray-100 pb-2.5">
            <div 
              onClick={() => setActiveScreen('market')}
              className={`bottom-nav-item ${activeScreen === 'market' ? 'active' : ''}`}
            >
              <div className="text-[20px]">🏠</div>
              <div className="text-[9px]">홈</div>
            </div>
            <div 
               onClick={() => setActiveScreen('stock')}
              className={`bottom-nav-item ${activeScreen === 'stock' ? 'active' : ''}`}
            >
              <div className="text-[20px]">📊</div>
              <div className="text-[9px]">주식</div>
            </div>
            <div 
               onClick={() => setActiveScreen('inventory')}
              className={`bottom-nav-item ${activeScreen === 'inventory' ? 'active' : ''}`}
            >
              <div className="text-[20px]">👤</div>
              <div className="text-[9px]">나의당근</div>
            </div>
          </nav>
        )}

        {/* Admin Panel (Retro style) */}
        {showAdmin && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="admin-panel-retro"
          >
            <div className="flex justify-between mb-2">
              <span>[SYSTEM ADMIN]</span>
              <button onClick={() => setShowAdmin(false)}>X</button>
            </div>
            <div className="space-y-1">
              <button onClick={() => adminAddMoney(100000)} className="block w-full text-left">- ASSET: +10W</button>
              <button onClick={() => adminTimeSkip()} className="block w-full text-left">- TIME: +5D</button>
              <div className="text-white">- NPC: RICH (0.3%)</div>
              <button onClick={() => nextTurn()} className="block w-full text-left mt-2 border border-[#0f0] text-center py-1">EXECUTE</button>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  </div>
  );
}
