const crypto = require('crypto');
const nacl = require('tweetnacl');
const {
  Address,
  Cell,
  contractAddress,
  loadStateInit,
} = require('@ton/core');
const {
  WalletContractV1R1,
  WalletContractV1R2,
  WalletContractV1R3,
  WalletContractV2R1,
  WalletContractV2R2,
  WalletContractV3R1,
  WalletContractV3R2,
  WalletContractV4,
  WalletContractV5Beta,
  WalletContractV5R1,
} = require('@ton/ton');

const TON_PROOF_PREFIX = Buffer.from('ton-proof-item-v2/', 'utf8');
const TON_CONNECT_PREFIX = Buffer.from('ton-connect', 'utf8');
const ZERO_PUBLIC_KEY = Buffer.alloc(32);

function walletCodeHash(WalletContract) {
  return WalletContract.create({
    workchain: 0,
    publicKey: ZERO_PUBLIC_KEY,
  }).init.code.hash().toString('hex');
}

const WALLET_DATA_LAYOUTS = new Map([
  [walletCodeHash(WalletContractV1R1), { name: 'v1r1', publicKeyOffset: 32 }],
  [walletCodeHash(WalletContractV1R2), { name: 'v1r2', publicKeyOffset: 32 }],
  [walletCodeHash(WalletContractV1R3), { name: 'v1r3', publicKeyOffset: 32 }],
  [walletCodeHash(WalletContractV2R1), { name: 'v2r1', publicKeyOffset: 32 }],
  [walletCodeHash(WalletContractV2R2), { name: 'v2r2', publicKeyOffset: 32 }],
  [walletCodeHash(WalletContractV3R1), { name: 'v3r1', publicKeyOffset: 64 }],
  [walletCodeHash(WalletContractV3R2), { name: 'v3r2', publicKeyOffset: 64 }],
  [walletCodeHash(WalletContractV4), { name: 'v4r2', publicKeyOffset: 64 }],
  [walletCodeHash(WalletContractV5Beta), { name: 'v5beta', publicKeyOffset: 113 }],
  [walletCodeHash(WalletContractV5R1), { name: 'v5r1', publicKeyOffset: 65 }],
]);

function tonProofError(message) {
  return Object.assign(new Error(message), { code: 'TON_PROOF_INVALID' });
}

function parseStateInit(walletStateInit) {
  if (typeof walletStateInit !== 'string' || walletStateInit.length < 16) {
    throw tonProofError('Wallet StateInit is missing');
  }

  let roots;
  try {
    roots = Cell.fromBoc(Buffer.from(walletStateInit, 'base64'));
  } catch {
    throw tonProofError('Wallet StateInit is invalid');
  }

  if (roots.length !== 1) {
    throw tonProofError('Wallet StateInit must contain one root cell');
  }

  let stateInit;
  try {
    stateInit = loadStateInit(roots[0].beginParse());
  } catch {
    throw tonProofError('Wallet StateInit cannot be decoded');
  }

  if (!stateInit.code || !stateInit.data) {
    throw tonProofError('Wallet StateInit has no code or data');
  }

  return stateInit;
}

function extractWalletPublicKey(stateInit) {
  const codeHash = stateInit.code.hash().toString('hex');
  const layout = WALLET_DATA_LAYOUTS.get(codeHash);
  if (!layout) {
    throw tonProofError('Unsupported TON wallet contract');
  }

  const slice = stateInit.data.beginParse();
  if (slice.remainingBits < layout.publicKeyOffset + 256) {
    throw tonProofError('Wallet StateInit data is incomplete');
  }

  return {
    publicKey: slice.skip(layout.publicKeyOffset).loadBuffer(32),
    walletVersion: layout.name,
  };
}

function buildTonProofMessageHash(address, proof) {
  const domainBytes = Buffer.from(proof.domain.value, 'utf8');
  const workchain = Buffer.alloc(4);
  const domainLength = Buffer.alloc(4);
  const timestamp = Buffer.alloc(8);

  workchain.writeInt32BE(address.workChain);
  domainLength.writeUInt32LE(domainBytes.length);
  timestamp.writeBigUInt64LE(BigInt(proof.timestamp));

  const message = Buffer.concat([
    TON_PROOF_PREFIX,
    workchain,
    address.hash,
    domainLength,
    domainBytes,
    timestamp,
    Buffer.from(proof.payload, 'utf8'),
  ]);
  const messageHash = crypto.createHash('sha256').update(message).digest();

  return crypto
    .createHash('sha256')
    .update(Buffer.concat([Buffer.from([0xff, 0xff]), TON_CONNECT_PREFIX, messageHash]))
    .digest();
}

function verifyTonProof({
  account,
  proof,
  expectedDomain,
  expectedPayload,
  expectedNetwork,
  maxAgeSeconds,
  nowSeconds = Math.floor(Date.now() / 1000),
}) {
  if (!account || !proof) throw tonProofError('TON proof is required');
  if (String(account.chain) !== String(expectedNetwork)) {
    throw tonProofError('TON wallet is connected to the wrong network');
  }

  let address;
  try {
    address = Address.parse(account.address);
  } catch {
    throw tonProofError('TON wallet address is invalid');
  }

  const domainValue = String(proof.domain?.value || '');
  const actualDomainLength = Buffer.byteLength(domainValue, 'utf8');
  if (actualDomainLength !== Number(proof.domain?.lengthBytes)) {
    throw tonProofError('TON proof domain length is invalid');
  }
  if (domainValue.toLowerCase() !== expectedDomain.toLowerCase()) {
    throw tonProofError('TON proof domain does not match this application');
  }
  if (String(proof.payload || '') !== expectedPayload) {
    throw tonProofError('TON proof payload is invalid or expired');
  }

  const proofTimestamp = Number(proof.timestamp);
  if (!Number.isInteger(proofTimestamp)) {
    throw tonProofError('TON proof timestamp is invalid');
  }
  if (proofTimestamp > nowSeconds + 60 || proofTimestamp < nowSeconds - maxAgeSeconds) {
    throw tonProofError('TON proof has expired');
  }

  const stateInit = parseStateInit(account.walletStateInit);
  const derivedAddress = contractAddress(address.workChain, stateInit);
  if (!derivedAddress.equals(address)) {
    throw tonProofError('Wallet StateInit does not match the connected address');
  }

  const { publicKey, walletVersion } = extractWalletPublicKey(stateInit);
  if (
    account.publicKey &&
    String(account.publicKey).toLowerCase() !== publicKey.toString('hex')
  ) {
    throw tonProofError('Wallet public key does not match StateInit');
  }

  let signature;
  try {
    signature = Buffer.from(proof.signature, 'base64');
  } catch {
    throw tonProofError('TON proof signature is invalid');
  }
  if (signature.length !== nacl.sign.signatureLength) {
    throw tonProofError('TON proof signature has invalid length');
  }

  const messageHash = buildTonProofMessageHash(address, proof);
  const verified = nacl.sign.detached.verify(messageHash, signature, publicKey);
  if (!verified) throw tonProofError('TON proof signature is invalid');

  return {
    rawAddress: address.toRawString(),
    publicKey: publicKey.toString('hex'),
    walletVersion,
  };
}

module.exports = {
  verifyTonProof,
  _internals: {
    buildTonProofMessageHash,
    extractWalletPublicKey,
    parseStateInit,
    walletDataLayouts: WALLET_DATA_LAYOUTS,
  },
};
