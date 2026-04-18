// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/GambitHub.sol";
import "../src/ClubVault.sol";

contract ClubVaultTest is Test {
    GambitHub hub;
    ClubVault vault;

    address oracle   = makeAddr("oracle");
    address treasury = makeAddr("treasury");
    address creator  = makeAddr("creator");
    address p2       = makeAddr("p2");
    address p3       = makeAddr("p3");
    address p4       = makeAddr("p4");
    address p5       = makeAddr("p5");

    uint256 constant BUY_IN = 1 ether;

    function setUp() public {
        hub   = new GambitHub(treasury, oracle);
        vault = new ClubVault(address(hub));

        vm.deal(creator, 20 ether);
        vm.deal(p2, 10 ether);
        vm.deal(p3, 10 ether);
        vm.deal(p4, 10 ether);
        vm.deal(p5, 10 ether);
    }

    // ── createClub ────────────────────────────────────────────────────────────

    function test_CreateClub() public {
        vm.prank(creator);
        uint256 id = vault.createClub{value: BUY_IN}(4);

        assertEq(id, 1);
        assertEq(vault.memberCount(1), 1);
        assertTrue(vault.isMember(1, creator));

        (address c, uint256 bi, uint256 mx,,,) = vault.clubs(id);
        assertEq(c, creator);
        assertEq(bi, BUY_IN);
        assertEq(mx, 4);
    }

    function test_CreateClub_ZeroBuyIn_Reverts() public {
        vm.prank(creator);
        vm.expectRevert("buy-in required");
        vault.createClub{value: 0}(4);
    }

    // FIX: README spec says 4–8 members minimum
    function test_CreateClub_MaxMembersOutOfRange_Reverts() public {
        vm.prank(creator);
        vm.expectRevert("4-8 members");
        vault.createClub{value: BUY_IN}(9);

        vm.prank(creator);
        vm.expectRevert("4-8 members");
        vault.createClub{value: BUY_IN}(3); // below minimum of 4
    }

    // ── joinClub ─────────────────────────────────────────────────────────────

    function test_JoinClub() public {
        vm.prank(creator);
        vault.createClub{value: BUY_IN}(4);

        vm.prank(p2);
        vault.joinClub{value: BUY_IN}(1);

        assertEq(vault.memberCount(1), 2);
        assertTrue(vault.isMember(1, p2));
    }

    function test_JoinClub_WrongBuyIn_Reverts() public {
        vm.prank(creator);
        vault.createClub{value: BUY_IN}(4);

        vm.prank(p2);
        vm.expectRevert("wrong buy-in");
        vault.joinClub{value: BUY_IN + 1}(1);
    }

    function test_JoinClub_AlreadyMember_Reverts() public {
        vm.prank(creator);
        vault.createClub{value: BUY_IN}(4);

        vm.prank(creator);
        vm.expectRevert("already member");
        vault.joinClub{value: BUY_IN}(1);
    }

    function test_JoinClub_Full_Reverts() public {
        vm.prank(creator);
        vault.createClub{value: BUY_IN}(4); // max 4

        vm.prank(p2);
        vault.joinClub{value: BUY_IN}(1);
        vm.prank(p3);
        vault.joinClub{value: BUY_IN}(1);
        vm.prank(p4);
        vault.joinClub{value: BUY_IN}(1);

        vm.prank(p5);
        vm.expectRevert("club full");
        vault.joinClub{value: BUY_IN}(1);
    }

    // ── settle ───────────────────────────────────────────────────────────────

    function _twoMemberClub() internal returns (uint256 id) {
        vm.prank(creator);
        id = vault.createClub{value: BUY_IN}(4); // maxMembers=4 satisfies 4-8 spec
        vm.prank(p2);
        vault.joinClub{value: BUY_IN}(id);
    }

    function test_Settle_Payouts() public {
        uint256 id = _twoMemberClub();

        uint256 pot       = BUY_IN * 2;
        uint256 fee       = (pot * 200) / 10_000;
        uint256 afterFee  = pot - fee;
        uint256 expFirst  = (afterFee * 7000) / 10_000;
        uint256 expSecond = (afterFee * 2000) / 10_000;

        uint256 beforeC = creator.balance;
        uint256 beforeP = p2.balance;

        vault.settle(id, creator, p2);

        assertEq(creator.balance, beforeC + expFirst);
        assertEq(p2.balance,      beforeP + expSecond);
    }

    function test_Settle_Carryover() public {
        uint256 id = _twoMemberClub();

        uint256 pot      = BUY_IN * 2;
        uint256 fee      = (pot * 200) / 10_000;
        uint256 afterFee = pot - fee;
        uint256 first    = (afterFee * 7000) / 10_000;
        uint256 second   = (afterFee * 2000) / 10_000;
        uint256 roll     = afterFee - first - second;

        vault.settle(id, creator, p2);
        assertEq(vault.carryover(id), roll);
    }

    function test_Settle_OnlyOperator_Reverts() public {
        uint256 id = _twoMemberClub();

        vm.prank(makeAddr("rando"));
        vm.expectRevert("not operator");
        vault.settle(id, creator, p2);
    }

    function test_Settle_NonMember_Reverts() public {
        uint256 id = _twoMemberClub();

        vm.expectRevert("not members");
        vault.settle(id, creator, p3);
    }

    function test_Settle_SameAddress_Reverts() public {
        uint256 id = _twoMemberClub();

        vm.expectRevert("same address");
        vault.settle(id, creator, creator);
    }

    function test_Settle_AlreadyClosed_Reverts() public {
        uint256 id = _twoMemberClub();
        vault.settle(id, creator, p2);

        vm.expectRevert("not active");
        vault.settle(id, creator, p2);
    }

    // ── startNewWeek ──────────────────────────────────────────────────────────

    function test_StartNewWeek() public {
        uint256 id = _twoMemberClub();
        vault.settle(id, creator, p2);

        // Creator starts new week
        vm.prank(creator);
        vault.startNewWeek{value: BUY_IN}(id);

        (,,,,, ClubVault.ClubState st) = vault.clubs(id);
        assertEq(uint8(st), uint8(ClubVault.ClubState.Active));
        assertEq(vault.memberCount(id), 1);
        assertTrue(vault.isMember(id, creator));
        assertFalse(vault.isMember(id, p2)); // old members cleared
    }

    function test_StartNewWeek_MembersRejoin() public {
        uint256 id = _twoMemberClub();
        vault.settle(id, creator, p2);

        vm.prank(creator);
        vault.startNewWeek{value: BUY_IN}(id);

        vm.prank(p2);
        vault.joinClub{value: BUY_IN}(id);

        assertEq(vault.memberCount(id), 2);
    }

    function test_StartNewWeek_CarryoverIncluded() public {
        uint256 id = _twoMemberClub();
        vault.settle(id, creator, p2);

        uint256 savedRoll = vault.carryover(id);
        assertTrue(savedRoll > 0);

        // Start new week and add another member
        vm.prank(creator);
        vault.startNewWeek{value: BUY_IN}(id);
        vm.prank(p2);
        vault.joinClub{value: BUY_IN}(id);

        // Settle again — pot = 2 buy-ins + carryover
        uint256 pot      = BUY_IN * 2 + savedRoll;
        uint256 fee      = (pot * 200) / 10_000;
        uint256 afterFee = pot - fee;
        uint256 expFirst = (afterFee * 7000) / 10_000;

        uint256 before = creator.balance;
        vault.settle(id, creator, p2);
        assertEq(creator.balance, before + expFirst);
    }

    function test_StartNewWeek_NotClosed_Reverts() public {
        uint256 id = _twoMemberClub();

        vm.prank(creator);
        vm.expectRevert("not closed");
        vault.startNewWeek{value: BUY_IN}(id);
    }

    function test_StartNewWeek_NotCreator_Reverts() public {
        uint256 id = _twoMemberClub();
        vault.settle(id, creator, p2);

        vm.prank(p2);
        vm.expectRevert("not creator");
        vault.startNewWeek{value: BUY_IN}(id);
    }

    function test_StartNewWeek_WrongBuyIn_Reverts() public {
        uint256 id = _twoMemberClub();
        vault.settle(id, creator, p2);

        vm.prank(creator);
        vm.expectRevert("wrong buy-in");
        vault.startNewWeek{value: BUY_IN + 1}(id);
    }

    // ── getMembers ────────────────────────────────────────────────────────────

    function test_GetMembers() public {
        vm.prank(creator);
        vault.createClub{value: BUY_IN}(4);
        vm.prank(p2);
        vault.joinClub{value: BUY_IN}(1);
        vm.prank(p3);
        vault.joinClub{value: BUY_IN}(1);

        address[] memory members = vault.getMembers(1);
        assertEq(members.length, 3);
        assertEq(members[0], creator);
        assertEq(members[1], p2);
        assertEq(members[2], p3);
    }
}
