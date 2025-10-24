# PlantChain Hardhat

## Setup

- Node 18+
- `npm i`
- Configure secrets (one-time):

```
npx hardhat vars set MNEMONIC "your wallet mnemonic"
npx hardhat vars set INFURA_API_KEY "your infura key"
# optional: etherscan
npx hardhat vars set ETHERSCAN_API_KEY "your etherscan key"
```

## Compile

```
npm run build
```

## Deploy

- Localhost:
```
npx hardhat node
npm run deploy:localhost
```

- Sepolia:
```
npm run deploy:sepolia
```

Deployed addresses are saved under `deployments/`.

