// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
import "./GambitHub.sol";
import "./interfaces/IGambitBadges.sol";

/// @notice Escrow for 1v1 micro-stake chess matches. Oracle-signed result triggers payout.
contract MatchEscrow is ReentrancyGuard, Pausable {
    using ECDSA for bytes32;

    enum MatchState { Pending, Active, Settled, Disputed, Cancelled }

    struct Match {
        address playerA;
        address playerB;
        uint256 stake;
        uint256 createdAt;
        uint256 timeControl; // seconds: blitz=180, rapid=600
        MatchState state;
        address winner;
        bool feesForwarded;
    }

    GambitHub public immutable hub;

    uint256 public matchCount;
    mapping(uint256 => Match) public matches;
    mapping(uint256 => bool)  public resultSubmitted;

    uint256 public constant FORFEIT_GRACE = 3 * 60; // 3 min on-chain guard

    event MatchCreated(uint256 indexed matchId, address indexed playerA, uint256 stake);
    event MatchJoined(uint256 indexed matchId, address indexed playerB);
    event MatchSettled(uint256 indexed matchId, address indexed winner, uint256 payout);
    event MatchCancelled(uint256 indexed matchId);
    event ForfeitClaimed(uint256 indexed matchId, address indexed claimant);

    constructor(address _hub) {
        require(_hub != address(0), "zero addr");
        hub = GambitHub(_hub);
    }

    // ── Match lifecycle ──────────────────────────────────────────────────────

    function createMatch(uint256 timeControl) external payable whenNotPaused returns (uint256 matchId) {
        require(msg.value > 0, "stake required");
        require(timeControl > 0, "invalid tc");
        // FIX: enforce FairPlayHold — flagged players cannot stake
        _revertIfFairPlayHold(msg.sender);

        matchId = ++matchCount;
        matches[matchId] = Match({
            playerA:       msg.sender,
            playerB:       address(0),
            stake:         msg.value,
            createdAt:     block.timestamp,
            timeControl:   timeControl,
            state:         MatchState.Pending,
            winner:        address(0),
            feesForwarded: false
        });
        emit MatchCreated(matchId, msg.sender, msg.value);
    }

    function joinMatch(uint256 matchId) external payable whenNotPaused nonReentrant {
        Match storage m = matches[matchId];
        require(m.state == MatchState.Pending, "not pending");
        require(msg.sender != m.playerA, "cannot self-match");
        require(msg.value == m.stake, "wrong stake");
        // FIX: enforce FairPlayHold for joining player
        _revertIfFairPlayHold(msg.sender);

        m.playerB = msg.sender;
        m.state   = MatchState.Active;
        emit MatchJoined(matchId, msg.sender);
    }

    /// @notice Submit oracle-signed result and pay out winner.
    function settleMatch(
        uint256 matchId,
        address winner,
        bytes calldata sig
    ) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];
        require(m.state == MatchState.Active, "not active");
        require(!resultSubmitted[matchId], "already settled");

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(matchId, winner, block.chainid))
        );
        address signer = ECDSA.recover(digest, sig);
        require(hub.hasRole(hub.ORACLE_ROLE(), signer), "bad oracle sig");

        resultSubmitted[matchId] = true;
        m.state  = MatchState.Settled;
        m.winner = winner;

        uint256 pot    = m.stake * 2;
        uint256 fee    = (pot * hub.matchFeeBps()) / 10_000;
        uint256 payout = pot - fee;

        if (fee > 0) {
            m.feesForwarded = true;
            hub.forwardFees{value: fee}();
        }

        if (winner == address(0)) {
            uint256 half = payout / 2;
            _send(m.playerA, half);
            _send(m.playerB, payout - half);
        } else {
            require(winner == m.playerA || winner == m.playerB, "invalid winner");
            _send(winner, payout);
            // FIX: auto-mint FIRST_WIN badge on first victory
            _tryMintFirstWin(winner);
        }

        emit MatchSettled(matchId, winner, payout);
    }

    function cancelMatch(uint256 matchId) external nonReentrant {
        Match storage m = matches[matchId];
        require(m.state == MatchState.Pending, "not pending");
        require(msg.sender == m.playerA, "not creator");

        m.state = MatchState.Cancelled;
        _send(m.playerA, m.stake);
        emit MatchCancelled(matchId);
    }

    /// @notice Claim forfeit when opponent abandons after on-chain time guard elapses.
    function claimForfeit(
        uint256 matchId,
        bytes calldata lastStateSig
    ) external nonReentrant whenNotPaused {
        Match storage m = matches[matchId];
        require(m.state == MatchState.Active, "not active");
        require(msg.sender == m.playerA || msg.sender == m.playerB, "not player");

        uint256 deadline = m.createdAt + m.timeControl + FORFEIT_GRACE;
        require(block.timestamp >= deadline, "too early");

        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked("forfeit", matchId, msg.sender, block.chainid))
        );
        address signer = ECDSA.recover(digest, lastStateSig);
        require(hub.hasRole(hub.ORACLE_ROLE(), signer), "bad forfeit sig");

        resultSubmitted[matchId] = true;
        m.state         = MatchState.Settled;
        m.winner        = msg.sender;

        uint256 pot    = m.stake * 2;
        uint256 fee    = (pot * hub.matchFeeBps()) / 10_000;
        uint256 payout = pot - fee;

        if (fee > 0) {
            // FIX: set feesForwarded flag before forwarding
            m.feesForwarded = true;
            hub.forwardFees{value: fee}();
        }
        _send(msg.sender, payout);
        // FIX: auto-mint FIRST_WIN badge on forfeit win
        _tryMintFirstWin(msg.sender);

        emit ForfeitClaimed(matchId, msg.sender);
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function pause()   external { require(hub.hasRole(hub.OPERATOR_ROLE(), msg.sender)); _pause(); }
    function unpause() external { require(hub.hasRole(hub.OPERATOR_ROLE(), msg.sender)); _unpause(); }

    // ── Internal ─────────────────────────────────────────────────────────────

    /// @dev Reverts if the player has a FairPlayHold badge (anti-cheat ban).
    function _revertIfFairPlayHold(address player) internal view {
        address badgesAddr = hub.badges();
        if (badgesAddr == address(0)) return;
        require(!IGambitBadges(badgesAddr).hasFairPlayHold(player), "fair-play hold");
    }

    /// @dev Tries to mint FIRST_WIN badge; silently skips if already minted or badges not set.
    function _tryMintFirstWin(address winner) internal {
        address badgesAddr = hub.badges();
        if (badgesAddr == address(0)) return;
        IGambitBadges b = IGambitBadges(badgesAddr);
        if (!b.hasBadge(winner, 1 /* FIRST_WIN */)) {
            try b.mint(winner, 1) {} catch {}
        }
    }

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }

    receive() external payable {}
}
