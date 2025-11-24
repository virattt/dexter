type VaultMapping = {
    [tokenAddress: string]: string;
};

const VAULT_ADDRESSES: VaultMapping = {
    "0x4200000000000000000000000000000000000006": "0x3117c7854d11cB0216c82B81934CAaFe0722BB44", // WETH
    "0xDfc7C877a950e49D2610114102175A06C2e3167a": "0xF7BC8B00a065943dC8D7B63E9632D7F987731C05", // MODE
    "0xd988097fb8612cc24eeC14542bC03424c656005f": "0x882fD369341FC435ad5E54e91d1ebC23b1Fc6d4C", // USDC
    "0xf0F161fDA2712DB8b566946122a5af183995e2eD": "0xc9cfB5221eE50098BD8882727522301A62C7b021", // USDT
    "0x2416092f143378750bb29b79eD961ab195CcEea5": "0xd9139c2dba16513eAd360658496c9c8223158Cd5", // ezETH
};

export function getVaultAddress(tokenAddress: string): string {
    // Store addresses in lowercase for comparison
    const normalizedAddresses = Object.keys(VAULT_ADDRESSES).reduce((acc, key) => {
        acc[key.toLowerCase()] = VAULT_ADDRESSES[key];
        return acc;
    }, {} as VaultMapping);

    const vault = normalizedAddresses[tokenAddress.toLowerCase()];
    if (!vault) throw new Error(`No vault found for token address ${tokenAddress}`);
    return vault;
}
