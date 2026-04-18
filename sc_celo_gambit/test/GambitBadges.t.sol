// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/GambitHub.sol";
import "../src/GambitBadges.sol";

contract GambitBadgesTest is Test {
    GambitHub    hub;
    GambitBadges badges;

    address oracle   = makeAddr("oracle");
    address treasury = makeAddr("treasury");
    address operator = address(this);
    address player   = makeAddr("player");
    address rando    = makeAddr("rando");

    function setUp() public {
        hub    = new GambitHub(treasury, oracle);
        badges = new GambitBadges(address(hub), "https://gambit.app/badges/");
    }

    // ── Mint ──────────────────────────────────────────────────────────────────

    function test_MintFirstWin() public {
        uint256 id = badges.mint(player, badges.FIRST_WIN());
        assertEq(id, 1);
        assertEq(badges.ownerOf(1), player);
        assertEq(badges.badgeType(1), badges.FIRST_WIN());
        assertTrue(badges.hasBadge(player, badges.FIRST_WIN()));
    }

    function test_MintAllBadgeTypes() public {
        badges.mint(player, badges.FIRST_WIN());
        badges.mint(player, badges.PUZZLE_STREAK_7());
        badges.mint(player, badges.CLUB_CHAMPION());
        badges.mint(player, badges.RATING_1400());

        for (uint8 i = 1; i <= 4; i++) {
            assertTrue(badges.hasBadge(player, i));
        }
    }

    function test_Mint_OnlyOperator() public {
        uint8 fw = badges.FIRST_WIN();
        vm.prank(rando);
        vm.expectRevert("not operator");
        badges.mint(player, fw);
    }

    function test_Mint_InvalidType_Reverts() public {
        vm.expectRevert("invalid badge type");
        badges.mint(player, 0);

        vm.expectRevert("invalid badge type");
        badges.mint(player, 6);
    }

    function test_Mint_Duplicate_Reverts() public {
        uint8 fw = badges.FIRST_WIN();
        badges.mint(player, fw);
        vm.expectRevert("already minted");
        badges.mint(player, fw);
    }

    // ── FairPlayHold ─────────────────────────────────────────────────────────

    function test_MintFairPlayHold() public {
        uint256 id = badges.mintFairPlayHold(player);
        assertEq(badges.ownerOf(id), player);
        assertTrue(badges.hasFairPlayHold(player));
        assertEq(badges.badgeType(id), badges.FAIR_PLAY_HOLD());
    }

    function test_MintFairPlayHold_Duplicate_Reverts() public {
        badges.mintFairPlayHold(player);
        vm.expectRevert("already flagged");
        badges.mintFairPlayHold(player);
    }

    function test_MintFairPlayHold_OnlyOperator() public {
        vm.prank(rando);
        vm.expectRevert("not operator");
        badges.mintFairPlayHold(player);
    }

    // ── Soulbound (ERC-5192) ──────────────────────────────────────────────────

    function test_Locked_ReturnsTrue() public {
        uint256 id = badges.mint(player, badges.FIRST_WIN());
        assertTrue(badges.locked(id));
    }

    // FIX: locked() on non-existent token must revert, not silently return true
    function test_Locked_NonExistentToken_Reverts() public {
        vm.expectRevert("nonexistent token");
        badges.locked(9999);
    }

    // FIX: supportsInterface must declare ERC-5192 (0xb45a3c0e)
    function test_SupportsInterface_ERC5192() public view {
        assertTrue(badges.supportsInterface(0xb45a3c0e));
    }

    function test_SupportsInterface_ERC721() public view {
        assertTrue(badges.supportsInterface(0x80ac58cd));
    }

    function test_Transfer_Reverts() public {
        uint256 id = badges.mint(player, badges.FIRST_WIN());

        vm.prank(player);
        vm.expectRevert("soulbound: non-transferable");
        badges.transferFrom(player, rando, id);
    }

    function test_SafeTransfer_Reverts() public {
        uint256 id = badges.mint(player, badges.FIRST_WIN());

        vm.prank(player);
        vm.expectRevert("soulbound: non-transferable");
        badges.safeTransferFrom(player, rando, id);
    }

    // ── TokenURI ──────────────────────────────────────────────────────────────

    function test_TokenURI() public {
        uint256 id = badges.mint(player, badges.CLUB_CHAMPION());
        string memory uri = badges.tokenURI(id);
        assertEq(uri, "https://gambit.app/badges/3.json");
    }

    function test_SetBaseURI() public {
        badges.mint(player, badges.FIRST_WIN());
        badges.setBaseURI("https://cdn.gambit.app/meta/");
        assertEq(badges.tokenURI(1), "https://cdn.gambit.app/meta/1.json");
    }

    function test_SetBaseURI_OnlyOperator() public {
        vm.prank(rando);
        vm.expectRevert("not operator");
        badges.setBaseURI("https://evil.com/");
    }

    // ── hasNoFairPlayHold ─────────────────────────────────────────────────────

    function test_NoFairPlayHold_Default() public view {
        assertFalse(badges.hasFairPlayHold(player));
    }
}
