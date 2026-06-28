import { callContract, sc } from "./contractClient";
import { CONTRACT_IDS } from "./network";
import type { CampaignDetail, CampaignMeta, CampaignStatus, Milestone } from "@/types/domain";

function requireRegistryId(): string {
  if (!CONTRACT_IDS.registry) {
    throw new Error(
      "Registry contract ID is not configured. Set NEXT_PUBLIC_REGISTRY_CONTRACT_ID."
    );
  }
  return CONTRACT_IDS.registry;
}

// ---- Registry reads ----

export async function listCampaignIds(viewerAddress: string): Promise<number[]> {
  const raw = await callContract<number[]>(requireRegistryId(), "list_campaign_ids", [], {
    sourceAccount: viewerAddress,
    simulateOnly: true,
  });
  return raw ?? [];
}

export async function getCampaignMeta(
  id: number,
  viewerAddress: string
): Promise<CampaignMeta> {
  const raw = await callContract<{
    id: number;
    title: string;
    creator: string;
    escrow_address: string;
    category: string;
  }>(requireRegistryId(), "get_campaign", [sc.u32(id)], {
    sourceAccount: viewerAddress,
    simulateOnly: true,
  });
  return {
    id: raw.id,
    title: raw.title,
    creator: raw.creator,
    escrowAddress: raw.escrow_address,
    category: raw.category,
  };
}

export async function getCampaignStatus(
  id: number,
  viewerAddress: string
): Promise<CampaignStatus> {
  const raw = await callContract<{
    meta: { id: number; title: string; creator: string; escrow_address: string; category: string };
    total_pledged: bigint;
    total_released: bigint;
    goal: bigint;
    deadline: bigint;
  }>(requireRegistryId(), "campaign_status", [sc.u32(id)], {
    sourceAccount: viewerAddress,
    simulateOnly: true,
  });

  return {
    meta: {
      id: raw.meta.id,
      title: raw.meta.title,
      creator: raw.meta.creator,
      escrowAddress: raw.meta.escrow_address,
      category: raw.meta.category,
    },
    totalPledged: raw.total_pledged.toString(),
    totalReleased: raw.total_released.toString(),
    goal: raw.goal.toString(),
    deadline: Number(raw.deadline),
  };
}

// ---- Escrow reads ----

export async function getCampaignDetail(
  id: number,
  viewerAddress: string
): Promise<CampaignDetail> {
  const status = await getCampaignStatus(id, viewerAddress);

  const rawMilestones = await callContract<
    { description: string; release_bps: number; approved: boolean; released: boolean }[]
  >(status.meta.escrowAddress, "get_milestones", [], {
    sourceAccount: viewerAddress,
    simulateOnly: true,
  });

  const backers = await callContract<string[]>(status.meta.escrowAddress, "get_backers", [], {
    sourceAccount: viewerAddress,
    simulateOnly: true,
  });

  const arbiter = await callContract<string>(status.meta.escrowAddress, "get_arbiter", [], {
    sourceAccount: viewerAddress,
    simulateOnly: true,
  });

  const milestones: Milestone[] = rawMilestones.map((m) => ({
    description: m.description,
    releaseBps: m.release_bps,
    approved: m.approved,
    released: m.released,
  }));

  return { ...status, milestones, backerCount: backers.length, arbiter };
}

export async function getMyPledge(
  escrowAddress: string,
  backerAddress: string
): Promise<string> {
  const raw = await callContract<bigint>(
    escrowAddress,
    "get_pledge",
    [sc.address(backerAddress)],
    { sourceAccount: backerAddress, simulateOnly: true }
  );
  return raw.toString();
}

// ---- Escrow writes (require wallet signature) ----

export async function pledgeToCampaign(
  escrowAddress: string,
  backerAddress: string,
  amountStroops: string
): Promise<{ hash: string }> {
  return callContract<{ hash: string }>(
    escrowAddress,
    "pledge",
    [sc.address(backerAddress), sc.i128(amountStroops)],
    { sourceAccount: backerAddress, simulateOnly: false }
  );
}

export async function approveMilestone(
  escrowAddress: string,
  arbiterAddress: string,
  milestoneIndex: number
): Promise<{ hash: string }> {
  return callContract<{ hash: string }>(
    escrowAddress,
    "approve_milestone",
    [sc.u32(milestoneIndex)],
    { sourceAccount: arbiterAddress, simulateOnly: false }
  );
}

export async function releaseMilestone(
  escrowAddress: string,
  callerAddress: string,
  milestoneIndex: number
): Promise<{ hash: string }> {
  return callContract<{ hash: string }>(
    escrowAddress,
    "release_milestone",
    [sc.u32(milestoneIndex)],
    { sourceAccount: callerAddress, simulateOnly: false }
  );
}

export async function refundPledge(
  escrowAddress: string,
  backerAddress: string
): Promise<{ hash: string }> {
  return callContract<{ hash: string }>(
    escrowAddress,
    "refund",
    [sc.address(backerAddress)],
    { sourceAccount: backerAddress, simulateOnly: false }
  );
}

// ---- Registry writes ----

export async function registerCampaign(
  creatorAddress: string,
  title: string,
  category: string,
  escrowAddress: string
): Promise<{ hash: string }> {
  return callContract<{ hash: string }>(
    requireRegistryId(),
    "register_campaign",
    [sc.address(creatorAddress), sc.string(title), sc.string(category), sc.address(escrowAddress)],
    { sourceAccount: creatorAddress, simulateOnly: false }
  );
}
