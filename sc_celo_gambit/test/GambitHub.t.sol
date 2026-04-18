// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/GambitHub.sol";

contract GambitHubTest is Test {
    GambitHub hub;
    address admin    = address(this);
    address oracle   = makeAddr("oracle");
    address treasury = makeAddr("treasury");
    address operator = makeAddr("operator");

    function setUp() public {
        hub = new GambitHub(treasury, oracle);
        hub.grantRole(hub.OPERATOR_ROLE(), operator);
    }

    // ── Deployment ───────────────────────────────────────────────────────────

    function test_DeploymentRoles() public view {
        assertTrue(hub.hasRole(hub.DEFAULT_ADMIN_ROLE(), admin));
        assertTrue(hub.hasRole(hub.OPERATOR_ROLE(), admin));
        assertTrue(hub.hasRole(hub.ORACLE_ROLE(), oracle));
    }

    function test_InitialFees() public view {
        assertEq(hub.matchFeeBps(), 300);
        assertEq(hub.clubFeeBps(), 200);
    }

    function test_Treasury() public view {
        assertEq(hub.treasury(), treasury);
    }

    // ── Registry ─────────────────────────────────────────────────────────────

    function test_RegisterContracts() public {
        address pp = makeAddr("pp");
        address me = makeAddr("me");
        address cv = makeAddr("cv");
        address gb = makeAddr("gb");

        hub.registerContracts(pp, me, cv, gb);

        assertEq(hub.puzzlePool(),  pp);
        assertEq(hub.matchEscrow(), me);
        assertEq(hub.clubVault(),   cv);
        assertEq(hub.badges(),      gb);
    }

    function test_RegisterContracts_OnlyAdmin() public {
        vm.prank(operator);
        vm.expectRevert();
        hub.registerContracts(address(0), address(0), address(0), address(0));
    }

    // ── Fee BPS ──────────────────────────────────────────────────────────────

    function test_SetMatchFee() public {
        vm.prank(operator);
        hub.setMatchFeeBps(500);
        assertEq(hub.matchFeeBps(), 500);
    }

    function test_SetClubFee() public {
        vm.prank(operator);
        hub.setClubFeeBps(100);
        assertEq(hub.clubFeeBps(), 100);
    }

    function test_SetMatchFee_ExceedsMax_Reverts() public {
        vm.prank(operator);
        vm.expectRevert("max 10%");
        hub.setMatchFeeBps(1001);
    }

    function test_SetFee_OnlyOperator() public {
        address rando = makeAddr("rando");
        vm.prank(rando);
        vm.expectRevert();
        hub.setMatchFeeBps(100);
    }

    // ── SetTreasury ───────────────────────────────────────────────────────────

    function test_SetTreasury() public {
        address newT = makeAddr("newT");
        hub.setTreasury(newT);
        assertEq(hub.treasury(), newT);
    }

    function test_SetTreasury_ZeroAddr_Reverts() public {
        vm.expectRevert("zero addr");
        hub.setTreasury(address(0));
    }

    // ── Pause ────────────────────────────────────────────────────────────────

    function test_PauseUnpause() public {
        vm.prank(operator);
        hub.pause();
        assertTrue(hub.paused());

        vm.prank(operator);
        hub.unpause();
        assertFalse(hub.paused());
    }

    function test_ForwardFees_WhenPaused_Reverts() public {
        vm.prank(operator);
        hub.pause();

        vm.deal(address(this), 1 ether);
        vm.expectRevert();
        hub.forwardFees{value: 0.01 ether}();
    }

    // ── ForwardFees ───────────────────────────────────────────────────────────

    function test_ForwardFees_ToTreasuryWhenNoPuzzlePool() public {
        uint256 before = treasury.balance;
        vm.deal(address(this), 1 ether);
        hub.forwardFees{value: 0.1 ether}();
        assertEq(treasury.balance, before + 0.1 ether);
    }

    function test_ForwardFees_SplitWithPuzzlePool() public {
        // Deploy a simple receiver as puzzle pool stand-in
        address pp = makeAddr("puzzlePool");
        vm.deal(pp, 0); // ensure empty
        hub.registerContracts(pp, address(0), address(0), address(0));

        vm.deal(address(this), 1 ether);
        uint256 tBefore  = treasury.balance;
        hub.forwardFees{value: 0.1 ether}();

        // pp receives half, treasury the other half
        assertEq(pp.balance,       0.05 ether);
        assertEq(treasury.balance, tBefore + 0.05 ether);
    }

    function test_ForwardFees_ZeroValue_Reverts() public {
        vm.expectRevert("no value");
        hub.forwardFees{value: 0}();
    }

    // ── Constructor guards ───────────────────────────────────────────────────

    function test_Constructor_ZeroTreasury_Reverts() public {
        vm.expectRevert("zero addr");
        new GambitHub(address(0), oracle);
    }

    function test_Constructor_ZeroOracle_Reverts() public {
        vm.expectRevert("zero addr");
        new GambitHub(treasury, address(0));
    }
}
