// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "forge-std/Test.sol";
import "../src/DailyPuzzlePool.sol";

contract MockCUSD is IERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    uint256 public totalSupply;

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply    += amount;
    }
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "insufficient");
        balanceOf[msg.sender] -= amount;
        balanceOf[to]         += amount;
        return true;
    }
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "insufficient");
        require(allowance[from][msg.sender] >= amount, "not approved");
        allowance[from][msg.sender] -= amount;
        balanceOf[from]             -= amount;
        balanceOf[to]               += amount;
        return true;
    }
}

contract DailyPuzzlePoolTest is Test {
    DailyPuzzlePool pool;
    MockCUSD        cusd;

    uint256 oraclePk = 0xBEEF;
    address oracle;
    address player = address(0xA1);
    address funder = address(0xA2);

    uint256 constant PRIZE = 0.01 ether; // 0.01 cUSD (18 dec)

    function setUp() public {
        oracle = vm.addr(oraclePk);
        cusd   = new MockCUSD();
        pool   = new DailyPuzzlePool(oracle, address(cusd));

        // Fund the pool
        cusd.mint(funder, 10 ether);
        vm.startPrank(funder);
        cusd.approve(address(pool), 10 ether);
        pool.fund(10 ether);
        vm.stopPrank();
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    function _nonce(string memory puzzleId, address p) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(keccak256(bytes(puzzleId)), p));
    }

    function _sign(address p, uint256 day, bytes32 nonce, uint256 amount)
        internal view returns (bytes memory)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(p, day, nonce, amount));
        bytes32 ethHash = keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", msgHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(oraclePk, ethHash);
        return abi.encodePacked(r, s, v);
    }

    // ── Tests ─────────────────────────────────────────────────────────────────

    function test_claim_success() public {
        uint256 day   = block.timestamp / 86400;
        bytes32 nonce = _nonce("puzzle001", player);
        bytes memory sig = _sign(player, day, nonce, PRIZE);

        vm.prank(player);
        pool.claim(day, nonce, PRIZE, sig);

        assertEq(cusd.balanceOf(player), PRIZE);
        assertTrue(pool.usedNonces(nonce));
        assertEq(pool.dailyClaims(day, player), 1);
    }

    function test_claim_up_to_daily_limit() public {
        uint256 day = block.timestamp / 86400;

        for (uint256 i = 0; i < 3; i++) {
            bytes32 nonce = _nonce(string(abi.encodePacked("puzzle", i)), player);
            bytes memory sig = _sign(player, day, nonce, PRIZE);
            vm.prank(player);
            pool.claim(day, nonce, PRIZE, sig);
        }

        assertEq(cusd.balanceOf(player), PRIZE * 3);
        assertEq(pool.dailyClaims(day, player), 3);
    }

    function test_revert_exceeds_daily_limit() public {
        uint256 day = block.timestamp / 86400;

        for (uint256 i = 0; i < 3; i++) {
            bytes32 nonce = _nonce(string(abi.encodePacked("pz", i)), player);
            vm.prank(player);
            pool.claim(day, nonce, PRIZE, _sign(player, day, nonce, PRIZE));
        }

        bytes32 nonce4 = _nonce("pz4", player);
        vm.prank(player);
        vm.expectRevert("daily limit reached");
        pool.claim(day, nonce4, PRIZE, _sign(player, day, nonce4, PRIZE));
    }

    function test_revert_replay_nonce() public {
        uint256 day   = block.timestamp / 86400;
        bytes32 nonce = _nonce("puzzle001", player);
        bytes memory sig = _sign(player, day, nonce, PRIZE);

        vm.prank(player);
        pool.claim(day, nonce, PRIZE, sig);

        vm.prank(player);
        vm.expectRevert("already claimed");
        pool.claim(day, nonce, PRIZE, sig);
    }

    function test_revert_invalid_signature() public {
        uint256 day   = block.timestamp / 86400;
        bytes32 nonce = _nonce("puzzle001", player);
        // Sign for wrong player
        bytes memory badSig = _sign(address(0xDEAD), day, nonce, PRIZE);

        vm.prank(player);
        vm.expectRevert("invalid signature");
        pool.claim(day, nonce, PRIZE, badSig);
    }

    function test_revert_wrong_day() public {
        uint256 day   = block.timestamp / 86400;
        bytes32 nonce = _nonce("puzzle001", player);
        // Sign for tomorrow's day
        bytes memory sig = _sign(player, day + 1, nonce, PRIZE);

        vm.prank(player);
        vm.expectRevert("invalid signature");
        pool.claim(day, nonce, PRIZE, sig);
    }

    function test_limit_resets_next_day() public {
        uint256 day = block.timestamp / 86400;

        for (uint256 i = 0; i < 3; i++) {
            bytes32 nonce = _nonce(string(abi.encodePacked("d1pz", i)), player);
            vm.prank(player);
            pool.claim(day, nonce, PRIZE, _sign(player, day, nonce, PRIZE));
        }

        // Advance to next day
        vm.warp(block.timestamp + 86400);
        uint256 nextDay = block.timestamp / 86400;

        bytes32 nonce = _nonce("d2pz0", player);
        vm.prank(player);
        pool.claim(nextDay, nonce, PRIZE, _sign(player, nextDay, nonce, PRIZE));

        assertEq(pool.dailyClaims(nextDay, player), 1);
    }

    function test_fund_and_balance() public {
        uint256 bal = pool.poolBalance();
        assertEq(bal, 10 ether);
    }
}
