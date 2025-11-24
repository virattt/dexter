import { Tool } from "@goat-sdk/core";
import { EVMWalletClient } from "@goat-sdk/wallet-evm";
import { CFA_FORWARDER_ABI, GDA_FORWARDER_ABI, POOL_ABI } from "./abi";
import {
    FlowParameters,
    GetFlowrateParameters,
    GetMemberFlowRateParameters,
    GetNetFlowRateParameters,
    GetTotalFlowRateParameters,
    GetUnitsParameters,
    UpdateMemberUnitsParameters,
} from "./parameters";

export class SuperfluidService {
    private readonly CFA_FORWARDER_ADDRESS = "0xcfA132E353cB4E398080B9700609bb008eceB125";
    private readonly GDA_FORWARDER_ADDRESS = "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08";

    @Tool({
        name: "create_or_update_or_delete_flow",
        description: "Create, update, or delete a flow of tokens from sender to receiver",
    })
    async flow(walletClient: EVMWalletClient, parameters: FlowParameters) {
        try {
            const hash = await walletClient.sendTransaction({
                to: this.CFA_FORWARDER_ADDRESS,
                abi: CFA_FORWARDER_ABI,
                functionName: "setFlowrate",
                args: [parameters.token, parameters.receiver, parameters.flowrate],
            });
            return hash.hash;
        } catch (error) {
            throw Error(`Failed to set flow: ${error}`);
        }
    }

    @Tool({
        name: "get_flow_rate",
        description: "Get the current flowrate between a sender and receiver for a specific token",
    })
    async getFlowrate(walletClient: EVMWalletClient, parameters: GetFlowrateParameters) {
        const result = await walletClient.read({
            address: this.CFA_FORWARDER_ADDRESS,
            abi: CFA_FORWARDER_ABI,
            functionName: "getFlowrate",
            args: [parameters.token, parameters.sender, parameters.receiver],
        });
        return Number(result.value);
    }

    @Tool({
        name: "update_member_units",
        description: "Update the units for a member in a Superfluid Pool",
    })
    async updateMemberUnits(walletClient: EVMWalletClient, parameters: UpdateMemberUnitsParameters) {
        try {
            const hash = await walletClient.sendTransaction({
                to: parameters.poolAddress,
                abi: POOL_ABI,
                functionName: "updateMemberUnits",
                args: [parameters.memberAddr, parameters.newUnits],
            });
            return hash.hash;
        } catch (error) {
            throw Error(`Failed to update member units: ${error}`);
        }
    }

    @Tool({
        name: "get_member_units",
        description: "Get the units of a member in a Superfluid Pool",
    })
    async getUnits(walletClient: EVMWalletClient, parameters: GetUnitsParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getUnits",
            args: [parameters.memberAddr],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_member_flow_rate",
        description: "Get the flow rate of a member in a Superfluid Pool",
    })
    async getMemberFlowRate(walletClient: EVMWalletClient, parameters: GetMemberFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getMemberFlowRate",
            args: [parameters.memberAddr],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_total_flow_rate",
        description: "Get the total flow rate of a Superfluid Pool",
    })
    async getTotalFlowRate(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalFlowRate",
            args: [],
        });
        return Number(result.value);
    }

    @Tool({
        name: "is_member_connected",
        description: "Check if the specified member is connected to a Superfluid Pool",
    })
    async isMemberConnected(walletClient: EVMWalletClient, parameters: GetUnitsParameters) {
        const result = await walletClient.read({
            address: this.GDA_FORWARDER_ADDRESS,
            abi: GDA_FORWARDER_ABI,
            functionName: "isMemberConnected",
            args: [parameters.memberAddr],
        });
        return result.value;
    }

    @Tool({
        name: "get_net_flow",
        description: "Get the net flow of a specific token for an account",
    })
    async getNetFlow(walletClient: EVMWalletClient, parameters: GetNetFlowRateParameters) {
        const result = await walletClient.read({
            address: this.GDA_FORWARDER_ADDRESS,
            abi: POOL_ABI,
            functionName: "getNetFlow",
            args: [parameters.token, parameters.memberAddr],
        });
        return Number(result.value);
    }

    @Tool({
        name: "transferability_for_units_owner",
        description: "Check if pool members can transfer their units",
    })
    async transferabilityForUnitsOwner(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "transferabilityForUnitsOwner",
            args: [],
        });
        return result.value;
    }

    @Tool({
        name: "distribution_from_any_address",
        description: "Check if addresses other than the pool admin can distribute via the pool",
    })
    async distributionFromAnyAddress(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "distributionFromAnyAddress",
            args: [],
        });
        return result.value;
    }

    @Tool({
        name: "admin",
        description: "Get the pool admin",
    })
    async admin(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "admin",
            args: [],
        });
        return result.value;
    }

    @Tool({
        name: "super_token",
        description: "Get the SuperToken for the pool",
    })
    async superToken(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "superToken",
            args: [],
        });
        return result.value;
    }

    @Tool({
        name: "get_total_units",
        description: "Get the total units of the pool",
    })
    async getTotalUnits(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalUnits",
            args: [],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_total_connected_units",
        description: "Get the total number of units of connected members",
    })
    async getTotalConnectedUnits(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalConnectedUnits",
            args: [],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_total_disconnected_units",
        description: "Get the total number of units of disconnected members",
    })
    async getTotalDisconnectedUnits(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalDisconnectedUnits",
            args: [],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_total_connected_flow_rate",
        description: "Get the flow rate of the connected members",
    })
    async getTotalConnectedFlowRate(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalConnectedFlowRate",
            args: [],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_total_disconnected_flow_rate",
        description: "Get the flow rate of the disconnected members",
    })
    async getTotalDisconnectedFlowRate(walletClient: EVMWalletClient, parameters: GetTotalFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalDisconnectedFlowRate",
            args: [],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_total_amount_received_by_member",
        description: "Get the total amount received by a member in the pool",
    })
    async getTotalAmountReceivedByMember(walletClient: EVMWalletClient, parameters: GetMemberFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getTotalAmountReceivedByMember",
            args: [parameters.memberAddr],
        });
        return Number(result.value);
    }

    @Tool({
        name: "get_claimable_now",
        description: "Get the claimable balance for a member at the current time in the pool",
    })
    async getClaimableNow(walletClient: EVMWalletClient, parameters: GetMemberFlowRateParameters) {
        const result = await walletClient.read({
            address: parameters.poolAddress,
            abi: POOL_ABI,
            functionName: "getClaimableNow",
            args: [parameters.memberAddr],
        });
        return Number(result.value);
    }
}
