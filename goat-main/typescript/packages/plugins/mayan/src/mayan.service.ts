import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { SolanaWalletClient } from "@goat-sdk/wallet-solana";
import {
    ChainName,
    Erc20Permit,
    Quote,
    addresses,
    createSwapFromSolanaInstructions,
    fetchQuote,
    fetchTokenList,
    getSwapFromEvmTxPayload,
} from "@mayanfinance/swap-sdk";
import { TypedDataDomain } from "abitype";
import { Signature, TypedDataEncoder } from "ethers";
import { parseAbi } from "viem";
import { EVMSwapParameters, SwapParameters } from "./parameters";

const ERC20_ABI = parseAbi([
    "function allowance(address owner, address spender) external view returns (uint256)",
    "function approve(address spender, uint256 amount) external returns (bool)",
    "function nonces(address owner) external returns (uint256)",
    "function name() external returns (string)",
    "function DOMAIN_SEPARATOR() external returns (bytes32)",
    "function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s)",
]);

export class MayanService {
    @Tool({
        name: "mayan_swap_from_solana",
        description: "Swap from solana to solana, EVM, sui chain",
    })
    async swapSolanaTool(walletClient: SolanaWalletClient, params: SwapParameters): Promise<string> {
        if (params.fromToken.length < 32) {
            params.fromToken = await this.findTokenContract(params.fromToken, "solana");
        }
        if (params.toToken.length < 32) {
            params.toToken = await this.findTokenContract(params.toToken, params.toChain);
        }

        const quotes = await fetchQuote({
            amount: +params.amount,
            fromChain: "solana",
            toChain: params.toChain as ChainName,
            fromToken: params.fromToken,
            toToken: params.toToken,
            slippageBps: params.slippageBps ?? "auto",
        });
        if (quotes.length === 0) {
            throw new Error("There is no quote available for the tokens you requested.");
        }

        const { instructions, signers, lookupTables } = await createSwapFromSolanaInstructions(
            quotes[0],
            walletClient.getAddress(),
            params.dstAddr,
            null,
            walletClient.getConnection(),
        );
        let hash: string;
        try {
            hash = (
                await walletClient.sendTransaction({
                    instructions,
                    addressLookupTableAddresses: lookupTables.map((a) => a.key.toString()),
                    accountsToSign: signers,
                })
            ).hash;
        } catch (error) {
            if (!hasSignatureProperty(error) || !error.signature) {
                throw error;
            }

            await new Promise((f) => setTimeout(f, 3000));
            hash = error.signature;
            const res = await fetch(`https://explorer-api.mayan.finance/v3/swap/trx/${hash}`);
            if (res.status !== 200) {
                throw error;
            }
        }

        return `https://explorer.mayan.finance/swap/${hash}`;
    }

    @Tool({
        name: "mayan_swap_from_evm",
        description: "Swap from EVM to solana, EVM, sui chain",
    })
    async swapEVMTool(walletClient: EVMWalletClient, params: EVMSwapParameters): Promise<string> {
        if (params.fromToken.length < 32) {
            params.fromToken = await this.findTokenContract(params.fromToken, params.fromChain);
        }
        if (params.toToken.length < 32) {
            params.toToken = await this.findTokenContract(params.toToken, params.toChain);
        }

        const quotes = await fetchQuote({
            amount: +params.amount,
            fromChain: params.fromChain as ChainName,
            toChain: params.toChain as ChainName,
            fromToken: params.fromToken,
            toToken: params.toToken,
            slippageBps: params.slippageBps ?? "auto",
        });
        if (quotes.length === 0) {
            throw new Error("There is no quote available for the tokens you requested.");
        }

        const amountIn = BigInt(quotes[0].effectiveAmountIn64);
        const allowance: bigint = (await this.callERC20(walletClient, params.fromToken, "allowance", [
            walletClient.getAddress(),
            addresses.MAYAN_FORWARDER_CONTRACT,
        ])) as bigint;
        if (allowance < amountIn) {
            // Approve the spender to spend the tokens
            const approveTx = (await this.callERC20(walletClient, params.fromToken, "approve", [
                addresses.MAYAN_FORWARDER_CONTRACT,
                amountIn,
            ])) as boolean;
            if (!approveTx) {
                throw new Error("couldn't get approve for spending allowance");
            }
        }

        let permit: Erc20Permit | undefined;
        if (quotes[0].fromToken.supportsPermit) {
            permit = await this.getERC20Permit(walletClient, quotes[0], amountIn);
        }

        const transactionReq = getSwapFromEvmTxPayload(
            quotes[0],
            walletClient.getAddress(),
            params.dstAddr,
            null,
            walletClient.getAddress(),
            walletClient.getChain().id,
            null,
            permit,
        );
        const { hash } = await walletClient.sendTransaction({
            to: transactionReq.to as string,
            value: transactionReq.value ? BigInt(transactionReq.value) : undefined,
            data: transactionReq.data ? (transactionReq.data as `0x${string}`) : undefined,
        });

        return `https://explorer.mayan.finance/swap/${hash}`;
    }

    //SuiKeyPairWalletClien isn't exported from @goat-sdk/wallet-sui
    //so I couldn't test this.
    //@Tool({
    //    name: "mayan_swap_from_sui",
    //    description: "Swap from sui to solana, EVM, sui chain",
    //})
    //async swapSUITool(
    //    walletClient: SuiWalletClient,
    //    params: SwapParameters
    //): Promise<string> {
    //    if (params.fromToken.length < 32) {
    //        params.fromToken = await this.findTokenContract(
    //            params.fromToken,
    //            "sui"
    //        );
    //    }
    //    if (params.toToken.length < 32) {
    //        params.toToken = await this.findTokenContract(
    //            params.toToken,
    //            params.toChain
    //        );
    //    }
    //
    //    const quotes = await fetchQuote({
    //        amount: +params.amount,
    //        fromChain: "sui",
    //        toChain: params.toChain as ChainName,
    //        fromToken: params.fromToken,
    //        toToken: params.toToken,
    //        slippageBps: params.slippageBps ?? "auto",
    //    });
    //    if (quotes.length === 0) {
    //        throw new Error(
    //            "There is no quote available for the tokens you requested."
    //        );
    //    }
    //
    //    const transaction = await createSwapFromSuiMoveCalls(
    //        quotes[0],
    //        walletClient.getAddress(),
    //        params.dstAddr,
    //        null,
    //        null,
    //        walletClient.getClient()
    //    );
    //    const { hash } = await walletClient.sendTransaction({ transaction });
    //
    //    return `https://explorer.mayan.finance/swap/${hash}`;
    //}

    private async findTokenContract(symbol: string, chain: string): Promise<string> {
        const tokens = await fetchTokenList(chain as ChainName, true);
        const token = tokens.find((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
        if (!token) {
            throw new Error(`Couldn't find token with ${symbol} symbol`);
        }

        return token.contract;
    }

    private async callERC20(
        walletClient: EVMWalletClient,
        contract: string,
        functionName: string,
        args?: unknown[],
    ): Promise<unknown> {
        const ret = await walletClient.read({
            address: contract,
            abi: ERC20_ABI,
            functionName,
            args,
        });
        return ret.value;
    }

    private async getERC20Permit(walletClient: EVMWalletClient, quote: Quote, amountIn: bigint): Promise<Erc20Permit> {
        const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
        const spender = addresses.MAYAN_FORWARDER_CONTRACT;
        const walletSrcAddr = walletClient.getAddress();
        const nonce = (await this.callERC20(walletClient, quote.fromToken.contract, "nonces", [
            walletSrcAddr,
        ])) as bigint;
        const name = (await this.callERC20(walletClient, quote.fromToken.contract, "name")) as string;

        const domain: TypedDataDomain = {
            name,
            version: "1",
            chainId: quote.fromToken.chainId,
            verifyingContract: quote.fromToken.contract as `0x${string}`,
        };
        const domainSeparator = (await this.callERC20(
            walletClient,
            quote.fromToken.contract,
            "DOMAIN_SEPARATOR",
        )) as string;
        for (let i = 1; i < 11; i++) {
            domain.version = String(i);
            const hash = TypedDataEncoder.hashDomain(domain);
            if (hash.toLowerCase() === domainSeparator.toLowerCase()) {
                break;
            }
        }

        const types = {
            Permit: [
                { name: "owner", type: "address" },
                { name: "spender", type: "address" },
                { name: "value", type: "uint256" },
                { name: "nonce", type: "uint256" },
                { name: "deadline", type: "uint256" },
            ],
        };
        const value = {
            owner: walletSrcAddr,
            spender,
            value: amountIn,
            nonce,
            deadline,
        };

        const { signature } = await walletClient.signTypedData({
            domain,
            types,
            primaryType: "Permit",
            message: value,
        });
        const { v, r, s } = Signature.from(signature);
        await this.callERC20(walletClient, quote.fromToken.contract, "permit", [
            walletSrcAddr,
            spender,
            amountIn,
            deadline,
            v,
            r,
            s,
        ]);

        return {
            value: amountIn,
            deadline,
            v,
            r,
            s,
        };
    }
}

function hasSignatureProperty(error: unknown): error is { signature?: string } {
    return typeof error === "object" && error !== null && "signature" in error;
}
