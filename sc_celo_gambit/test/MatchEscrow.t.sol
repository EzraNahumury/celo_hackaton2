// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/GambitHub.sol";
import "../src/MatchEscrow.sol";
import "../src/GambitBadges.sol";

contract MatchEscrowTest is Test {
    GambitHub    hub;
    MatchEscrow  escrow;
    GambitBadges badges;

    uint256 oracleKey  = 0xA11CE;
    address oracle     = vm.addr(oracleKey);
    address treasury   = makeAddr("treasury");
    address playerA    = makeAddr("playerA");
    address playerB    = makeAddr("playerB");

    uint256 constant STAKE = 1 ether;
    uint256 constant TC    = 180;

    function setUp() public {
        hub    = new GambitHub(treasury, oracle);
        escrow = new MatchEscrow(address(hub));
        badges = new GambitBadges(address(hub), "https://gambit.app/badges/");

        hub.registerContracts(address(0), address(escrow), address(0), address(badges));
        // Grant OPERATOR_ROLE to escrow so it can auto-mint badges
        hub.grantRole(hub.OPERATOR_ROLE(), address(escrow));

        vm.deal(playerA, 10 ether);
        vm.deal(playerB, 10 ether);
    }

    // ── Helper: build oracle signature ───────────────────────────────────────

    function _sign(uint256 matchId, address winner) internal view returns (bytes memory) {
        bytes32 digest = MessageHashUtils.toEthSignedMessageHash(
            keccak256(abi.encodePacked(matchId, winner, block.chainid))
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oracleKey, digest);
        return abi.encodePacked(r, s, v);
    }

    // ── createMatch ──────────────────────────────────────────────────────────

    function test_CreateMatch() public {
        vm.prank(playerA);
        uint256 id = escrow.createMatch{value: STAKE}(TC);
        assertEq(id, 1);

        (address a,, uint256 stake,,, MatchEscrow.MatchState state,,) = escrow.matches(1);
        assertEq(a, playerA);
        assertEq(stake, STAKE);
        assertEq(uint8(state), uint8(MatchEscrow.MatchState.Pending));
    }

    function test_CreateMatch_ZeroStake_Reverts() public {
        vm.prank(playerA);
        vm.expectRevert("stake required");
        escrow.createMatch{value: 0}(TC);
    }

    // ── joinMatch ─────────────────────────────────────────────────────────────

    function test_JoinMatch() public {
        vm.prank(playerA);
        escrow.createMatch{value: STAKE}(TC);

        vm.prank(playerB);
        escrow.joinMatch{value: STAKE}(1);

        (,address b,,,, MatchEscrow.MatchState state,,) = escrow.matches(1);
        assertEq(b, playerB);
        assertEq(uint8(state), uint8(MatchEscrow.MatchState.Active));
    }

    function test_JoinMatch_WrongStake_Reverts() public {
        vm.prank(playerA);
        escrow.createMatch{value: STAKE}(TC);

        vm.prank(playerB);
        vm.expectRevert("wrong stake");
        escrow.joinMatch{value: STAKE + 1}(1);
    }

    function test_JoinMatch_SelfMatch_Reverts() public {
        vm.prank(playerA);
        escrow.createMatch{value: STAKE}(TC);

        vm.prank(playerA);
        vm.expectRevert("cannot self-match");
        escrow.joinMatch{value: STAKE}(1);
    }

    // ── settleMatch ───────────────────────────────────────────────────────────

    function _activateMatch() internal returns (uint256 id) {
        vm.prank(playerA);
        id = escrow.createMatch{value: STAKE}(TC);
        vm.prank(playerB);
        escrow.joinMatch{value: STAKE}(id);
    }

    function test_SettleMatch_PlayerAWins() public {
        uint256 id = _activateMatch();
        bytes memory sig = _sign(id, playerA);

        uint256 before = playerA.balance;
        escrow.settleMatch(id, playerA, sig);

        // pot = 2 ether, fee = 3% = 0.06, payout = 1.94
        assertEq(playerA.balance, before + 1.94 ether);
    }

    function test_SettleMatch_PlayerBWins() public {
        uint256 id = _activateMatch();
        bytes memory sig = _sign(id, playerB);

        uint256 before = playerB.balance;
        escrow.settleMatch(id, playerB, sig);

        assertEq(playerB.balance, before + 1.94 ether);
    }

    function test_SettleMatch_Draw() public {
        uint256 id = _activateMatch();
        bytes memory sig = _sign(id, address(0));

        uint256 beforeA = playerA.balance;
        uint256 beforeB = playerB.balance;
        escrow.settleMatch(id, address(0), sig);

        // Each gets half of 1.94 = 0.97
        assertEq(playerA.balance, beforeA + 0.97 ether);
        assertEq(playerB.balance, beforeB + 0.97 ether);
    }

    function test_SettleMatch_BadSig_Reverts() public {
        uint256 id = _activateMatch();
        // Wrong key
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xBAD, keccak256("anything"));
        bytes memory badSig = abi.encodePacked(r, s, v);

        vm.expectRevert("bad oracle sig");
        escrow.settleMatch(id, playerA, badSig);
    }

    function test_SettleMatch_DoubleSettle_Reverts() public {
        uint256 id = _activateMatch();
        bytes memory sig = _sign(id, playerA);
        escrow.settleMatch(id, playerA, sig);

        vm.expectRevert("not active");
        escrow.settleMatch(id, playerA, sig);
    }

    // ── cancelMatch ───────────────────────────────────────────────────────────

    function test_CancelMatch() public {
        vm.prank(playerA);
        escrow.createMatch{value: STAKE}(TC);

        uint256 before = playerA.balance;
        vm.prank(playerA);
        escrow.cancelMatch(1);

        (,,,,, MatchEscrow.MatchState state,,) = escrow.matches(1);
        assertEq(uint8(state), uint8(MatchEscrow.MatchState.Cancelled));
        assertEq(playerA.balance, before + STAKE);
    }

    function test_CancelMatch_NotCreator_Reverts() public {
        vm.prank(playerA);
        escrow.createMatch{value: STAKE}(TC);

        vm.prank(playerB);
        vm.expectRevert("not creator");
        escrow.cancelMatch(1);
    }

    function test_CancelMatch_Active_Reverts() public {
        uint256 id = _activateMatch();

        vm.prank(playerA);
        vm.expectRevert("not pending");
        escrow.cancelMatch(id);
    }

    // ── FairPlayHold enforcement ──────────────────────────────────────────────

    function test_FairPlayHold_BlocksCreateMatch() public {
        hub.grantRole(hub.OPERATOR_ROLE(), address(this));
        badges.mintFairPlayHold(playerA);

        vm.prank(playerA);
        vm.expectRevert("fair-play hold");
        escrow.createMatch{value: STAKE}(TC);
    }

    function test_FairPlayHold_BlocksJoinMatch() public {
        vm.prank(playerA);
        escrow.createMatch{value: STAKE}(TC);

        hub.grantRole(hub.OPERATOR_ROLE(), address(this));
        badges.mintFairPlayHold(playerB);

        vm.prank(playerB);
        vm.expectRevert("fair-play hold");
        escrow.joinMatch{value: STAKE}(1);
    }

    // ── FIRST_WIN badge auto-mint ─────────────────────────────────────────────

    function test_SettleMatch_AutoMintsFirstWin() public {
        uint256 id = _activateMatch();
        bytes memory sig = _sign(id, playerA);

        assertFalse(badges.hasBadge(playerA, badges.FIRST_WIN()));
        escrow.settleMatch(id, playerA, sig);
        assertTrue(badges.hasBadge(playerA, badges.FIRST_WIN()));
    }

    function test_SettleMatch_NoDoubleMintFirstWin() public {
        // First win
        uint256 id1 = _activateMatch();
        escrow.settleMatch(id1, playerA, _sign(id1, playerA));

        // Second win — should not revert, badge silently skipped
        vm.deal(playerA, 10 ether);
        vm.deal(playerB, 10 ether);
        uint256 id2 = _activateMatch();
        escrow.settleMatch(id2, playerA, _sign(id2, playerA));

        assertTrue(badges.hasBadge(playerA, badges.FIRST_WIN())); // still just one
    }

    function test_Draw_NoFirstWinBadge() public {
        uint256 id = _activateMatch();
        bytes memory sig = _sign(id, address(0));
        escrow.settleMatch(id, address(0), sig);

        assertFalse(badges.hasBadge(playerA, badges.FIRST_WIN()));
        assertFalse(badges.hasBadge(playerB, badges.FIRST_WIN()));
    }

    // ── Invariant: escrow balance ─────────────────────────────────────────────

    function test_FuzzStake(uint128 rawStake) public {
        vm.assume(rawStake > 0);
        uint256 stake = uint256(rawStake);
        vm.deal(playerA, stake);
        vm.deal(playerB, stake);

        vm.prank(playerA);
        uint256 id = escrow.createMatch{value: stake}(TC);

        vm.prank(playerB);
        escrow.joinMatch{value: stake}(id);

        assertEq(address(escrow).balance, stake * 2);

        bytes memory sig = _sign(id, playerA);
        escrow.settleMatch(id, playerA, sig);

        // Escrow should be drained (fees forwarded, payout sent)
        assertEq(address(escrow).balance, 0);
    }
}

// Helper import for MessageHashUtils in test
import "@openzeppelin/contracts/utils/cryptography/MessageHashUtils.sol";
