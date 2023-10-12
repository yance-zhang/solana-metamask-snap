import { Buffer } from 'buffer';
import { OnRpcRequestHandler } from '@metamask/snaps-types';

import {
  showPublicKeyHandler,
  getPublicKeyHandler,
  signTransactionHandler,
  signAllTransactionsHandler,
  getPrivateKey,
  getBalance,
} from './core';

window.Buffer = window.Buffer || Buffer;

/**
 * Handle incoming JSON-RPC requests, sent through `wallet_invokeSnap`.
 *
 * @param args - The request handler args as object.
 * @param args.origin - The origin of the request, e.g., the website that
 * invoked the snap.
 * @param args.request - A validated JSON-RPC request object.
 * @returns The result of `snap_dialog`.
 * @throws If the request method is not valid for this snap.
 */
export const onRpcRequest: OnRpcRequestHandler = async ({
  origin,
  request,
}) => {
  const params = request?.params as Record<string, any>;

  switch (request.method) {
    case 'showPublicKey':
      return await showPublicKeyHandler();

    case 'getPublicKey':
      return await getPublicKeyHandler();

    case 'getPrivateKey':
      return await getPrivateKey();

    case 'getBalance':
      return await getBalance();

    case 'signTransaction':
      return await signTransactionHandler({
        origin,
        transaction: params?.transaction,
        serializeConfig: params?.serializeConfig,
        isVersionedTransaction: params?.isVersionedTransaction,
      });

    case 'signAllTransactions':
      return await signAllTransactionsHandler({
        origin,
        transactions: params?.transactions,
      });

    default:
      console.log('Method not found.');
  }
};
