// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./GambitHub.sol";

/// @dev ERC-5192 minimal soulbound interface
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);
    function locked(uint256 tokenId) external view returns (bool);
}

/// @notice Soulbound (ERC-5192) milestone badges for Gambit players.
contract GambitBadges is ERC721, IERC5192 {
    using Strings for uint256;

    GambitHub public immutable hub;

    uint8 public constant FIRST_WIN       = 1;
    uint8 public constant PUZZLE_STREAK_7 = 2;
    uint8 public constant CLUB_CHAMPION   = 3;
    uint8 public constant RATING_1400     = 4;
    uint8 public constant FAIR_PLAY_HOLD  = 5;

    string public baseURI;

    uint256 private _tokenIdCounter;

    mapping(uint256 => uint8) public badgeType;
    mapping(address => mapping(uint8 => uint256)) public playerBadge;

    event BadgeMinted(address indexed player, uint8 indexed bType, uint256 tokenId);
    event FairPlayHoldMinted(address indexed player, uint256 tokenId);

    modifier onlyOperator() {
        require(hub.hasRole(hub.OPERATOR_ROLE(), msg.sender), "not operator");
        _;
    }

    constructor(address _hub, string memory _baseURI) ERC721("GambitBadges", "GMBT") {
        require(_hub != address(0), "zero addr");
        hub     = GambitHub(_hub);
        baseURI = _baseURI;
    }

    // ── ERC-5192 ─────────────────────────────────────────────────────────────

    /// @inheritdoc IERC5192
    function locked(uint256 tokenId) external view override returns (bool) {
        // FIX: verify token actually exists before returning locked status
        require(_ownerOf(tokenId) != address(0), "nonexistent token");
        return true;
    }

    // FIX: declare ERC-5192 support via supportsInterface
    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721)
        returns (bool)
    {
        return interfaceId == 0xb45a3c0e // IERC5192
            || super.supportsInterface(interfaceId);
    }

    // Block all transfers — soulbound
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        require(from == address(0), "soulbound: non-transferable");
        return super._update(to, tokenId, auth);
    }

    // ── Minting ───────────────────────────────────────────────────────────────

    function mint(address player, uint8 bType) external onlyOperator returns (uint256 tokenId) {
        require(bType >= 1 && bType <= 4, "invalid badge type");
        require(playerBadge[player][bType] == 0, "already minted");
        tokenId = _mintBadge(player, bType);
        emit BadgeMinted(player, bType, tokenId);
    }

    function mintFairPlayHold(address player) external onlyOperator returns (uint256 tokenId) {
        require(playerBadge[player][FAIR_PLAY_HOLD] == 0, "already flagged");
        tokenId = _mintBadge(player, FAIR_PLAY_HOLD);
        emit FairPlayHoldMinted(player, tokenId);
    }

    function hasFairPlayHold(address player) external view returns (bool) {
        return playerBadge[player][FAIR_PLAY_HOLD] != 0;
    }

    function hasBadge(address player, uint8 bType) external view returns (bool) {
        return playerBadge[player][bType] != 0;
    }

    // ── Metadata ──────────────────────────────────────────────────────────────

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_ownerOf(tokenId) != address(0), "nonexistent");
        return string(abi.encodePacked(baseURI, uint256(badgeType[tokenId]).toString(), ".json"));
    }

    function setBaseURI(string calldata _uri) external onlyOperator {
        baseURI = _uri;
    }

    // ── Internal ─────────────────────────────────────────────────────────────

    function _mintBadge(address player, uint8 bType) internal returns (uint256 tokenId) {
        tokenId = ++_tokenIdCounter;
        badgeType[tokenId]         = bType;
        playerBadge[player][bType] = tokenId;
        _safeMint(player, tokenId);
        emit Locked(tokenId);
    }
}
