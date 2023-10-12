import { Buffer } from 'buffer';
import { useContext, useState } from 'react';
import styled from 'styled-components';
import {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  VersionedTransaction,
  clusterApiUrl,
} from '@solana/web3.js';
import { MetamaskActions, MetaMaskContext } from '../hooks';
import {
  connectSnap,
  getSnap,
  setAccount,
  shouldDisplayReconnectButton,
} from '../utils';
import {
  ConnectButton,
  InstallFlaskButton,
  ReconnectButton,
  Card,
  SendHelloButton,
} from '../components';
import { defaultSnapOrigin } from '../config';

window.Buffer = window.Buffer || Buffer;

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  margin-top: 7.6rem;
  margin-bottom: 7.6rem;
  ${({ theme }) => theme.mediaQueries.small} {
    padding-left: 2.4rem;
    padding-right: 2.4rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
    width: auto;
  }
`;

const Heading = styled.h1`
  margin-top: 0;
  margin-bottom: 2.4rem;
  text-align: center;
`;

const Span = styled.span`
  color: ${(props) => props.theme.colors.primary.default};
`;

const Subtitle = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.large};
  font-weight: 500;
  margin-top: 0;
  margin-bottom: 0;
  ${({ theme }) => theme.mediaQueries.small} {
    font-size: ${({ theme }) => theme.fontSizes.text};
  }
`;

const CardContainer = styled.div`
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  justify-content: space-between;
  max-width: 64.8rem;
  width: 100%;
  height: 100%;
  margin-top: 1.5rem;
`;

const Notice = styled.div`
  background-color: ${({ theme }) => theme.colors.background.alternative};
  border: 1px solid ${({ theme }) => theme.colors.border.default};
  color: ${({ theme }) => theme.colors.text.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;

  & > * {
    margin: 0;
  }
  ${({ theme }) => theme.mediaQueries.small} {
    margin-top: 1.2rem;
    padding: 1.6rem;
  }
`;

const ErrorMessage = styled.div`
  background-color: ${({ theme }) => theme.colors.error.muted};
  border: 1px solid ${({ theme }) => theme.colors.error.default};
  color: ${({ theme }) => theme.colors.error.alternative};
  border-radius: ${({ theme }) => theme.radii.default};
  padding: 2.4rem;
  margin-bottom: 2.4rem;
  margin-top: 2.4rem;
  max-width: 60rem;
  width: 100%;
  ${({ theme }) => theme.mediaQueries.small} {
    padding: 1.6rem;
    margin-bottom: 1.2rem;
    margin-top: 1.2rem;
    max-width: 100%;
  }
`;

const Index = () => {
  const [state, dispatch] = useContext(MetaMaskContext);
  const [userPublicKey, setUserPublicKey] = useState<string>('');
  const [userPrivateKey, setUserPrivateKey] = useState<string>('');
  const [balance, setBalance] = useState<number>(-1);

  const connectWallet = async () => {
    const accounts = await window.ethereum.request<string[]>({
      method: 'eth_requestAccounts',
    });
    // console.log(accounts);
    const account = accounts?.[0];
    if (!account) {
      throw new Error('Must accept wallet connection request.');
    }

    setAccount(account);
  };

  const handleConnectClick = async () => {
    try {
      await connectSnap();
      const installedSnap = await getSnap();

      dispatch({
        type: MetamaskActions.SetInstalled,
        payload: installedSnap,
      });
    } catch (e) {
      console.error(e);
      dispatch({ type: MetamaskActions.SetError, payload: e });
    }
  };

  const isVersionedTransaction = (
    transaction: Transaction | VersionedTransaction,
  ): transaction is VersionedTransaction => {
    return 'version' in transaction;
  };

  const signTransaction = async (tx: Transaction | VersionedTransaction) => {
    const isVersionedTx = isVersionedTransaction(tx);

    const serializeConfig = isVersionedTx
      ? undefined
      : {
          requireAllSignatures: false,
          verifySignatures: false,
        };
    // console.log(tx, serializeConfig);
    const serialized = tx.serialize(serializeConfig);

    const rpcRequestObject = {
      method: 'signTransaction',
      params: {
        transaction: serialized,
        isVersionedTransaction: isVersionedTx,
        serializeConfig,
      },
    };

    const results: any = await window.ethereum.request({
      method: 'wallet_invokeSnap',
      params: {
        snapId: defaultSnapOrigin,
        request: rpcRequestObject,
      },
    });

    let returnTx: Transaction | VersionedTransaction;

    // De-serialize results:
    if (isVersionedTx) {
      returnTx = VersionedTransaction.deserialize(
        Buffer.from(results?.transaction?.data),
      );
    } else {
      returnTx = Transaction.from(Buffer.from(results?.transaction?.data));
    }

    return returnTx;
  };

  return (
    <Container>
      <Heading>
        Welcome to <Span>Solana Snap</Span>
      </Heading>
      <Subtitle>
        Get started by editing <code>src/index.ts</code>
      </Subtitle>
      <CardContainer>
        {state.error && (
          <ErrorMessage>
            <b>An error happened:</b> {state.error.message}
          </ErrorMessage>
        )}
        {!state.isFlask && (
          <Card
            content={{
              title: 'Install',
              description:
                'Snaps is pre-release software only available in MetaMask Flask, a canary distribution for developers with access to upcoming features.',
              button: <InstallFlaskButton />,
            }}
            fullWidth
          />
        )}
        {!state.installedSnap && (
          <Card
            content={{
              title: 'Connect',
              description:
                'Get started by connecting to and installing the snap.',
              button: (
                <ConnectButton
                  onClick={handleConnectClick}
                  disabled={!state.isFlask}
                />
              ),
            }}
            disabled={!state.isFlask}
          />
        )}
        {shouldDisplayReconnectButton(state.installedSnap) && (
          <Card
            content={{
              title: 'Reconnect',
              description:
                'While connected to a local running snap this button will always be displayed in order to update the snap if a change is made.',
              button: (
                <ReconnectButton
                  onClick={handleConnectClick}
                  disabled={!state.installedSnap}
                />
              ),
            }}
            disabled={!state.installedSnap}
          />
        )}
        <Card
          content={{
            title: 'Connect Wallet',
            description:
              'Manage your approvals and get notifications on risky open approvals',
            button: (
              <ConnectButton
                onClick={connectWallet}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
        />

        <Card
          content={{
            title: 'Get Private Key',
            description: (
              <div
                style={{ wordBreak: 'break-all' }}
              >{`Private Key: ${userPrivateKey}`}</div>
            ),
            button: (
              <SendHelloButton
                text="Get Private"
                onClick={async () => {
                  const key: any = await window.ethereum.request({
                    method: 'wallet_invokeSnap',
                    params: {
                      snapId: defaultSnapOrigin,
                      request: {
                        method: 'getPrivateKey',
                      },
                    },
                  });
                  setUserPrivateKey(key);
                }}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
        />

        <Card
          content={{
            title: 'Get Public Key',
            description: (
              <div
                style={{ wordBreak: 'break-all' }}
              >{`Public Key: ${userPublicKey}`}</div>
            ),
            button: (
              <SendHelloButton
                text="Get Public"
                onClick={async () => {
                  const key: any = await window.ethereum.request({
                    method: 'wallet_invokeSnap',
                    params: {
                      snapId: defaultSnapOrigin,
                      request: {
                        method: 'getPublicKey',
                      },
                    },
                  });
                  setUserPublicKey(key);
                }}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
        />

        <Card
          content={{
            title: 'Get Balance',
            description: `Balance: ${balance > -1 ? balance : ' '} SOL`,
            button: (
              <SendHelloButton
                text="Get Balance"
                onClick={async () => {
                  const res: any = await window.ethereum.request({
                    method: 'wallet_invokeSnap',
                    params: {
                      snapId: defaultSnapOrigin,
                      request: {
                        method: 'getBalance',
                      },
                    },
                  });
                  setBalance(res);
                }}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
        />

        <Card
          content={{
            title: 'Sign message',
            description: `Sign transaction`,
            button: (
              <SendHelloButton
                text="Sign Transaction"
                onClick={async () => {
                  const to = Keypair.generate();
                  const key: any = await window.ethereum.request({
                    method: 'wallet_invokeSnap',
                    params: {
                      snapId: defaultSnapOrigin,
                      request: {
                        method: 'getPublicKey',
                      },
                    },
                  });
                  setUserPublicKey(key);

                  const connection = new Connection(
                    clusterApiUrl('devnet'),
                    'confirmed',
                  );
                  const recentBlockhash = await connection.getLatestBlockhash();
                  const tx = new Transaction({
                    recentBlockhash: recentBlockhash.blockhash,
                    feePayer: new PublicKey(key),
                  }).add(
                    SystemProgram.transfer({
                      fromPubkey: new PublicKey(key),
                      toPubkey: to.publicKey,
                      lamports: LAMPORTS_PER_SOL / 100,
                    }),
                  );
                  // console.log('trigger tx: ', tx);
                  // console.log(window.Buffer);
                  signTransaction(tx);
                }}
                disabled={!state.installedSnap}
              />
            ),
          }}
          disabled={!state.installedSnap}
        />

        <Notice>
          <p>
            Please note that the <b>snap.manifest.json</b> and{' '}
            <b>package.json</b> must be located in the server root directory and
            the bundle must be hosted at the location specified by the location
            field.
          </p>
        </Notice>
      </CardContainer>
    </Container>
  );
};

export default Index;
