import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, doc, setDoc, updateDoc, writeBatch, query, limit, where } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";
import { Item, NPCType, ChatResponse } from "../types";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null, // Add auth extraction if needed, but here we don't have user auth yet in game flow
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export const generateNPCMessage = async (
  npcType: NPCType,
  userMessage: string,
  context: string,
  currentPrice: number,
  originalItemPrice: number,
  tradeType: 'BUY' | 'SELL'
): Promise<ChatResponse> => {
  const prompt = `
    You are an NPC in a used market trading simulation game (like Karrot/Danggeun Market).
    NPC Type: ${npcType}
    User Message: "${userMessage}"
    Context: ${context}
    Current Negotiated Price: ₩${currentPrice}
    Original Item Value: ₩${originalItemPrice}
    Trade Type: ${tradeType} (The user is ${tradeType === 'BUY' ? 'buying from you' : 'selling to you'})

    NPC Personas & Tactical Behavior:
    - KIND (Spawn 5%): Very polite and soft-spoken. Even if the user makes an absurd request (e.g., asking for 300 million won for a 3,000 won item), they don't get angry; they politely suggest a slightly higher but reasonable counter-offer (e.g., "3억은 무리고 4500원에 거래하시는 것은 어떨까요?"). They try to match the player's suggested price unless it's extremely excessive.
    - NORMAL (Spawn 80%): Tries to balance profit with the user's request. Following user's proposal to some extent. Example: if user wants to sell a 3k item for 4500, they might say "시세가 얼만데 4500원이에요? 저도 이익이 있어야 하니까 깔끔하게 3500갑니다!". They are influenced by the user's tone; if the user is rude, they may lower their offer or raise their price.
    - DRUNK (Spawn 10%): Slurred speech, typos, and hiccups (e.g., "에헿", "딸국!", "까까줘어"). Focused on their own profit and doesn't empathize with the player, but can be persuaded if handled correctly. They won't deviate too far from the original price but display irrational persistence.
    - RUDE (Spawn 4%): Very stubborn and foul-mouthed. Focused purely on profit. However, if the user "stands their ground" or acts strong/aggressive back, they might suddenly yield and agree to trade at the fair market price (original value).
    - JAMMIN (Spawn 1%): Uses specific Korean elementary/middle school slang (잼민이 용어). Can be rude and swear when angry. If the user is kind and respectful, they will agree to a price very close to the player's suggestion (within reasonable bounds).

    Bargaining Rules:
    1. EXTREME PRICE CONSTRAINT: NPCs should NOT agree to prices that are wildly unrealistic. Generally, keep the price within 0.3x to 2.0x of the original item price. They prefer to stay close to the market value.
    2. NPC DECISION: Based on user message content and tone, decide if you accept, counter-offer, or ignore.
    3. CONTINUOUS DIALOGUE: Even if you agree to a price (e.g., "좋아요, 그 가격에 하죠"), the conversation DOES NOT end. You should continue to chat until the player says "네 알겠습니다".
    4. AGREEMENT TRIGGER (AI Side): Set isAgreement to true if you are satisfied with the price, but the code will only finalize if the player says the specific phrase.
    5. newProposedPrice MUST be the result of the current turn's negotiation.
    6. All responses MUST be in Korean.

    Return ONLY a JSON object:
    {
      "message": "The NPC's spoken response (Korean, 1-2 short sentences)",
      "newProposedPrice": number,
      "isAgreement": boolean
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            newProposedPrice: { type: Type.NUMBER },
            isAgreement: { type: Type.BOOLEAN },
          },
          required: ["message", "newProposedPrice", "isAgreement"],
        }
      }
    });

    const result = JSON.parse(response.text || '{"message": "대화에 실패했습니다.", "newProposedPrice": 0, "isAgreement": false}');
    return result as ChatResponse;
  } catch (error) {
    console.error("AI Service Error:", error);
    return {
      message: "연결이 불안정합니다. (통신 오류)",
      newProposedPrice: currentPrice,
      isAgreement: false
    };
  }
};

// Seed-based random for deterministic items across PCs
const seedRandom = (seed: number) => {
  return () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
};

export const fetchSoldOutItems = async (): Promise<string[]> => {
  try {
    const tenMinutesAgo = Date.now() - (10 * 60 * 1000);
    const q = query(
      collection(db, 'sold_items'),
      where('soldAt', '>', tenMinutesAgo)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.id);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, 'sold_items');
    return [];
  }
};

export const markItemAsSoldInFirestore = async (itemId: string) => {
  try {
    await setDoc(doc(db, 'sold_items', itemId), { soldAt: Date.now() });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `sold_items/${itemId}`);
  }
};

export const generateInitialItems = (soldItemIds: string[] = []): Item[] => {
  const conditions: Item['condition'][] = ['NEW', 'LIKE_NEW', 'USED', 'HEAVILY_USED'];
  
  const itemNames: Record<string, string[]> = {
    FOOD: ['비빔밥', '불고기', '김치찌개', '된장찌개', '제육볶음', '잡채', '떡볶이', '김밥', '순대', '튀김', '파전', '해물파전', '감자전', '육전', '삼계탕', '갈비찜', '닭볶음탕', '수육', '족발', '보쌈', '감자탕', '순대국', '설렁탕', '곰탕', '육개장', '냉면', '칼국수', '잔치국수', '비빔냉면', '물냉면', '육회', '간장게장', '계란찜', '계란말이', '두부김치', '잡채', '만두'],
    CLOTHING: ['티셔츠', '청바지', '슬랙스', '니트', '스웨터', '가디건', '후드티', '맨투맨', '자켓', '코트', '패딩', '원피스', '스커트', '셔츠', '블라우스', '운동복', '잠옷', '양말', '속옷', '모자', '장갑', '목도리'],
    ART: ['모나리자', '별이 빛나는 밤', '최후의 만찬', '절규', '키스', '기억의 지속', '진주 귀걸이를 한 소녀', '비너스의 탄생', '다비드상', '생각하는 사람', '피라미드', '에펠탑', '자유의 여신상', '피에타'],
    OBJECT: ['책상', '의자', '침대', '소파', '식탁', '책장', '서랍장', '조명', '스마트폰', '노트북', '모니터', '카메라', '텔레비전', '냉장고', '세탁기', '청소기', '에어컨', '선풍기', '가습기', '텀블러', '머그컵', '시계', '우산'],
    CAR: ['현대 아반떼', '기아 K5', '제네시스 G80', '테슬라 모델3', 'BMW 5시리즈', '벤츠 E클래스', '포르쉐 타이칸', '중고 펠리세이드'],
    REAL_ESTATE: ['강남 아파트', '한남동 빌라', '성수동 오피스텔', '제주도 전원주택', '판교 단독주택', '해운대 엘시티', '송도 펜트하우스', '이태원 상가']
  };

  const items: Item[] = [];
  const soldSet = new Set(soldItemIds);

  // Global seed for same items on all PCs
  const GLOBAL_SEED = 12345;
  const rng = seedRandom(GLOBAL_SEED);

  const createItem = (tier: 'CHEAP' | 'NORMAL' | 'EXPENSIVE' | 'AWESOME' | 'RICH' | 'LEGENDARY', idPrefix: string) => {
    let price = 0;
    let category: Item['category'] = 'OTHER';
    let sourcePool: string[] = [];

    const r = rng();

    if (tier === 'CHEAP') {
      price = Math.floor((r * 4000 + 1000) / 100) * 100;
      category = (['FOOD', 'CLOTHING', 'ART', 'OTHER'] as const)[Math.floor(rng() * 4)];
    } else if (tier === 'NORMAL') {
      price = Math.floor((r * 994900 + 5100) / 100) * 100;
      category = (['FOOD', 'CLOTHING', 'ART', 'OTHER'] as const)[Math.floor(rng() * 4)];
    } else if (tier === 'EXPENSIVE') {
      price = Math.floor((r * 8999900 + 1000100) / 100) * 100;
      category = (['FOOD', 'CLOTHING', 'ART', 'OTHER'] as const)[Math.floor(rng() * 4)];
    } else if (tier === 'AWESOME') {
      price = Math.floor((r * 89999900 + 10000100) / 500) * 500;
      category = (['CAR', 'REAL_ESTATE', 'ART', 'OTHER'] as const)[Math.floor(rng() * 4)];
    } else if (tier === 'RICH') {
      price = Math.floor((r * 899999900 + 100000100) / 1000) * 1000;
      category = (['CAR', 'REAL_ESTATE', 'ART'] as const)[Math.floor(rng() * 3)];
    } else {
      price = Math.floor((r * 9000000000 + 1000000000) / 10000) * 10000;
      category = (['REAL_ESTATE', 'CAR', 'ART'] as const)[Math.floor(rng() * 3)];
    }

    const poolKey = category === 'OTHER' ? 'OBJECT' : category;
    sourcePool = itemNames[poolKey] || itemNames['ART'];

    const nameTemplate = sourcePool[Math.floor(rng() * sourcePool.length)];
    const condition = conditions[Math.floor(rng() * conditions.length)];
    const names = [nameTemplate, `[급처] ${nameTemplate}`, `상태 좋은 ${nameTemplate}`, `${nameTemplate} 블랙`, `아껴 쓰던 ${nameTemplate}`];
    const name = names[Math.floor(rng() * names.length)];

    return {
      id: idPrefix,
      name: name.substring(0, 50),
      price,
      description: `${name} 판매합니다. 상태 아주 좋습니다.`,
      category,
      condition,
      isDecayed: false,
      createdAt: 1714380000000 - Math.floor(rng() * 1000000000), // Fixed base timestamp
      sellerId: `seller_${idPrefix}`,
      isSoldOut: soldSet.has(idPrefix),
    };
  };

  // Adjusting counts back to large as requested: 1,150,000 total
  // Using deterministic IDs so they are consistent
  for (let i = 0; i < 200000; i++) items.push(createItem('CHEAP', `cheap_${i}`));
  for (let i = 0; i < 500000; i++) items.push(createItem('NORMAL', `normal_${i}`));
  for (let i = 0; i < 100000; i++) items.push(createItem('EXPENSIVE', `expensive_${i}`));
  for (let i = 0; i < 150000; i++) items.push(createItem('AWESOME', `awesome_${i}`));
  for (let i = 0; i < 100000; i++) items.push(createItem('RICH', `rich_${i}`));
  for (let i = 0; i < 100000; i++) items.push(createItem('LEGENDARY', `legendary_${i}`));

  return items;
};
