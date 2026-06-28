import {
  Contract,
  rpc,
  TransactionBuilder,
  Address,
  nativeToScVal,
  scValToNative,
  type xdr,
} from "@stellar/stellar-sdk";
import { NETWORK_PASSPHRASE, RPC_URL } from "./network";
import { signTransactionXdr } from "./wallet";

const server = new rpc.Server(RPC_URL, { allowHttp: RPC_URL.startsWith("http://") });

const BASE_FEE = "100000"; // generous fee for resource-heavy Soroban invocations

export class ContractCallError extends Error {
  constructor(message: string, public readonly cause?: unknown) {
    super(message);
    this.name = "ContractCallError";
  }
}

/**
 * Simulates and (optionally) submits a contract invocation.
 *
 * - `simulateOnly = true` is used for read-only view calls: we still go
 *   through a full simulation because Soroban view functions are themselves
 *   invocations, just never sent on-chain.
 * - `simulateOnly = false` requires a connected wallet's public key so we
 *   can build a real transaction, have it signed client-side, and submit it,
 *   then poll until the network reports a final status.
 */
export async function callContract<T = unknown>(
  contractId: string,
  method: string,
  args: xdr.ScVal[],
  options: { sourceAccount: string; simulateOnly: boolean }
): Promise<T> {
  const { sourceAccount, simulateOnly } = options;

  let account;
  try {
    account = await server.getAccount(sourceAccount);
  } catch (err) {
    throw new ContractCallError(
      "Could not load the source account from the network. It may need to be funded first.",
      err
    );
  }

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  let simulated;
  try {
    simulated = await server.simulateTransaction(tx);
  } catch (err) {
    throw new ContractCallError(`Simulation failed for "${method}".`, err);
  }

  if (rpc.Api.isSimulationError(simulated)) {
    throw new ContractCallError(
      `Contract rejected "${method}": ${simulated.error}`
    );
  }

  if (simulateOnly) {
    const retval = simulated.result?.retval;
    return retval ? (scValToNative(retval) as T) : (undefined as T);
  }

  const prepared = rpc.assembleTransaction(tx, simulated).build();
  const signedXdr = await signTransactionXdr(prepared.toXDR(), NETWORK_PASSPHRASE);

  const { TransactionBuilder: TB } = await import("@stellar/stellar-sdk");
  const signedTx = TB.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  let sendResult;
  try {
    sendResult = await server.sendTransaction(signedTx);
  } catch (err) {
    throw new ContractCallError("Failed to submit transaction to the network.", err);
  }

  if (sendResult.status === "ERROR") {
    throw new ContractCallError(`Transaction submission rejected for "${method}".`);
  }

  const hash = sendResult.hash;
  const finalStatus = await pollTransactionStatus(hash);

  if (finalStatus.status !== "SUCCESS") {
    throw new ContractCallError(
      `Transaction for "${method}" did not succeed (status: ${finalStatus.status}).`
    );
  }

  return { hash, status: finalStatus.status } as T;
}

async function pollTransactionStatus(
  hash: string,
  timeoutMs = 30_000,
  intervalMs = 1_500
): Promise<{ status: string }> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const res = await server.getTransaction(hash);
    if (res.status !== rpc.Api.GetTransactionStatus.NOT_FOUND) {
      return { status: res.status };
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return { status: "TIMEOUT" };
}

// ---- typed convenience wrappers ----

export const sc = {
  address: (value: string) => Address.fromString(value).toScVal(),
  i128: (value: string | bigint | number) => nativeToScVal(BigInt(value), { type: "i128" }),
  u32: (value: number) => nativeToScVal(value, { type: "u32" }),
  string: (value: string) => nativeToScVal(value, { type: "string" }),
};

export { server as rpcServer };
