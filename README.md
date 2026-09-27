# Blockchain Rental Agreement System

A Solidity-based smart contract system for managing property rental agreements on-chain: rent collection with automated late penalties, escrowed security deposits, and decentralized dispute resolution. Built with Hardhat, OpenZeppelin, and a React frontend.

> **Academic Project — Non-Commercial Use Only**
> This repository is submitted as academic/course work. It is provided **solely for educational, research, and evaluation purposes**.
> **The system must not be used for commercial purposes** — including but not limited to production deployment, paid services, resale, licensing, or any revenue-generating activity — without explicit written permission from the author.
> The software is provided "as is", without warranty of any kind; the author assumes no liability for any loss or damage arising from its use.

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Agreement Lifecycle](#agreement-lifecycle)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Environment Variables](#environment-variables)
- [Usage](#usage)
- [Testing](#testing)
- [Deployment](#deployment)
- [Frontend](#frontend)
- [Security Considerations](#security-considerations)
- [Project Structure](#project-structure)
- [License](#license)

---

## Overview

Traditional rental agreements are paper-based, enforcement relies on intermediaries, and deposit disputes are slow and adversarial. This project moves the agreement, payments, deposit escrow, and dispute process on-chain so that:

- **Rent payments are verifiable** — every payment emits an event and is recorded on-chain.
- **Late payments are penalised automatically** — a configurable grace period and late-fee percentage are enforced by contract logic, not by the landlord's discretion.
- **Security deposits are escrowed** — funds are locked in `DepositManager` and only released/deducted through the agreement's state machine.
- **Disputes are arbitrated transparently** — evidence, arbitrator assignment, voting, and resolution all happen on-chain with full audit history.
- **Agreements are composable** — `RentalFactory` deploys a dedicated `RentalAgreement` instance per lease and indexes it by landlord and tenant.

## Architecture

The system is split into a core agreement contract and four modules, wired together by a factory.

```
contracts/
├── core/
│   ├── RentalAgreement.sol     # Per-lease state machine, roles, rent/termination/dispute entry points
│   └── RentalFactory.sol       # Deploys agreements, indexes by landlord/tenant, collects platform fee
├── modules/
│   ├── PaymentHandler.sol      # Rent/deposit processing, platform fee split, payment history
│   ├── DepositManager.sol      # Deposit locking, deductions, refunds
│   ├── PenaltyEngine.sol       # Late-fee, damage, and early-termination penalty calculation
│   └── DisputeResolution.sol   # Dispute filing, evidence, arbitrator assignment/voting/resolution
└── interfaces/
    ├── IRentalAgreement.sol
    ├── IPaymentHandler.sol
    ├── IDepositManager.sol
    └── IDisputeResolution.sol
```

| Component | Responsibility | Access / Extends |
|---|---|---|
| `RentalAgreement` | Lease lifecycle, roles, state transitions | `IRentalAgreement`, `ReentrancyGuard`, `AccessControlEnumerable`, `Pausable` |
| `RentalFactory` | Creates agreements, keeps registry queries | — |
| `PaymentHandler` | Splits rent between landlord and platform wallet, logs history | `Ownable`, `ReentrancyGuard` |
| `DepositManager` | Escrows deposit, executes deductions/refunds | `AccessControl`, `ReentrancyGuard` |
| `PenaltyEngine` | Computes penalties, tracks violations | `Ownable` |
| `DisputeResolution` | Manages dispute lifecycle and arbitrator voting | `AccessControl`, `Pausable` |

### Roles

| Role | Grant location | Purpose |
|---|---|---|
| `DEFAULT_ADMIN_ROLE` | `RentalAgreement` constructor | Admin rights (granted to landlord) |
| `LANDLORD_ROLE` | `RentalAgreement` constructor | Termination, arrears checks, deposit decisions |
| `TENANT_ROLE` | `RentalAgreement` constructor | Pay rent, initiate disputes/termination |
| `ARBITRATOR_ROLE` | `DisputeResolution` | Assign evidence, vote, resolve disputes |

### Agreement state machine

Defined in `contracts/interfaces/IRentalAgreement.sol`:

```
DRAFT → ACTIVE → COMPLETED
              ↘ IN_ARREARS → ACTIVE / BREACHED
              ↘ DISPUTED    → ACTIVE / BREACHED
              ↘ TERMINATING → COMPLETED / BREACHED
```

`TerminationReason`: `MUTUAL_AGREEMENT`, `LANDLORD_BREACH`, `TENANT_BREACH`, `NON_PAYMENT`, `PROPERTY_DAMAGE`.

### Agreement data

`AgreementDetails` stores `propertyId`, `ipfsDocumentHash` (off-chain signed lease document), `monthlyRent`, `securityDeposit`, `lateFeePercentage` (default `500` = 5%), `gracePeriodDays` (default `5 days`), start/end dates, `lastPaymentDate`, `nextPaymentDue`, `state`, and `latePaymentCount`.

## Agreement Lifecycle

1. **Create** — A landlord calls `RentalFactory.createAgreement(...)`; the factory deploys a new `RentalAgreement` and emits `AgreementDeployed`.
2. **Deposit** — The tenant locks the security deposit through `DepositManager.lockDeposit`.
3. **Pay rent** — The tenant calls `payRent()` (payable). `PaymentHandler.processPayment` splits the amount by `platformFee` (basis points, max `1000` = 10%), forwards the rest plus any penalty to the landlord, and refunds overpayment.
4. **Late payment** — Past `nextPaymentDue + gracePeriodDays`, `PenaltyEngine.calculateLatePenalty` applies the late fee; the agreement moves to `IN_ARREARS` and `LatePayment` is emitted.
5. **Dispute** — The tenant calls `fileDispute(reason)`; the agreement enters `DISPUTED`. An arbitrator is assigned, evidence submitted via `submitEvidence`, and the dispute is resolved by `voteOnDispute`/`resolveDispute`.
6. **Termination** — Either party calls `initiateTermination(reason)`, moving the agreement to `TERMINATING`.
7. **Deposit return** — `returnDeposit(amount, reason)` settles the escrow (with any deduction recorded by `DepositManager.makeDeduction`).
8. **Completion** — The agreement reaches `COMPLETED` (or `BREACHED`), and all state changes emit `StateChanged`.

Events emitted by `RentalAgreement`: `RentPaid`, `LatePayment`, `DepositWithdrawn`, `DisputeFiled`, `AgreementTerminated`, `StateChanged`.

## Prerequisites

- **Node.js** ≥ 18
- **npm** ≥ 9
- A wallet private key and an RPC endpoint (only needed for testnet deployment)

## Installation

```bash
# 1. Install contract dependencies
npm install

# 2. Install frontend dependencies
cd frontend && npm install && cd ..

# 3. Compile
npm run compile
```

## Environment Variables

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

| Variable | Description |
|---|---|
| `PRIVATE_KEY` | Deployer wallet private key (**never commit `.env`**) |
| `GOERLI_RPC_URL` | Goerli RPC endpoint |
| `SEPOLIA_RPC_URL` | Sepolia RPC endpoint |
| `MUMBAI_RPC_URL` | Polygon Mumbai RPC endpoint |
| `ETHERSCAN_API_KEY` | For contract verification |
| `PLATFORM_FEE` | Platform fee in basis points (e.g. `100` = 1%) |
| `PLATFORM_WALLET` | Address receiving the platform fee share |

## Usage

```bash
npm run compile      # Compile contracts
npm run test         # Run the test suite
npm run coverage     # Solidity coverage report
npm run node         # Start a local Hardhat node
npm run clean        # Remove artifacts/cache
```

## Testing

```bash
npm test
```

The integration suite in `test/integration/full_lifecycle.test.js` covers:

- **Agreement Creation** — correct agreement details and correct role assignment
- **Rent Payment** — payment acceptance (`RentPaid` emitted) and late penalty calculation (`LatePayment` emitted)
- **Dispute Resolution** — filing and resolving a dispute

## Deployment

```bash
# Local
npm run node               # terminal 1
npm run deploy:local       # terminal 2

# Testnets
npm run deploy:sepolia
npm run deploy:goerli

# Verify on Etherscan
npm run verify -- --network sepolia <CONTRACT_ADDRESS>
```

`scripts/deploy/01_deploy_rental_system.js` deploys `RentalFactory` (passing `PLATFORM_WALLET` and `PLATFORM_FEE`) and prints the resulting address.

## Frontend

A React 18 + ethers v6 dapp lives in `frontend/`.

```bash
cd frontend
npm start     # dev server
npm run build # production build
```

| Path | Purpose |
|---|---|
| `src/components/ConnectWallet.jsx` | Wallet connection |
| `src/components/CreateAgreement.jsx` | Lease creation form |
| `src/components/Dashboard.jsx` | Agreement overview |
| `src/components/AgreementCard.jsx` | Per-agreement actions |
| `src/hooks/useWallet.js` | Wallet/provider hook |
| `src/utils/abis.js` | Contract ABIs |
| `src/utils/format.js` | Value formatting helpers |

## Security Considerations

Implemented mitigations:

- **Reentrancy** — `nonReentrant` guards on `payRent`, `processPayment`, and deposit operations (OpenZeppelin `ReentrancyGuard`).
- **Access control** — role checks (`onlyTenant`, `onlyLandlord`, `ARBITRATOR_ROLE`) plus `DEFAULT_ADMIN_ROLE` for administration.
- **State validation** — `inState(...)` modifier restricts each action to a valid lifecycle state.
- **Input validation** — zero-address, non-zero rent, and date-order checks in the constructor; platform fee capped at `1000` bps.
- **Circuit breaker** — `Pausable` on `RentalAgreement` and `DisputeResolution`.
- **Checks-effects-interactions** — external value transfers are performed after state updates, with failure checks on every `call`.
- **Overpayment refund** — surplus ETH is returned to the payer.

Known limitations (documented for academic review):

- Contracts have **not** been audited; do not deploy to mainnet or handle real funds.
- `processDeposit` does not escrow funds itself — deposit custody is handled by `DepositManager`.
- Arbitrator set and quorum are configuration-dependent; review `DisputeResolution` parameters before use.
- Penalty and fee values are hard-coded/defaulted in `AgreementDetails` rather than fully configurable per agreement.

## Project Structure

```
RentalAgreementSystem/
├── contracts/            # Solidity sources (core, modules, interfaces)
├── scripts/
│   └── deploy/
│       └── 01_deploy_rental_system.js
├── test/
│   └── integration/
│       └── full_lifecycle.test.js
├── frontend/             # React dapp
├── subgraph/             # (reserved) subgraph/indexing workspace
├── artifacts/            # Compiled output (generated)
├── cache/                # Hardhat cache (generated)
├── hardhat.config.js     # Solidity 0.8.19, optimizer 200 runs, viaIR
├── package.json
├── .env.example
```
