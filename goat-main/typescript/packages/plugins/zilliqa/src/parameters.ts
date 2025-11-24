import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class TransferParameters extends createToolParameters(
    z.object({
        toAddress: z
            .string()
            .describe(
                "The address to transfer ZIL to, from your Zilliqa address. This may be an EVM or a Zilliqa address, encoded in either hex or bech32 format",
            ),
        amount: z.string().describe("The amount of ZIL to send"),
    }),
) {}

export class AddressParameters extends createToolParameters(
    z.object({
        address: z
            .string()
            .describe("An account address, which may be EVM or Zilliqa, encoded in either hex or bech32 format"),
    }),
) {}
