import { IrysPaymentToken } from "../parameters";

export type IrysNetwork = "testnet" | "devnet";

export interface IrysPluginOptions {
    privateKey: string;
    paymentToken?: IrysPaymentToken;
    network?: IrysNetwork;
    rpcURL?: string; // Only required for devnet
}
