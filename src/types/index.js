// @flow

import type {
  Currency,
  Unit,
  TokenCurrency,
  FiatCurrency,
  CryptoCurrency,
  ExplorerView
} from "./currencies";

import type {
  CryptoCurrencyConfig,
  CryptoCurrencyObjMap,
  CryptoCurrencyIds
} from "../data/cryptocurrencies";

import type { DerivationMode } from "../derivation";

import type {
  Account,
  AccountRaw,
  TokenAccount,
  TokenAccountRaw
} from "./account";

import type { Operation, OperationRaw, OperationType } from "./operation";

import type {
  AccountPortfolio,
  BalanceHistoryWithCountervalue,
  BalanceHistory,
  PortfolioRange,
  ValueChange,
  Portfolio,
  AssetsDistribution
} from "./portfolio";

import type { Transaction, TransactionStatus } from "./transaction";

export type {
  DerivationMode,
  CryptoCurrencyConfig,
  CryptoCurrencyObjMap,
  CryptoCurrencyIds,
  Account,
  AccountRaw,
  TokenAccount,
  TokenAccountRaw,
  Operation,
  OperationRaw,
  OperationType,
  TokenCurrency,
  Currency,
  Unit,
  FiatCurrency,
  CryptoCurrency,
  ExplorerView,
  AccountPortfolio,
  ValueChange,
  BalanceHistory,
  BalanceHistoryWithCountervalue,
  PortfolioRange,
  Portfolio,
  Transaction,
  TransactionStatus,
  AssetsDistribution
};

/**
 * Other stuff
 * -----------
 */

export type AccountIdParams = {
  type: string,
  version: string,
  currencyId: string,
  xpubOrAddress: string,
  derivationMode: DerivationMode
};

export type DailyOperationsSection = {
  day: Date,
  data: Operation[]
};

export type DailyOperations = {
  // operations grouped by day
  sections: DailyOperationsSection[],
  // Is the sections complete? means there is no more operations to pull
  completed: boolean
};
