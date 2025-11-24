import { Tool } from "@goat-sdk/core";
import { ConstructableNodeToken, Uploader } from "@irys/upload";
import {
    Arbitrum,
    Avalanche,
    BNB,
    BaseEth,
    Bera,
    Chainlink,
    Ethereum,
    Iotex,
    LineaEth,
    Matic,
    ScrollEth,
    USDCEth,
    USDCPolygon,
} from "@irys/upload-ethereum";
import {
    DownloadDataParameters,
    FundAccountParameters,
    FundResponse,
    UploadDataParameters,
    UploadFileParameters,
    UploadFolderParameters,
    UploadResponse,
} from "./parameters";
import type { IrysPluginOptions } from "./types/IrysPluginOptions";

export class IrysService {
    private privateKey: string;
    private network: string;
    private rpcURL: string;
    private tokenConstructor: ConstructableNodeToken;
    private baseUrl = "https://gateway.irys.xyz";

    constructor(parameters: IrysPluginOptions) {
        this.privateKey = parameters.privateKey;
        this.network = parameters.network ?? "testnet";
        this.rpcURL = parameters.rpcURL ?? "https://eth-mainnet.public.blastapi.io";

        // The token is obtained from the parameter; by default 'ethereum' is used.
        const tokenName = parameters.paymentToken?.toLowerCase() ?? "ethereum";
        // Mapping dictionary between names and imported tokens.
        const tokenMapping: { [key: string]: ConstructableNodeToken } = {
            ethereum: Ethereum,
            matic: Matic,
            bnb: BNB,
            avalanche: Avalanche,
            baseeth: BaseEth,
            usdceth: USDCEth,
            arbitrum: Arbitrum,
            chainlink: Chainlink,
            usdcpolygon: USDCPolygon,
            bera: Bera,
            scrolleth: ScrollEth,
            lineaeth: LineaEth,
            iotex: Iotex,
        };
        const tokenConstructor = tokenMapping[tokenName];
        if (!tokenConstructor) {
            throw new Error(`Token '${tokenName}' not supported`);
        }
        this.tokenConstructor = tokenConstructor;
    }

    private async getIrysUploader() {
        try {
            if (this.network === "testnet") {
                const irysUploader = await Uploader(this.tokenConstructor).withWallet(this.privateKey);
                return irysUploader;
            }

            const irysUploader = await Uploader(this.tokenConstructor)
                .withWallet(this.privateKey)
                .withRpc(this.rpcURL)
                .devnet();
            return irysUploader;
        } catch (error) {
            console.error("Error getting Irys uploader", error);
            throw error;
        }
    }

    @Tool({
        name: "fund_irys_account",
        description: "Fund your account on the Irys network",
    })
    async fundAccount(parameters: FundAccountParameters): Promise<FundResponse | Error> {
        const { amount } = parameters;
        const irysUploader = await this.getIrysUploader();

        try {
            const fundTx = await irysUploader.fund(irysUploader.utils.toAtomic(amount));
            return {
                id: fundTx.id,
                quantity: Number(irysUploader.utils.fromAtomic(fundTx.quantity)),
                reward: Number(irysUploader.utils.fromAtomic(fundTx.reward)),
                target: fundTx.target,
                token: irysUploader.token,
            };
        } catch (e) {
            console.log("Error when funding ", e);
            throw new Error(`Error when funding: ${e}`);
        }
    }

    @Tool({
        name: "upload_data",
        description: "Upload data to the Irys network",
    })
    async uploadData(parameters: UploadDataParameters): Promise<UploadResponse | Error> {
        const dataToUpload = parameters.data;
        const irysUploader = await this.getIrysUploader();

        try {
            const receipt = await irysUploader.upload(dataToUpload);
            return {
                id: receipt.id,
            };
        } catch (e) {
            console.log("Error when uploading ", e);
            throw new Error(`Error when uploading: ${e}`);
        }
    }

    @Tool({
        name: "upload_file",
        description: "Upload a file to the Irys network",
    })
    async uploadFile(parameters: UploadFileParameters): Promise<UploadResponse | Error> {
        const { filePath, name, value } = parameters;
        const irysUploader = await this.getIrysUploader();

        const tags = [{ name: name, value: value }];

        try {
            const receipt = await irysUploader.uploadFile(filePath, {
                tags: tags,
            });
            return {
                id: receipt.id,
            };
        } catch (e) {
            console.log("Error when uploading ", e);
            throw new Error(`Error when uploading: ${e}`);
        }
    }

    @Tool({
        name: "upload_folder",
        description: "Upload the contents of a folder to the Irys network",
    })
    async uploadFolder(parameters: UploadFolderParameters): Promise<UploadResponse | Error> {
        const { folderPath, indexFile, batchSize, keepDeleted } = parameters;
        const irysUploader = await this.getIrysUploader();

        try {
            const receipt = await irysUploader.uploadFolder(`./${folderPath}`, {
                indexFile: indexFile,
                batchSize: batchSize,
                keepDeleted: keepDeleted,
            }); // Returns the manifest ID

            if (receipt) {
                return {
                    id: receipt.id,
                };
            }

            throw new Error("Error when uploading");
        } catch (e) {
            console.log("Error when uploading ", e);
            throw new Error(`Error when uploading: ${e}`);
        }
    }

    @Tool({
        name: "download_data",
        description: "Download data from the Irys network",
    })
    async downloadData(parameters: DownloadDataParameters) {
        const transactionId = parameters.transactionId;

        try {
            const response = await fetch(`${this.baseUrl}/${transactionId}`);
            if (!response.ok) {
                throw new Error(`HTTP status ${response.status}`);
            }

            const fileUrl = response.url;

            const fileResponse = await fetch(fileUrl);

            if (!fileResponse.ok) {
                throw new Error(`HTTP status ${fileResponse.status}`);
            }

            // Detect content type
            const contentType = fileResponse.headers.get("content-type");

            if (contentType?.includes("application/json")) {
                return {
                    data: await fileResponse.json(),
                    type: "json",
                    url: fileUrl,
                };
            }

            if (contentType?.includes("text")) {
                return {
                    data: await fileResponse.text(),
                    type: "text",
                    url: fileUrl,
                };
            }

            const blob = await fileResponse.blob();

            if (contentType?.includes("image")) {
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () =>
                        resolve({
                            data: reader.result as string,
                            type: "image",
                            contentType,
                            url: fileUrl,
                        });
                    reader.onerror = reject;
                    reader.readAsDataURL(blob); // Convert image Blob to Base64
                });
            }

            return {
                data: await blob.text(),
                type: "blob-text",
                contentType,
                url: fileUrl,
            }; // Return raw text from Blob
        } catch (e) {
            console.error("Error when downloading ", e);
            throw new Error(`Error when downloading: ${e}`);
        }
    }
}
