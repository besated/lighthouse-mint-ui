import React, { useContext, useEffect } from "react";
import * as C from "./style";
import { connect, WalletConnect, WalletWindowKey } from "@sei-js/core";
import { Transition } from "react-transition-group";
import config from "../../config.json";
import { Connector, useConnect } from "wagmi";
import { getPublicClient, getWalletClient } from "wagmi/actions";
import {
  EvmWalletConnect,
  WASM_PRECOMPILE_ABI,
  WASM_PRECOMPILE_ADDRESS,
  seiDevnet,
  wagmiConfig,
} from "utils/evmConfig";
import { getContract } from "viem";

const WalletConnectContext = React.createContext({
  isModalOpen: false,
  openWalletConnect: () => {},
  closeWalletConnect: () => {},
  wallet: null as WalletConnect | EvmWalletConnect | null,
  disconnectWallet: () => {},
});

const isConnector = (name: WalletWindowKey | Connector): name is Connector => {
  return (name as Connector).connect !== undefined;
};

const WalletConnectProvider = ({ children }: any) => {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [wallet, setWallet] = React.useState<
    WalletConnect | EvmWalletConnect | null
  >(null);

  const openWalletConnect = () => setIsModalOpen(true);
  const closeWalletConnect = () => setIsModalOpen(false);

  const connectWallet = async (connector: WalletWindowKey | Connector) => {
    if (isConnector(connector)) {
      const { accounts } = await connector.connect({ chainId: seiDevnet.id });
      const publicClient = getPublicClient(wagmiConfig);
      const walletClient = await getWalletClient(wagmiConfig, {
        chainId: seiDevnet.id,
        connector,
      });
      const contract = getContract({
        abi: WASM_PRECOMPILE_ABI,
        address: WASM_PRECOMPILE_ADDRESS,
        client: walletClient,
      });
      setWallet({ address: accounts[0], contract, publicClient });
      closeWalletConnect();
    } else {
      const wallet = await connect(connector, config.network);
      setWallet(wallet);
      closeWalletConnect();
    }
  };

  /*useEffect(() => {
        // Check if user is previously connected
        const storedWallet = localStorage.getItem("wallet");
        if (storedWallet) {
            const parsedWallet: WalletConnect = JSON.parse(storedWallet);
            setWallet(parsedWallet);
        }
    }, []);*/

  useEffect(() => {
    /*// Save wallet to localStorage on connection
        if (wallet) {
            localStorage.setItem("wallet", JSON.stringify(wallet));
        } else {
            localStorage.removeItem("wallet");
        }*/
  }, [wallet]);

  const disconnectWallet = () => {
    setWallet(null);
  };

  return (
    <WalletConnectContext.Provider
      value={{
        isModalOpen,
        openWalletConnect,
        closeWalletConnect,
        wallet,
        disconnectWallet,
      }}
    >
      {children}
      <WalletConnectModal connectWallet={connectWallet} />
    </WalletConnectContext.Provider>
  );
};

const wallets = [
  ["leap", require("./assets/leap.png")],
  ["keplr", require("./assets/keplr.png")],
  ["fin", require("./assets/fin.png")],
  ["compass", require("./assets/compass.png")],
];

const WalletConnectModal = ({ connectWallet }: any) => {
  const { isModalOpen, closeWalletConnect } = useContext(WalletConnectContext);
  const { connectors: evmConnectors } = useConnect();

  const duration = 100;

  const defaultStyle = {
    transition: `opacity ${duration}ms ease-in-out`,
    opacity: 0,
  };

  const transitionStyles: any = {
    entering: { opacity: 1 },
    entered: { opacity: 1 },
    exiting: { opacity: 0 },
    exited: { opacity: 0 },
  };

  return (
    <Transition in={isModalOpen} timeout={duration} unmountOnExit>
      {(state) => (
        <C.Modal
          style={{
            ...defaultStyle,
            ...transitionStyles[state],
          }}
        >
          <C.Overlay onClick={closeWalletConnect}></C.Overlay>
          <C.Dialog>
            <C.DialogHeader>
              <C.DialogTitle>Connect SEI Wallet</C.DialogTitle>
              <C.CloseButton onClick={closeWalletConnect}>
                &times;
              </C.CloseButton>
            </C.DialogHeader>
            <C.DialogBody>
              {evmConnectors.map((connector) => (
                <C.Wallet
                  key={connector.id}
                  onClick={() => connectWallet(connector)}
                >
                  <C.WalletIcon src={connector.icon} />
                  <C.WalletName>{connector.name}</C.WalletName>
                </C.Wallet>
              ))}
              {wallets.map(([name, icon]) => (
                <C.Wallet key={name} onClick={() => connectWallet(name)}>
                  <C.WalletIcon src={icon} />
                  <C.WalletName>
                    {name.charAt(0).toUpperCase() + name.slice(1)}
                  </C.WalletName>
                </C.Wallet>
              ))}
            </C.DialogBody>
          </C.Dialog>
        </C.Modal>
      )}
    </Transition>
  );
};

const useWalletConnect = () => {
  const {
    isModalOpen,
    openWalletConnect,
    closeWalletConnect,
    wallet,
    disconnectWallet,
  } = useContext(WalletConnectContext);
  return {
    isModalOpen,
    openWalletConnect,
    closeWalletConnect,
    wallet,
    disconnectWallet,
  };
};

export { WalletConnectProvider, useWalletConnect };
