// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Central registry and fee router for all Gambit contracts.
contract GambitHub is AccessControl, Pausable, ReentrancyGuard {
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");
    bytes32 public constant ORACLE_ROLE   = keccak256("ORACLE_ROLE");

    address public treasury;
    uint256 public matchFeeBps  = 300;  // 3%
    uint256 public clubFeeBps   = 200;  // 2%

    address public puzzlePool;
    address public matchEscrow;
    address public clubVault;
    address public badges;

    event TreasuryUpdated(address indexed prev, address indexed next);
    event ContractRegistered(string name, address addr);
    event FeeBpsUpdated(string name, uint256 bps);
    event FeesForwarded(address indexed to, uint256 amount);

    constructor(address _treasury, address _oracle) {
        require(_treasury != address(0) && _oracle != address(0), "zero addr");
        treasury = _treasury;
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(OPERATOR_ROLE, msg.sender);
        _grantRole(ORACLE_ROLE, _oracle);
    }

    // ── Registry ────────────────────────────────────────────────────────────

    function registerContracts(
        address _puzzlePool,
        address _matchEscrow,
        address _clubVault,
        address _badges
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        puzzlePool  = _puzzlePool;
        matchEscrow = _matchEscrow;
        clubVault   = _clubVault;
        badges      = _badges;
        emit ContractRegistered("PuzzlePool",  _puzzlePool);
        emit ContractRegistered("MatchEscrow", _matchEscrow);
        emit ContractRegistered("ClubVault",   _clubVault);
        emit ContractRegistered("GambitBadges", _badges);
    }

    // ── Fee routing ─────────────────────────────────────────────────────────

    /// @notice Called by MatchEscrow / ClubVault to route protocol fees.
    function forwardFees() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "no value");
        uint256 toPuzzle = msg.value / 2;
        uint256 toTreasury = msg.value - toPuzzle;

        if (puzzlePool != address(0) && toPuzzle > 0) {
            (bool ok,) = puzzlePool.call{value: toPuzzle}("");
            require(ok, "puzzle fwd fail");
        } else {
            toTreasury += toPuzzle;
        }

        (bool ok2,) = treasury.call{value: toTreasury}("");
        require(ok2, "treasury fwd fail");
        emit FeesForwarded(treasury, toTreasury);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setTreasury(address _t) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_t != address(0), "zero addr");
        emit TreasuryUpdated(treasury, _t);
        treasury = _t;
    }

    function setMatchFeeBps(uint256 bps) external onlyRole(OPERATOR_ROLE) {
        require(bps <= 1000, "max 10%");
        matchFeeBps = bps;
        emit FeeBpsUpdated("match", bps);
    }

    function setClubFeeBps(uint256 bps) external onlyRole(OPERATOR_ROLE) {
        require(bps <= 1000, "max 10%");
        clubFeeBps = bps;
        emit FeeBpsUpdated("club", bps);
    }

    function pause()   external onlyRole(OPERATOR_ROLE) { _pause(); }
    function unpause() external onlyRole(OPERATOR_ROLE) { _unpause(); }
}
