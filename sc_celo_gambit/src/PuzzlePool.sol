// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import "./GambitHub.sol";

/// @notice Daily prize pool for puzzle leaderboard. Merkle distribution at midnight UTC.
contract PuzzlePool is ReentrancyGuard {

    GambitHub public immutable hub;

    struct Round {
        bytes32 merkleRoot;
        uint256 totalPrize;
        uint256 day;
        bool    distributed; // true once finalizeRound is called for this day
    }

    uint256 public pendingBalance;

    mapping(uint256 => Round)  public rounds;
    mapping(uint256 => mapping(address => bool)) public claimed;

    event SponsorDeposit(address indexed sponsor, uint256 amount, uint256 day);
    event RoundFinalized(uint256 indexed day, bytes32 merkleRoot, uint256 prize);
    event PrizeClaimed(uint256 indexed day, address indexed player, uint256 amount);
    event FeeReceived(uint256 amount);

    modifier onlyOperator() {
        require(hub.hasRole(hub.OPERATOR_ROLE(), msg.sender), "not operator");
        _;
    }

    constructor(address _hub) {
        require(_hub != address(0), "zero addr");
        hub = GambitHub(_hub);
    }

    // ── Funding ──────────────────────────────────────────────────────────────

    function sponsorDeposit() external payable {
        require(msg.value > 0, "zero deposit");
        pendingBalance += msg.value;
        emit SponsorDeposit(msg.sender, msg.value, _today());
    }

    receive() external payable {
        pendingBalance += msg.value;
        emit FeeReceived(msg.value);
    }

    // ── Round management ─────────────────────────────────────────────────────

    /// @notice Operator finalizes the current day and publishes Merkle root of top finishers.
    function finalizeRound(bytes32 merkleRoot) external onlyOperator {
        uint256 day = _today();
        // FIX: only allow finalizing the current day — prevents pre-finalizing future days
        require(rounds[day].totalPrize == 0, "already finalized");
        require(pendingBalance > 0, "empty pool");

        rounds[day] = Round({
            merkleRoot:  merkleRoot,
            totalPrize:  pendingBalance,
            day:         day,
            // FIX: mark round as distributed immediately on finalization
            distributed: true
        });

        pendingBalance = 0;

        emit RoundFinalized(day, merkleRoot, rounds[day].totalPrize);
    }

    // ── Claiming ─────────────────────────────────────────────────────────────

    /// @param day    Unix day index (timestamp / 86400)
    /// @param amount Allocated prize amount (must match Merkle leaf)
    /// @param proof  Merkle proof path
    function claim(
        uint256 day,
        uint256 amount,
        bytes32[] calldata proof
    ) external nonReentrant {
        require(!claimed[day][msg.sender], "already claimed");
        Round storage r = rounds[day];
        require(r.distributed, "round not finalized");
        require(amount <= r.totalPrize, "amount too large");

        bytes32 leaf = keccak256(abi.encodePacked(msg.sender, amount));
        require(MerkleProof.verify(proof, r.merkleRoot, leaf), "invalid proof");

        claimed[day][msg.sender] = true;
        (bool ok,) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        emit PrizeClaimed(day, msg.sender, amount);
    }

    // ── View ─────────────────────────────────────────────────────────────────

    function hasClaimed(uint256 day, address player) external view returns (bool) {
        return claimed[day][player];
    }

    function todayIndex() external view returns (uint256) {
        return _today();
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _today() internal view returns (uint256) {
        return block.timestamp / 86400;
    }
}
