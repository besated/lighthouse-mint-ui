import React, { useEffect } from "react";
import config from "./config.json";
import Home from "./home";
import { WalletConnectProvider } from "hooks/walletConnect";
import { Toaster } from "react-hot-toast";
import { color } from "styles/theme";
import { Hex2Rgba } from "utils/helpers";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "utils/evmConfig";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    document.title = config.name;
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <WalletConnectProvider>
          <Home />
          <Toaster
            position="top-center"
            reverseOrder={false}
            toastOptions={{
              style: {
                border: "1px solid " + color.black,
                color: color.white,
                background: Hex2Rgba(color.black, 0.95),
              },
            }}
          />
        </WalletConnectProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
};

export default App;
