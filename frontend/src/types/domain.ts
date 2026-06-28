export interface Milestone {
  description: string;
  releaseBps: number; // basis points of total goal, 10000 = 100%
  approved: boolean;
  released: boolean;
}

export interface CampaignMeta {
  id: number;
  title: string;
  creator: string;
  escrowAddress: string;
  category: string;
}

export interface CampaignStatus {
  meta: CampaignMeta;
  totalPledged: string; // i128 as string to avoid JS precision loss
  totalReleased: string;
  goal: string;
  deadline: number; // unix seconds
}

export interface CampaignDetail extends CampaignStatus {
  milestones: Milestone[];
  backerCount: number;
  arbiter: string;
}

export type ContractEventType =
  | "campaign_init"
  | "pledge_made"
  | "milestone_approved"
  | "funds_released"
  | "refund_issued"
  | "campaign_registered"
  | "vault_deposit"
  | "vault_withdraw";

export interface StreamedEvent {
  id: string;
  type: ContractEventType;
  ledger: number;
  timestamp: number;
  contractId: string;
  data: Record<string, unknown>;
}

export type AsyncStatus = "idle" | "loading" | "success" | "error";

export interface WalletState {
  isConnected: boolean;
  publicKey: string | null;
  network: string | null;
}
