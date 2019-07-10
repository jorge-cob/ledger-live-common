// @flow

import type { BigNumber } from "bignumber.js";

export type Transaction = {
  recipient: string,
  amount: ?(BigNumber | string),
  useAllAmount?: boolean,
  tokenAccountId?: ?string, // if provided, the transaction is done on a token instead
  // bitcoin
  feePerByte?: ?(BigNumber | string),
  // ethereum
  gasPrice?: BigNumber | string,
  gasLimit?: BigNumber | string,
  // xrp
  tag?: ?number,
  fee?: BigNumber | string
};

export type TransactionStatus = {
  // ? should UI show a warning about fees (currently have been hardcoded to be if fee>10% of amount)
  showFeeWarning: boolean,
  // estimated total fees the tx is going to cost. (in the mainAccount currency)
  estimatedFees: BigNumber,
  // actual amount that the recipient will receive (in account currency)
  amount: BigNumber,
  // total amount that the sender will spend (in account currency)
  totalSpent: BigNumber,
  // ? will it wipe all possible amount of the account
  useAllAmount: boolean,
  // null if recipient is valid, otherwise it will be an error, likely InvalidAddress error
  recipientError: ?Error,
  // null if recipient have no warning. recipient can be valid but have warning to display (e.g. ETH EIP55)
  recipientWarning: ?Error,
  // summary of the transaction is good to go or have validation error
  transactionError: ?Error
};
