# PlantChain Frontend

## Install

```
npm i
```

## Generate ABI/addresses

```
# expects contracts deployments in ../plantchain-hardhat/deployments
npm run genabi
```

## Run (Local Mock)

1. Start local FHEVM Hardhat node and deploy PlantChain in contracts project.
2. In this folder:
```
npm run dev:mock
```

## Run (Sepolia)

1. Deploy contracts to Sepolia in `../plantchain-hardhat`:
```
npm run deploy:sepolia
```
2. Generate ABI/addresses here:
```
npm run genabi
```
3. Start dev server and open the app, connect MetaMask on Sepolia:
```
npm run dev
```


