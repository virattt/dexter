import nacl from "tweetnacl";

export function getPublicKey(orderlyKey: Uint8Array): Uint8Array {
    return nacl.sign.keyPair.fromSeed(orderlyKey).publicKey;
}

export function sign(message: Uint8Array, orderlyKey: Uint8Array): Uint8Array {
    const keyPair = nacl.sign.keyPair.fromSeed(orderlyKey);
    return nacl.sign.detached(message, keyPair.secretKey);
}
