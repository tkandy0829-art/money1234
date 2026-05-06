import { Stock, NPC } from "./types";

export const INITIAL_STOCKS: Stock[] = [
  {
    id: "^KS11",
    name: "KOSPI",
    price: 2500,
    prevPrice: 2500,
    risk: "LOW",
    history: [2500],
  },
  {
    id: "005930.KS",
    name: "삼성전자",
    price: 70000,
    prevPrice: 70000,
    risk: "MEDIUM",
    history: [70000],
  },
  {
    id: "000660.KS",
    name: "SK하이닉스",
    price: 150000,
    prevPrice: 150000,
    risk: "MEDIUM",
    history: [150000],
  },
];

export const NPC_SAMPLES: NPC[] = [
  { id: "npc_normal", name: "동네 이웃", type: "NORMAL", avatar: "👤" },
  { id: "npc_kind", name: "친절한 미소", type: "KIND", avatar: "😇" },
  { id: "npc_drunk", name: "술취한 아저씨", type: "DRUNK", avatar: "🥴" },
  { id: "npc_rude", name: "욕쟁이 할머니", type: "RUDE", avatar: "👿" },
  { id: "npc_jammin", name: "급식 잼민이", type: "JAMMIN", avatar: "🎒" },
];

export const LOCATIONS = ["강남역", "판교 테크노벨리", "홍대 입구", "여의도", "부산 해운대"];
