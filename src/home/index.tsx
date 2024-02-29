import { useState, useEffect, useRef } from "react";
import * as C from "./style";
import { useWalletConnect } from "hooks/walletConnect";
import config from "config.json";
import { Bg } from "styles/bg";
import Wallet, { DropdownItem } from "components/wallet";
import {
  getCosmWasmClient,
  getSigningCosmWasmClient,
  getStargateClient,
} from "@sei-js/core";
import { SigningCosmWasmClient } from "@cosmjs/cosmwasm-stargate";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faTwitter } from "@fortawesome/free-brands-svg-icons";
import { faCircleNotch, faGlobe } from "@fortawesome/free-solid-svg-icons";
import BigNumber from "bignumber.js";
import { Timer } from "components/timer";
import { GasPrice } from "@cosmjs/stargate";
import { toast } from "react-hot-toast";
import MintedModal from "components/mintedModal";
import axios from "axios";
import { isEvmWallet, shortenPublicKey } from "utils/helpers";
import { formatEther, hashMessage, recoverPublicKey, toHex } from "viem";
import { fromHex, toBech32 } from "@cosmjs/encoding";
import { rawSecp256k1PubkeyToRawAddress } from "@cosmjs/amino";
import { Secp256k1 } from "@cosmjs/crypto";

const LIGHTHOUSE_CONTRACT_ARCTIC_1 =
  "sei1x22q8lfhz7qcvtzs0dakhgx2th64l79kepjujhhxk5x804taeqlqa9e93f";
const LIGHTHOUSE_CONTRACT_ATLANTIC_2 =
  "sei12gjnfdh2kz06qg6e4y997jfgpat6xpv9dw58gtzn6g75ysy8yt5snzf4ac";
const LIGHTHOUSE_CONTRACT_PACIFIC_1 =
  "sei1hjsqrfdg2hvwl3gacg4fkznurf36usrv7rkzkyh29wz3guuzeh0snslz7d";

const getLighthouseContract = (network: string) => {
  if (network === "pacific-1") {
    return LIGHTHOUSE_CONTRACT_PACIFIC_1;
  } else if (network === "atlantic-2") {
    return LIGHTHOUSE_CONTRACT_ATLANTIC_2;
  } else if (network === "sei-chain") {
    return "sei1j5uc8aly825mnjl0napky8nxnnkmcqpl2lx8dud29xyhw2dmr24s6lquut";
  } else if (network === "arctic-1") {
    return LIGHTHOUSE_CONTRACT_ARCTIC_1;
  } else {
    throw new Error("Invalid network");
  }
};

var phaseTimer: any = {};
var interval: any = null;
var phaseSwitch = false;

const Home = () => {
  const { openWalletConnect, wallet, disconnectWallet } = useWalletConnect();

  const [loading, setLoading] = useState(true);
  const [collection, setCollection] = useState<any>(null);
  const [phases, setPhases] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<any>(null);

  const [amount, setAmount] = useState(1);
  const amountInput = useRef<any>(null);

  const [showMintedModal, setShowMintedModal] = useState(false);
  const [mintedInfo, setMintedInfo] = useState<any>({});
  const [balance, setBalance] = useState("");

  useEffect(() => {
    refresh();
    clearInterval(interval);

    interval = setInterval(() => {
      refresh();
    }, 5000);

    return () => {
      clearInterval(interval);
    };
  }, [wallet]);

  useEffect(() => {}, []);

  const getAddress = () => {
    if (!wallet) {
      return "";
    }
    if (isEvmWallet(wallet)) {
      return wallet.address;
    } else {
      return wallet.accounts[0].address;
    }
  };

  const getBalance = async () => {
    const address = getAddress();
    if (!wallet || !address) {
      return;
    }
    if (isEvmWallet(wallet)) {
      const balance = await wallet.publicClient.getBalance({
        address: wallet.address,
      });
      setBalance(formatEther(balance));
      return;
    }

    const client = await getStargateClient(config.rpc);
    const balance = await client.getBalance(address, "usei");
    setBalance(new BigNumber(balance.amount).div(1e6).toString());
  };

  const refresh = async () => {
    const client = await SigningCosmWasmClient.connect(config.rpc);
    client
      .queryContractSmart(getLighthouseContract(config.network), {
        get_collection: { collection: config.collection_address },
      })
      .then((result) => {
        // console.log(result);
        let collectionData: any = {
          supply: result.supply,
          mintedSupply: result.next_token_id - result.start_order,
          phases: [],
          tokenUri: result.token_uri,
          name: result.name,
          hidden_metadata: result.hidden_metadata,
          placeholder_token_uri: result.placeholder_token_uri,
          iterated_uri: result.iterated_uri,
        };

        for (let i = 0; i < config.groups.length; i++) {
          for (let j = 0; j < result.mint_groups.length; j++) {
            let group = result.mint_groups[j];
            let groupConfig: any = config.groups[i];
            if (
              groupConfig.name.toLowerCase().trim() ===
              group.name.toLowerCase().trim()
            ) {
              collectionData.phases.push({
                ...group,
                allowlist: groupConfig.allowlist,
              });
            }
          }
        }

        setCollection(collectionData);
        managePhases(collectionData.phases);
        getBalance();
        setLoading(false);
        client.disconnect();
      });
  };

  const managePhases = (phases: any[]) => {
    let currentPhase = null;

    for (let i = 0; i < phases.length; i++) {
      let phase = phases[i];

      phase.start_time *= 1000;
      phase.end_time = phase.end_time === 0 ? 0 : phase.end_time * 1000;

      let start = new Date(phase.start_time);
      let end = new Date(phase.end_time);
      let now = new Date();

      if (phase.end_time === 0) end = new Date(32503680000000);

      if (end.getTime() - start.getTime() > 31536000000) phases[i].noend = true;
      else phases[i].noend = false;

      if (now > start && now < end) currentPhase = phase;
    }

    if (currentPhase === null) {
      let closest = null;
      for (let i = 0; i < phases.length; i++) {
        let phase = phases[i];
        let start = new Date(phase.start_time);

        if (closest === null) closest = phase;
        else {
          let closestStart = new Date(closest.start_time);
          if (start < closestStart) closest = phase;
        }
      }

      currentPhase = closest;
    }

    //order phases by start date
    phases.sort((a: any, b: any) => {
      let aStart = new Date(a.start_time);
      let bStart = new Date(b.start_time);

      if (aStart < bStart) {
        return -1;
      } else if (aStart > bStart) {
        return 1;
      } else {
        return 0;
      }
    });

    if (phaseTimer.name !== currentPhase.name) {
      if (phaseTimer.timeout) clearTimeout(phaseTimer.timeout);

      const now = new Date();
      const start = new Date(currentPhase.start_time);
      const end = new Date(currentPhase.end_time);

      phaseTimer.name = currentPhase.name;

      if (now > start && now < end) {
        if (end.getTime() - now.getTime() < 31536000000) {
          phaseTimer.timeout = setTimeout(() => {
            refresh();
            phaseTimer.timeout = null;
            phaseTimer.name = null;
          }, new Date(currentPhase.end_time).getTime() - new Date().getTime());
        } else {
          currentPhase.noend = true;
        }
      } else if (now < start) {
        phaseTimer.timeout = setTimeout(() => {
          managePhases(phases);
          refresh();
          phaseTimer.timeout = null;
          phaseTimer.name = null;
        }, new Date(currentPhase.start_time).getTime() - new Date().getTime());
      } else if (now > end) {
        //past phase
      }
    }

    setPhases(phases);
    if (!phaseSwitch) {
      setCurrentPhase(currentPhase);
    }
  };

  const switchPhase = (phase: any) => {
    if (
      (!phase.noend && new Date(phase.end_time) < new Date()) ||
      phase.name === currentPhase.name
    )
      return;

    setCurrentPhase(phase);
    phaseSwitch = true;
  };

  const incrementAmount = () => {
    amountInput.current.value = amount + 1;
    setAmount(amount + 1);
  };

  const decrementAmount = () => {
    if (amount > 1) {
      amountInput.current.value = amount - 1;
      setAmount(amount - 1);
    }
  };

  const onAmountChange = () => {
    let value = amountInput.current.value;
    if (value === "") value = 1;
    try {
      setAmount(parseInt(value));
    } catch (e) {}
  };

  const getMintInstructions = (lighthouseConfig: any, recipient: string) => {
    const instruction: any = {
      contractAddress: getLighthouseContract(config.network),
      msg: {
        mint_native: {
          collection: config.collection_address,
          group: currentPhase.name,
          recipient,
        },
      },
    };
    if (currentPhase.unit_price !== "0" || currentPhase.unit_price !== 0) {
      instruction.funds = [
        {
          denom: "usei",
          amount: new BigNumber(currentPhase.unit_price)
            .plus(new BigNumber(lighthouseConfig.fee))
            .toString(),
        },
      ];
    }

    let instructions = [];
    for (let i = 0; i < amount; i++) {
      instructions.push(instruction);
    }
    return instructions;
  };

  const handleEvmMint = async (lighthouseConfig: any): Promise<string[]> => {
    if (!wallet || !isEvmWallet(wallet)) {
      return [];
    }

    let seiAddress = "";
    try {
      seiAddress = await wallet.publicClient.request({
        method: "sei_getSeiAddress" as any,
        params: [wallet.address],
      });
    } catch (e) {
      console.log("Error fetching address", e);
    }

    if (!seiAddress) {
      const message = "Get pubkey";
      const signature = await wallet.walletClient.signMessage({
        account: wallet.address,
        message: message,
      });
      const pubKey = await recoverPublicKey({
        hash: hashMessage(message),
        signature,
      });
      const compressedPubKey = Secp256k1.compressPubkey(
        fromHex(pubKey.substring(2))
      );
      seiAddress = toBech32(
        "sei",
        rawSecp256k1PubkeyToRawAddress(compressedPubKey)
      );
    }
    console.log(seiAddress);
    const instructions = getMintInstructions(lighthouseConfig, seiAddress);
    const instruction = instructions[0];
    const txHash = await wallet.contract.write.execute([
      instruction.contractAddress,
      toHex(JSON.stringify(instruction.msg)),
      toHex(JSON.stringify(instruction.funds)),
    ]);
    const tx = await wallet.publicClient.waitForTransactionReceipt({
      hash: txHash,
    });
    console.log(tx);

    // We don't get logs from the EVM tx, so will have to get minted tokens from the contract itself
    const client = await getCosmWasmClient(config.rpc);
    const { tokens } = await client.queryContractSmart(
      config.collection_address,
      { tokens: { owner: seiAddress } }
    );
    return tokens.slice(-amount);
  };

  const handleWasmMint = async (lighthouseConfig: any): Promise<string[]> => {
    if (!wallet || isEvmWallet(wallet)) {
      return [];
    }

    const seiAddress = wallet.accounts[0].address;
    const instructions = getMintInstructions(lighthouseConfig, seiAddress);
    const signingClient = await getSigningCosmWasmClient(
      config.rpc,
      wallet.offlineSigner,
      {
        gasPrice: GasPrice.fromString("0.01usei"),
      }
    );

    const mintReceipt = await signingClient.executeMultiple(
      wallet!.accounts[0].address,
      instructions,
      "auto"
    );

    const tokenIds: string[] = [];
    const logs = mintReceipt.logs;
    for (const log of logs) {
      const events = log.events;
      for (const event of events) {
        if (event.type === "wasm") {
          // Find the attribute with the key 'collection'
          for (const attribute of event.attributes) {
            if (attribute.key === "token_id") {
              tokenIds.push(attribute.value);
              break;
            }
          }
        }
      }
    }
    return tokenIds;
  };

  const mint = async () => {
    if (wallet === null) return openWalletConnect();

    //check if amount is larger than max tokens
    if (currentPhase.max_tokens > 0 && amount > currentPhase.max_tokens) {
      toast.error(
        "You can only mint " + currentPhase.max_tokens + " tokens per wallet"
      );
      return;
    }

    //check if amount is larger than remaining tokens
    if (amount > collection.supply - collection.mintedSupply) {
      toast.error(
        "There are only " +
          (collection.supply - collection.mintedSupply) +
          " tokens left"
      );
      return;
    }

    //check if current phase is active
    if (new Date(currentPhase.start_time) > new Date()) {
      toast.error("This phase has not started yet");
      return;
    }

    //check if current phase has ended
    if (!currentPhase.noend && new Date(currentPhase.end_time) < new Date()) {
      toast.error("This phase has ended");
      return;
    }

    // TODO: Can we mint more than one?
    if (amount > 1) {
      toast.error("Can't mint more than one");
      return;
    }

    //load client
    const client = await getCosmWasmClient(config.rpc);

    let lighthouseConfig = await client.queryContractSmart(
      getLighthouseContract(config.network),
      { get_config: {} }
    );

    const loading = toast.loading("Minting...");
    try {
      let tokenIds: string[] = [];
      if (isEvmWallet(wallet)) {
        tokenIds = await handleEvmMint(lighthouseConfig);
      } else {
        tokenIds = await handleWasmMint(lighthouseConfig);
      }
      if (!tokenIds.length) {
        throw new Error("Mint failed");
      }
      toast.dismiss(loading);
      toast.success("Minted successfully");

      refresh();

      loadNowMintedMetadata(tokenIds)
        .then((metadata: any) => {
          setMintedInfo({ mints: metadata });
          setShowMintedModal(true);
        })
        .catch((e) => {
          setMintedInfo({ mints: tokenIds });
          setShowMintedModal(true);
          console.log(e);
        });
    } catch (e: any) {
      toast.dismiss(loading);
      if (e.message.includes("Max Tokens Minted"))
        toast.error(
          "You can only mint " +
            currentPhase.max_tokens +
            " tokens per wallet for this phase"
        );
      else if (e.message !== "Transaction declined") toast.error("Mint failed");

      console.log(e);
    }
  };

  const loadNowMintedMetadata = async (mints: any) =>
    new Promise(async (resolve, reject) => {
      let metadata: any[] = [];
      let promises: any[] = [];

      if (!collection.hidden_metadata) {
        if (!collection.iterated_uri) {
          for (let i = 0; i < mints.length; i++) {
            promises.push(
              axios
                .get(`${collection.tokenUri}/${mints[i]}`)
                .then((response) => response.data)
            );
          }

          Promise.all(promises)
            .then((results) => {
              //merge with myMintedNfts
              mints.forEach((mint: any, index: number) => {
                metadata.push({
                  mint: mint,
                  data: results[index],
                });
              });

              resolve(metadata);
            })
            .catch((e) => {
              reject(e);
            });
        } else {
          let tokenurimetadata = await axios
            .get(collection.tokenUri)
            .then((response) => response.data);

          for (let i = 0; i < mints.length; i++) {
            metadata.push({
              mint: mints[i],
              data: {
                ...tokenurimetadata,
                name: collection.name + " #" + mints[i],
              },
            });
          }

          resolve(metadata);
        }
      } else {
        let placeholder_metadata = await axios
          .get(collection.placeholder_token_uri)
          .then((response) => response.data);

        for (let i = 0; i < mints.length; i++) {
          metadata.push({
            mint: mints[i],
            data: {
              ...placeholder_metadata,
              name: collection.name + " #" + mints[i],
            },
          });
        }

        resolve(metadata);
      }
    });
  return (
    <C.Home>
      <C.Bg>
        <Bg />
      </C.Bg>
      <C.Container>
        <C.Header>
          <C.Logo src="/images/logo.png" />
          {wallet === null && (
            <C.WalletConnect onClick={openWalletConnect}>
              Connect Wallet
            </C.WalletConnect>
          )}
          {wallet !== null && (
            <Wallet balance={balance + " SEI"} address={getAddress()}>
              <DropdownItem
                onClick={() => navigator.clipboard.writeText(getAddress())}
              >
                Copy Address
              </DropdownItem>
              <DropdownItem
                onClick={() => {
                  disconnectWallet();
                  openWalletConnect();
                }}
              >
                Change Wallet
              </DropdownItem>
              <DropdownItem onClick={disconnectWallet}>Disconnect</DropdownItem>
            </Wallet>
          )}
        </C.Header>
        <C.Launch>
          {loading && (
            <C.Loading>
              <FontAwesomeIcon icon={faCircleNotch} spin />
            </C.Loading>
          )}

          {!loading && (
            <>
              <C.LaunchBg></C.LaunchBg>
              <C.LaunchInfo>
                <C.Title>{config.name}</C.Title>
                <C.TotalMinted>
                  <C.TotalMintedInfo>
                    <C.TotalMintedTitle>TOTAL MINTED</C.TotalMintedTitle>
                    <C.TotalMintedValue>
                      {Math.floor(
                        (collection.mintedSupply / collection.supply) *
                          100 *
                          100
                      ) / 100}
                      %{" "}
                      <span>
                        {collection.mintedSupply}/{collection.supply}
                      </span>
                    </C.TotalMintedValue>
                  </C.TotalMintedInfo>
                  <C.TotalMintedProgress
                    value={
                      Math.floor(
                        (collection.mintedSupply / collection.supply) *
                          100 *
                          100
                      ) / 100
                    }
                  ></C.TotalMintedProgress>
                </C.TotalMinted>

                <C.Description>{config.description}</C.Description>

                {(config.website || config.twitter || config.discord) && (
                  <C.Links>
                    {config.website && (
                      <C.Link
                        href={config.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FontAwesomeIcon icon={faGlobe} />
                      </C.Link>
                    )}
                    {config.twitter && (
                      <C.Link
                        href={config.twitter}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FontAwesomeIcon icon={faTwitter} />
                      </C.Link>
                    )}
                    {config.discord && (
                      <C.Link
                        href={config.discord}
                        target="_blank"
                        rel="noreferrer"
                      >
                        <FontAwesomeIcon icon={faDiscord} />
                      </C.Link>
                    )}
                  </C.Links>
                )}

                <C.Phases>
                  {phases.map((phase, index) => (
                    <C.Phase
                      key={index}
                      active={
                        currentPhase.name === phase.name ? "true" : "false"
                      }
                      switch={
                        !(!phase.noend && new Date(phase.end_time) < new Date())
                          ? "true"
                          : "false"
                      }
                      onClick={() => switchPhase(phase)}
                    >
                      <C.PhaseTop>
                        <C.PhaseTitle>{phase.name}</C.PhaseTitle>
                        {!phase.noend && (
                          <>
                            {new Date(phase.start_time) < new Date() &&
                              new Date(phase.end_time) > new Date() && (
                                <C.PhaseDate>
                                  <span>Ends In</span>{" "}
                                  <Timer date={phase.end_time} />
                                </C.PhaseDate>
                              )}
                          </>
                        )}
                        {new Date(phase.start_time) > new Date() && (
                          <C.PhaseDate>
                            <span>Starts In</span>{" "}
                            <Timer date={phase.start_time} />
                          </C.PhaseDate>
                        )}
                      </C.PhaseTop>
                      <C.PhaseBottom>
                        {phase.max_tokens > 0
                          ? phase.max_tokens + " Per Wallet •"
                          : ""}{" "}
                        {new BigNumber(phase.unit_price).div(1e6).toString()}{" "}
                        SEI
                      </C.PhaseBottom>
                      {!phase.noend &&
                        new Date(phase.end_time) < new Date() && (
                          <C.PhaseBadge>Ended</C.PhaseBadge>
                        )}
                    </C.Phase>
                  ))}
                </C.Phases>
              </C.LaunchInfo>
              <C.Mid></C.Mid>
              <C.LaunchMint>
                <C.TitleMobile>{config.name}</C.TitleMobile>
                <C.Image>
                  <img src="/images/launch.png" alt="launch" />
                </C.Image>
                <C.MintInfo>
                  <C.Price>
                    Price:{" "}
                    <span>
                      {new BigNumber(currentPhase.unit_price)
                        .div(1e6)
                        .times(amount)
                        .toString()}{" "}
                      SEI
                    </span>
                  </C.Price>
                  <C.Amount>
                    <C.AmountButton onClick={decrementAmount}>
                      &minus;
                    </C.AmountButton>
                    <C.AmountValue
                      ref={amountInput}
                      type="number"
                      step="1"
                      min={1}
                      defaultValue={1}
                      onChange={onAmountChange}
                    />
                    <C.AmountButton onClick={incrementAmount}>
                      &#43;
                    </C.AmountButton>
                  </C.Amount>
                </C.MintInfo>
                <C.MintButton
                  onClick={mint}
                  disabled={collection.supply - collection.mintedSupply <= 0}
                >
                  {collection.supply - collection.mintedSupply <= 0
                    ? "Sold Out!"
                    : "Mint"}
                </C.MintButton>
              </C.LaunchMint>
            </>
          )}
        </C.Launch>
        <C.CollectionAddresses>
          <div>Collection Addresses:</div>
          <C.CollectionAddress
            href={`https://seistream.app/account/${config.collection_address}`}
            target="_blank"
            rel="noopener"
          >
            {shortenPublicKey(config.collection_address)}
          </C.CollectionAddress>
          <C.CollectionAddress
            href={`https://seitrace.com/address/${config.evm_collection_address}`}
            target="_blank"
            rel="noopener"
          >
            {shortenPublicKey(config.evm_collection_address)}
          </C.CollectionAddress>
        </C.CollectionAddresses>
      </C.Container>

      {showMintedModal && (
        <MintedModal
          close={() => setShowMintedModal(false)}
          name={collection.name}
          mints={mintedInfo.mints}
          tokenUri={collection.tokenUri}
        />
      )}
    </C.Home>
  );
};

export default Home;
