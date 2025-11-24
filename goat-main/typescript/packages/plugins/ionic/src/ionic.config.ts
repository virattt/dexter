export interface IonicProtocolAddresses {
    assets: {
        [symbol: string]: {
            address?: `0x${string}`;
            decimals?: number;
        };
    };
    PoolDirectory?: `0x${string}`;
    PoolLens?: `0x${string}`;
    Comptroller?: `0x${string}`;
    PriceOracle?: `0x${string}`;
}

export const ionicProtocolAddresses: {
    [chainId: number]: IonicProtocolAddresses;
} = {
    // Mode Chain
    34443: {
        assets: {
            ionUSDC: { address: "0x2BE717340023C9e14C1Bb12cb3ecBcfd3c3fB038", decimals: 6 },
            ionWETH: { address: "0x71ef7EDa2Be775E5A7aa8afD02C45F059833e9d2", decimals: 18 },
            ionMODE: { address: "0xe77fb5c088b194c46695780322d39c791d5ada16", decimals: 18 },
            ionEzETH: { address: "0x59e710215d45F584f44c0FEe83DA6d43D762D857", decimals: 18 },
            ionSTONE: { address: "0x959FA710CCBb22c7Ce1e59Da82A247e686629310", decimals: 18 },
            ionWrsETH: { address: "0x49950319aBE7CE5c3A6C90698381b45989C99b46", decimals: 18 },
            ionWeETH: { address: "0xA0D844742B4abbbc43d8931a6Edb00C56325aA18", decimals: 18 },
            iondMBTC: { address: "0x5158ae44C1351682B3DC046541Edf84BF28c8ca4", decimals: 18 },
        },
        PoolDirectory: "0x39C353Cf9041CcF467A04d0e78B63d961E81458a", // Mode PoolDirectory
        PoolLens: "0x70BB19a56BfAEc65aE861E6275A90163AbDF36a6", // Mode PoolLens
        Comptroller: "0xfb3323e24743caf4add0fdccfb268565c0685556",
        PriceOracle: "0x2BAF3A2B667A5027a83101d218A9e8B73577F117",
    },
    // Base Chain
    8453: {
        assets: {
            ionEzETH: { address: "0x079f84161642D81aaFb67966123C9949F9284bf5", decimals: 18 },
            ionWstETH: { address: "0x9D62e30c6cB7964C99314DCf5F847e36Fcb29ca9", decimals: 18 },
            ionCbETH: { address: "0x9c201024A62466F9157b2dAaDda9326207ADDd29", decimals: 18 },
            ionAERO: { address: "0x014e08F05ac11BB532BE62774A4C548368f59779", decimals: 18 },
            ionUSDC: { address: "0xa900A17a49Bc4D442bA7F72c39FA2108865671f0", decimals: 6 },
            ionWETH: { address: "0x49420311B518f3d0c94e897592014de53831cfA3", decimals: 18 },
            ionWeETH: { address: "0x84341B650598002d427570298564d6701733c805", decimals: 18 },
            ionEUSD: { address: "0x9c2A4f9c5471fd36bE3BBd8437A33935107215A1", decimals: 18 },
            ionBsdETH: { address: "0x3D9669DE9E3E98DB41A1CbF6dC23446109945E3C", decimals: 18 },
            ionHyUSD: { address: "0x751911bDa88eFcF412326ABE649B7A3b28c4dEDe", decimals: 18 },
            ionRSR: { address: "0xfc6b82668E10AFF62f208C492fc95ef1fa9C0426", decimals: 18 },
            ionWSuperOETHb: { address: "0xC462eb5587062e2f2391990b8609D2428d8Cf598", decimals: 18 },
            ionWUSDM: { address: "0xe30965Acd0Ee1CE2e0Cd0AcBFB3596bD6fC78A51", decimals: 18 },
            ionCbBTC: { address: "0x1De166df671AE6DB4C4C98903df88E8007593748", decimals: 8 },
            ionEURC: { address: "0x0E5A87047F871050c0D713321Deb0F008a41C495", decimals: 18 },
            ionOGN: { address: "0xE00B2B2ca7ac347bc7Ca82fE5CfF0f76222FF375", decimals: 18 },
            ionUSDPlus: { address: "0x74109171033F662D5b898A7a2FcAB2f1EF80c201", decimals: 18 },
            ionUSDz: { address: "0xa4442b665d4c6DBC6ea43137B336e3089f05626C", decimals: 18 },
            ionWUSDPlus: { address: "0xF1bbECD6aCF648540eb79588Df692c6b2F0fbc09", decimals: 18 },
            ionSUSDz: { address: "0xf64bfd19DdCB2Bb54e6f976a233d0A9400ed84eA", decimals: 18 },
            ionUSOL: { address: "0xbd06905590b6E1b6Ac979Fc477A0AebB58d52371", decimals: 18 },
            ionUSUI: { address: "0xAa255Cf8e294BD7fcAB21897C0791e50C99BAc69", decimals: 18 },
            ionFBOMB: { address: "0xd333681242F376f9005d1208ff946C3EE73eD659", decimals: 18 },
            ionKLIMA: { address: "0x600D660440f15EeADbC3fc1403375e04b318F07e", decimals: 9 },
        },
        PoolDirectory: "0xE1A3006be645a80F206311d9f18C866c204bA02f", // Base PoolDirectory
        PoolLens: "0x6ec80f9aCd960b568932696C0F0bE06FBfCd175a", // Base PoolLens
        Comptroller: "0x05c9C6417F246600f8f5f49fcA9Ee991bfF73D13",
        PriceOracle: "0x0Dc808adcE2099A9F62AA87D9670745AbA741746",
    },
    // OP Chain
    10: {
        assets: {
            ionWETH: { address: "0x53b1D15b24d93330b2fD359C798dE7183255e7f2", decimals: 18 },
            ionLUSD: { address: "0x9F4089Ea33773A090ac514934517990dF04ae5a7", decimals: 18 },
            ionUSDC: { address: "0x50549be7e21C3dc0Db03c3AbAb83e1a78d07e6e0", decimals: 6 },
            ionWstETH: { address: "0x2527e8cC363Ef3fd470c6320B22956021cacd149", decimals: 18 },
            ionUSDT: { address: "0xb2918350826C1FB3c8b25A553B5d49611698206f", decimals: 6 },
            ionOP: { address: "0xAec01BB498bec2Fe8f3416314D5E0Db7EC76576b", decimals: 18 },
            ionSNX: { address: "0xe4c5Aeb87762789F854B3Bae7515CF00d77a1f5e", decimals: 18 },
            ionWBTC: { address: "0x863dccAaD60A1105f4B948C67895B4F0411C4497", decimals: 8 },
            ionUSDM: { address: "0xc63B18Fc9025ACC7830B9df05e5A0B208940a3EE", decimals: 18 },
            ionWeETH: { address: "0xC741af01903f39841228dE21d9DdD31Ba604Fec5", decimals: 18 },
        },
        PoolDirectory: "0xBbDcA7858ac2417b06636F7BA35e7d9EA39402ea", // Optimism PoolDirectory
        PoolLens: "0x9c9CB0C521b05b368A11BC3B2AB6adb870D05f87", // Optimism PoolLens
        Comptroller: "0xaFB4A254D125B0395610fdc8f1D022936c7b166B",
        PriceOracle: "0x4d6D585eE00B1DF3F4c16075fE2489566AE3eBc9",
    },
};
