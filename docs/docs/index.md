# Welcome

> SDK is in beta. Libraries may be unstable and APIs are subject to change.

The WindingTree Market Protocol facilitates coordination and deal management for buyers and sellers. This SDK provides essential software tools to configure and construct the protocol actors, streamlining the implementation of its workflow. For a comprehensive understanding of the protocol's operation, explore the detailed documentation available at this [link](/docs/protocol.md).

## Protocol Smart Contracts - Polygon zkEVM

### Smart Contract Instances

- Config: [0x098b1d12cAfE7315C77b6d308A62ce02806260Ee](https://explorer.public.zkevm-test.net/address/0x098b1d12cAfE7315C77b6d308A62ce02806260Ee/read-proxy#address-tabs) - Protocol configuration smart contract
- EntitiesRegistry: [0x4bB51528C83844b509E1152EEb05260eE1bf60e6](https://explorer.public.zkevm-test.net/address/0x4bB51528C83844b509E1152EEb05260eE1bf60e6/read-proxy#address-tabs) - Protocol identity management
- Market: [0xDd5B6ffB3585E109ECddec5293e31cdc1e9DeD57](https://explorer.public.zkevm-test.net/address/0xDd5B6ffB3585E109ECddec5293e31cdc1e9DeD57/read-proxy#address-tabs) - Protocol entry point
- LIF: [0x4d60F4483BaA654CdAF1c5734D9E6B16735efCF8](https://explorer.public.zkevm-test.net/address/0x4d60F4483BaA654CdAF1c5734D9E6B16735efCF8/read-proxy#address-tabs) - Test version of LIF token

### Testing Tokens

- `STABLE6`: [ERC20, 6 decimals, no permit](https://explorer.public.zkevm-test.net/address/0x8CB96383609C56af1Fe44DB7591F94AEE2fa43b2/read-proxy#address-tabs)
- `STABLE6PERMIT`: [ERC20, 6 decimals, with permit](https://explorer.public.zkevm-test.net/address/0x4556d5C1486d799f67FA96c84F1d0552486CAAF4/read-proxy#address-tabs)
- `STABLE18`: [ERC20, 18 decimals, no permit](https://explorer.public.zkevm-test.net/address/0x4EcB659060Da61D795D777bb21BAe3599b301C66/read-proxy#address-tabs)
- `STABLE18PERMIT`: [ERC20, 18 decimals, with permit](https://explorer.public.zkevm-test.net/address/0xF54784206A53EF19fd3024D8cdc7A6251A4A0d67/read-proxy#address-tabs)

## Protocol Addresses

During this stage of protocol development, we do not offer online server instances. Instead, for testing and developing with the protocol SDK, you have the flexibility to deploy your own instances using the code examples provided in the SDK repository. This empowers developers to have complete control over their testing environments, fostering a more dynamic and productive development process. If you encounter any difficulties during deployment or have questions about the code examples, our documentation and support team are here to assist you at every step of the way.

## Configuration

### Peer Key Generation

The peer key is a crucial component of the peer-to-peer security schema. It serves the purpose of peer identification and is instrumental in establishing secure connections between peers.

To generate a new peer key, use the following script:

```bash
pnpm gen:key
```

The generated key consists of three components:

- **ID**: A unique identifier for the peer, distinguishing it from others in the network.
- **Public Key (pubKey)**: Intended to be shared openly for verifying message authenticity and establishing secure connections.
- **Private Key (privKey)**: Must be kept confidential and only known to the peer it belongs to. Essential for decrypting incoming messages and ensuring communication security.

Handle the private key with extreme care and never share it with anyone else. Proper management of the peer key is crucial for maintaining a secure and robust peer-to-peer network.

> It is necessary to generate a peer key specifically for the protocol coordination server. However, the protocol nodes and clients are equipped to generate their peer keys automatically every time they start.

### Server Address (multiaddr) Generation

Once you have generated a peer key for your server, you can create a server address that clients and protocol nodes can use to establish connections with your server.

To generate a server address, use the following script:

```bash
pnpm gen:address --ip 127.0.0.1 --port 3333 --id QmQkjfoGnUGdq...8o75N89opSfgBeM
```

The resulting server address will have the format: `/ip4/127.0.0.1/tcp/3333/ws/p2p/QmQkjfoGnUGdq...8o75N89opSfgBeM`.

The address components are as follows:

- `/ip4/127.0.0.1`: Represents the IP address of the server. Replace `127.0.0.1` with the public IP or domain name of your server in a production environment.
- `/tcp/3333`: Indicates the transport protocol (TCP) and the port number (`3333`) on which the server listens for incoming connections. Replace `3333` with your server's actual port number.
- `/ws`: Specifies that the server uses WebSocket as the communication protocol, commonly used for real-time web applications.
- `/p2p/QmQkjfoGnUGdq...8o75N89opSfgBeM`: The unique identifier (peer ID) for your server, generated during the 'Peer Key Generation' step. Peers use this ID to identify and securely connect to your server.

This server address allows clients and protocol nodes to connect to your server and access its services.

### Coordination Server Configuration

For setting up a coordination server using the Winding Tree SDK, use this TypeScript code snippet:

```typescript
import { ServerOptions } from '@windingtree/sdk-server';
import { memoryStorage, ... } from '@windingtree/storage';
import { serverPeerKey } from './path/to/config.js';

const serverOptions: ServerOptions = {
  port: 33333, // Specify the desired port
  peerKey: serverPeerKey, // Use the key generated during 'Peer Key Generation' step
  /**
   * Choose from the available storage engines in '@windingtree/storage' or implement your own
   **/
  messagesStorageInit: memoryStorage.createInitializer(),
};
```

With this configuration, your coordination server will handle incoming connections from peers and facilitate secure communication among them.

### Supplier Node Configuration

For a supplier node configuration in the protocol, use this example:

```typescript
import { NodeOptions } from '@windingtree/sdk-node';
import { serverAddress } from './path/to/config.js';

const nodeOptions: NodeOptions = {
  topics: ['topic'], // List of topics on which the node listens for incoming requests. You can use H3 geohash as a topic, for example.
  chain, // Blockchain network configuration. See the `Chain` type from `viem/chains`.
  contracts: contractsConfig, // See the `Contracts` type from `@windingtree/type`.
  serverAddress, // Server multiaddr.
  supplierId, // Unique supplier ID that is registered in the protocol smart contract.
  signerSeedPhrase: '<SIGNER_WALLET_SEED_PHRASE>', // Seed phrase for the signer wallet. Used to sign transactions.
  signerPk: signerPk, // Optional. You can provide it instead of signerSeedPhrase.
};
```

Explanation of properties in the node configuration:

1. **Topics**: The `topics` property is an array defining the topics on which the node listens for incoming requests. Topics are used to categorize and route messages efficiently, such as using H3 geohash as a topic.

2. **Chain**: The `chain` property represents the configuration for the blockchain network. It includes essential details like the node URL, contract addresses, and other parameters required to interact with the blockchain. Refer to the `Chain` type from `viem/chains` for specific type details.

3. **Contracts**: The `contracts` property contains the configuration related to smart contracts. It defines how the node interacts with the underlying blockchain's smart contracts.

4. **Server Address**: The `serverAddress` property holds the multiaddr of the server generated earlier. It specifies the address at which the server can be reached by other peers in the network.

5. **Supplier ID**: The `supplierId` property is a unique identifier for the supplier node. It is generated as a bytes32-formatted string, which is a keccak hash of the node owner's Ethereum account address and a unique salt string.

6. **Signer Seed Phrase/PK**: The `signerSeedPhrase` property holds the seed phrase for the signer wallet. This seed phrase is used to sign transactions on the blockchain. Alternatively, you can provide the `signerPk` property, which represents the public key of the signer wallet.

Please replace the placeholders (`<SIGNER_WALLET_SEED_PHRASE>`, etc.) with actual values based on your implementation.

To generate the `supplierId`, use the Node Manager app example, which likely provides a user interface to facilitate the generation process.

With this configuration, your supplier node will be ready to participate in the protocol, interact with the blockchain, and communicate with other peers in the protocol network.

### Client Node Configuration

Below is a minimal example of the configuration for a protocol client:

```typescript
import { ClientOptions } from '@windingtree/sdk-client';
import { serverAddress } from './path/to/config.js';

const clientOptions: ClientOptions = {
  serverAddress,
};
```

In this configuration, we only have one property:

1. **Server Address**: The `serverAddress` property is the multiaddr of the server to which the client will connect. This address specifies the location of the server in the peer-to-peer network and allows the client to establish a connection for communication.

This setup provides the basic configuration for a protocol client. Depending on your specific requirements and use case, you may explore additional options available in the client chapter of the documentation to fine-tune the behavior and capabilities of the client node.

## SDK Development

- [WindingTree protocol discussions](https://github.com/windingtree/sdk/discussions)
- Bug tracker: [https://github.com/windingtree/sdk/issues](https://github.com/windingtree/sdk/issues)
- [Contribution](/docs/contribution.md)

Please keep in mind that the SDK is currently in beta, and libraries may be unstable with APIs subject to change. As you explore the functionalities and contribute to the development, we encourage you to participate in the discussions and provide valuable feedback to help improve the SDK's stability and performance. If you encounter any issues or have questions during your development journey, do not hesitate to reach out to our support team, who are available to assist you at every step.

Let's build the future of decentralized coordination together!
