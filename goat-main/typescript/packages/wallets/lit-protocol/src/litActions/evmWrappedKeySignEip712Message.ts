/**
 * Signs a message with the Ethers wallet which is also decrypted inside the Lit Action.
 *
 * @jsParam pkpAddress - The Eth address of the PKP which is associated with the Wrapped Key
 * @jsParam ciphertext - For the encrypted Wrapped Key
 * @jsParam dataToEncryptHash - For the encrypted Wrapped Key
 * @jsParam messageToSign - The unsigned message to be signed by the Wrapped Key
 * @jsParam accessControlConditions - The access control condition that allows only the pkpAddress to decrypt the Wrapped Key
 *
 * @returns { Promise<string> } - Returns a message signed by the Ethers Wrapped key. Or returns errors if any.
 */
export const signEip712MessageLitActionCode = `
const LIT_PREFIX = "lit_";

async function getDecryptedKeyToSingleNode({
  accessControlConditions,
  ciphertext,
  dataToEncryptHash,
}) {
  try {
    // May be undefined, since we're using \`decryptToSingleNode\`
    return await Lit.Actions.decryptToSingleNode({
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
      chain: "ethereum",
      authSig: null,
    });
  } catch (err) {
    throw new Error(\`When decrypting key to a single node - \${err.message}\`);
  }
}

function removeSaltFromDecryptedKey(decryptedPrivateKey) {
  if (!decryptedPrivateKey.startsWith(LIT_PREFIX)) {
    throw new Error(
      \`PKey was not encrypted with salt; all wrapped keys must be prefixed with '\${LIT_PREFIX}'\`
    );
  }

  return decryptedPrivateKey.slice(LIT_PREFIX.length);
}

async function signMessageEthereumKey({ privateKey, messageToSign }) {
  const wallet = new ethers.Wallet(privateKey);
  const { domain, types, message } = JSON.parse(messageToSign);
  return wallet._signTypedData(domain, types, message);
}

(async () => {
  try {
    const decryptedPrivateKey = await getDecryptedKeyToSingleNode({
      accessControlConditions,
      ciphertext,
      dataToEncryptHash,
    });

    if (!decryptedPrivateKey) {
      // Silently exit on nodes which didn't run the \`decryptToSingleNode\` code
      return;
    }

    const privateKey = removeSaltFromDecryptedKey(decryptedPrivateKey);

    let signature = await signMessageEthereumKey({
      privateKey,
      messageToSign,
    });

    Lit.Actions.setResponse({ response: signature });
  } catch (err) {
    Lit.Actions.setResponse({ response: \`Error: \${err.message}\` });
  }
})();
`;
