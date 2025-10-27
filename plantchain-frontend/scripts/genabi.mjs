import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '..', 'plantchain-hardhat', 'deployments');
const OUT_DIR = path.resolve(process.cwd(), 'abi');

async function main() {
  try {
    await fs.mkdir(OUT_DIR, { recursive: true });
  } catch {}

  const chains = await fs.readdir(ROOT).catch(() => []);
  const map = {};

  for (const chain of chains) {
    const fp = path.join(ROOT, chain, 'PlantChain.json');
    try {
      const raw = await fs.readFile(fp, 'utf8');
      const json = JSON.parse(raw);
      const chainId = json.chainId || (chain === 'sepolia' ? 11155111 : chain);
      map[chainId.toString()] = {
        address: json.address,
        chainId: chainId,
        chainName: chain,
      };

      // write ABI once
      const abiOut = path.join(OUT_DIR, 'PlantChainABI.ts');
      await fs.writeFile(
        abiOut,
        `export const PlantChainABI = ${JSON.stringify({ abi: json.abi }, null, 2)} as const;\n`
      );
    } catch {}
  }

  const addrOut = path.join(OUT_DIR, 'PlantChainAddresses.ts');
  await fs.writeFile(
    addrOut,
    `export const PlantChainAddresses = ${JSON.stringify(map, null, 2)} as const;\n`
  );

  console.log('[genabi] generated ABI and addresses to', OUT_DIR);
}

main();
