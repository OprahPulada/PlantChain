// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint32, euint64, euint256, externalEuint32, externalEuint64 } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";
import { ERC721 } from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import { Strings } from "@openzeppelin/contracts/utils/Strings.sol";

contract PlantChain is SepoliaConfig, ERC721 {
    using Strings for uint256;

    struct Plant {
        uint256 id;
        address owner;
        string name;
        string species;
        string description;
        string imageCID; // IPFS CID
        uint256 createdAt;
    }

    struct GrowthLogMeta {
        uint256 logId;
        uint256 plantId;
        string description;
        string imageCID; // optional
        uint256 timestamp;
    }

    struct PointLogMeta {
        address from;
        uint64 amount; // typically 1
        uint8 reason;  // 1=create, 2=growthLog, 3=tip
        uint256 timestamp;
    }

    // eco points stored as encrypted counter per user
    mapping(address => euint64) private _ecoPoints; // encrypted totals

    // plants
    uint256 private _nextPlantId = 1;
    mapping(uint256 => Plant) private _plants;
    mapping(address => uint256[]) private _ownerToPlants;

    // growth logs
    uint256 private _nextLogId = 1;
    mapping(uint256 => GrowthLogMeta[]) private _plantLogs;

    // point logs per plant (includes: create, growth log, external tip)
    mapping(uint256 => PointLogMeta[]) private _plantPointLogs;

    // NFT minted state: 1 token per plant
    mapping(uint256 => bool) public plantMinted;

    event PlantCreated(uint256 indexed plantId, address indexed owner, string name, string species, string imageCID, uint256 createdAt);
    event PlantUpdated(uint256 indexed plantId, uint256 indexed logId, string description, string imageCID, uint256 timestamp);
    event EcoPointsChanged(address indexed user); // emits when points changed
    event EcoPointTipped(uint256 indexed plantId, address indexed from, address indexed to, uint64 amount, uint256 timestamp);
    event ViewPointLogsPaid(address indexed payer, uint256 indexed plantId, uint256 value, uint256 timestamp);

    constructor() ERC721("PlantChain", "PLANT") {}

    function createPlant(
        string calldata name,
        string calldata species,
        string calldata description,
        string calldata imageCID
    ) external returns (uint256 plantId) {
        plantId = _nextPlantId++;

        _plants[plantId] = Plant({
            id: plantId,
            owner: msg.sender,
            name: name,
            species: species,
            description: description,
            imageCID: imageCID,
            createdAt: block.timestamp
        });

        _ownerToPlants[msg.sender].push(plantId);

        _incrementPoints(msg.sender, 1);
        // Log creation -> +1 for this plant
        _plantPointLogs[plantId].push(PointLogMeta({ from: msg.sender, amount: 1, reason: 1, timestamp: block.timestamp }));

        emit PlantCreated(plantId, msg.sender, name, species, imageCID, block.timestamp);
    }

    function addGrowthLog(
        uint256 plantId,
        string calldata description,
        string calldata imageCID
    ) external returns (uint256 logId) {
        require(_plants[plantId].owner != address(0), "PLANT_NOT_FOUND");
        require(_plants[plantId].owner == msg.sender, "NOT_OWNER");

        logId = _nextLogId++;
        _plantLogs[plantId].push(GrowthLogMeta({
            logId: logId,
            plantId: plantId,
            description: description,
            imageCID: imageCID,
            timestamp: block.timestamp
        }));

        _incrementPoints(msg.sender, 1);
        // Log growth log -> +1 for this plant
        _plantPointLogs[plantId].push(PointLogMeta({ from: msg.sender, amount: 1, reason: 2, timestamp: block.timestamp }));

        emit PlantUpdated(plantId, logId, description, imageCID, block.timestamp);
    }

    function getPlant(uint256 plantId) external view returns (Plant memory) {
        return _plants[plantId];
    }

    function getGrowthLogs(uint256 plantId) external view returns (GrowthLogMeta[] memory) {
        return _plantLogs[plantId];
    }

    function getPlantPointLogs(uint256 plantId) external view returns (PointLogMeta[] memory) {
        return _plantPointLogs[plantId];
    }

    function getMyPlants(address owner) external view returns (uint256[] memory) {
        return _ownerToPlants[owner];
    }

    // FHE eco points API -----------------------------------------------------
    // external encrypted add: allow front-end to add arbitrary points using FHE input
    function addEcoPoints(
        externalEuint32 inputPoints,
        bytes calldata inputProof
    ) external {
        euint32 addend32 = FHE.fromExternal(inputPoints, inputProof);
        // upgrade to 64-bit to store totals safely
        euint64 addend = FHE.asEuint64(addend32);
        _ecoPoints[msg.sender] = FHE.add(_ecoPoints[msg.sender], addend);
        FHE.allowThis(_ecoPoints[msg.sender]);
        FHE.allow(_ecoPoints[msg.sender], msg.sender);
        emit EcoPointsChanged(msg.sender);
    }

    // Public tip: allow anyone to add encrypted points to a plant owner's eco points.
    // For UX and logging we assume "1 point" tip; front-end encrypts 1 via Relayer SDK.
    function tipEcoPointOne(
        uint256 plantId,
        externalEuint32 inputPoints,
        bytes calldata inputProof
    ) external {
        require(_plants[plantId].owner != address(0), "PLANT_NOT_FOUND");
        address to = _plants[plantId].owner;

        euint32 addend32 = FHE.fromExternal(inputPoints, inputProof);
        euint64 addend = FHE.asEuint64(addend32);

        _ecoPoints[to] = FHE.add(_ecoPoints[to], addend);
        FHE.allowThis(_ecoPoints[to]);
        FHE.allow(_ecoPoints[to], to);

        // Log one-point tip (amount kept as clear for off-chain UI; encrypted value is not decrypted on-chain)
        _plantPointLogs[plantId].push(PointLogMeta({ from: msg.sender, amount: 1, reason: 3, timestamp: block.timestamp }));
        emit EcoPointTipped(plantId, msg.sender, to, 1, block.timestamp);
        emit EcoPointsChanged(to);
    }

    // Optional: a small payable action to "pay before view" from frontend UX.
    // No access control enforced here (frontend will call this before reading logs).
    function payToViewPointLogs(uint256 plantId) external payable {
        require(msg.value > 0, "PAY_FEE");
        emit ViewPointLogsPaid(msg.sender, plantId, msg.value, block.timestamp);
    }

    // trivial encryption increment for 1 point (gas-optimized scalar add)
    function _incrementPoints(address user, uint64 delta) internal {
        _ecoPoints[user] = FHE.add(_ecoPoints[user], delta);
        FHE.allowThis(_ecoPoints[user]);
        FHE.allow(_ecoPoints[user], user);
        emit EcoPointsChanged(user);
    }

    // view encrypted handle (for front-end decrypt or public decrypt)
    function getEcoPoints(address user) external view returns (euint64) {
        return _ecoPoints[user];
    }

    // NFT minting ------------------------------------------------------------
    function mintPlantNFT(uint256 plantId) external {
        require(_plants[plantId].owner == msg.sender, "NOT_OWNER");
        require(!plantMinted[plantId], "ALREADY_MINTED");
        plantMinted[plantId] = true;
        _safeMint(msg.sender, plantId);
    }

    // Minimalistic on-chain tokenURI composition (points + simple meta stub)
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "NOT_MINTED");
        Plant memory p = _plants[tokenId];
        string memory json = string.concat(
            '{',
            '"name":"', p.name, ' #', tokenId.toString(), '",',
            '"description":"Plant growth record NFT",',
            '"image":"ipfs://', p.imageCID, '",',
            '"attributes":[',
            '{"trait_type":"species","value":"', p.species, '"}',
            ']',
            '}'
        );
        return string.concat("data:application/json;utf8,", json);
    }
}
