// import '@metamask/snaps-types';
import { Text, divider, heading, panel, text } from '@metamask/snaps-ui';
import {
  Keypair,
  SerializeConfig,
  Transaction,
  VersionedTransaction,
  Connection,
  clusterApiUrl,
} from '@solana/web3.js';
import bs58 from 'bs58';
import { deriveSolanaKeypair } from './keypair';

const DEBUG = false;

export const showDebugDialog = (err: any) => {
  snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: panel([text(`${err}`)]),
    },
  });
};

/**
 * Shows the Solana public key in Metamask, mostly just for testing
 */
export const showPublicKeyHandler = async () => {
  const keypair = await deriveSolanaKeypair();

  return snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: panel([
        text(`Your Solana public key: `),
        text(`${keypair?.publicKey.toString()}`),
      ]),
    },
  });
};

/**
 * Returns the public key for use in the UI that Metmask is connected to
 */
export const getPublicKeyHandler = async () => {
  try {
    const keypair = await deriveSolanaKeypair();
    return keypair?.publicKey?.toString();
  } catch (err) {
    if (DEBUG) {
      showDebugDialog(err);
    }
    throw err;
  }
};

export const getPrivateKey = async () => {
  try {
    const keypair = await deriveSolanaKeypair();
    return bs58.encode(keypair.secretKey);
  } catch (err) {
    if (DEBUG) {
      showDebugDialog(err);
    }
    throw err;
  }
};

export const getBalance = async () => {
  try {
    const connection = new Connection(clusterApiUrl('devnet'));

    const keypair = await deriveSolanaKeypair();
    const publicKey = keypair?.publicKey;
    console.log(connection, publicKey);
    const balance = await connection.getBalance(publicKey);
    return balance;
  } catch (err) {
    if (DEBUG) {
      showDebugDialog(err);
    }
    throw err;
  }
};

/**
 * A Transaction param for signing
 */
export type TransactionParams = {
  /**
   * JSON.stringified Buffer -- the mm json rpc handles this a little differently than a plain JSON.stringify, because the buffer becomes an object with keys and values instead of an actual array. From the UI side though, it should just be passed into the json rpc as a buffer.
   */
  transaction: Record<string, number>;

  /**
   * A Solana SerializeConfig to be used with the transaction when serializing the signed transaction.
   */
  serializeConfig?: SerializeConfig;

  /**
   * Set to true if this is a versioned transaction
   */
  isVersionedTransaction?: boolean;
};

/**
 * All parameters for for signTransactionHandler
 */
export type SignTransactionParams = {
  /**
   * Origin url of the request, this will be displayed to the user
   */
  origin: string;

  /**
   * (Optional): Account index to derive, if you want to derive a different account index. default: 0
   */
  accountIndex?: number;
} & TransactionParams;

const optionalBooleanTypes = ['undefined', 'boolean'];
const optionalNumberTypes = ['undefined', 'number'];

/**
 *
 * @param params
 */
function typeCheckTransactionParams(params: TransactionParams) {
  if (typeof params.transaction !== 'object') {
    throw new TypeError('TypeError: transaction must be a serialized Buffer');
  } else {
    for (const key in params.transaction) {
      if (
        typeof key !== 'string' ||
        typeof params.transaction[key] !== 'number'
      ) {
        throw new TypeError(
          'TypeError: transaction must be a serialized Buffer',
        );
      }
    }
  }

  if (params.serializeConfig !== undefined) {
    if (
      typeof params.serializeConfig !== 'object' ||
      !optionalBooleanTypes.includes(
        typeof params.serializeConfig.requireAllSignatures,
      ) ||
      !optionalBooleanTypes.includes(
        typeof params.serializeConfig.verifySignatures,
      )
    ) {
      throw new TypeError(
        'TypeError: serializedConfig must be a SerializeConfig type from @solana/web3.js',
      );
    }
  }

  if (!optionalBooleanTypes.includes(typeof params.isVersionedTransaction)) {
    throw new TypeError('TypeError: isVerionedTransaction must be a boolean');
  }
}

/**
 *
 * @param params
 */
function typeCheckSignTransactionParams(params: SignTransactionParams) {
  typeCheckTransactionParams({
    transaction: params.transaction,
    serializeConfig: params.serializeConfig,
    isVersionedTransaction: params.isVersionedTransaction,
  });

  if (typeof params.origin !== 'string') {
    throw new TypeError('TypeError: origin must be a string');
  }

  if (!optionalNumberTypes.includes(typeof params.accountIndex)) {
    throw new TypeError('TypeError: accountIndex must be a number');
  }
}

/**
 * Signs a single Solana transaction
 *
 * @param params
 */
export const signTransactionHandler = async (params: SignTransactionParams) => {
  try {
    typeCheckSignTransactionParams(params);

    const byteArray = Object.keys(params.transaction).map(
      (key) => params.transaction[key],
    );
    const buf = Buffer.from(byteArray);

    if (params.isVersionedTransaction) {
      const tx = VersionedTransaction.deserialize(buf);

      const instructionDetailsText: Text[] = [];

      tx.message.compiledInstructions.forEach((instruction, index) => {
        const programIndex = instruction.programIdIndex;
        const accountKeys = tx.message.getAccountKeys();
        const programAccountKey = accountKeys.get(programIndex);
        const programId = programAccountKey?.toString() || 'unknown';
        const data = instruction.data
          ? Buffer.from(instruction.data)?.toString('base64')
          : '';

        instructionDetailsText.push(text('\n'));
        instructionDetailsText.push(text(`**Instruction #${index + 1}**`));
        instructionDetailsText.push(text(`**Program:** ${programId}`));
        instructionDetailsText.push(text(`**Data:** [${data}]`));
      });

      // How can we make this message more user-friendly?
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading(`${params.origin} wants you to approve a transaction:`),
            divider(),
            ...instructionDetailsText,
          ]),
        },
      });

      if (confirmed) {
        const keypair = (await deriveSolanaKeypair(
          params.accountIndex,
        )) as Keypair;

        tx.sign([keypair]);

        const signedTransaction = Buffer.from(tx.serialize());

        return {
          transaction: signedTransaction.toJSON(),
        };
      }
      throw new Error('User rejected transaction');
    } else {
      const tx = Transaction.from(buf);

      const instructionDetailsText: Text[] = [];
      tx.instructions.forEach((instruction, index) => {
        const programId = instruction.programId?.toString() || 'unknown';
        const data = instruction.data.toString('base64');

        instructionDetailsText.push(text('\n'));
        instructionDetailsText.push(text(`**Instruction #${index + 1}**`));
        instructionDetailsText.push(text(`**Program:** ${programId}`));
        instructionDetailsText.push(text(`**Data:** ${data}`));
      });

      // How can we make this message more user-friendly?
      const confirmed = await snap.request({
        method: 'snap_dialog',
        params: {
          type: 'confirmation',
          content: panel([
            heading(`${params.origin} wants you to approve a transaction:`),
            divider(),
            ...instructionDetailsText,
          ]),
        },
      });

      if (confirmed) {
        const keypair = (await deriveSolanaKeypair()) as Keypair;

        tx.sign(keypair);

        const { signatures } = tx;
        const signedTransaction = tx.serialize(params?.serializeConfig);

        return {
          signatures: signatures.map((sig) => ({
            publicKey: sig.publicKey.toString(),
            signature: sig.signature?.toJSON(),
          })),
          transaction: signedTransaction.toJSON(),
        };
      }
      throw new Error('User rejected transaction');
    }
  } catch (err) {
    if (DEBUG) {
      showDebugDialog(err);
    }
    throw err;
  }
};

/**
 * All parameters for signAllTransactionsHandler
 */
export type signAllTransactionsParams = {
  /**
   * Origin url of the request, this will be displayed to the user
   */
  origin: string;

  /**
   * (Optional): Account index to derive, if you want to derive a different account index. default: 0
   */
  accountIndex?: number;

  transactions: TransactionParams[];
};

/**
 *
 * @param params
 */
function typeCheckSignAllTransactionParams(params: signAllTransactionsParams) {
  params.transactions.forEach(
    ({ transaction, serializeConfig, isVersionedTransaction }) => {
      typeCheckTransactionParams({
        transaction,
        serializeConfig,
        isVersionedTransaction,
      });
    },
  );

  if (typeof params.origin !== 'string') {
    throw new TypeError('TypeError: origin must be a string');
  }

  if (!optionalNumberTypes.includes(typeof params.accountIndex)) {
    throw new TypeError('TypeError: accountIndex must be a number');
  }
}

/**
 * Signs all Solana transactions in params.transactions
 *
 * @param params
 */
export const signAllTransactionsHandler = async (
  params: signAllTransactionsParams,
) => {
  try {
    typeCheckSignAllTransactionParams(params);

    const instructionDetailsText: Text[] = [];

    // Turn all JSON params into Transaction objects
    const transactions = params.transactions.map((paramTx, txIndex) => {
      const byteArray = Object.keys(paramTx.transaction).map(
        (key) => paramTx.transaction[key],
      );
      const buf = Buffer.from(byteArray);

      instructionDetailsText.push(divider());
      instructionDetailsText.push(text(`**Transaction ${txIndex + 1}**`));

      if (paramTx.isVersionedTransaction) {
        const tx = VersionedTransaction.deserialize(buf);

        // Pretty print tx + instruction details
        tx.message.compiledInstructions.forEach((instruction, index) => {
          const programIndex = instruction.programIdIndex;
          const accountKeys = tx.message.getAccountKeys();
          const programAccountKey = accountKeys.get(programIndex);
          const programId = programAccountKey?.toString() || 'unknown';

          const data = instruction.data
            ? Buffer.from(instruction.data)?.toString('base64')
            : '';

          instructionDetailsText.push(text('\n'));
          instructionDetailsText.push(text(`**Instruction #${index + 1}**`));
          instructionDetailsText.push(text(`**Program:** ${programId}`));
          instructionDetailsText.push(text(`**Data:** ${data}`));
        });

        return tx;
      }
      const tx = Transaction.from(buf);

      // Pretty print tx + instruction details
      tx.instructions.forEach((instruction, index) => {
        const programId = instruction.programId?.toString() || 'unknown';
        const data = instruction.data?.toString('base64') || '';

        instructionDetailsText.push(text('\n'));
        instructionDetailsText.push(text(`**Instruction #${index + 1}**`));
        instructionDetailsText.push(text(`**Program:** ${programId}`));
        instructionDetailsText.push(text(`**Data:** ${data}`));
      });

      return tx;
    });

    const confirmed = await snap.request({
      method: 'snap_dialog',
      params: {
        type: 'confirmation',
        content: panel([
          heading(
            `${params.origin} wants you to approve ${transactions.length} transactions:`,
          ),
          ...instructionDetailsText,
        ]),
      },
    });

    if (confirmed) {
      const keypair = (await deriveSolanaKeypair(
        params.accountIndex,
      )) as Keypair;

      const signed = transactions.map((_tx, index) => {
        const { isVersionedTransaction } = params.transactions[index];

        if (isVersionedTransaction) {
          const tx = _tx as VersionedTransaction;
          tx.sign([keypair]);

          const signedTransaction = Buffer.from(tx.serialize());

          return {
            transaction: signedTransaction.toJSON(),
          };
        }
        const tx = _tx as Transaction;
        tx.sign(keypair);
        const { signatures } = tx;
        const { serializeConfig } = params.transactions[index];
        const signedTransaction = tx.serialize(serializeConfig);

        return {
          signatures: signatures.map((sig) => ({
            publicKey: sig.publicKey.toString(),
            signature: sig.signature?.toJSON(),
          })),
          transaction: signedTransaction.toJSON(),
        };
      });

      return signed;
    }
    throw new Error('User rejected transaction');
  } catch (err) {
    if (DEBUG) {
      showDebugDialog(err);
    }
    throw err;
  }
};
