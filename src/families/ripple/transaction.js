// @flow
import { BigNumber } from "bignumber.js";
import type { Transaction, TransactionRaw } from "./types";
import {
  fromTransactionCommonRaw,
  toTransactionCommonRaw
} from "../../transaction/common";

const fromTransactionRaw = (tr: TransactionRaw): Transaction => {
  const common = fromTransactionCommonRaw(tr);
  const { networkInfo } = tr;
  return {
    ...common,
    family: tr.family,
    tag: tr.tag,
    fee: tr.fee ? BigNumber(tr.fee) : null,
    feeCustomUnit: tr.feeCustomUnit, // FIXME remove this field. this is not good.. we're dereferencing here. we should instead store an index (to lookup in currency.units on UI)
    networkInfo: networkInfo && {
      family: networkInfo.family,
      serverFee: BigNumber(networkInfo.serverFee),
      baseReserve: BigNumber(networkInfo.baseReserve)
    }
  };
};

const toTransactionRaw = (t: Transaction): TransactionRaw => {
  const common = toTransactionCommonRaw(t);
  const { networkInfo } = t;
  return {
    ...common,
    family: t.family,
    tag: t.tag,
    fee: t.fee ? t.fee.toString() : null,
    feeCustomUnit: t.feeCustomUnit, // FIXME remove this field. this is not good.. we're dereferencing here. we should instead store an index (to lookup in currency.units on UI)
    networkInfo: networkInfo && {
      family: networkInfo.family,
      serverFee: networkInfo.serverFee.toString(),
      baseReserve: networkInfo.baseReserve.toString()
    }
  };
};

export default { fromTransactionRaw, toTransactionRaw };
