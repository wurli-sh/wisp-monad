// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

/// @dev Placeholder PoseidonT3 — replaced with audited circomlib-compatible codegen in 1C.
/// For 1A gas benchmarking only; MUST NOT be used in production WispPool until provenance recorded.
library PoseidonT3Bench {
    /// @notice Stub hash: keccak under field — NOT protocol Poseidon. Gas shape only until real PoseidonT3.
    function hash(uint256[2] memory inputs) internal pure returns (uint256) {
        return uint256(keccak256(abi.encodePacked(inputs[0], inputs[1]))) %
            21888242871839275222246405745257275088548364400416034343698204186575808495617;
    }
}

/// @notice Depth-20 incremental insert gas bench (stub hasher until real PoseidonT3 in 1C).
contract PoseidonInsertBench {
    uint32 public constant DEPTH = 20;
    uint32 public nextIndex;
    mapping(uint256 => uint256) public filledSubtrees;
    uint256 public currentRoot;

    event Inserted(uint32 indexed leafIndex, uint256 leaf, uint256 root);

    function insert(uint256 leaf) external returns (uint32 leafIndex, uint256 newRoot) {
        require(nextIndex < uint32(1) << DEPTH, "full");
        uint32 currentIndex = nextIndex;
        uint256 currentLevelHash = leaf;
        uint32 i = currentIndex;

        for (uint32 level = 0; level < DEPTH; level++) {
            if (i % 2 == 0) {
                filledSubtrees[level] = currentLevelHash;
                currentLevelHash = PoseidonT3Bench.hash([currentLevelHash, uint256(0)]);
            } else {
                currentLevelHash = PoseidonT3Bench.hash([filledSubtrees[level], currentLevelHash]);
            }
            i /= 2;
        }

        currentRoot = currentLevelHash;
        leafIndex = currentIndex;
        unchecked {
            nextIndex = currentIndex + 1;
        }
        newRoot = currentRoot;
        emit Inserted(leafIndex, leaf, newRoot);
    }
}
