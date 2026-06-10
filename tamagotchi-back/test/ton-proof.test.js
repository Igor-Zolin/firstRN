const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const test = require('node:test');
const nacl = require('tweetnacl');
const { beginCell, storeStateInit } = require('@ton/core');
const { WalletContractV4, WalletContractV5R1 } = require('@ton/ton');
const {
  verifyTonProof,
  _internals,
} = require('../src/services/ton-proof.service');

const NOW = 1_800_000_000;
const DOMAIN = 'localhost';
const PAYLOAD = 'test-ton-proof-payload';

function createSignedProof(WalletContract = WalletContractV4) {
  const keyPair = nacl.sign.keyPair();
  const wallet = WalletContract.create({
    workchain: 0,
    publicKey: Buffer.from(keyPair.publicKey),
  });
  const walletStateInit = beginCell()
    .store(storeStateInit(wallet.init))
    .endCell()
    .toBoc()
    .toString('base64');
  const proof = {
    timestamp: NOW,
    domain: {
      lengthBytes: Buffer.byteLength(DOMAIN),
      value: DOMAIN,
    },
    payload: PAYLOAD,
    signature: '',
  };
  const messageHash = _internals.buildTonProofMessageHash(wallet.address, proof);
  proof.signature = Buffer.from(
    nacl.sign.detached(messageHash, keyPair.secretKey)
  ).toString('base64');

  return {
    account: {
      address: wallet.address.toRawString(),
      chain: '-3',
      walletStateInit,
      publicKey: Buffer.from(keyPair.publicKey).toString('hex'),
    },
    proof,
  };
}

test('verifies TON proof for a standard v4 wallet', () => {
  const signed = createSignedProof();
  const result = verifyTonProof({
    ...signed,
    expectedDomain: DOMAIN,
    expectedPayload: PAYLOAD,
    expectedNetwork: '-3',
    maxAgeSeconds: 300,
    nowSeconds: NOW,
  });

  assert.equal(result.rawAddress, signed.account.address);
  assert.equal(result.walletVersion, 'v4r2');
  assert.equal(result.publicKey, signed.account.publicKey);
});

test('verifies TON proof for a standard v5r1 wallet', () => {
  const signed = createSignedProof(WalletContractV5R1);
  const result = verifyTonProof({
    ...signed,
    expectedDomain: DOMAIN,
    expectedPayload: PAYLOAD,
    expectedNetwork: '-3',
    maxAgeSeconds: 300,
    nowSeconds: NOW,
  });

  assert.equal(result.walletVersion, 'v5r1');
});

test('rejects a proof signed for another domain', () => {
  const signed = createSignedProof();

  assert.throws(
    () =>
      verifyTonProof({
        ...signed,
        expectedDomain: 'game.example.com',
        expectedPayload: PAYLOAD,
        expectedNetwork: '-3',
        maxAgeSeconds: 300,
        nowSeconds: NOW,
      }),
    /domain does not match/
  );
});

test('rejects an expired proof', () => {
  const signed = createSignedProof();

  assert.throws(
    () =>
      verifyTonProof({
        ...signed,
        expectedDomain: DOMAIN,
        expectedPayload: PAYLOAD,
        expectedNetwork: '-3',
        maxAgeSeconds: 300,
        nowSeconds: NOW + 301,
      }),
    /expired/
  );
});

test('rejects a tampered proof signature', () => {
  const signed = createSignedProof();
  signed.proof.payload = crypto.randomBytes(16).toString('hex');

  assert.throws(
    () =>
      verifyTonProof({
        ...signed,
        expectedDomain: DOMAIN,
        expectedPayload: signed.proof.payload,
        expectedNetwork: '-3',
        maxAgeSeconds: 300,
        nowSeconds: NOW,
      }),
    /signature is invalid/
  );
});
