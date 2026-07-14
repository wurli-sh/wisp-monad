// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IPoseidonT3} from "./poseidon/IPoseidonT3.sol";

interface IGroth16Verifier {
    function verifyProof(
        uint256[2] calldata _pA,
        uint256[2][2] calldata _pB,
        uint256[2] calldata _pC,
        uint256[7] calldata _pubSignals
    ) external view returns (bool);
}

/// @notice Immutable-denomination private note pool with on-chain Poseidon Merkle tree.
contract WispPool is AccessControl, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant SNARK_SCALAR_FIELD =
        21888242871839275222246405745257275088548364400416034343698204186575808495617;
    uint32 public constant TREE_DEPTH = 20;
    uint32 public constant ROOT_HISTORY_SIZE = 4096;
    bytes32 public constant POSEIDON_T3_CODE_HASH = 0x354b26999e434f8256d168395315e1f51fc15bf49bf2e6bb58fc549bd597e7da;
    bytes32 public constant circuitId =
        keccak256("wisp-claim-v1:root,nullifier,recipientAddress,denomination,chainId,poolAddress,recipientBinding");

    bytes32 public constant PAUSER_ROLE = keccak256("PAUSER_ROLE");

    IERC20 public immutable token;
    IGroth16Verifier public immutable verifier;
    IPoseidonT3 public immutable poseidon;
    uint256 public immutable denomination;

    mapping(uint256 => uint256) public filledSubtrees;
    mapping(uint256 => uint256) public zeros;
    mapping(bytes32 => bool) public commitments;
    mapping(bytes32 => bool) public nullifierHashes;
    mapping(bytes32 => uint32) private rootOccurrences;

    uint256 private currentRootValue;
    uint32 public nextLeafIndex;
    uint256[ROOT_HISTORY_SIZE] public roots;
    uint32 public currentRootIndex;
    uint32 public rootsStored;

    event Deposit(bytes32 indexed commitment, uint32 indexed leafIndex, bytes32 root);
    event Claim(bytes32 indexed nullifier, address indexed recipient);

    error InvalidDenomination();
    error ZeroAddress();
    error NoCode();
    error InvalidPoseidon();
    error InvalidCommitment();
    error DuplicateCommitment();
    error TreeFull();
    error UnknownRoot();
    error NullifierSpent();
    error InvalidProof();
    error InvalidField();
    error ZeroRecipient();
    error FeeOnTransfer();

    constructor(address token_, address verifier_, address poseidon_, uint256 denomination_, address admin_) {
        if (token_ == address(0) || verifier_ == address(0) || poseidon_ == address(0) || admin_ == address(0)) {
            revert ZeroAddress();
        }
        if (token_.code.length == 0 || verifier_.code.length == 0 || poseidon_.code.length == 0) {
            revert NoCode();
        }
        if (poseidon_.codehash != POSEIDON_T3_CODE_HASH) revert InvalidPoseidon();
        if (!_isAllowedDenomination(denomination_)) revert InvalidDenomination();

        token = IERC20(token_);
        verifier = IGroth16Verifier(verifier_);
        poseidon = IPoseidonT3(poseidon_);
        denomination = denomination_;

        _grantRole(DEFAULT_ADMIN_ROLE, admin_);
        _grantRole(PAUSER_ROLE, admin_);

        uint256 z = 0;
        for (uint32 i = 0; i < TREE_DEPTH; i++) {
            zeros[i] = z;
            filledSubtrees[i] = z;
            z = _hashLeftRight(z, z);
        }
        currentRootValue = z;
        roots[0] = z;
        rootOccurrences[bytes32(z)] = 1;
        rootsStored = 1;
    }

    function _isAllowedDenomination(uint256 d) internal pure returns (bool) {
        return d == 1e6 || d == 10e6 || d == 50e6 || d == 100e6;
    }

    function _hashLeftRight(uint256 left, uint256 right) internal view returns (uint256) {
        return poseidon.poseidon([left, right]);
    }

    function _isCanonicalField(uint256 v) internal pure returns (bool) {
        return v < SNARK_SCALAR_FIELD;
    }

    function deposit(bytes32 commitment)
        external
        nonReentrant
        whenNotPaused
        returns (uint32 leafIndex, bytes32 newRoot)
    {
        uint256 c = uint256(commitment);
        if (c == 0 || !_isCanonicalField(c)) revert InvalidCommitment();
        if (commitments[commitment]) revert DuplicateCommitment();
        if (nextLeafIndex >= uint32(1) << TREE_DEPTH) revert TreeFull();

        uint256 balBefore = token.balanceOf(address(this));
        token.safeTransferFrom(msg.sender, address(this), denomination);
        if (token.balanceOf(address(this)) != balBefore + denomination) revert FeeOnTransfer();

        commitments[commitment] = true;

        uint32 currentIndex = nextLeafIndex;
        uint256 currentLevelHash = c;
        uint32 i = currentIndex;

        for (uint32 level = 0; level < TREE_DEPTH; level++) {
            if (i % 2 == 0) {
                filledSubtrees[level] = currentLevelHash;
                currentLevelHash = _hashLeftRight(currentLevelHash, zeros[level]);
            } else {
                currentLevelHash = _hashLeftRight(filledSubtrees[level], currentLevelHash);
            }
            i /= 2;
        }

        currentRootValue = currentLevelHash;
        uint32 newRootIndex = (currentRootIndex + 1) % ROOT_HISTORY_SIZE;
        if (rootsStored == ROOT_HISTORY_SIZE) {
            rootOccurrences[bytes32(roots[newRootIndex])] -= 1;
        } else {
            rootsStored += 1;
        }
        currentRootIndex = newRootIndex;
        roots[newRootIndex] = currentRootValue;
        rootOccurrences[bytes32(currentRootValue)] += 1;

        leafIndex = currentIndex;
        unchecked {
            nextLeafIndex = currentIndex + 1;
        }
        newRoot = bytes32(currentRootValue);
        emit Deposit(commitment, leafIndex, newRoot);
    }

    function claim(
        uint256[2] calldata a,
        uint256[2][2] calldata b,
        uint256[2] calldata c,
        bytes32 root,
        bytes32 nullifier,
        address recipient,
        bytes32 recipientBinding
    ) external nonReentrant whenNotPaused {
        if (recipient == address(0)) revert ZeroRecipient();
        if (!_isCanonicalField(uint256(root))) revert InvalidField();
        if (!_isCanonicalField(uint256(nullifier))) revert InvalidField();
        if (!_isCanonicalField(uint256(recipientBinding))) revert InvalidField();
        if (!isKnownRoot(root)) revert UnknownRoot();
        if (nullifierHashes[nullifier]) revert NullifierSpent();

        uint256[7] memory pubSignals = [
            uint256(root),
            uint256(nullifier),
            uint256(uint160(recipient)),
            denomination,
            block.chainid,
            uint256(uint160(address(this))),
            uint256(recipientBinding)
        ];

        if (!verifier.verifyProof(a, b, c, pubSignals)) revert InvalidProof();

        nullifierHashes[nullifier] = true;
        token.safeTransfer(recipient, denomination);
        emit Claim(nullifier, recipient);
    }

    function isKnownRoot(bytes32 root) public view returns (bool) {
        return rootOccurrences[root] != 0;
    }

    function currentRoot() external view returns (bytes32) {
        return bytes32(currentRootValue);
    }

    function isSpent(bytes32 nullifier) external view returns (bool) {
        return nullifierHashes[nullifier];
    }

    function pause() external onlyRole(PAUSER_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(PAUSER_ROLE) {
        _unpause();
    }
}
