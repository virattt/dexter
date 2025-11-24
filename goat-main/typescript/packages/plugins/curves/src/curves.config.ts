import { Abi } from "viem";
import rawAbi from "./abi/curves.json";
import { CurvesOptions } from "./types";

const curvesAbi = rawAbi as unknown as Abi;

export class CurvesPluginConfigError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "CurvesPluginConfigError";
    }
}

export interface ValidatedConfig {
    curves: Required<CurvesOptions>;
}

export function validateConfig(opts?: CurvesOptions): ValidatedConfig {
    // Validation errors
    const errors: string[] = [];

    // Validate curves contract address
    const curvesAddress = opts?.address ?? process.env.CURVES_CONTRACT_ADDRESS;
    if (!curvesAddress) {
        errors.push("Curves contract address not found in plugin options or environment");
    }

    if (errors.length > 0) {
        throw new CurvesPluginConfigError(errors.join("\n"));
    }

    const curves: Required<CurvesOptions> = {
        address: curvesAddress,
        abi: opts?.abi ?? curvesAbi,
    } as Required<CurvesOptions>;

    return {
        curves,
    };
}
