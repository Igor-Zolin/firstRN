/* eslint-disable react-refresh/only-export-components */
import {
  TonConnectUIProvider,
  useIsConnectionRestored,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  createTonProofChallenge,
  getApiBase,
  getTonWalletMe,
  unlinkTonWallet,
  verifyTonWallet,
} from '../api/client';
import { useAuth } from '../auth/AuthContext';

type TonBindingStatus =
  | 'disconnected'
  | 'preparing'
  | 'connected'
  | 'verifying'
  | 'verified'
  | 'error';

type TonWalletContextValue = {
  status: TonBindingStatus;
  verified: boolean;
  walletAddress: string | null;
  error: string;
};

const TonWalletContext = createContext<TonWalletContextValue | null>(null);

function getManifestUrl() {
  const configured = import.meta.env.VITE_TONCONNECT_MANIFEST_URL as
    | string
    | undefined;
  return configured?.trim() || `${getApiBase()}/tonconnect-manifest.json`;
}

function WalletBinding({ children }: { children: React.ReactNode }) {
  const { isAuthed, bootLoading } = useAuth();
  const wallet = useTonWallet();
  const connectionRestored = useIsConnectionRestored();
  const [tonConnectUI] = useTonConnectUI();
  const [status, setStatus] = useState<TonBindingStatus>('disconnected');
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [error, setError] = useState('');
  const verifiedAddressRef = useRef<string | null>(null);
  const verificationKeyRef = useRef('');

  const prepareProof = useCallback(async () => {
    if (!isAuthed) {
      tonConnectUI.setConnectRequestParameters(null);
      return;
    }

    setStatus((current) => (current === 'verified' ? current : 'preparing'));
    tonConnectUI.setConnectRequestParameters({ state: 'loading' });

    try {
      const challenge = await createTonProofChallenge();
      tonConnectUI.setConnectRequestParameters({
        state: 'ready',
        value: { tonProof: challenge.payload },
      });
      setError('');
      setStatus((current) => (current === 'verified' ? current : 'disconnected'));
    } catch (challengeError) {
      tonConnectUI.setConnectRequestParameters(null);
      setStatus('error');
      setError(
        challengeError instanceof Error
          ? challengeError.message
          : 'Не удалось подготовить TON proof'
      );
    }
  }, [isAuthed, tonConnectUI]);

  useEffect(() => {
    if (bootLoading) return;

    if (!isAuthed) {
      tonConnectUI.setConnectRequestParameters(null);
      if (tonConnectUI.connected) {
        void tonConnectUI.disconnect();
      }
      return;
    }

    void prepareProof();
    const interval = window.setInterval(() => {
      void prepareProof();
    }, 4 * 60 * 1000);

    return () => window.clearInterval(interval);
  }, [bootLoading, isAuthed, prepareProof, tonConnectUI]);

  useEffect(() => {
    if (!isAuthed || !connectionRestored || !wallet) return;

    let active = true;
    const proofReply = wallet.connectItems?.tonProof;
    const proof =
      proofReply && 'proof' in proofReply ? proofReply.proof : null;
    const verificationKey = proof
      ? `${wallet.account.address}:${proof.payload}:${proof.signature}`
      : `${wallet.account.address}:restored`;

    if (verificationKeyRef.current === verificationKey) return;
    verificationKeyRef.current = verificationKey;

    const bindWallet = async () => {
      setStatus('verifying');
      setWalletAddress(wallet.account.address);
      setError('');

      try {
        const existing = await getTonWalletMe();
        if (
          existing.walletAddress === wallet.account.address &&
          existing.network &&
          (wallet.account.chain === '-239'
            ? existing.network === 'mainnet'
            : existing.network === 'testnet')
        ) {
          if (!active) return;
          verifiedAddressRef.current = wallet.account.address;
          setStatus('verified');
          return;
        }

        if (!proof) {
          throw new Error(
            'Кошелёк подключён без TON proof. Отключите его и подключите заново.'
          );
        }

        const result = await verifyTonWallet({
          account: {
            address: wallet.account.address,
            chain: wallet.account.chain,
            walletStateInit: wallet.account.walletStateInit,
            publicKey: wallet.account.publicKey,
          },
          proof,
        });

        if (!active) return;
        verifiedAddressRef.current = result.wallet.walletAddress;
        setWalletAddress(result.wallet.walletAddress);
        setStatus('verified');
        await prepareProof();
      } catch (bindingError) {
        if (!active) return;
        setStatus('error');
        setError(
          bindingError instanceof Error
            ? bindingError.message
            : 'Не удалось подтвердить TON-кошелёк'
        );
        verifiedAddressRef.current = null;
        await tonConnectUI.disconnect().catch(() => {});
      }
    };

    void bindWallet();

    return () => {
      active = false;
    };
  }, [
    connectionRestored,
    isAuthed,
    prepareProof,
    tonConnectUI,
    wallet,
  ]);

  useEffect(() => {
    if (!connectionRestored || wallet) return;

    const verifiedAddress = verifiedAddressRef.current;
    verifiedAddressRef.current = null;
    verificationKeyRef.current = '';
    setWalletAddress(null);
    setStatus('disconnected');

    if (verifiedAddress && isAuthed) {
      void unlinkTonWallet().catch(() => {});
    }
  }, [connectionRestored, isAuthed, wallet]);

  const value = useMemo<TonWalletContextValue>(
    () => ({
      status,
      verified: status === 'verified',
      walletAddress,
      error,
    }),
    [error, status, walletAddress]
  );

  return (
    <TonWalletContext.Provider value={value}>
      {children}
    </TonWalletContext.Provider>
  );
}

export function AppTonConnectProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const configuredTwaReturnUrl = (
    import.meta.env.VITE_TELEGRAM_MINIAPP_URL as string | undefined
  )?.trim();
  const twaReturnUrl =
    configuredTwaReturnUrl && /^[a-z][a-z0-9+.-]*:\/\//i.test(configuredTwaReturnUrl)
      ? (configuredTwaReturnUrl as `${string}://${string}`)
      : undefined;

  return (
    <TonConnectUIProvider
      manifestUrl={getManifestUrl()}
      language="ru"
      enableAndroidBackHandler={false}
      analytics={{ mode: 'off' }}
      actionsConfiguration={
        twaReturnUrl ? { twaReturnUrl } : undefined
      }
    >
      <WalletBinding>{children}</WalletBinding>
    </TonConnectUIProvider>
  );
}

export function useTonWalletBinding() {
  const context = useContext(TonWalletContext);
  if (!context) {
    throw new Error(
      'useTonWalletBinding must be used inside AppTonConnectProvider'
    );
  }
  return context;
}
