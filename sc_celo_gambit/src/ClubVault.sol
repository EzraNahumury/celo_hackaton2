// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./GambitHub.sol";
import "./interfaces/IGambitBadges.sol";

/// @notice Weekly club tournament vault. Collects buy-ins in cUSD, holds pot, distributes 70/20/10.
contract ClubVault is ReentrancyGuard {

    GambitHub public immutable hub;
    IERC20    public immutable token; // cUSD

    enum ClubState { Active, Closed }

    struct Club {
        address creator;
        uint256 buyIn;
        uint256 maxMembers;  // 4–8 per README spec
        uint256 weekStart;
        uint256 pot;
        ClubState state;
        address[] members;
    }

    uint256 public clubCount;
    mapping(uint256 => Club) public clubs;
    mapping(uint256 => mapping(address => bool)) public isMember;
    mapping(uint256 => uint256) public carryover;

    uint256 public constant FIRST_BPS  = 7000;
    uint256 public constant SECOND_BPS = 2000;
    // 10% remainder is rolled to next week as retention hook

    event ClubCreated(uint256 indexed clubId, address indexed creator, uint256 buyIn);
    event MemberJoined(uint256 indexed clubId, address indexed member);
    event ClubSettled(uint256 indexed clubId, address first, address second, uint256 roll);
    event ClubNewWeek(uint256 indexed clubId, uint256 weekStart);

    modifier onlyOperator() {
        require(hub.hasRole(hub.OPERATOR_ROLE(), msg.sender), "not operator");
        _;
    }

    constructor(address _hub, address _token) {
        require(_hub != address(0) && _token != address(0), "zero addr");
        hub   = GambitHub(_hub);
        token = IERC20(_token);
    }

    // ── Club lifecycle ───────────────────────────────────────────────────────

    function createClub(uint256 maxMembers, uint256 buyIn) external nonReentrant returns (uint256 clubId) {
        require(buyIn > 0, "buy-in required");
        require(maxMembers >= 4 && maxMembers <= 8, "4-8 members");
        token.transferFrom(msg.sender, address(this), buyIn);

        clubId = ++clubCount;
        Club storage c = clubs[clubId];
        c.creator    = msg.sender;
        c.buyIn      = buyIn;
        c.maxMembers = maxMembers;
        c.weekStart  = block.timestamp;
        c.state      = ClubState.Active;
        c.pot        = buyIn;

        c.members.push(msg.sender);
        isMember[clubId][msg.sender] = true;

        emit ClubCreated(clubId, msg.sender, buyIn);
        emit MemberJoined(clubId, msg.sender);
    }

    function joinClub(uint256 clubId) external nonReentrant {
        Club storage c = clubs[clubId];
        require(c.state == ClubState.Active, "not active");
        require(!isMember[clubId][msg.sender], "already member");
        require(c.members.length < c.maxMembers, "club full");
        token.transferFrom(msg.sender, address(this), c.buyIn);

        c.members.push(msg.sender);
        isMember[clubId][msg.sender] = true;
        c.pot += c.buyIn;

        emit MemberJoined(clubId, msg.sender);
    }

    /// @notice Operator settles the week. Fee sent to treasury, splits 70/20/10, auto-mints ClubChampion.
    function settle(
        uint256 clubId,
        address first,
        address second
    ) external onlyOperator nonReentrant {
        Club storage c = clubs[clubId];
        require(c.state == ClubState.Active, "not active");
        require(isMember[clubId][first] && isMember[clubId][second], "not members");
        require(first != second, "same address");

        uint256 pot      = c.pot + carryover[clubId];
        uint256 fee      = (pot * hub.clubFeeBps()) / 10_000;
        uint256 afterFee = pot - fee;

        uint256 toFirst  = (afterFee * FIRST_BPS)  / 10_000;
        uint256 toSecond = (afterFee * SECOND_BPS) / 10_000;
        uint256 roll     = afterFee - toFirst - toSecond;

        if (fee > 0) token.transfer(hub.treasury(), fee);

        carryover[clubId] = roll;
        c.state = ClubState.Closed;

        token.transfer(first,  toFirst);
        token.transfer(second, toSecond);

        _tryMintClubChampion(first);

        emit ClubSettled(clubId, first, second, roll);
    }

    /// @notice Creator resets the club for next week. Members re-join and pay buy-in again.
    function startNewWeek(uint256 clubId) external nonReentrant {
        Club storage c = clubs[clubId];
        require(c.state == ClubState.Closed, "not closed");
        require(msg.sender == c.creator, "not creator");
        token.transferFrom(msg.sender, address(this), c.buyIn);

        // Clear old member list (max 8 iterations — safe)
        for (uint256 i = 0; i < c.members.length; i++) {
            isMember[clubId][c.members[i]] = false;
        }
        delete c.members;

        c.members.push(msg.sender);
        isMember[clubId][msg.sender] = true;
        c.pot       = c.buyIn;
        c.weekStart = block.timestamp;
        c.state     = ClubState.Active;

        emit ClubNewWeek(clubId, block.timestamp);
        emit MemberJoined(clubId, msg.sender);
    }

    // ── View ─────────────────────────────────────────────────────────────────

    function getMembers(uint256 clubId) external view returns (address[] memory) {
        return clubs[clubId].members;
    }

    function memberCount(uint256 clubId) external view returns (uint256) {
        return clubs[clubId].members.length;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _tryMintClubChampion(address winner) internal {
        address badgesAddr = hub.badges();
        if (badgesAddr == address(0)) return;
        IGambitBadges b = IGambitBadges(badgesAddr);
        if (!b.hasBadge(winner, 3 /* CLUB_CHAMPION */)) {
            try b.mint(winner, 3) {} catch {}
        }
    }
}
