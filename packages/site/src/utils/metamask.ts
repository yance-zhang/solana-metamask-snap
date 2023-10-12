/**
 * Detect if the wallet injecting the ethereum object is Flask.
 *
 * @returns True if the MetaMask version is Flask, false otherwise.
 */
export const isFlask = async () => {
  let provider: any = window.ethereum;

  if (!provider.isMetaMask) {
    return false;
  }
  console.log(provider.providers);
  if (provider.providers) {
    provider = provider.providers.find((p: any) => p.isMetaMask);
  }

  try {
    const clientVersion = await provider?.request({
      method: 'web3_clientVersion',
    });

    const isFlaskDetected = (clientVersion as string[])?.includes('flask');

    return Boolean(provider && isFlaskDetected);
  } catch {
    return false;
  }
};
