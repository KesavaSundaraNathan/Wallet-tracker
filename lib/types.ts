export type Network = 'visa' | 'mastercard' | 'amex';

export interface Card {
  id: string;
  name: string;            // user's custom label, rendered on the card face
  network: Network;
  finish: string;          // theme key within the network (see components/card/themes.ts)
  nameAlign: 'left' | 'right';
  holder: string;
  last4: string;
  expiry: string;          // MM/YY
  createdAt: number;
}

export type TxType = 'expense' | 'income' | 'transfer';

export interface Transaction {
  id: string;
  type: TxType;
  amount: number;          // always positive; sign comes from `type`
  merchant: string;
  categoryId: string | null;
  cardId: string | null;   // mode of payment (for a transfer: the source account)
  toCardId?: string | null; // transfer destination
  date: string;            // YYYY-MM-DD (local)
  note?: string;
  recurring?: boolean;
  seriesId?: string;       // groups occurrences of one recurring expense
}

export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;           // hex
}

export interface Budget {
  id: string;
  categoryId: string;      // a budget can only exist for a defined category
  limit: number;           // monthly
}

export type ChartType = 'pie' | 'bar' | 'line';
export type StatsMode = 'card' | 'overview';
