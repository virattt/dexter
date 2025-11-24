import { createToolParameters } from "@goat-sdk/core";
import { z } from "zod";

export class CreateDLMMPositionParameters extends createToolParameters(
    z.object({
        poolAddress: z.string().describe("The pool address"),
        amount: z.string().describe("The amount of tokens to swap in the tokens base unit"),
    }),
) {}
