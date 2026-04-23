// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title DailyPuzzlePool
 * @notice Immediate cUSD prize claim for daily chess puzzles.
 *
 * Flow:
 *  1. Backend validates puzzle solution.
 *  2. Backend (oracle) signs a voucher: keccak256(player, day, nonce, amount).
 *  3. Frontend submits the voucher to claim().
 *  4. Contract verifies oracle signature, enforces 3-claim daily limit,
 *     marks nonce as used, and transfers cUSD to the player.
 *
 * Nonce = keccak256(puzzleId, playerAddress) — unique per player+puzzle,
 * computed deterministically by the backend, preventing replay attacks.
 */
contract DailyPuzzlePool is ReentrancyGuard {
    using ECDSA for bytes32;

    // ── State ────────────────────────────────────────────────────────────────

    address public immutable oracle; // signs claim vouchers (backend server wallet)
    IERC20  public immutable cusd;   // prize token (cUSD on Celo)

    uint256 public constant MAX_DAILY_CLAIMS = 3;

    /// @dev day (unix_timestamp / 86400) => player => claims used today
    mapping(uint256 => mapping(address => uint256)) public dailyClaims;

    /// @dev nonce => claimed; prevents replay of the same signed voucher
    mapping(bytes32 => bool) public usedNonces;

    // ── Events ───────────────────────────────────────────────────────────────

    event PrizeClaimed(
        address indexed player,
        uint256 indexed day,
        bytes32 nonce,
        uint256 amount
    );
    event Funded(address indexed funder, uint256 amount);

    // ── Constructor ──────────────────────────────────────────────────────────

    constructor(address _oracle, address _cusd) {
        require(_oracle != address(0) && _cusd != address(0), "zero addr");
        oracle = _oracle;
        cusd   = IERC20(_cusd);
    }

    // ── Funding ──────────────────────────────────────────────────────────────

    /**
     * @notice Fund the prize pool. Caller must approve this contract first.
     */
    function fund(uint256 amount) external {
        require(amount > 0, "zero amount");
        cusd.transferFrom(msg.sender, address(this), amount);
        emit Funded(msg.sender, amount);
    }

    // ── Claiming ─────────────────────────────────────────────────────────────

    /**
     * @notice Claim a puzzle prize using a backend-signed voucher.
     *
     * @param day       Unix day index (block.timestamp / 86400) — enforces daily limit.
     * @param nonce     Unique bytes32 per solve; keccak256(puzzleId, player) on backend.
     * @param amount    Prize in cUSD wei (must match what oracle signed).
     * @param signature ECDSA signature by oracle over keccak256(player, day, nonce, amount).
     */
    function claim(
        uint256 day,
        bytes32 nonce,
        uint256 amount,
        bytes calldata signature
    ) external nonReentrant {
        require(!usedNonces[nonce],                                "already claimed");
        require(dailyClaims[day][msg.sender] < MAX_DAILY_CLAIMS,  "daily limit reached");
        require(cusd.balanceOf(address(this)) >= amount,           "pool empty");

        // Verify oracle signature
        bytes32 msgHash  = keccak256(abi.encodePacked(msg.sender, day, nonce, amount));
        bytes32 ethHash  = MessageHashUtils.toEthSignedMessageHash(msgHash);
        address signer   = ECDSA.recover(ethHash, signature);
        require(signer == oracle, "invalid signature");

        // Mark nonce as used and increment daily counter
        usedNonces[nonce] = true;
        dailyClaims[day][msg.sender]++;

        cusd.transfer(msg.sender, amount);

        emit PrizeClaimed(msg.sender, day, nonce, amount);
    }

    // ── View ─────────────────────────────────────────────────────────────────

    function poolBalance() external view returns (uint256) {
        return cusd.balanceOf(address(this));
    }

    function claimsToday(address player) external view returns (uint256) {
        return dailyClaims[block.timestamp / 86400][player];
    }

    function todayIndex() external view returns (uint256) {
        return block.timestamp / 86400;
    }
}
