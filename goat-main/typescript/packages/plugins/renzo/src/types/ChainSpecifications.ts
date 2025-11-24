import { Address } from "viem";
import { arbitrum, base, bsc, linea, mode } from "viem/chains";

export type ChainSpecifications = Record<
    number,
    {
        renzoDepositAddress: Address;
        l2EzEthAddress: Address;
    }
>;

const chainSpecifications: ChainSpecifications = {
    [mode.id]: {
        renzoDepositAddress: "0x4D7572040B84b41a6AA2efE4A93eFFF182388F88",
        l2EzEthAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5",
    },
    [base.id]: {
        renzoDepositAddress: "0xf25484650484de3d554fb0b7125e7696efa4ab99",
        l2EzEthAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5",
    },
    [arbitrum.id]: {
        renzoDepositAddress: "0xf25484650484de3d554fb0b7125e7696efa4ab99",
        l2EzEthAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5",
    },
    [bsc.id]: {
        renzoDepositAddress: "0xf25484650484de3d554fb0b7125e7696efa4ab99",
        l2EzEthAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5",
    },
    [linea.id]: {
        renzoDepositAddress: "0x4D7572040B84b41a6AA2efE4A93eFFF182388F88",
        l2EzEthAddress: "0x2416092f143378750bb29b79eD961ab195CcEea5",
    },
};

export function getRenzoAddresses(chainId: number) {
    const chainSpec = chainSpecifications[chainId];
    if (!chainSpec) {
        throw new Error(`Chain ID ${chainId} not supported`);
    }
    return {
        renzoDepositAddress: chainSpec.renzoDepositAddress,
        l2EzEthAddress: chainSpec.l2EzEthAddress,
    };
}
