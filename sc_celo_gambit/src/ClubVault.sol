// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./GambitHub.sol";
import "./interfaces/IGambitBadges.sol";

/// @notice Weekly club tournament vault. Collects buy-ins, holds pot, distributes 70/20/10.
contract ClubVault is ReentrancyGuard {

    GambitHub public immutable hub;

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

    uint256 public constant FIRST_BPS      = 7000;
    uint256 public constant SECOND_BPS     = 2000;
    // 10% remainder is rolled to next week as retention hook

    event ClubCreated(uint256 indexed clubId, address indexed creator, uint256 buyIn);
    event MemberJoined(uint256 indexed clubId, address indexed member);
    event ClubSettled(uint256 indexed clubId, address first, address second, uint256 roll);
    event ClubNewWeek(uint256 indexed clubId, uint256 weekStart);

    modifier onlyOperator() {
        require(hub.hasRole(hub.OPERATOR_ROLE(), msg.sender), "not operator");
        _;
    }

    constructor(address _hub) {
        require(_hub != address(0), "zero addr");
        hub = GambitHub(_hub);
    }

    // ── Club lifecycle ───────────────────────────────────────────────────────

    function createClub(uint256 maxMembers) external payable nonReentrant returns (uint256 clubId) {
        require(msg.value > 0, "buy-in required");
        // FIX: minimum 4 members per README spec ("4–8 member")
        require(maxMembers >= 4 && maxMembers <= 8, "4-8 members");

        clubId = ++clubCount;
        Club storage c = clubs[clubId];
        c.creator    = msg.sender;
        c.buyIn      = msg.value;
        c.maxMembers = maxMembers;
        c.weekStart  = block.timestamp;
        c.state      = ClubState.Active;
        c.pot        = msg.value;

        c.members.push(msg.sender);
        isMember[clubId][msg.sender] = true;

        emit ClubCreated(clubId, msg.sender, msg.value);
        emit MemberJoined(clubId, msg.sender);
    }

    function joinClub(uint256 clubId) external payable nonReentrant {
        Club storage c = clubs[clubId];
        require(c.state == ClubState.Active, "not active");
        require(!isMember[clubId][msg.sender], "already member");
        require(c.members.length < c.maxMembers, "club full");
        require(msg.value == c.buyIn, "wrong buy-in");

        c.members.push(msg.sender);
        isMember[clubId][msg.sender] = true;
        c.pot += msg.value;

        emit MemberJoined(clubId, msg.sender);
    }

    /// @notice Operator settles the week. Fee deducted, splits 70/20/10, auto-mints ClubChampion.
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

        if (fee > 0) hub.forwardFees{value: fee}();

        carryover[clubId] = roll;
        c.state = ClubState.Closed;

        _send(first,  toFirst);
        _send(second, toSecond);

        // FIX: auto-mint CLUB_CHAMPION soulbound badge to weekly winner
        _tryMintClubChampion(first);

        emit ClubSettled(clubId, first, second, roll);
    }

    /// @notice Creator resets the club for next week. Members re-join and pay buy-in again.
    /// @dev Carryover from previous week is preserved and added to next settlement pot.
    function startNewWeek(uint256 clubId) external payable nonReentrant {
        Club storage c = clubs[clubId];
        require(c.state == ClubState.Closed, "not closed");
        require(msg.sender == c.creator, "not creator");
        require(msg.value == c.buyIn, "wrong buy-in");

        // Clear old member list and isMember mapping (max 8 iterations — safe)
        for (uint256 i = 0; i < c.members.length; i++) {
            isMember[clubId][c.members[i]] = false;
        }
        delete c.members;

        // Creator re-joins as first member for new week
        c.members.push(msg.sender);
        isMember[clubId][msg.sender] = true;
        c.pot       = msg.value;
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

    function _send(address to, uint256 amount) internal {
        (bool ok,) = to.call{value: amount}("");
        require(ok, "transfer failed");
    }

    receive() external payable {}
}
