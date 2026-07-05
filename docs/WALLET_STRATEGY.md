# Wallet strategy — launch without our own wallet, add it after v1

Status: **DECIDED direction.** Pairs with `docs/SELF_CUSTODY.md` (custody model)
and `docs/DEPLOYMENT_ROADMAP.md` (rollout).

## The framing (important)

On Canton you cannot have *no* wallet — funds always live in a **party** whose
**key** must sign to move them. "Launch without a wallet" really means **"launch
without building our OWN wallet, by using an existing one (Loop) as the
key-holder/signer."** Building our own wallet later (from the Canton Foundation
wallet reference / Wallet SDK) swaps in a different key-holder — it does **not**
change the swap contracts or settlement logic.

So the whole strategy is: **keep everything wallet-agnostic, and treat "the
wallet" as a pluggable key-holder + signer + party host behind one seam.**

## The seam (already exists — reuse it)

| Layer | Abstraction | v1 (Loop) | v2 (our wallet) |
|---|---|---|---|
| Frontend | `NEXT_PUBLIC_WALLET_PROVIDER` (`dev`/`loop`/`hosted`) | `loop` | `hosted` |
| Signing | client signer behind a `WalletProvider` interface | Loop popup | our wallet signer |
| Backend verify | `SignatureVerifier` (`INTENT_SIGNATURE_MODE`) + `PartyKeyResolver` | verify Loop Ed25519 | verify our key |
| Party host | party-provisioning port | user's Loop party (hosted on Loop) | user party hosted on **our** validator |
| Contracts | `SwapRequest`, allocations, `WhitelistEntry`, delegation | unchanged | unchanged |

Because the contracts only ever deal with **parties and signatures**, v2 is
*additive*: a new provider implementation + a new party-host path. No contract
redeploy/migration is forced by the wallet change.

## v1 — launch on Loop (no own wallet)

- Users connect **Loop**; their funds stay in their **Loop party** (self-custody
  — Loop holds the key, so our operator key can never move user funds; this
  satisfies the key-safety goal by construction).
- Swaps: the app builds a CIP-0056 allocation; the user signs it in Loop; our
  **operator/solver/protocol parties (hosted on our validator)** execute the DvP
  → **settlement traffic + app rewards land on our validator.**
- KYC allowlist, freeze, fee, receipts: all as already built.
- Pros: fastest to launch, already ~80% wired (Loop provider, signature verifier,
  allocations). Strongest custody (we never hold keys).
- Volume note: user-side confirmations happen on Loop's validator, but the
  **settlement** (the expensive, rewarded part) is on ours. Good enough for v1.

## v2 — swap built INTO our own wallet (the product), with our own wallet-connect

The long-term home of swap is **inside our own wallet**, not a separate dApp
connected to Loop. The wallet is the product; **swap is a feature module within
it**; and the wallet ships **our own wallet-connect**.

- Build the wallet from the **Canton Foundation wallet reference / Wallet SDK**.
  Users get a party **hosted on our validator**, so now *all* their activity
  (holdings, allocations, transfers, settlement) is sequenced and confirmed by
  us → **maximum transactions on our validator** (the primary goal).
- **Swap is in-wallet.** The swap screen calls the same intent-swap backend
  (matching, allocations, DvP) and the same contracts. Because the wallet holds
  the user's key in-process, signing an allocation is a local action — no
  external connect round-trip — which is a much better UX than v1's Loop popup.
- **Our own wallet-connect.** The wallet exposes a connect protocol (the role
  Loop plays for us in v1): the embedded swap uses it internally, and external
  dApps can connect to *our* wallet the way dApps connect to Loop today. This
  makes our wallet a Loop alternative, not just a swap UI.
- **Key safety in v2 is a design requirement, not a default.** Host user parties
  as **external (externally-signed) parties**: the user's key lives in the
  wallet client (device/passkey/secure enclave), and our validator hosts +
  sequences but **cannot sign for the user**. This keeps self-custody even though
  we run the wallet — our operator key alone still cannot move user funds.
  - Do **not** ship a v2 where our node holds user keys custodially; that
    re-introduces exactly the drain risk we rejected. If a custodial mode is ever
    needed, gate every outbound move behind the destination-locked
    `WithdrawalDelegation` from `docs/SELF_CUSTODY.md`.

### What the wallet must provide (component checklist)

| Component | Role | Source |
|---|---|---|
| Key store | hold/seal the user key (passkey / secure enclave); externally sign | Foundation Wallet SDK |
| Party host | onboard the user's party **on our validator** | our validator + provisioning port |
| Signer | sign Ledger API commands / allocations (interactive submission) | Wallet SDK + our validator |
| Wallet-connect | session + sign-request protocol for in-wallet swap and 3rd-party dApps | our impl (CIP-0103-style) |
| Swap module | UI + calls to existing intent-swap backend/contracts | existing repo (wallet-agnostic) |

## Transition (v1 → v2) without pain

1. **Identity is wallet-independent.** A user is keyed by email/KYC → mapped to a
   `cantonPartyId`. Add a `walletType` (`loop` | `hosted`) on the user/account
   record now so v2 is purely additive.
2. **Both providers coexist.** v2 can launch while existing users stay on Loop;
   new users (or opt-in migrators) get a hosted party. The matching engine,
   allowlist, and contracts treat all parties identically.
3. **Migration = an ordinary transfer.** To move a user from Loop to a hosted
   wallet: provision the hosted party, re-whitelist it, the user signs a transfer
   of their holdings from the Loop party to the hosted party, update the mapping.
   No contract change, no custodial step, no fund risk.
4. **No forced contract upgrade.** The DAR stays the same across the wallet
   change (SCU only needed for actual template changes — see
   `docs/CONTRACT_UPGRADE.md`).

## Recommendation (final)

- **v1: launch the swap as the app on Loop now.** Shortest path, mostly built,
  strongest custody story for launch. Treat it as the bridge, not the end state.
- **Build the seam now (cheap):** add `walletType` to the user/account record and
  keep the `WalletProvider`/`SignatureVerifier`/party-host abstractions clean, so
  the in-wallet provider is a drop-in.
- **v2: swap moves INTO our own wallet** (built from the Canton Foundation
  reference), with our own wallet-connect, user parties hosted on our validator,
  and **externally-signed (user-held) keys**. This captures maximum volume on our
  validator while preserving the key-safety guarantee. The standalone web app
  then becomes either retired or a thin client that connects via our
  wallet-connect — the swap backend/contracts are unchanged either way.

## What needs DevNet / Foundation-repo validation

- Loop Ed25519 verification against the party's public key from the Ledger API
  (replace the permissive dev verifier).
- v2: external-party / interactive-submission hosting on our validator, and the
  exact key-management model from the Foundation wallet reference. Validate on
  DevNet before mainnet.
